import React, { Suspense, lazy, useCallback, useMemo, useRef, useState } from 'react'
import {
    Accordion,
    AccordionDetails,
    AccordionSummary,
    Alert,
    Box,
    Button,
    Card,
    CardContent,
    CardHeader,
    FormControl,
    FormControlLabel,
    InputLabel,
    MenuItem,
    Select,
    Slider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableSortLabel,
    TableRow,
    TextField,
    Typography,
    Switch,
    Chip,
    CircularProgress,
    InputAdornment,
} from '@mui/material'
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LineElement, LinearScale, LogarithmicScale, PointElement, Tooltip } from 'chart.js'
import { API_URL } from '../config'
import { ExpandMore, FileUpload, Download, PlayArrow, SettingsOutlined, Search } from '@mui/icons-material'
import NumberField from '../components/ui/NumberField'

ChartJS.register(CategoryScale, LinearScale, LogarithmicScale, BarElement, LineElement, PointElement, Tooltip, Legend)

type MediaType = 'Q' | 'S'

type ProteinDto = {
    id: string
    name: string
    description: string
    sequence: string
    molecularWeight: number
    charge: number
    color: string
    amount: number
}

type FractionDto = {
    fractionIndex: number
    proteinCount?: number
    hitCount?: number
    hitProteinIds?: string[]
    proteins: ProteinDto[]
}

type ParamsDto = {
    pH: number
    mediaType: MediaType
    exchanger: 'anion' | 'cation'
    fractions: number
    overlap: number
    deadband: number
}

type CountsDto = {
    total: number
    wash: number
    retained: number
    skipped: number
}

type IonExchangeResponse = {
    ok: boolean
    params: ParamsDto
    counts: CountsDto
    wash: ProteinDto[]
    fractions: FractionDto[]
    error?: string
}

type SortDirection = 'asc' | 'desc'

type FractionSortKey = 'fractionIndex' | 'proteinCount' | 'hitCount'
type ProteinSortKey = 'charge' | 'molecularWeight'

const MAX_STACKED_SERIES = 200

const LazyBar = lazy(() => import('react-chartjs-2').then(module => ({ default: module.Bar })))
const LazyLine = lazy(() => import('react-chartjs-2').then(module => ({ default: module.Line })))
const LazyScatter = lazy(() =>
    import('react-chartjs-2').then(module => ({
        default: module.Scatter,
    })),
)

const ChartLoadingPlaceholder: React.FC<{ chartName: string }> = ({ chartName }) => {
    return (
        <Box className='ionx-chart-loading'>
            <CircularProgress size={34} thickness={4.5} />
            <Typography variant='body2'>Loading {chartName}</Typography>
        </Box>
    )
}

