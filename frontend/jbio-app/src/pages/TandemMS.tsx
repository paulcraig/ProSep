import React, { useState } from 'react'
import {
	Alert,
	Box,
	Button,
	Card,
	CardContent,
	CardHeader,
	FormControl,
	InputLabel,
	MenuItem,
	Select,
	SelectChangeEvent,
	TextField,
	Typography,
} from '@mui/material'
import { Chart as ChartJS, ChartData, ChartOptions, LinearScale, PointElement, ScatterDataPoint, Tooltip } from 'chart.js'
import { Scatter } from 'react-chartjs-2'
import { API_URL } from '../config'
import NumberField from '../components/ui/NumberField'

ChartJS.register(LinearScale, PointElement, Tooltip)

const PROTEASES = ['Trypsin', 'Chymostrypsin', 'Thermolysin', 'ProteinaseK'] as const

type TandemMSResponse = {
	peaks: Record<string, {
		sequence: string[]
		IonHits: number
	}>
	hits: number
}

type SpectrumPoint = ScatterDataPoint & {
	mzLabel: string
	ionHits: number
	sequences: string[]
}

type Fragment = {
	type: string
	mz: number
}

type FragmentGap = {
	type: string
	frommz: number
	tomz: number
	difference: number
	letter: string
}

type ByPeaksResponse = {
	fragments: Fragment[]
	gaps: FragmentGap[]
}

type SpectrumAnnotation = {
	x: number
	label: string
	type: string
	width: number
	lane: number
}

type FragmentTooltip = {
	x: number
	y: number
	title: string
	details: string[]
}

const ionColor = (type: string) => type.toLowerCase() === 'b' ? '#e34b4b' : '#4d8de0'
const ionLane = (type: string) => type.toLowerCase() === 'b' ? 'b' : 'y'

const isByPeaksResponse = (value: unknown): value is ByPeaksResponse => {
	if (typeof value !== 'object' || value === null || !('fragments' in value) || !('gaps' in value)) {
		return false
	}
	const response = value as { fragments: unknown; gaps: unknown }
	if (!Array.isArray(response.fragments) || !Array.isArray(response.gaps)) return false
	const fragmentsAreValid = response.fragments.every((fragment) =>
		typeof fragment === 'object' && fragment !== null &&
		'type' in fragment && typeof fragment.type === 'string' &&
		'mz' in fragment && typeof fragment.mz === 'number' && Number.isFinite(fragment.mz),
	)
	const gapsAreValid = response.gaps.every((gap) =>
		typeof gap === 'object' && gap !== null &&
		'type' in gap && typeof gap.type === 'string' &&
		'frommz' in gap && typeof gap.frommz === 'number' && Number.isFinite(gap.frommz) &&
		'tomz' in gap && typeof gap.tomz === 'number' && Number.isFinite(gap.tomz) &&
		'difference' in gap && typeof gap.difference === 'number' && Number.isFinite(gap.difference) &&
		'letter' in gap && typeof gap.letter === 'string',
	)
	return fragmentsAreValid && gapsAreValid
}

