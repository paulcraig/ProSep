import React, { useMemo, useRef, useState } from 'react'
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
    Slider,
    Switch,
    Typography,
} from '@mui/material'
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LineElement, LinearScale, LogarithmicScale, PointElement, Tooltip } from 'chart.js'
import { API_URL } from '../config'
import NumberField from '../components/ui/NumberField'
import { HitTable } from '../components/chromatography/tables/HitTable'
import { ProteinTable } from '../components/chromatography/tables/ProteinTable'
import { Chromatogram } from '../components/chromatography/graphs/Chromatogram'
import { ChromatographyHitGraph } from '../components/chromatography/graphs/HitGraph'

ChartJS.register(CategoryScale, LinearScale, LogarithmicScale, BarElement, LineElement, PointElement, Tooltip, Legend)

type MediaType = 'Q' | 'S'

export type ProteinDto = {
    id: string
    name: string
    description: string
    sequence: string
    molecularWeight: number
    charge: number
    color: string
    amount: number
}

export type FractionDto = {
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

export type IonExchangeResponse = {
    ok: boolean
    params: ParamsDto
    counts: CountsDto
    wash: ProteinDto[]
    fractions: FractionDto[]
    error?: string
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

    const [showLineGraph, setShowLineGraph] = useState<boolean>(true)
    const [useLogScale, setUseLogScale] = useState<boolean>(true)
    const [showWash, setShowWash] = useState<boolean>(false)

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
        } catch (err) {
            setData(null)
            setError(err instanceof Error ? err.message : 'Unexpected error')
        } finally {
            setLoading(false)
        }
    }

    const fractionRows = useMemo(() => data?.fractions ?? [], [data])

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

            {data && fractionRows && (
                <>
                    <Card>
                        <CardHeader title='Fractionation' />
                        <CardContent>
                            <FormControlLabel control={<Switch checked={showLineGraph} onChange={(_, checked) => setShowLineGraph(checked)} />} label='Line' sx={{ marginBottom: '0.25rem' }} />
                            <FormControlLabel control={<Switch checked={useLogScale} onChange={(_, checked) => setUseLogScale(checked)} />} label='Log Scale' sx={{ marginBottom: '0.25rem' }} />
                            <FormControlLabel control={<Switch checked={showWash} onChange={(_, checked) => setShowWash(checked)} />} label='Show Wash' sx={{ marginBottom: '0.25rem' }} />

                            <Chromatogram {...{ data, fractionRows, showLineGraph, showWash, useLogScale }} />
                            <ChromatographyHitGraph {...{ data, fractionRows, showWash, useLogScale }} />
                            
                            <Box>
                                <Typography variant='body2'>
                                    Total: {data.counts.total} | Retained: {data.counts.retained} | Wash: {data.counts.wash} | Exchanger:{' '}
                                    <span style={{ textTransform: 'capitalize' }}>{data.params.exchanger}</span>
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                    <HitTable {...{ fractionRows }} />
                    <ProteinTable {...{ fractionRows, ph }} />
                </>
            )}
        </Box>
    )
}

export default IonExchangeFractionation