const IonExchangeFractionation: React.FC = () => {
    const [fastaText, setFastaText] = useState<string>('')
    const [ph, setPh] = useState<number>(7.0)
    const [mediaType, setMediaType] = useState<MediaType>('Q')
    const [fractionCount, setFractionCount] = useState<number>(80)
    const [noise, setNoise] = useState<number>(0.1)
    const [deadband, setDeadband] = useState<number>(0.05)
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<string>('')
    const [data, setData] = useState<IonExchangeResponse | null>(null)

    const [fractionPage, setFractionPage] = useState<number>(0)
    const [fractionRowsPerPage, setFractionRowsPerPage] = useState<number>(10)
    const [proteinPage, setProteinPage] = useState<number>(0)
    const [proteinRowsPerPage, setProteinRowsPerPage] = useState<number>(10)
    const [showLineGraph, setShowLineGraph] = useState<boolean>(true)
    const [useLogScale, setUseLogScale] = useState<boolean>(true)
    const [showWash, setShowWash] = useState<boolean>(false)
    const [fractionSort, setFractionSort] = useState<{
        key: FractionSortKey
        direction: SortDirection
    }>({
        key: 'fractionIndex',
        direction: 'asc',
    })
    const [proteinSort, setProteinSort] = useState<{
        key: ProteinSortKey
        direction: SortDirection
    }>({
        key: 'charge',
        direction: 'asc',
    })
    const [fractionSearch, setFractionSearch] = useState<string>('')
    const [proteinSearch, setProteinSearch] = useState<string>('')

    const lineChartRef = useRef<ChartJS<'line'> | null>(null)
    const scatterChartRef = useRef<ChartJS<'scatter'> | null>(null)
    const stackedChartRef = useRef<ChartJS<'bar'> | null>(null)

    const downloadChart = useCallback((chart: ChartJS | null, fileName: string) => {
        if (!chart) {
            return
        }

        const canvas = chart.canvas
        const exportCanvas = document.createElement('canvas')
        exportCanvas.width = canvas.width
        exportCanvas.height = canvas.height

        const exportCtx = exportCanvas.getContext('2d')
        if (!exportCtx) {
            return
        }

        exportCtx.fillStyle = '#ffffff'
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
        exportCtx.drawImage(canvas, 0, 0)

        const base64Image = exportCanvas.toDataURL('image/png')

        const a = document.createElement('a')
        a.href = base64Image
        a.download = fileName
        a.click()
    }, [])

    const exportChromatogram = useCallback(() => {
        const activeChart = showLineGraph ? lineChartRef.current : scatterChartRef.current
        downloadChart(activeChart, 'chromatogram.png')
    }, [downloadChart, showLineGraph])

    const exportStackedProteins = useCallback(() => {
        downloadChart(stackedChartRef.current, 'stacked-proteins.png')
    }, [downloadChart])

    const handleLoadFasta = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) {
            return
        }

        const text = await file.text()
        setFastaText(text)
        event.target.value = ''
    }

    const handleRunFractionation = async () => {
        setLoading(true)
        setError('')

        try {
            const response = await fetch(`${API_URL}/ion_exchange_fractionation/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fasta_content: fastaText,
                    ph,
                    media_type: mediaType,
                    fraction_count: fractionCount,
                    noise,
                    deadband,
                }),
            })

            const json = (await response.json()) as IonExchangeResponse
            if (!response.ok || !json.ok || json.error) {
                throw new Error(json.error || 'Failed to process ion exchange fractionation.')
            }

            setData(json)
            setProteinPage(0)
            setFractionPage(0)
        } catch (err) {
            setData(null)
            setError(err instanceof Error ? err.message : 'Unexpected error')
        } finally {
            setLoading(false)
        }
    }

    const fractionRows = useMemo(() => data?.fractions ?? [], [data])

    const retainedRows = useMemo(() => {
        const byKey = new Map<string, ProteinDto>()
        for (const fraction of fractionRows) {
            for (const protein of fraction.proteins) {
                byKey.set(`${protein.id}::${protein.sequence}`, protein)
            }
        }
        return Array.from(byKey.values()).sort((a, b) => Math.abs(a.charge) - Math.abs(b.charge))
    }, [fractionRows])

    const filteredFractionRows = useMemo(() => {
        const query = fractionSearch.trim().toLowerCase()
        if (!query) {
            return fractionRows
        }

        return fractionRows.filter(row => {
            const hitIds = (row.hitProteinIds ?? []).join(' ').toLowerCase()

            return hitIds.includes(query)
        })
    }, [fractionRows, fractionSearch])

    const sortedFractionRows = useMemo(() => {
        const rows = [...filteredFractionRows]
        const directionMultiplier = fractionSort.direction === 'asc' ? 1 : -1

        rows.sort((a, b) => {
            const aValue = fractionSort.key === 'fractionIndex' ? a.fractionIndex : fractionSort.key === 'proteinCount' ? (a.proteinCount ?? a.proteins.length) : (a.hitCount ?? 0)

            const bValue = fractionSort.key === 'fractionIndex' ? b.fractionIndex : fractionSort.key === 'proteinCount' ? (b.proteinCount ?? b.proteins.length) : (b.hitCount ?? 0)

            return (aValue - bValue) * directionMultiplier
        })

        return rows
    }, [filteredFractionRows, fractionSort])

    const filteredRetainedRows = useMemo(() => {
        const query = proteinSearch.trim().toLowerCase()
        if (!query) {
            return retainedRows
        }

        return retainedRows.filter(row => {
            return row.name.toLowerCase().includes(query) || row.sequence.toLowerCase().includes(query) || row.description.toLowerCase().includes(query)
        })
    }, [retainedRows, proteinSearch])

    const sortedRetainedRows = useMemo(() => {
        const rows = [...filteredRetainedRows]
        const directionMultiplier = proteinSort.direction === 'asc' ? 1 : -1

        rows.sort((a, b) => {
            const aValue = proteinSort.key === 'charge' ? a.charge : a.molecularWeight
            const bValue = proteinSort.key === 'charge' ? b.charge : b.molecularWeight

            return (aValue - bValue) * directionMultiplier
        })

        return rows
    }, [filteredRetainedRows, proteinSort])

    const handleFractionSort = (key: FractionSortKey, direction: SortDirection) => {
        setFractionSort({ key, direction })
        setFractionPage(0)
    }

    const handleProteinSort = (key: ProteinSortKey, direction: SortDirection) => {
        setProteinSort({ key, direction })
        setProteinPage(0)
    }

    const pagedProteins = useMemo(() => {
        const start = proteinPage * proteinRowsPerPage
        return sortedRetainedRows.slice(start, start + proteinRowsPerPage)
    }, [sortedRetainedRows, proteinPage, proteinRowsPerPage])

    const pagedFractions = useMemo(() => {
        const start = fractionPage * fractionRowsPerPage
        return sortedFractionRows.slice(start, start + fractionRowsPerPage)
    }, [sortedFractionRows, fractionPage, fractionRowsPerPage])

    const proteinSeriesPoints = useMemo(() => {
        const points: Array<{ x: number; y: number }> = []

        if (showWash) {
            points.push({ x: 0, y: data?.wash?.length ?? 0 })
        }

        for (const fraction of fractionRows) {
            points.push({
                x: fraction.fractionIndex,
                y: fraction.proteins.map(p => p.amount).reduce((a, b) => a + b, 0),
            })
        }
        const maxY = Math.max(...points.map(p => p.y), 1)
        for (const point of points) {
            point.y = Math.round((point.y / maxY) * 100) / 100
        }
        return points
    }, [data, fractionRows, showWash])

    const scatterData = useMemo(() => {
        return {
            datasets: [
                {
                    label: 'Proteins per fraction',
                    data: proteinSeriesPoints,
                    backgroundColor: 'rgba(107, 224, 57, 0.8)',
                    pointRadius: 4,
                },
            ],
        }
    }, [proteinSeriesPoints])

    const lineData = useMemo(() => {
        return {
            datasets: [
                {
                    label: 'Proteins per fraction',
                    data: proteinSeriesPoints,
                    borderColor: 'rgba(107, 224, 57, 1)',
                    backgroundColor: 'rgba(107, 224, 57, 0.8)',
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    tension: 0.1,
                    fill: false,
                },
            ],
        }
    }, [proteinSeriesPoints])

    const stackedHitAmounts = useMemo(() => {
        const proteinColorById = new Map<string, string>()
        const proteinTotals = new Map<string, number>()
        const fractionAmountMaps: Array<Map<string, number>> = []
        const labels: string[] = []
        const baseOtherData: number[] = []

        const washAmountByProteinId = new Map<string, number>()
        let washOtherTotal = 0
        for (const protein of data?.wash ?? []) {
            washOtherTotal += protein.amount
        }

        if (showWash) {
            labels.push('Wash')
            fractionAmountMaps.push(washAmountByProteinId)
            baseOtherData.push(washOtherTotal)
        }

        for (const fraction of fractionRows) {
            const amountByProteinId = new Map<string, number>()
            const hitIdSet = new Set(fraction.hitProteinIds ?? [])
            const hasHitFilter = hitIdSet.size > 0
            let fractionOtherTotal = 0

            labels.push(String(fraction.fractionIndex))

            for (const protein of fraction.proteins) {
                const isHitProtein = hasHitFilter && hitIdSet.has(protein.id)
                if (!isHitProtein) {
                    fractionOtherTotal += protein.amount
                    continue
                }

                const previous = amountByProteinId.get(protein.id) ?? 0
                const next = previous + protein.amount
                amountByProteinId.set(protein.id, next)

                proteinTotals.set(protein.id, (proteinTotals.get(protein.id) ?? 0) + protein.amount)

                if (!proteinColorById.has(protein.id)) {
                    proteinColorById.set(protein.id, protein.color)
                }
            }

            fractionAmountMaps.push(amountByProteinId)
            baseOtherData.push(fractionOtherTotal)
        }

        const sortedProteinIds = Array.from(proteinTotals.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([proteinId]) => proteinId)

        const keptProteinIds = sortedProteinIds.slice(0, MAX_STACKED_SERIES)
        const keptSet = new Set(keptProteinIds)

        const datasets = keptProteinIds.map(proteinId => ({
            label: proteinId,
            data: fractionAmountMaps.map(fractionMap => fractionMap.get(proteinId) ?? 0),
            backgroundColor: proteinColorById.get(proteinId) ?? 'rgba(107, 224, 57, 0.8)',
            stack: 'hit-protein-amounts',
            borderWidth: 0,
            barPercentage: 1,
            categoryPercentage: 1,
        }))

        const otherData = fractionAmountMaps.map((fractionMap, fractionIndex) => {
            let otherTotal = baseOtherData[fractionIndex] ?? 0
            fractionMap.forEach((amount, proteinId) => {
                if (!keptSet.has(proteinId)) {
                    otherTotal += amount
                }
            })
            return otherTotal
        })

        const hasOther = otherData.some(value => value > 0)
        if (hasOther) {
            datasets.push({
                label: showWash ? 'Other/Wash' : 'Other',
                data: otherData,
                backgroundColor: 'rgba(120, 120, 120, 0.85)',
                stack: 'hit-protein-amounts',
                borderWidth: 0,
                barPercentage: 1,
                categoryPercentage: 1,
            })
        }

        return {
            labels,
            datasets,
            hiddenProteinCount: Math.max(sortedProteinIds.length - MAX_STACKED_SERIES, 0),
        }
    }, [data, fractionRows, showWash])

    return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Card>
                <CardHeader title='Ion Exchange Fractionation' />
                <CardContent>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <FormControl>
                            <InputLabel id='media-type-label'>Media</InputLabel>
                            <Select labelId='media-type-label' value={mediaType} label='Media' onChange={e => setMediaType(e.target.value as MediaType)}>
                                <MenuItem value='Q'>Q media (Triethylamine +)</MenuItem>
                                <MenuItem value='S'>S media (Sulfite -)</MenuItem>
                            </Select>
                        </FormControl>

                        <NumberField label='Fractions' value={fractionCount} min={1} onValueChange={value => setFractionCount(value == null ? 80 : Math.max(1, value))} />

                        <NumberField label='Deadband (Charge)' value={Number(deadband.toFixed(2))} onValueChange={value => setDeadband(Number(value))} min={0} max={1} step={0.01} />
                    </Box>

                    <Box sx={{ marginTop: '1rem', marginBottom: '0.5rem' }}>
                        <Box>
                            <Typography gutterBottom sx={{ margin: 0 }}>
                                pH: {ph.toFixed(1)}
                            </Typography>
                        </Box>
                        <Slider min={0} max={14} step={0.5} value={ph} marks onChange={(_, value) => setPh(value as number)} />
                    </Box>

                    <Box sx={{ marginTop: 1, marginBottom: 2 }}>
                        <Typography>Noise / Overlap: {noise.toFixed(2)}</Typography>
                        <Slider min={0} max={0.5} step={0.01} value={noise} onChange={(_, value) => setNoise(value as number)} />
                    </Box>

                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button component='label' variant='contained'>
                            Upload FASTA
                            <input type='file' hidden accept='.fasta,.fas,.fa,.faa' onChange={handleLoadFasta} />
                        </Button>
                        <Button variant='contained' disabled={loading || fastaText.trim().length === 0} onClick={handleRunFractionation}>
                            {loading ? 'Processing...' : 'Run Fractionation'}
                        </Button>
                    </Box>

                    {error && (
                        <Alert severity='error' sx={{ marginTop: '1rem' }}>
                            {error}
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {data && (
                <>
                    <Card>
                        <CardHeader title='Fractionation' />
                        <CardContent>
                            <div>
                                <FormControlLabel control={<Switch checked={showLineGraph} onChange={(_, checked) => setShowLineGraph(checked)} />} label='Line' sx={{ marginBottom: '0.25rem' }} />
                                <FormControlLabel control={<Switch checked={useLogScale} onChange={(_, checked) => setUseLogScale(checked)} />} label='Log Scale' sx={{ marginBottom: '0.25rem' }} />
                                <FormControlLabel control={<Switch checked={showWash} onChange={(_, checked) => setShowWash(checked)} />} label='Show Wash' sx={{ marginBottom: '0.25rem' }} />
                                <Box>
                                    <Button variant='contained' onClick={exportChromatogram} startIcon={<Download />}>
                                        Download
                                    </Button>
                                </Box>
                                <div>
                                    {showLineGraph ? (
                                        <Suspense fallback={<ChartLoadingPlaceholder chartName='Chromatogram' />}>
                                            <LazyLine
                                                ref={lineChartRef}
                                                data={lineData}
                                                options={{
                                                    responsive: true,
                                                    maintainAspectRatio: false,
                                                    scales: {
                                                        x: {
                                                            type: 'linear',
                                                            title: {
                                                                display: true,
                                                                text: 'Fractions',
                                                            },
                                                            beginAtZero: true,
                                                            ticks: {
                                                                callback: value => (Number(value) === 0 ? (showWash ? 'Wash' : '0') : String(value)),
                                                            },
                                                        },
                                                        y: {
                                                            type: useLogScale ? 'logarithmic' : 'linear',
                                                            title: {
                                                                display: true,
                                                                text: showWash ? 'Retained+Wash' : 'Retained',
                                                            },
                                                            beginAtZero: !useLogScale,
                                                        },
                                                    },
                                                }}
                                            />
                                        </Suspense>
                                    ) : (
                                        <Suspense fallback={<ChartLoadingPlaceholder chartName='Chromatogram' />}>
                                            <LazyScatter
                                                ref={scatterChartRef}
                                                data={scatterData}
                                                options={{
                                                    responsive: true,
                                                    maintainAspectRatio: false,
                                                    scales: {
                                                        x: {
                                                            title: {
                                                                display: true,
                                                                text: 'Fractions',
                                                            },
                                                            beginAtZero: true,
                                                            ticks: {
                                                                callback: value => (Number(value) === 0 ? (showWash ? 'Wash' : '0') : String(value)),
                                                            },
                                                        },
                                                        y: {
                                                            type: useLogScale ? 'logarithmic' : 'linear',
                                                            title: {
                                                                display: true,
                                                                text: showWash ? 'Retained+Wash' : 'Retained',
                                                            },
                                                            beginAtZero: !useLogScale,
                                                        },
                                                    },
                                                }}
                                            />
                                        </Suspense>
                                    )}
                                </div>
                            </div>

                            <div>
                                <Box>
                                    <Button variant='contained' onClick={exportStackedProteins} startIcon={<Download />}>
                                        Download
                                    </Button>
                                </Box>
                                <div>
                                    <Suspense fallback={<ChartLoadingPlaceholder chartName='Stacked Proteins' />}>
                                        <LazyBar
                                            ref={stackedChartRef}
                                            key={`stacked-hit-amounts-${fractionRows.length}-${stackedHitAmounts.datasets.length}`}
                                            data={stackedHitAmounts}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                animation: false,
                                                normalized: true,
                                                scales: {
                                                    x: {
                                                        stacked: true,
                                                        title: {
                                                            display: true,
                                                            text: showWash ? 'Wash / Fractions' : 'Fractions',
                                                        },
                                                    },
                                                    y: {
                                                        stacked: true,
                                                        type: useLogScale ? 'logarithmic' : 'linear',
                                                        title: {
                                                            display: true,
                                                            text: showWash ? 'Retained+Wash Amount' : 'Retained Amount',
                                                        },
                                                    },
                                                },
                                                plugins: {
                                                    legend: {
                                                        display: false,
                                                    },
                                                },
                                            }}
                                        />
                                    </Suspense>
                                </div>
                            </div>

                            <Box>
                                <Typography variant='body2'>
                                    Total: {data.counts.total} | Retained: {data.counts.retained} | Wash: {data.counts.wash} | Exchanger:{' '}
                                    <span style={{ textTransform: 'capitalize' }}>{data.params.exchanger}</span>
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader
                            title='Hits'
                            action={
                                <TextField
                                    variant='outlined'
                                    value={fractionSearch}
                                    placeholder='Search'
                                    onChange={e => {
                                        setFractionSearch(e.target.value)
                                        setFractionPage(0)
                                    }}
                                    slotProps={{
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position='start'>
                                                    <Search />
                                                </InputAdornment>
                                            ),
                                        },
                                    }}
                                />
                            }
                        />
                        <CardContent>
                            <TablePagination
                                component='div'
                                count={sortedFractionRows.length}
                                page={fractionPage}
                                onPageChange={(_, newPage) => setFractionPage(newPage)}
                                rowsPerPage={fractionRowsPerPage}
                                onRowsPerPageChange={e => {
                                    setFractionRowsPerPage(Number(e.target.value))
                                    setFractionPage(0)
                                }}
                                rowsPerPageOptions={[10, 25, 50]}
                            />
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={fractionSort.key === 'fractionIndex'}
                                                    direction={fractionSort.key === 'fractionIndex' ? fractionSort.direction : 'asc'}
                                                    onClick={() => handleFractionSort('fractionIndex', fractionSort.key === 'fractionIndex' && fractionSort.direction === 'asc' ? 'desc' : 'asc')}
                                                >
                                                    Fraction
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={fractionSort.key === 'proteinCount'}
                                                    direction={fractionSort.key === 'proteinCount' ? fractionSort.direction : 'asc'}
                                                    onClick={() => handleFractionSort('proteinCount', fractionSort.key === 'proteinCount' && fractionSort.direction === 'asc' ? 'desc' : 'asc')}
                                                >
                                                    Protein Count
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={fractionSort.key === 'hitCount'}
                                                    direction={fractionSort.key === 'hitCount' ? fractionSort.direction : 'asc'}
                                                    onClick={() => handleFractionSort('hitCount', fractionSort.key === 'hitCount' && fractionSort.direction === 'asc' ? 'desc' : 'asc')}
                                                >
                                                    Hit Count
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>Hit Protein IDs</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {pagedFractions.map(row => (
                                            <TableRow key={row.fractionIndex}>
                                                <TableCell>{row.fractionIndex}</TableCell>
                                                <TableCell>{row.proteinCount ?? row.proteins.length}</TableCell>
                                                <TableCell>{row.hitCount ?? 0}</TableCell>
                                                <TableCell>
                                                    {(row.hitProteinIds ?? []).length === 0 ? (
                                                        '...'
                                                    ) : (
                                                        <Box>
                                                            {(row.hitProteinIds ?? []).map((proteinId, proteinIndex) => {
                                                                const protein = row.proteins.find(item => item.id === proteinId)
                                                                return (
                                                                    <Chip
                                                                        key={`${row.fractionIndex}-${proteinId}-${proteinIndex}`}
                                                                        size='medium'
                                                                        clickable
                                                                        label={proteinId}
                                                                        title={'Copy Sequence'}
                                                                        sx={{
                                                                            border: '2px solid #333',
                                                                            backgroundColor: protein?.color ?? 'inherit',
                                                                            color: '#fff',
                                                                            fontWeight: 600,
                                                                            fontSize: '1rem',
                                                                            margin: '0.2rem',
                                                                            fontFamily: 'monospace',
                                                                            textShadow: '0 0 3px rgba(0,0,0,0.9)',
                                                                        }}
                                                                        onClick={() => {
                                                                            if (!protein) return
                                                                            navigator.clipboard.writeText(protein.sequence)
                                                                        }}
                                                                    />
                                                                )
                                                            })}
                                                        </Box>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader
                            title='Filtered Proteins'
                            action={
                                <TextField
                                    variant='outlined'
                                    value={proteinSearch}
                                    placeholder='Search'
                                    onChange={e => {
                                        setProteinSearch(e.target.value)
                                        setProteinPage(0)
                                    }}
                                    slotProps={{
                                        input: {
                                            startAdornment: (
                                                <InputAdornment position='start'>
                                                    <Search />
                                                </InputAdornment>
                                            ),
                                        },
                                    }}
                                />
                            }
                        />
                        <CardContent>
                            <TablePagination
                                component='div'
                                count={sortedRetainedRows.length}
                                page={proteinPage}
                                onPageChange={(_, newPage) => setProteinPage(newPage)}
                                rowsPerPage={proteinRowsPerPage}
                                onRowsPerPageChange={e => {
                                    setProteinRowsPerPage(Number(e.target.value))
                                    setProteinPage(0)
                                }}
                                rowsPerPageOptions={[10, 25, 50]}
                            />
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>ID</TableCell>
                                            <TableCell>Name</TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={proteinSort.key === 'charge'}
                                                    direction={proteinSort.key === 'charge' ? proteinSort.direction : 'asc'}
                                                    onClick={() => handleProteinSort('charge', proteinSort.key === 'charge' && proteinSort.direction === 'asc' ? 'desc' : 'asc')}
                                                >
                                                    Charge at pH {ph.toFixed(1)}
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>
                                                <TableSortLabel
                                                    active={proteinSort.key === 'molecularWeight'}
                                                    direction={proteinSort.key === 'molecularWeight' ? proteinSort.direction : 'asc'}
                                                    onClick={() => handleProteinSort('molecularWeight', proteinSort.key === 'molecularWeight' && proteinSort.direction === 'asc' ? 'desc' : 'asc')}
                                                >
                                                    Molecular Weight
                                                </TableSortLabel>
                                            </TableCell>
                                            <TableCell>Sequence</TableCell>
                                            <TableCell>Description</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {pagedProteins.map((row, idx) => (
                                            <TableRow key={`${row.id}-${idx}`}>
                                                <TableCell>
                                                    <Box
                                                        sx={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 1,
                                                        }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                width: 16,
                                                                height: 16,
                                                                backgroundColor: row.color ?? 'transparent',
                                                                borderRadius: '50%',
                                                                border: row.color ? '1px solid #333' : 'none',
                                                            }}
                                                        />
                                                        <Typography
                                                            variant='body2'
                                                            sx={{
                                                                fontFamily: 'monospace',
                                                            }}
                                                        >
                                                            {row.id}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>{row.name || '-'}</TableCell>
                                                <TableCell>{row.charge.toFixed(2)}</TableCell>
                                                <TableCell>{row.molecularWeight.toFixed(2)}</TableCell>
                                                <TableCell
                                                    title={row.sequence}
                                                    sx={{
                                                        maxWidth: '150px',
                                                        height: '1.5em',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {row.sequence}
                                                </TableCell>
                                                <TableCell
                                                    title={row.description}
                                                    sx={{
                                                        maxWidth: '150px',
                                                        height: '1.5em',
                                                        overflow: 'hidden',
                                                        textOverflow: 'ellipsis',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                >
                                                    {row.description}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </CardContent>
                    </Card>
                </>
            )}
        </Box>
    )
}

export default IonExchangeFractionation
