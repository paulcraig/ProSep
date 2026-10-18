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
	const [requestBodyText, setRequestBodyText] = useState<string | null>(null)
	const [responseData, setResponseData] = useState<TandemMSResponse | null>(null)

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
		const requestBody = {
			protein_string: sanitizedProteinString,
			protease,
			lower_bound: lowerBound,
			upper_bound: upperBound,
		}
		setRequestBodyText(JSON.stringify(requestBody, null, 2))

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

			{requestBodyText !== null && (
				<Card>
					<CardHeader title='Request Body Sent' />
					<CardContent>
						<Typography
							component='pre'
							variant='body2'
							sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', overflowX: 'auto' }}
						>
							{requestBodyText}
						</Typography>
					</CardContent>
				</Card>
			)}

			{responseData && (
				<Card>
					<CardHeader title='Tandem MS Mass Spectrum' />
					<CardContent>
						<Box sx={{ height: 420, minWidth: 0 }}>
							<Scatter data={chartData} options={chartOptions} plugins={[drawPeakStems]} />
						</Box>
					</CardContent>
				</Card>
			)}
		</Box>
	)
}

export default TandemMS
