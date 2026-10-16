import React, { useMemo, useState } from 'react'
import { Chart as ChartJS, CategoryScale, LinearScale, LogarithmicScale, BarElement, LineElement, PointElement, Tooltip, Legend } from 'chart.js'
import { API_URL } from '../config'
import {
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
    SelectChangeEvent,
    Switch,
    Typography,
} from '@mui/material'
import NumberField from '../components/ui/NumberField'
import { Chromatogram } from '../components/chromatography/graphs/Chromatogram'
import { ChromatographyHitGraph } from '../components/chromatography/graphs/HitGraph'
import { ProteinTable } from '../components/chromatography/tables/ProteinTable'

// Gel dictionary
const gelDict: { [key: string]: [number, number] } = {
    'Bio-P 0.1-1.8 kDa': [100, 1800],
    'Bio-P 0.8-4.0 kDa': [800, 4000],
    'Bio-P 1.0-6.0 kDa': [1000, 6000],
    'Bio-P 1.5-20.0 kDa': [1500, 20000],
    'Bio-P 2.5-40.0 kDA': [2500, 40000],
    'Bio-P 3.0-60.0 kDa': [3000, 60000],
    'Bio-P 5.0-100 kDa': [5000, 100000],
    'S-X 0.4-14.0 kDa': [400, 14000],
    'S-X <2.0 kDA': [0, 2000],
    'S-X <0.4 kDA': [0, 400],
    'Bio-A 10.0 - 500 kDA': [10000, 500000],
    'Bio-A 10.0 - 1500 kDA': [10000, 1500000],
}

ChartJS.register(CategoryScale, LinearScale, LogarithmicScale, BarElement, LineElement, PointElement, Tooltip, Legend)

type ProteinDto = {
    id: string
    name: string
    description: string
    sequence: string
    molecularWeight: number
    color: string
    amount: number
}

type FractionDto = {
    fractionIndex: number
    proteinCount?: number
    absorbanceScore?: number
    hitCount?: number
    hitProteinIds?: string[]
    proteins: ProteinDto[]
}

type SizeExclusionResponse = {
    ok: boolean
    params: {
        gelName: string
        minSize: number
        maxSize: number
        fractions: number
    }
    counts: {
        total: number
        to_small: number
        to_big: number
        inside: number
        skipped: number
    }
    wash: ProteinDto[]
    fractions: FractionDto[]
    afterWash: ProteinDto[]
    error?: string
}

const SizeExclusionPage: React.FC = () => {
    const [fastaText, setFastaText] = useState('')
    const gelNames = Object.keys(gelDict)
    const [selectedGel, setSelectedGel] = useState(gelNames[0])
    const [minSize, setMinSize] = useState(gelDict[gelNames[0]][0])
    const [maxSize, setMaxSize] = useState(gelDict[gelNames[0]][1])
    const [fractionCount, setFractionCount] = useState(5) // x fractions inside range

    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [data, setData] = useState<SizeExclusionResponse | null>(null)

    const [showLineGraph, setShowLineGraph] = useState<boolean>(true)
    const [useLogScale, setUseLogScale] = useState<boolean>(false)
    const [showWash, setShowWash] = useState<boolean>(true)

    const handleLoadFasta = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        const text = await file.text()
        setFastaText(text)
    }

    const handleGelChange = (event: SelectChangeEvent<string>) => {
        const gel = event.target.value as string
        setSelectedGel(gel)
        setMinSize(gelDict[gel][0])
        setMaxSize(gelDict[gel][1])
    }

    const handleRun = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch(`${API_URL}/size_exclusion/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fasta_content: fastaText,
                    gel_name: selectedGel,
                    proteinList: [],
                    fraction_count: fractionCount,
                }),
            })
            const json = (await res.json()) as SizeExclusionResponse
            if (!res.ok || !json.ok || json.error) {
                throw new Error(json.error || 'Failed to process.')
            }
            setData(json)
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unexpected error')
            setData(null)
        } finally {
            setLoading(false)
        }
    }

    const fractionRows = useMemo(() => data?.fractions ?? [], [data])

    return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Card>
                <CardHeader title='Size Exclusion Chromatography' />
                <CardContent>
                    {error && <Alert severity='error'>{error}</Alert>}

                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, pb: 1 }}>
                        <FormControl>
                            <InputLabel id='gel-select-label'>Gel Type</InputLabel>
                            <Select sx={{ width: 350 }} labelId='gel-select-label' value={selectedGel} label='Gel Type' onChange={handleGelChange}>
                                {gelNames.map(name => (
                                    <MenuItem key={name} value={name}>
                                        {name} ({gelDict[name][0]} - {gelDict[name][1]} Da)
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <NumberField label='Fractions' value={fractionCount} min={1} onValueChange={value => setFractionCount(value == null ? 1 : Math.max(1, Math.floor(value)))} />
                    </Box>

                    <Box mt={2}>
                        <Button variant='contained' component='label'>
                            Upload FASTA
                            <input hidden type='file' onChange={handleLoadFasta} />
                        </Button>

                        <Button variant='contained' onClick={handleRun} disabled={loading || !fastaText.trim()} sx={{ ml: 2 }}>
                            {loading ? 'Running...' : 'Run Fractionation'}
                        </Button>
                    </Box>
                </CardContent>
            </Card>

            {data && (
                <>
                    <FormControlLabel control={<Switch checked={showLineGraph} onChange={(_, checked) => setShowLineGraph(checked)} />} label='Line' sx={{ marginBottom: '0.25rem' }} />
                    <FormControlLabel control={<Switch checked={useLogScale} onChange={(_, checked) => setUseLogScale(checked)} />} label='Log Scale' sx={{ marginBottom: '0.25rem' }} />
                    <FormControlLabel control={<Switch checked={showWash} onChange={(_, checked) => setShowWash(checked)} />} label='Show Wash' sx={{ marginBottom: '0.25rem' }} />

                    <Chromatogram
                        {...{
                            data,
                            fractionRows,
                            showLineGraph,
                            showWash,
                            useLogScale,
                            afterWash: data.afterWash,
                            washLabel: 'Too Big',
                            afterWashLabel: 'Too Small',
                        }}
                    />
                    <ChromatographyHitGraph
                        {...{
                            data,
                            fractionRows,
                            showWash,
                            useLogScale,
                            afterWash: data.afterWash,
                            washLabel: 'Too Big',
                            afterWashLabel: 'Too Small',
                        }}
                    />
                    <Box sx={{ my: 1 }}>
                        <Typography variant='body2'>
                            Total: {data.counts.total} | Too Small: {data.counts.to_small} | Too Big: {data.counts.to_big} | Inside: {data.counts.inside} | Skipped: {data.counts.skipped}
                        </Typography>
                    </Box>
                    <ProteinTable {...{ fractionRows }} />
                </>
            )}
        </Box>
    )
}

export default SizeExclusionPage
