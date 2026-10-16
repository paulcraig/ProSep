import React, { useMemo, useState } from 'react'
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
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    Typography,
} from '@mui/material'
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LineElement, LinearScale, LogarithmicScale, PointElement, Tooltip } from 'chart.js'
import { API_URL } from '../config'
import NumberField from '../components/ui/NumberField'
import { ProteinTable } from '../components/chromatography/tables/ProteinTable'
import { Chromatogram } from '../components/chromatography/graphs/Chromatogram'

/*
 * Register the chart components we need for Chart.js.
 * Without this, the Line chart and axes will not render properly.
 */
ChartJS.register(CategoryScale, LinearScale, LogarithmicScale, BarElement, LineElement, PointElement, Tooltip, Legend)

/*
 * Allowed ligand types for the HIC stationary phase.
 * These match the backend-supported values.
 */
type LigandType = 'butyl' | 'octyl' | 'phenyl'

/*
 * Protein object returned by the backend for each protein in a fraction.
 */
type ProteinDto = {
    id: string
    name: string
    description: string
    sequence: string
    molecularWeight: number
    hydrophobicity: number
    bindingStrength: number
    color: string
    amount: number
}

/*
 * One output fraction returned by the backend.
 */
type FractionDto = {
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
    ligandType: LigandType
    saltStart: number
    saltEnd: number
    saltAlpha: number
    fractions: number
    overlap: number
    deadband: number
}

/*
 * Summary counts returned by the backend.
 */
type CountsDto = {
    total: number
    wash: number
    retained: number
    skipped: number
}

/*
 * Full API response shape for a successful HIC run.
 */
type HICResponse = {
    ok: boolean
    params: ParamsDto
    counts: CountsDto
    wash: ProteinDto[]
    fractions: FractionDto[]
    error?: string
}