const FragmentSpectrum: React.FC<{ data: ByPeaksResponse }> = ({ data }) => {
	const [tooltip, setTooltip] = useState<FragmentTooltip | null>(null)
	const fragments = data.fragments
		.filter((fragment) => Number.isFinite(fragment.mz))
		.sort((left, right) => left.mz - right.mz)
	const gaps = data.gaps
		.filter((gap) => Number.isFinite(gap.frommz) && Number.isFinite(gap.tomz))
		.sort((left, right) => Math.min(left.frommz, left.tomz) - Math.min(right.frommz, right.tomz))
	const width = 1100
	const left = 64
	const right = width - 28
	const plotWidth = right - left
	const mzValues = [...fragments.map((fragment) => fragment.mz), ...gaps.flatMap((gap) => [gap.frommz, gap.tomz])]
	const highestMz = mzValues.length ? Math.max(...mzValues) : 0
	const xAxisMax = highestMz > 0 ? highestMz * 1.1 : 100
	const xForMz = (mz: number) => left + (mz / xAxisMax) * plotWidth
	const axisTicks = Array.from({ length: Math.floor(xAxisMax / 100) + 1 }, (_, index) => {
		const value = index * 100
		return {
			x: left + (value / xAxisMax) * plotWidth,
			value,
		}
	})

	const lastGapRightByLane: Record<'b' | 'y', number[]> = { b: [], y: [] }
	const gapAnnotations: SpectrumAnnotation[] = gaps.map((gap) => {
		const x1 = xForMz(Math.min(gap.frommz, gap.tomz))
		const x2 = xForMz(Math.max(gap.frommz, gap.tomz))
		const center = (x1 + x2) / 2
		const label = gap.letter
		const estimatedWidth = Math.max(28, label.length * 8)
		const type = ionLane(gap.type)
		let lane = lastGapRightByLane[type].findIndex((occupiedRight) => occupiedRight + 8 < center - estimatedWidth / 2)
		if (lane < 0) lane = lastGapRightByLane[type].length
		lastGapRightByLane[type][lane] = center + estimatedWidth / 2
		return { x: center, label, type: gap.type, width: estimatedWidth, lane }
	})
	const outerGapIndexes: Record<'b' | 'y', { left: number; right: number }> = {
		b: { left: -1, right: -1 },
		y: { left: -1, right: -1 },
	}
	gaps.forEach((gap, index) => {
		const lane = ionLane(gap.type)
		const leftMz = Math.min(gap.frommz, gap.tomz)
		const rightMz = Math.max(gap.frommz, gap.tomz)
		const currentLeftIndex = outerGapIndexes[lane].left
		const currentRightIndex = outerGapIndexes[lane].right
		if (currentLeftIndex < 0 || leftMz < Math.min(gaps[currentLeftIndex].frommz, gaps[currentLeftIndex].tomz)) {
			outerGapIndexes[lane].left = index
		}
		if (currentRightIndex < 0 || rightMz > Math.max(gaps[currentRightIndex].frommz, gaps[currentRightIndex].tomz)) {
			outerGapIndexes[lane].right = index
		}
	})

	const bGapLaneCount = lastGapRightByLane.b.length
	const yGapLaneCount = lastGapRightByLane.y.length
	const gapBandSeparator = bGapLaneCount > 0 && yGapLaneCount > 0 ? 1 : 0
	const gapLaneCount = bGapLaneCount + yGapLaneCount + gapBandSeparator
	const plotTop = 48 + gapLaneCount * 34
	const baseline = plotTop + 190
	const height = baseline + 56
	const connectorY = (lane: 'b' | 'y') => {
		const barHeight = baseline - plotTop
		const heightFraction = lane === 'b' ? 0.15 : 0.4
		return plotTop + barHeight * heightFraction
	}
	const gapLabelY = (type: string, lane: number) => {
		const normalizedType = ionLane(type)
		const laneOffset = normalizedType === 'b' ? 0 : bGapLaneCount + gapBandSeparator
		return 24 + (laneOffset + lane) * 34
	}

	return (
		<Box sx={{ width: '100%', overflowX: 'auto' }}>
			<Box sx={{ position: 'relative', minWidth: 720 }}>
			<svg
				viewBox={`0 0 ${width} ${height}`}
				role='img'
				aria-label='Fragment mass spectrum'
				style={{ display: 'block', width: '100%', height: 'auto' }}
				onMouseLeave={() => setTooltip(null)}
			>
				<defs>
					<marker id='fragment-arrow-start-b' markerWidth='6' markerHeight='6' refX='5' refY='3' orient='auto' markerUnits='strokeWidth'>
						<path d='M 0 0 L 6 3 L 0 6 z' fill='#e34b4b' />
					</marker>
					<marker id='fragment-arrow-end-b' markerWidth='6' markerHeight='6' refX='1' refY='3' orient='auto' markerUnits='strokeWidth'>
						<path d='M 6 0 L 0 3 L 6 6 z' fill='#e34b4b' />
					</marker>
					<marker id='fragment-arrow-start-out-b' markerWidth='6' markerHeight='6' refX='1' refY='3' orient='auto' markerUnits='strokeWidth'>
						<path d='M 6 0 L 0 3 L 6 6 z' fill='#e34b4b' />
					</marker>
					<marker id='fragment-arrow-end-out-b' markerWidth='6' markerHeight='6' refX='5' refY='3' orient='auto' markerUnits='strokeWidth'>
						<path d='M 0 0 L 6 3 L 0 6 z' fill='#e34b4b' />
					</marker>
					<marker id='fragment-arrow-start-y' markerWidth='6' markerHeight='6' refX='5' refY='3' orient='auto' markerUnits='strokeWidth'>
						<path d='M 0 0 L 6 3 L 0 6 z' fill='#4d8de0' />
					</marker>
					<marker id='fragment-arrow-end-y' markerWidth='6' markerHeight='6' refX='1' refY='3' orient='auto' markerUnits='strokeWidth'>
						<path d='M 6 0 L 0 3 L 6 6 z' fill='#4d8de0' />
					</marker>
					<marker id='fragment-arrow-start-out-y' markerWidth='6' markerHeight='6' refX='1' refY='3' orient='auto' markerUnits='strokeWidth'>
						<path d='M 6 0 L 0 3 L 6 6 z' fill='#4d8de0' />
					</marker>
					<marker id='fragment-arrow-end-out-y' markerWidth='6' markerHeight='6' refX='5' refY='3' orient='auto' markerUnits='strokeWidth'>
						<path d='M 0 0 L 6 3 L 0 6 z' fill='#4d8de0' />
					</marker>
				</defs>
				<line x1={left} y1={baseline} x2={right} y2={baseline} stroke='#9aa3ad' />
				<line x1={left} y1={plotTop - 10} x2={left} y2={baseline} stroke='#9aa3ad' />
				<text x={18} y={(plotTop + baseline) / 2} textAnchor='middle' fill='currentColor' fontSize='14' transform={`rotate(-90 18 ${(plotTop + baseline) / 2})`}>Intensity</text>
				<text x={(left + right) / 2} y={height - 12} textAnchor='middle' fill='currentColor' fontSize='14'>m/e</text>
				{axisTicks.map((tick, index) => (
					<g key={`axis-tick-${index}`}>
						<line x1={tick.x} y1={plotTop - 10} x2={tick.x} y2={baseline} stroke='#dfe3e8' strokeDasharray='3 4' />
						<line x1={tick.x} y1={baseline} x2={tick.x} y2={baseline + 5} stroke='#9aa3ad' />
						<text x={tick.x} y={baseline + 20} textAnchor='middle' fill='currentColor' fontSize='11'>{tick.value}</text>
					</g>
				))}

				{fragments.map((fragment, index) => {
					const x = xForMz(fragment.mz)
					const color = ionColor(fragment.type)
					return (
						<g
							key={`fragment-${index}`}
							onMouseEnter={() => setTooltip({
								x,
								y: plotTop,
								title: `${fragment.type.toLowerCase()} ion fragment`,
								details: [`m/e: ${fragment.mz.toFixed(2)}`],
							})}
						>
							<line x1={x} y1={baseline} x2={x} y2={plotTop} stroke='transparent' strokeWidth='10' />
							<line x1={x} y1={baseline} x2={x} y2={plotTop} stroke={color} strokeWidth='2' />
						</g>
					)
				})}

				{gaps.map((gap, index) => {
					const annotation = gapAnnotations[index]
					const x1 = xForMz(Math.min(gap.frommz, gap.tomz))
					const x2 = xForMz(Math.max(gap.frommz, gap.tomz))
					const y = gapLabelY(annotation.type, annotation.lane) + 7
					const color = ionColor(gap.type)
					const lane = ionLane(gap.type)
					const gapConnectorY = connectorY(lane)
					const isLeftOuterGap = outerGapIndexes[lane].left === index
					const isRightOuterGap = outerGapIndexes[lane].right === index
					return (
						<g
							key={`gap-${index}`}
							onMouseEnter={() => setTooltip({
								x: annotation.x,
								y: y + 110,
								title: `${gap.type.toLowerCase()} ion gap`,
								details: [
									`Amino acid: ${gap.letter}`,
									`m/e: ${Math.min(gap.frommz, gap.tomz).toFixed(2)}-${Math.max(gap.frommz, gap.tomz).toFixed(2)}`,
									`Difference: ${gap.difference.toFixed(2)}`,
								],
							})}
						>
							<line x1={x1} y1={gapConnectorY} x2={x2} y2={gapConnectorY} stroke='transparent' strokeWidth='10' />
							<line
								x1={x1}
								y1={gapConnectorY}
								x2={x2}
								y2={gapConnectorY}
								stroke={color}
								strokeWidth='1.5'
								markerStart={`url(#fragment-arrow-${isLeftOuterGap ? 'start-out' : 'start'}-${lane})`}
								markerEnd={`url(#fragment-arrow-${isRightOuterGap ? 'end-out' : 'end'}-${lane})`}
							/>
							<text x={annotation.x} y={gapConnectorY - 8} textAnchor='middle' fill={color} fontSize='12' fontWeight='600'>
								{annotation.label}
							</text>
						</g>
					)
				})}
			</svg>
			{tooltip && (
				<Box
					role='tooltip'
					sx={{
						position: 'absolute',
						left: `${(tooltip.x / width) * 100}%`,
						top: `${(tooltip.y / height) * 100}%`,
						transform: 'translate(-50%, -100%)',
						backgroundColor: 'rgba(0, 0, 0, 0.8)',
						color: '#fff',
						borderRadius: '3px',
						px: 1.5,
						py: 1,
						pointerEvents: 'none',
						zIndex: 1,
						whiteSpace: 'nowrap',
					}}
				>
					<Typography variant='body2' sx={{ fontWeight: 600, lineHeight: 1.4 }}>{tooltip.title}</Typography>
					{tooltip.details.map((detail) => (
						<Typography key={detail} variant='body2' sx={{ lineHeight: 1.4 }}>{detail}</Typography>
					))}
				</Box>
			)}
			</Box>
			<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center', alignItems: 'center', pt: 1 }}>
				<Typography variant='body2' sx={{ fontWeight: 600 }}>Legend:</Typography>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
					<Box sx={{ width: 24, borderTop: '3px solid #e34b4b' }} aria-hidden='true' />
					<Typography variant='body2'>b ions (red)</Typography>
				</Box>
				<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
					<Box sx={{ width: 24, borderTop: '3px solid #4d8de0' }} aria-hidden='true' />
					<Typography variant='body2'>y ions (blue)</Typography>
				</Box>
				<Typography variant='body2' color='text.secondary'>Horizontal lines show amino-acid gaps; vertical lines show fragment masses.</Typography>
			</Box>
		</Box>
	)
}

