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
import React, { useMemo, useState } from 'react'
import { Chromatogram, ChromatogramFractionDto } from '../components/chromatography/graphs/Chromatogram'
import { ChromatographyHitGraph } from '../components/chromatography/graphs/HitGraph'
import { HitTable } from '../components/chromatography/tables/HitTable'
import { ProteinTable, ProteinTableProteinDto } from '../components/chromatography/tables/ProteinTable'
import NumberField from '../components/ui/NumberField'
import { API_URL } from '../config'
import { FractionationResponse } from '../components/chromatography/types'

/*
 * Register the chart components we need for Chart.js.
 * Without this, the Line chart and axes will not render properly.
 */
ChartJS.register(CategoryScale, LinearScale, LogarithmicScale, BarElement, LineElement, PointElement, Tooltip, Legend)

/*
 * Protein object returned by the backend for each protein in a fraction.
 */
type ProteinDto = ProteinTableProteinDto & {
    id: string
    name: string
    description: string
    sequence: string
    molecularWeight: number
    amount: number
}

/*
 * One output fraction returned by the backend.
 */
type FractionDto = ChromatogramFractionDto & {
    fractionIndex: number
    proteinCount?: number
    absorbanceScore?: number
    hitCount?: number
    hitProteinIds?: string[]
    proteins: ProteinDto[]
}

/*
 * Parameter metadata returned by the backend for the completed run.
 */
type ParamsDto = {
    fractions: number
    prosite_strong: string
    prosite_weak: string
    noise: number
}

/*
 * Summary counts returned by the backend.
 */
type CountsDto = {
    total: number
    strongly_bound: number
    weakly_bound: number
    unbound: number
    skipped: number
}

/*
 * Fractioon counts returned by the backend.
 */
type FractionCountsDto = {
    wash_fractions: number
    weak_fractions: number
    strong_fractions: number
}

/*
 * Full API response shape for a successful HIC run.
 */
type AffinityResponse = FractionationResponse & {
    ok: boolean
    params: ParamsDto
    counts: CountsDto
    fraction_counts: FractionCountsDto
    fractions: FractionDto[]
    error?: string
}

type MethodData = Readonly<{
    name: string
    prosite_strong: string
    prosite_weak: string
    elute: string
    elute_concentrations: readonly [number, number, number]
    elute_concentration_unit: string
}>

const methods = {
    IMAC: {
        name: "Immobilized Metal",
        prosite_strong: "H-H-H-H-H-H",
        prosite_weak: "H-H-H",
        elute: "Imidazole",
        elute_concentrations: [0, 100, 500],
        elute_concentration_unit: "mM"
    },
    GST: {
        name: "Glutathione",
        prosite_strong: "G-S-T-G-S-T",
        prosite_weak: "G-S-T",
        elute: "Glutathione",
        elute_concentrations: [0, 5, 20],
        elute_concentration_unit: "mM"
    },
    STREP_TAG: {
        name: "Strep-tag",
        prosite_strong: "W-S-H-P-Q-F-E-K",
        prosite_weak: "W-S-H-P",
        elute: "Desthiobiotin",
        elute_concentrations: [0, 1, 5],
        elute_concentration_unit: "mM"
    },
    FLAG: {
        name: "FLAG",
        prosite_strong: "D-Y-K-D-D-D-D-K",
        prosite_weak: "D-Y-K-D",
        elute: "FLAG peptide",
        elute_concentrations: [0, 1, 10],
        elute_concentration_unit: "mM"
    },
    MBP: {
        name: "Maltose-Binding Protein",
        prosite_strong: "D-E-E-D",
        prosite_weak: "D-E",
        elute: "Maltose",
        elute_concentrations: [0, 10, 50],
        elute_concentration_unit: "mM"
    },
    AVITAG_BIOTIN: {
        name: "Biotinylated AviTag",
        prosite_strong: "G-L-N-D-I-F-E-A-Q-K-I-E-W-H-E",
        prosite_weak: "G-L-N-D-I-F-E-A-Q-K",
        elute: "Biotin",
        elute_concentrations: [0, 1, 10],
        elute_concentration_unit: "mM"
    },
} as const satisfies { [index: string]: MethodData }

