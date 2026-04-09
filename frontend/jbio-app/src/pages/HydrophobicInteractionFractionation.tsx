import React, { useMemo, useState } from "react";
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
    Slider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TextField,
    Typography,
} from "@mui/material";
import { Line } from "react-chartjs-2";
import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LineElement,
    LinearScale,
    LogarithmicScale,
    PointElement,
    Tooltip,
} from "chart.js";
import { API_URL } from "../config";
import "./HydrophobicInteractionFractionation.css";

/*
 * Register the chart components we need for Chart.js.
 * Without this, the Line chart and axes will not render properly.
 */
ChartJS.register(
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
);

/*
 * Allowed ligand types for the HIC stationary phase.
 * These match the backend-supported values.
 */
type LigandType = "butyl" | "octyl" | "phenyl";

/*
 * Protein object returned by the backend for each protein in a fraction.
 */
type ProteinDto = {
    id: string;
    name: string;
    description: string;
    sequence: string;
    molecularWeight: number;
    hydrophobicity: number;
    bindingStrength: number;
    color: string;
};

/*
 * One output fraction returned by the backend.
 */
type FractionDto = {
    fractionIndex: number;
    proteinCount?: number;
    proteins: ProteinDto[];
};

/*
 * Parameter metadata returned by the backend for the completed run.
 */
type ParamsDto = {
    ligandType: LigandType;
    saltStart: number;
    saltEnd: number;
    saltAlpha: number;
    fractions: number;
    overlap: number;
    deadband: number;
};

/*
 * Summary counts returned by the backend.
 */
type CountsDto = {
    total: number;
    wash: number;
    retained: number;
    skipped: number;
};

/*
 * Simple x/y point used to build chart datasets.
 */
type XYPoint = { 
    x: number; 
    y: number; 
};

/*
 * Full API response shape for a successful HIC run.
 */
type HICResponse = {
    ok: boolean;
    params: ParamsDto;
    counts: CountsDto;
    wash: ProteinDto[];
    fractions: FractionDto[];
    error?: string;
};