const isTandemMSResponse = (value: unknown): value is TandemMSResponse => {
	if (typeof value !== 'object' || value === null || !('peaks' in value) || !('hits' in value)) {
		return false
	}
	const response = value as { peaks: unknown; hits: unknown }
	if (typeof response.peaks !== 'object' || response.peaks === null || typeof response.hits !== 'number') {
		return false
	}
	return Object.values(response.peaks).every((peak) => {
		if (typeof peak !== 'object' || peak === null || !('sequence' in peak) || !('IonHits' in peak)) {
			return false
		}
		const typedPeak = peak as { sequence: unknown; IonHits: unknown }
		return Array.isArray(typedPeak.sequence) &&
			typedPeak.sequence.every((sequence) => typeof sequence === 'string') &&
			typeof typedPeak.IonHits === 'number' &&
			Number.isFinite(typedPeak.IonHits)
	})
}

const TandemMS: React.FC = () => {
	const [proteinString, setProteinString] = useState<string>('')
	const [protease, setProtease] = useState<string>(PROTEASES[0])
	const [lowerBound, setLowerBound] = useState<number | null>(0)
	const [upperBound, setUpperBound] = useState<number | null>(3000)
	const [loading, setLoading] = useState<boolean>(false)
	const [error, setError] = useState<string>('')
	const [responseData, setResponseData] = useState<TandemMSResponse | null>(null)
	const [selectedPeak, setSelectedPeak] = useState<SpectrumPoint | null>(null)
	const [selectedSequence, setSelectedSequence] = useState<string>('')
	const [byPeaksLoading, setByPeaksLoading] = useState<boolean>(false)
	const [byPeaksError, setByPeaksError] = useState<string>('')
	const [byPeaksData, setByPeaksData] = useState<ByPeaksResponse | null>(null)

	const sanitizedProteinString = proteinString.toUpperCase()
	const proteinIsValid = /^[A-Z]+$/.test(sanitizedProteinString) || sanitizedProteinString.length === 0
	const proteaseIsValid = PROTEASES.some((allowedProtease) => allowedProtease === protease)
	const boundsAreValid =
		lowerBound !== null &&
		upperBound !== null &&
		Number.isFinite(lowerBound) &&
		Number.isFinite(upperBound) &&
		Number.isInteger(lowerBound) &&
		Number.isInteger(upperBound) &&
		lowerBound >= 0 &&
		lowerBound <= 3000 &&
		upperBound >= 0 &&
		upperBound <= 3000 &&
		lowerBound <= upperBound
	const inputsAreValid = proteinIsValid && proteaseIsValid && boundsAreValid

	const handleRun = async () => {
		if (!inputsAreValid) {
			return
		}

		setLoading(true)
		setError('')
		setResponseData(null)
		setSelectedPeak(null)
		setSelectedSequence('')
		setByPeaksData(null)
		const requestBody = {
			protein_string: sanitizedProteinString,
			protease,
			lower_bound: lowerBound,
			upper_bound: upperBound,
		}

		try {
			const response = await fetch(`${API_URL}/tandem_ms/plot`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(requestBody),
			})

			if (!response.ok) {
				throw new Error(`Request failed with status ${response.status}`)
			}

			const data: unknown = await response.json()
			if (!isTandemMSResponse(data)) {
				throw new Error('Backend returned an unexpected Tandem MS response.')
			}
			setResponseData(data)
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Unexpected error')
		} finally {
			setLoading(false)
		}
	}

	const handleProteaseChange = (event: SelectChangeEvent<string>) => {
		setProtease(event.target.value)
	}

	const handleSpectrumClick = (_event: unknown, elements: { index: number }[]) => {
		const clickedPoint = elements.length > 0 ? spectrumPoints[elements[0].index] : undefined
		if (!clickedPoint) return
		setSelectedPeak(clickedPoint)
		setSelectedSequence(clickedPoint.sequences.length === 1 ? clickedPoint.sequences[0] : '')
		setByPeaksData(null)
		setByPeaksError('')
	}

	const handlePlotFragments = async () => {
		if (!selectedSequence) return
		setByPeaksLoading(true)
		setByPeaksError('')
		try {
			const response = await fetch(`${API_URL}/tandem_ms/by_peaks`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(selectedSequence),
			})
			if (!response.ok) {
				throw new Error(`Request failed with status ${response.status}`)
			}
			const result: unknown = await response.json()
			if (!isByPeaksResponse(result)) {
				throw new Error('Backend returned an unexpected sequence fragment response.')
			}
			setByPeaksData(result as ByPeaksResponse)
		} catch (err) {
			setByPeaksError(err instanceof Error ? err.message : 'Unexpected error')
		} finally {
			setByPeaksLoading(false)
		}
	}

	const spectrumPoints: SpectrumPoint[] = responseData
		? Object.entries(responseData.peaks)
			.map(([mzLabel, peak]) => ({
				x: Number(mzLabel),
				y: peak.IonHits,
				mzLabel,
				ionHits: peak.IonHits,
				sequences: peak.sequence,
			}))
			.filter((point) => Number.isFinite(point.x))
			.sort((left, right) => left.x - right.x)
		: []

	const chartData: ChartData<'scatter', SpectrumPoint[]> = {
		datasets: [{
			label: 'Ion hits',
			data: spectrumPoints,
			showLine: false,
			pointRadius: 0,
			pointHitRadius: 10,
			backgroundColor: '#75d6c2',
		}],
	}

	const drawPeakStems = {
		id: 'tandemMsPeakStems',
		beforeDatasetsDraw(chart: ChartJS<'scatter'>) {
			const dataset = chart.data.datasets[0]
			if (!dataset) return

			const xScale = chart.scales.x
			const yScale = chart.scales.y
			const context = chart.ctx
			context.save()
			context.strokeStyle = '#75d6c2'
			context.lineWidth = 1.5
			for (const rawPoint of dataset.data) {
				const point = rawPoint as SpectrumPoint
				const mz = Number(point.x)
				const intensity = Number(point.y)
				context.beginPath()
				context.moveTo(xScale.getPixelForValue(mz), yScale.getPixelForValue(0))
				context.lineTo(xScale.getPixelForValue(mz), yScale.getPixelForValue(intensity))
				context.stroke()
			}
			context.restore()
		},
	}

	const chartOptions: ChartOptions<'scatter'> = {
		responsive: true,
		maintainAspectRatio: false,
		interaction: { mode: 'nearest', intersect: false, axis: 'x' },
		onClick: handleSpectrumClick,
		scales: {
			x: {
				type: 'linear',
				min: 0,
				title: { display: true, text: 'm/e' },
			},
			y: {
				beginAtZero: true,
				title: { display: true, text: 'I' },
				ticks: { precision: 0 },
			},
		},
		plugins: {
			tooltip: {
				callbacks: {
					title: (items) => {
						const point = items[0]?.raw as SpectrumPoint | undefined
						return point ? `m/e: ${point.mzLabel}` : ''
					},
					label: (item) => {
						const point = item.raw as SpectrumPoint
						return [`Ion hits: ${point.ionHits}`, 'Sequences:', ...point.sequences.map((sequence) => `  ${sequence}`)]
					},
				},
			},
		},
	}

	return (
		<Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
			<Card>
				<CardHeader title='Tandem Mass Spectrometry' />
				<CardContent>
					<Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
						<TextField
							label='Protein sequence'
							value={proteinString}
							onChange={(event) => setProteinString(event.target.value)}
							multiline
							minRows={4}
							fullWidth
							required
						/>

						<Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'flex-start' }}>
							<FormControl>
								<InputLabel id='tandem-ms-protease-label'>Protease</InputLabel>
								<Select
									labelId='tandem-ms-protease-label'
									value={protease}
									label='Protease'
									onChange={handleProteaseChange}
								>
									{PROTEASES.map((name) => (
										<MenuItem key={name} value={name}>{name}</MenuItem>
									))}
								</Select>
							</FormControl>

							<NumberField
								label='Lower bound'
								value={lowerBound}
								min={0}
								max={3000}
								step={1}
								onValueChange={setLowerBound}
							/>
							<NumberField
								label='Upper bound'
								value={upperBound}
								min={0}
								max={3000}
								step={1}
								onValueChange={setUpperBound}
							/>
						</Box>
						{!proteinIsValid && (
							<Alert severity='error'>Protein sequence must contain letters only.</Alert>
						)}
						{!proteaseIsValid && (
							<Alert severity='error'>Select one of the available proteases.</Alert>
						)}
						{!boundsAreValid && (
							<Alert severity='error'>Bounds must be integers from 0 to 3000, and the lower bound cannot exceed the upper bound.</Alert>
						)}
						{error && <Alert severity='error'>{error}</Alert>}

						<Box>
							<Button
								variant='contained'
								onClick={handleRun}
								disabled={loading || !inputsAreValid}
							>
								{loading ? 'Sending request...' : 'Run Tandem MS'}
							</Button>
						</Box>
					</Box>
				</CardContent>
			</Card>

			{responseData && (
				<Card>
					<CardHeader title='Tandem MS Mass Spectrum' />
					<CardContent>
						<Box sx={{ height: 420, minWidth: 0 }}>
							<Scatter data={chartData} options={chartOptions} plugins={[drawPeakStems]} />
						</Box>
						{selectedPeak && (
							<Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2, mt: 2 }}>
								<Typography variant='body2'>Selected m/e: {selectedPeak.mzLabel}</Typography>
								<FormControl size='small' sx={{ minWidth: 220 }}>
									<InputLabel id='tandem-ms-sequence-label'>Sequence</InputLabel>
									<Select
										labelId='tandem-ms-sequence-label'
										value={selectedSequence}
										label='Sequence'
										onChange={(event) => setSelectedSequence(event.target.value)}
									>
										{selectedPeak.sequences.map((sequence, index) => (
											<MenuItem key={`${sequence}-${index}`} value={sequence}>{sequence}</MenuItem>
										))}
									</Select>
								</FormControl>
								<Button variant='contained' onClick={handlePlotFragments} disabled={!selectedSequence || byPeaksLoading}>
									{byPeaksLoading ? 'Loading fragments...' : 'Plot selected sequence'}
								</Button>
							</Box>
						)}
						{byPeaksError && <Alert severity='error' sx={{ mt: 2 }}>{byPeaksError}</Alert>}
					</CardContent>
				</Card>
			)}

			{byPeaksData && (
				<Card>
					<CardHeader title={`Fragments for ${selectedSequence}`} />
					<CardContent sx={{ pt: 1 }}>
						{byPeaksData.fragments.length > 0
							? <FragmentSpectrum data={byPeaksData} />
							: <Typography variant='body2'>No fragments returned for this sequence.</Typography>}
					</CardContent>
				</Card>
			)}
		</Box>
	)
}

export default TandemMS