const AffinityChromatography: React.FC = () => {
    /*
     * Raw FASTA text loaded from the uploaded file.
     * This is sent directly to the backend.
     */
    const [fastaText, setFastaText] = useState<string>('')

    /**
     * User-selected HIC parameters.
     */
    const [method, setMethod] = useState<MethodData>(methods.IMAC)
    const [methodLastRan, setMethodLastRan] = useState<MethodData>(method);

    /**
     * Fractionation controls.
     */
    const [fractionCount, setFractionCount] = useState<number>(80)
    const [noise, setNoise] = useState<number>(0.1)

    /*
     * Stores the full backend response after a successful run.
     * The graphs and table are derived from this object.
     */
    const [loading, setLoading] = useState<boolean>(false)
    const [error, setError] = useState<string>('')

    /*
     * Stores the full backend response after a successful run.
     * The graphs and table are derived from this object.
     */
    const [data, setData] = useState<AffinityResponse | null>(null)

    /*
     * Reads an uploaded FASTA file into text and stores it in state.
     */
    const handleLoadFasta = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return
        const text = await file.text()
        setFastaText(text)

        // Clear the file input so the same file can be uploaded again if needed.
        event.target.value = ''
    }

    /*
     * Sends the current form values and FASTA content to the backend.
     * On success, stores the returned HIC result in `data`.
     */
    const handleRun = async () => {
        setLoading(true)
        setError('')

        try {
            const response = await fetch(`${API_URL}/affinity_chromatography/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fasta_content: fastaText,
                    fraction_count: fractionCount,
                    prosite_strong: method?.prosite_strong,
                    prosite_weak: method?.prosite_weak,
                    noise,
                }),
            })

            const json = (await response.json()) as AffinityResponse
            if (!response.ok || !json.ok || json.error) {
                throw new Error(json.error || 'Failed to process Affinity Chromatography fractionation.')
            }

            setData(json)
            setMethodLastRan(method)
        } catch (err) {
            setData(null)
            setError(err instanceof Error ? err.message : 'Unexpected error')
        } finally {
            setLoading(false)
        }
    }

    // Keep fraction count at least 1
    const handleFractionCountChange = (value: number | null) => {
        if (value == null) {
            setFractionCount(1)
            return
        }

        setFractionCount(Math.max(1, Math.floor(value)))
    }

    /**
     * Generates step-wise elution concentration graph points
     * @param data the fractions we're generating points based off of
     * @param elution_concentrations the elute concentrations to use for the graph
     * @returns array (x,y) representing a step elution gradient for these fractions
     */
    function elutionConcentrationPoints(
        data: { fractions: Array<{ fractionIndex: number }>, fraction_counts: { wash_fractions: number, weak_fractions: number, strong_fractions: number }}, 
        elution_concentrations: readonly [number, number, number]
    ): Array<{ x: number; y: number }> {
        const fractions = data.fractions ?? []
        
        return fractions.map((f) => {
            return {
                x: f.fractionIndex,
                y: f.fractionIndex <= data.fraction_counts.wash_fractions ? elution_concentrations[0]
                : f.fractionIndex <= data.fraction_counts.weak_fractions + data.fraction_counts.wash_fractions ? elution_concentrations[1]
                : elution_concentrations[2]
            }
        })
    }

    /*
     * Convenience alias for the returned fractions.
     * Used throughout the graphs and table.
     */
    const fractionRows = useMemo(() => data?.fractions ?? [], [data])

    const elutionGradient = useMemo(() => (data && methodLastRan ? elutionConcentrationPoints(data, methodLastRan.elute_concentrations) : []), [data, methodLastRan])

    const [showLineGraph, setShowLineGraph] = useState<boolean>(true)
    const [useLogScale, setUseLogScale] = useState<boolean>(true)

    return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Card>
                <CardHeader title='Affinity Chromatography' />
                <CardContent>
                    {/* Main control row for user inputs */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, pb: 1 }}>
                        <FormControl>
                            <InputLabel id='method-label'>Method</InputLabel>
                            <Select labelId='method-label' value={method.name} label='Method' onChange={e => setMethod(Object.values(methods).filter(method => method.name === e.target.value)[0])}>
                                {Object.values(methods).map((method) => 
                                    <MenuItem value={method.name}>{method.name}</MenuItem>
                                )}
                            </Select>
                        </FormControl>

                        <NumberField label='Fractions' value={fractionCount} min={1} onValueChange={handleFractionCountChange} />

                    </Box>

                    {/* Noise / overlap slider */}
                    <Box sx={{ marginTop: 1, marginBottom: 2 }}>
                        <Typography>Noise / Overlap</Typography>
                        <Slider value={noise} step={0.01} min={0} max={1} onChange={(_, v) => setNoise(v as number)} valueLabelDisplay='auto' />
                    </Box>

                    {/* Main action buttons */}
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button variant='contained' component='label'>
                            Upload FASTA
                            <input hidden type='file' onChange={handleLoadFasta} />
                        </Button>

                        <Button variant='contained' onClick={handleRun} disabled={loading || !fastaText.trim()}>
                            {loading ? 'Running...' : 'Run Fractionation'}
                        </Button>
                    </Box>

                    {/* Show backend or request errors */}
                    {error && (
                        <Alert severity='error' sx={{ mt: 2 }}>
                            {error}
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {data && fractionRows && (
                <>
                    <Card>
                        <CardHeader title='Graphs' />
                        <CardContent>
                            <Box>
                                <FormControlLabel control={<Switch checked={showLineGraph} onChange={(_, checked) => setShowLineGraph(checked)} />} label='Line' sx={{ marginBottom: '0.25rem' }} />
                                <FormControlLabel control={<Switch checked={useLogScale} onChange={(_, checked) => setUseLogScale(checked)} />} label='Log Scale' sx={{ marginBottom: '0.25rem' }} />
                            </Box>

                            <Chromatogram {...{ data, fractionRows, showLineGraph, showWash:false, useLogScale, elutionPoints: elutionGradient, elutionLabel:methodLastRan.elute, elutionAxisLabel:methodLastRan.elute_concentration_unit }} />
                            <ChromatographyHitGraph {...{ data, fractionRows, showWash:false, useLogScale }} />
                            <Box sx={{ my: 1 }}>
                                <Typography variant='body2'>
                                    Total: {data.counts.total} | Strongly bound: {data.counts.strongly_bound} | Weakly bound: {data.counts.weakly_bound} | Unbound: {data.counts.unbound} | Skipped: {data.counts.skipped}
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                    
                    <HitTable {...{ fractionRows }} />
                    <ProteinTable {...{
                        fractionRows
                    }} />
                </>
            )}

        </Box>
    )
}

export default AffinityChromatography