const HydrophobicInteractionFractionation: React.FC = () => {
    /*
     * Raw FASTA text loaded from the uploaded file.
     * This is sent directly to the backend.
     */
    const [fastaText, setFastaText] = useState<string>("");

    /**
     * User-selected HIC parameters.
     */
    const [ligandType, setLigandType] = useState<LigandType>("butyl");
    const [saltStart, setSaltStart] = useState<number>(1.5);
    const [saltEnd, setSaltEnd] = useState<number>(0.0);
    const [saltAlpha, setSaltAlpha] = useState<number>(1.2);

    /**
     * Fractionation controls.
     */
    const [fractionCount, setFractionCount] = useState<number>(80);
    const [noise, setNoise] = useState<number>(0.1);
    const [deadband, setDeadband] = useState<number>(0.15);

    /*
     * Stores the full backend response after a successful run.
     * The graphs and table are derived from this object.
     */
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>("");

    /*
     * Stores the full backend response after a successful run.
     * The graphs and table are derived from this object.
     */
    const [data, setData] = useState<HICResponse | null>(null);

    /*
     * Pagination state for the fractions table.
     */
    const [fractionPage, setFractionPage] = useState<number>(0);
    const [fractionRowsPerPage, setFractionRowsPerPage] = useState<number>(10);
    
    /*
     * Reads an uploaded FASTA file into text and stores it in state.
     */
    const handleLoadFasta = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        setFastaText(text);

        // Clear the file input so the same file can be uploaded again if needed.
        event.target.value = "";
    };

    /*
     * Sends the current form values and FASTA content to the backend.
     * On success, stores the returned HIC result in `data`.
     */
    const handleRun = async () => {
        setLoading(true);
        setError("");

        try {
            const response = await fetch(
                `${API_URL}/hydrophobic_interaction_fractionation/process`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
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
                }
            );
            
            // Read raw text first so debugging bad responses is easier.
            const text = await response.text();
            console.log("HIC raw response:", text);

            let json: HICResponse;
            try {
                json = JSON.parse(text) as HICResponse;
            } catch {
                throw new Error(`Backend returned non-JSON response: ${text.slice(0, 200)}`);
            }

            if (!response.ok || !json.ok || json.error) {
                throw new Error(json.error || "Failed to process HIC fractionation.");
            }

            setData(json);
            setFractionPage(0);
        } catch (err) {
            setData(null);
            setError(err instanceof Error ? err.message : "Unexpected error");
        } finally {
            setLoading(false);
        }
    };

    /*
    * Exports the current HIC fraction table as a CSV file.
    *
    * For each fraction, this function:
    * - Calculates average hydrophobicity
    * - Calculates average binding strength
    * - Collects all protein IDs in that fraction
    *
    * The data is formatted into CSV rows, converted into a Blob,
    * and downloaded in the browser as "hic_fractions.csv".
    *
    * Only runs if valid HIC data exists.
    */
    const handleCsv = () => {
        if (!data || !data.fractions || data.fractions.length === 0) return;

        const rows: string[] = [];

        // CSV header
        rows.push([
            "Fraction",
            "Protein Count",
            "Avg Hydrophobicity",
            "Avg Binding Strength",
            "Protein IDs"
        ].join(", "));

        // One row per fraction
        data.fractions.forEach((f) => {
            const proteins = f.proteins ?? [];

            const avgHydrophobicity =
                proteins.length > 0
                    ? proteins.reduce((sum, p) => sum + p.hydrophobicity, 0) / proteins.length
                    : 0;

            const avgBindingStrength =
                proteins.length > 0
                    ? proteins.reduce((sum, p) => sum + p.bindingStrength, 0) / proteins.length
                    : 0;
            
            const proteinIds = proteins.map((p) => p.id).join("; ");

            rows.push([
                f.fractionIndex,
                f.proteinCount ?? proteins.length,
                avgHydrophobicity.toFixed(4),
                avgBindingStrength.toFixed(4),
                `"${proteinIds.replace(/"/g, '""')}"`
            ].join(", "));
        });

        const csvContent = rows.join("\n");
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = window.URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "hic_fractions.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        window.URL.revokeObjectURL(url);
    };

    // Keep salt start >= 0 and <= current salt end
    const handleSaltStartChange = (value: string) => {
        const parsed = parseFloat(value);

        if (Number.isNaN(parsed)) {
            setSaltStart(0);
            return;
        }

        const next = Math.max(0, Math.min(parsed, saltEnd));
        setSaltStart(next);
    };

    // Keep salt end >= current salt start
    const handleSaltEndChange = (value: string) => {
        const parsed = parseFloat(value);

        if (Number.isNaN(parsed)) {
            setSaltEnd(saltStart);
            return;
        }

        const next = Math.max(saltStart, parsed);
        setSaltEnd(next);
    };

    // Keep salt alpha non-negative
    const handleSaltAlphaChange = (value: string) => {
        const parsed = parseFloat(value);

        if (Number.isNaN(parsed)) {
            setSaltAlpha(0);
            return;
        }

        setSaltAlpha(Math.max(0, parsed));
    };

    // Keep fraction count at least 1
    const handleFractionCountChange = (value: string) => {
        const parsed = parseInt(value, 10);

        if (Number.isNaN(parsed)) {
            setFractionCount(1);
            return;
        }

        setFractionCount(Math.max(1, parsed));
    };

    // Keep deadband non-negative
    const handleDeadbandChange = (value: string) => {
        const parsed = parseFloat(value);

        if (Number.isNaN(parsed)) {
            setDeadband(0);
            return;
        }

        setDeadband(Math.max(0, parsed));
    };

    /*
     * Convenience alias for the returned fractions.
     * Used throughout the graphs and table.
     */
    const fractionRows = useMemo(() => data?.fractions ?? [], [data]);

    /*
     * First graph:
     * Plot average binding strength for each fraction.
     * This gives a quick summary of retention strength across the run.
     */
    const proteinSeriesPoints = useMemo(() => {
        return fractionRows.map((f) => {
            const proteins = f.proteins ?? [];
            const avgBindingStrength =
                proteins.length > 0
                    ? proteins.reduce((sum, p) => sum + p.bindingStrength, 0) / proteins.length
                    : 0;

            return {
                x: f.fractionIndex,
                y: avgBindingStrength,
            };
        });
    }, [fractionRows]);

    /*
     * Dataset for the first graph.
     */
    const chartData = useMemo(() => {
        return {
            datasets: [
                {
                    label: "Average Binding Strength per Fraction",
                    data: proteinSeriesPoints,
                    fill: false,
                    showLine: true,
                    pointRadius: 3,
                    pointHoverRadius: 5,
                    borderWidth: 3,
                    borderColor: "#8ea2ff",
                    backgroundColor: "#8ea2ff",
                    tension: 0.25,
                },
            ],
        };
    }, [proteinSeriesPoints]);

    /*
     * Display options for the first graph.
     */
    const chartOptions = useMemo(() => {
        return {
            responsive: true,
            plugins: {
            legend: {
                labels: {
                color: "#ffffff",
                },
            },
            },
            scales: {
            x: {
                type: "linear" as const,
                title: {
                    display: true,
                    text: "Fraction",
                    color: "#ffffff",
                },
                ticks: {
                    color: "#ffffff",
                },
                grid: {
                    color: "rgba(255,255,255,0.15)",
                },
            },
            y: {
                type: "linear" as const,
                title: {
                display: true,
                text: "Average Binding Strength",
                color: "#ffffff",
                },
                ticks: {
                color: "#ffffff",
                },
                grid: {
                color: "rgba(255,255,255,0.15)",
                },
            },
            },
        };
    }, []);

    /*
     * Slice the fractions list for table pagination.
     */
    const pagedFractions = useMemo(() => {
        const start = fractionPage * fractionRowsPerPage;
        const end = start + fractionRowsPerPage;
        return fractionRows.slice(start, end);
    }, [fractionRows, fractionPage, fractionRowsPerPage]);

    /*
     * Second graph:
     * Build a smooth chromatogram-style protein signal curve.
     *
     * For each fraction, we:
     * - compute average binding strength
     * - treat that as the peak height
     * - place a gaussian-like peak centered on the fraction index
     * - sum contributions across all fractions
     *
     * This creates a smooth signal trace similar to a chromatography plot.
     */
    const chromatogramSignalPoints = useMemo(() => {
        if (!data) return [];

        const fractions = data.fractions ?? [];
        if (fractions.length === 0) return [];

        const minX = 1;
        const maxX = fractions.length;
        const step = 0.02; // Smaller step = smoother curve
        const width = 0.18; // Controls how wide each peak is

        const points: XYPoint[] = [];

        for (let x = minX; x <= maxX; x += step) {
            let y = 0;

            fractions.forEach((f) => {
                const proteins = f.proteins ?? [];
                const avgBindingStrength =
                    proteins.length > 0
                        ? proteins.reduce((sum, p) => sum + p.bindingStrength, 0) / proteins.length
                        : 0;
                
                const center = f.fractionIndex;

                // Add gaussian contribution from this fraction's peak.
                y += avgBindingStrength * Math.exp(-((x - center) ** 2) / (2 * width * width));
            });

            points.push({
                x: Number(x.toFixed(2)),
                y,
            });
        }

        return points;
    }, [data]);

    /*
     * Build the salt gradient overlay for the second graph.
     * It stays flat initially, then transitions toward saltEnd across later fractions.
     */
    const saltGradientPoints = useMemo(() => {
        if (!data) return [];

        const fractions = data.fractions ?? [];
        const totalFractions = Math.max(1, fractions.length);

        // Start the gradient after an initial loading/binding region.
        const gradientStartFraction = Math.max(2, Math.floor(totalFractions * 0.18));

        return fractions.map((f, index) => {
            let y = data.params.saltStart;

            if (index + 1 > gradientStartFraction) {
                const progress =
                    ((index + 1) - gradientStartFraction) /
                    Math.max(1, totalFractions - gradientStartFraction);
                y = data.params.saltStart +
                    (data.params.saltEnd - data.params.saltStart) * progress;
            }

            return {
                x: f.fractionIndex,
                y,
            };
        });
    }, [data]);

    /*
     * Combined dataset for the second graph:
     * - Protein signal on left y-axis
     * - Salt gradient on right y-axis
     */
    const saltChartData = useMemo(() => {
        return {
            datasets: [
                {
                    label: "Protein Signal",
                    data: chromatogramSignalPoints,
                    parsing: false as const,
                    borderColor: "#66d1b2",
                    backgroundColor: "#66d1b2",
                    yAxisID: "y",
                    tension: 0.35,
                    borderWidth: 3,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    fill: false as const,
                },
                {
                    label: "Salt Gradient",
                    data: saltGradientPoints,
                    parsing: false as const,
                    borderColor: "#ff6b6b",
                    backgroundColor: "#ff6b6b",
                    yAxisID: "y1",
                    tension: 0,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    borderDash: [6, 6],
                    fill: false as const,
                },
            ],
        };
    }, [chromatogramSignalPoints, saltGradientPoints]);

    /*
     * Display and interaction options for the second graph.
     */
    const saltChartOptions = useMemo(() => {
        return {
            responsive: true,
            maintainAspectRatio: true,
            aspectRatio: 2.5,
            animation: false as const,
            interaction: {
                mode: "nearest" as const,
                intersect: false,
            },
            plugins: {
                tooltip: {
                    enabled: true,
                    mode: "nearest" as const,
                    intersect: false,
                },
                legend: {
                    labels: {
                        color: "#ffffff",
                    },
                },
            },
            elements: {
                line: {
                    tension: 0,
                },
                point: {
                    radius: 0,
                },
            },
            scales: {
                x: {
                    type: "linear" as const,
                    min: 1,
                    max: data?.fractions.length ?? 1,
                    title: {
                        display: true,
                        text: "Fraction",
                        color: "#ffffff",
                    },
                    ticks: {
                        color: "#ffffff",
                        stepSize: 1,
                    },
                    grid: {
                        color: "rgba(255,255,255,0.12)",
                    },
                },
                y: {
                    type: "linear" as const,
                    position: "left" as const,
                    title: {
                        display: true,
                        text: "Protein Signal",
                        color: "#66d1b2",
                    },
                    ticks: {
                        color: "#ffffff",
                    },
                    grid: {
                        color: "rgba(255,255,255,0.12)",
                    },
                },
                y1: {
                    type: "linear" as const,
                    position: "right" as const,
                    title: {
                        display: true,
                        text: "Salt Concentration",
                        color: "#ff6b6b",
                    },
                    ticks: {
                        color: "#ffffff",
                    },
                    grid: {
                        drawOnChartArea: false,
                    },
                },
            },
        };
    }, [data]);

    return (
        <Box className="hic-container">
            <Card className="hic-card">
                <CardHeader title="Hydrophobic Interaction Fractionation (HIC)" />
                <CardContent>
                    {/* Show backend or request errors */}
                    {error && (
                        <Alert severity="error" className="hic-alert">
                            {error}
                        </Alert>
                    )}

                    {/* Main control row for user inputs */}
                    <Box className="hic-controls">
                        <FormControl className="hic-field">
                            <InputLabel id="ligand-label">Ligand Type</InputLabel>
                            <Select
                                labelId="ligand-label"
                                value={ligandType}
                                label="Ligand Type"
                                onChange={(e) => setLigandType(e.target.value as LigandType)}
                            >
                                <MenuItem value="butyl">Butyl</MenuItem>
                                <MenuItem value="octyl">Octyl</MenuItem>
                                <MenuItem value="phenyl">Phenyl</MenuItem>
                            </Select>
                        </FormControl>

                        <TextField
                            className="hic-field"
                            label="Salt Start"
                            type="number"
                            value={saltStart}
                            onChange={(e) => handleSaltStartChange(e.target.value)}
                        />

                        <TextField
                            className="hic-field"
                            label="Salt End"
                            type="number"
                            value={saltEnd}
                            onChange={(e) => handleSaltEndChange(e.target.value)}
                        />

                        <TextField
                            className="hic-field"
                            label="Salt Alpha"
                            type="number"
                            value={saltAlpha}
                            onChange={(e) => handleSaltAlphaChange(e.target.value)}
                        />

                        <TextField
                            className="hic-field"
                            label="Fractions"
                            type="number"
                            value={fractionCount}
                            onChange={(e) => handleFractionCountChange(e.target.value)}
                        />

                        <TextField
                            className="hic-field hic-field-wide"
                            label="Deadband (bindingStrength)"
                            type="number"
                            value={deadband}
                            onChange={(e) => handleDeadbandChange(e.target.value)}
                        />
                    </Box>
                    
                    {/* Noise / overlap slider */}
                    <Box className="hic-slider">
                        <Typography className="hic-slider-label">Noise / Overlap</Typography>
                        <Slider 
                            value={noise}
                            step={0.01}
                            min={0}
                            max={1}
                            onChange={(_, v) => setNoise(v as number)}
                            valueLabelDisplay="auto"
                        />
                    </Box>


                    {/* Main action buttons */}
                    <Box className="hic-button-row">
                        <Button variant="contained" component="label">
                            Upload FASTA
                            <input hidden type="file" onChange={handleLoadFasta} />
                        </Button>

                        <Button
                            variant="contained"
                            onClick={handleRun}
                            disabled={loading || !fastaText.trim()}
                        >
                            {loading ? "Running..." : "Run HIC"}
                        </Button>
                    </Box>
                </CardContent>
            </Card>
            
            {/* Only show results after a successful run */}
            {data && (
                <>
                    {/* First graph: average binding strength by fraction */}
                    <Card className="hic-card">
                        <CardHeader title="Chromatogram" />
                        <CardContent>
                            <Box className="hic-chart-box">
                                <Line data={chartData} options={chartOptions} />
                            </Box>
                            <Box className="hic-stats">
                                <Typography variant="body2">
                                    Ligand: {data.params.ligandType} | Salt Start: {data.params.saltStart} | Salt End: {data.params.saltEnd} | Deadband: {data.params.deadband}
                                </Typography>
                                <Typography variant="body2">
                                    Total: {data.counts.total} | Wash: {data.counts.wash} | Retained: {data.counts.retained} | Skipped: {data.counts.skipped}
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>

                    {/* Second graph: smooth signal trace plus salt gradient overlay */}
                    <Card className="hic-card">
                        <CardHeader title="Chromatogram (Signal + Salt Gradient)" />
                        <CardContent>
                            <Box className="hic-chart-box">
                                <Line data={saltChartData} options={saltChartOptions}/>
                            </Box>
                        </CardContent>
                    </Card>
                    
                    {/* Results table for individual fractions */}
                    <Card className="hic-table-card">
                        <CardHeader title="Fractions" />
                        <CardContent>
                            {/* Download the currently generated fraction summary as a CSV file */}
                            <Box className="hic-button-row">
                                <Button
                                    variant="contained"
                                    onClick={handleCsv}
                                    disabled={!data || !data.fractions || data.fractions.length === 0}
                                >
                                    Download CSV
                                </Button>
                            </Box>
                            <TableContainer>
                                <Table size="small" className="hic-table">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Fraction</TableCell>
                                            <TableCell align="right">Protein Count</TableCell>
                                            <TableCell align="right">Avg Hydrophobicity</TableCell>
                                            <TableCell align="right">Avg Binding Strength</TableCell>
                                            <TableCell>Example Proteins</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {pagedFractions.map((f) => {
                                            const proteins = f.proteins ?? [];
                                            const avgHydrophobicity =
                                                proteins.length > 0
                                                    ? proteins.reduce((sum, p) => sum + p.hydrophobicity, 0) / proteins.length
                                                    : 0;

                                            const avgBindingStrength =
                                                proteins.length > 0
                                                    ? proteins.reduce((sum, p) => sum + p.bindingStrength, 0) / proteins.length
                                                    : 0;

                                            return (
                                                <TableRow key={f.fractionIndex}>
                                                    <TableCell>{f.fractionIndex}</TableCell>
                                                    <TableCell align="right">
                                                        {f.proteinCount ?? proteins.length}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {avgHydrophobicity.toFixed(3)}
                                                    </TableCell>
                                                    <TableCell align="right">
                                                        {avgBindingStrength.toFixed(3)}
                                                    </TableCell>
                                                    <TableCell>
                                                        {proteins.slice(0, 3).map((p) => p.id).join(", ")}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </Table>
                            </TableContainer>

                            <TablePagination
                                className="hic-pagination"
                                component="div"
                                count={fractionRows.length}
                                page={fractionPage}
                                onPageChange={(_, newPage) => setFractionPage(newPage)}
                                rowsPerPage={fractionRowsPerPage}
                                onRowsPerPageChange={(e) => {
                                    setFractionRowsPerPage(parseInt(e.target.value, 10));
                                    setFractionPage(0);
                                }}
                                rowsPerPageOptions={[5, 10, 25, 50]}
                            />
                        </CardContent>
                    </Card>
                </>
            )}
        </Box>
    );
};

export default HydrophobicInteractionFractionation;