const HydrophobicInteractionFractionation: React.FC = () => {
    /*
     * Raw FASTA text loaded from the uploaded file.
     * This is sent directly to the backend.
     */
    const [fastaText, setFastaText] = useState<string>('')

    /**
     * User-selected HIC parameters.
     */
    const [ligandType, setLigandType] = useState<LigandType>('butyl')
    const [saltStart, setSaltStart] = useState<number>(1.5)
    const [saltEnd, setSaltEnd] = useState<number>(0.0)
    const [saltAlpha, setSaltAlpha] = useState<number>(1.2)

    /**
     * Fractionation controls.
     */
    const [fractionCount, setFractionCount] = useState<number>(80)
    const [noise, setNoise] = useState<number>(0.1)
    const [deadband, setDeadband] = useState<number>(0.15)

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
    const [data, setData] = useState<HICResponse | null>(null)

    /*
     * Pagination state for the fractions table.
     */
    const [fractionPage, setFractionPage] = useState<number>(0)
    const [fractionRowsPerPage, setFractionRowsPerPage] = useState<number>(10)

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
            const response = await fetch(`${API_URL}/hydrophobic_interaction_fractionation/process`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fasta_content: fastaText,
                    ligand_type: ligandType,
                    salt_start: saltStart,
                    salt_end: saltEnd,
                    salt_alpha: saltAlpha,
                    fraction_count: fractionCount,
                    noise,
                    deadband,
                }),
            })

            // Read raw text first so debugging bad responses is easier.
            const text = await response.text()
            console.log('HIC raw response:', text)

            let json: HICResponse
            try {
                json = JSON.parse(text) as HICResponse
            } catch {
                throw new Error(`Backend returned non-JSON response: ${text.slice(0, 200)}`)
            }

            if (!response.ok || !json.ok || json.error) {
                throw new Error(json.error || 'Failed to process HIC fractionation.')
            }

            setData(json)
            setFractionPage(0)
        } catch (err) {
            setData(null)
            setError(err instanceof Error ? err.message : 'Unexpected error')
        } finally {
            setLoading(false)
        }
    }

    // Keep salt start non-negative, but do not force any relationship to salt end
    const handleSaltStartChange = (value: number | null) => {
        if (value == null) {
            setSaltStart(0)
            return
        }

        setSaltStart(Math.max(0, value))
    }

    // Keep salt end non-negative, but do not force any relationship to salt start
    const handleSaltEndChange = (value: number | null) => {
        if (value == null) {
            setSaltEnd(0)
            return
        }

        setSaltEnd(Math.max(0, value))
    }

    // Keep salt alpha non-negative
    const handleSaltAlphaChange = (value: number | null) => {
        if (value == null) {
            setSaltAlpha(0)
            return
        }

        setSaltAlpha(Math.max(0, value))
    }

    // Keep fraction count at least 1
    const handleFractionCountChange = (value: number | null) => {
        if (value == null) {
            setFractionCount(1)
            return
        }

        setFractionCount(Math.max(1, Math.floor(value)))
    }

    // Keep deadband non-negative
    const handleDeadbandChange = (value: number | null) => {
        if (value == null) {
            setDeadband(0)
            return
        }

        setDeadband(Math.max(0, value))
    }

    /*
     * Convenience alias for the returned fractions.
     * Used throughout the graphs and table.
     */
    const fractionRows = useMemo(() => data?.fractions ?? [], [data])

    /*
     * Slice the fractions list for table pagination.
     */
    const pagedFractions = useMemo(() => {
        const start = fractionPage * fractionRowsPerPage
        const end = start + fractionRowsPerPage
        return fractionRows.slice(start, end)
    }, [fractionRows, fractionPage, fractionRowsPerPage])

    /*
     * Build the salt gradient overlay for the chromatogram.
     * It stays flat initially, then transitions toward saltEnd across later fractions.
     */
    const saltGradientPoints = useMemo(() => {
        if (!data) return []

        const fractions = data.fractions ?? []
        const totalFractions = Math.max(1, fractions.length)

        // Start the gradient after an initial loading/binding region.
        const gradientStartFraction = Math.max(2, Math.floor(totalFractions * 0.18))

        return fractions.map((f, index) => {
            let y = data.params.saltStart

            if (index + 1 > gradientStartFraction) {
                const progress = (index + 1 - gradientStartFraction) / Math.max(1, totalFractions - gradientStartFraction)
                y = data.params.saltStart + (data.params.saltEnd - data.params.saltStart) * progress
            }

            return {
                x: f.fractionIndex,
                y,
            }
        })
    }, [data])

    const [showLineGraph, setShowLineGraph] = useState<boolean>(true)
    const [useLogScale, setUseLogScale] = useState<boolean>(true)
    const [showWash, setShowWash] = useState<boolean>(false)

    return (
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Card>
                <CardHeader title='Hydrophobic Interaction Fractionation (HIC)' />
                <CardContent>
                    {/* Main control row for user inputs */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, pb: 1 }}>
                        <FormControl>
                            <InputLabel id='ligand-label'>Ligand Type</InputLabel>
                            <Select labelId='ligand-label' value={ligandType} label='Ligand Type' onChange={e => setLigandType(e.target.value as LigandType)}>
                                <MenuItem value='butyl'>Butyl</MenuItem>
                                <MenuItem value='octyl'>Octyl</MenuItem>
                                <MenuItem value='phenyl'>Phenyl</MenuItem>
                            </Select>
                        </FormControl>

                        <NumberField label='Fractions' value={fractionCount} min={1} onValueChange={handleFractionCountChange} />

                        <NumberField label='Salt Start' value={saltStart} min={0} onValueChange={handleSaltStartChange} />

                        <NumberField label='Salt End' value={saltEnd} min={0} onValueChange={handleSaltEndChange} />

                        <NumberField label='Salt Alpha' value={saltAlpha} min={0} onValueChange={handleSaltAlphaChange} />

                        <NumberField label='Deadband (Binding Strength)' value={deadband} min={0} onValueChange={handleDeadbandChange} />
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
                    <FormControlLabel control={<Switch checked={showLineGraph} onChange={(_, checked) => setShowLineGraph(checked)} />} label='Line' sx={{ marginBottom: '0.25rem' }} />
                    <FormControlLabel control={<Switch checked={useLogScale} onChange={(_, checked) => setUseLogScale(checked)} />} label='Log Scale' sx={{ marginBottom: '0.25rem' }} />
                    <FormControlLabel control={<Switch checked={showWash} onChange={(_, checked) => setShowWash(checked)} />} label='Show Wash' sx={{ marginBottom: '0.25rem' }} />

                    <Chromatogram {...{ data, fractionRows, showLineGraph, showWash, useLogScale, saltGradient: saltGradientPoints }} />
                    <Box sx={{ my: 1 }}>
                        <Typography variant='body2'>
                            Total: {data.counts.total} | Retained: {data.counts.retained} | Wash: {data.counts.wash} | Skipped: {data.counts.skipped} | Ligand: {data.params.ligandType} | Salt Range: [{data.params.saltStart}, {data.params.saltEnd}]
                        </Typography>
                    </Box>
                    <ProteinTable {...{
                        fractionRows,
                        metrics: [
                            { label: 'Hydrophobicity', value: (p: ProteinDto) => p.hydrophobicity },
                            { label: 'Binding Strength', value: (p: ProteinDto) => p.bindingStrength }]
                    }} />
                </>
            )}

            {/* Only show results after a successful run */}
            {data && (
                <>
                    {/* Results table for individual fractions */}
                    <Card>
                        <CardHeader title='Fractions' />
                        <CardContent>
                            <TableContainer>
                                <Table size='small'>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Fraction</TableCell>
                                            <TableCell align='right'>Protein Count</TableCell>
                                            <TableCell align='right'>Avg Hydrophobicity</TableCell>
                                            <TableCell align='right'>Avg Binding Strength</TableCell>
                                            <TableCell>Example Proteins</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {pagedFractions.map(f => {
                                            const proteins = f.proteins ?? []
                                            const avgHydrophobicity = proteins.length > 0 ? proteins.reduce((sum, p) => sum + p.hydrophobicity, 0) / proteins.length : 0

                                            const avgBindingStrength = proteins.length > 0 ? proteins.reduce((sum, p) => sum + p.bindingStrength, 0) / proteins.length : 0

                                            return (
                                                <TableRow key={f.fractionIndex}>
                                                    <TableCell>{f.fractionIndex}</TableCell>
                                                    <TableCell align='right'>{f.proteinCount ?? proteins.length}</TableCell>
                                                    <TableCell align='right'>{avgHydrophobicity.toFixed(3)}</TableCell>
                                                    <TableCell align='right'>{avgBindingStrength.toFixed(3)}</TableCell>
                                                    <TableCell>
                                                        {proteins
                                                            .slice(0, 3)
                                                            .map(p => p.id)
                                                            .join(', ')}
                                                    </TableCell>
                                                </TableRow>
                                            )
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            <Box sx={{ my: 1 }}>
                                <TablePagination
                                    component='div'
                                    count={fractionRows.length}
                                    page={fractionPage}
                                    onPageChange={(_, newPage) => setFractionPage(newPage)}
                                    rowsPerPage={fractionRowsPerPage}
                                    onRowsPerPageChange={e => {
                                        setFractionRowsPerPage(parseInt(e.target.value, 10))
                                        setFractionPage(0)
                                    }}
                                    rowsPerPageOptions={[5, 10, 25, 50]}
                                />
                            </Box>
                        </CardContent>
                    </Card>
                </>
            )}
        </Box>
    )
}

export default HydrophobicInteractionFractionation
