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

type LigandType = "butyl" | "octyl" | "phenyl";

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

type FractionDto = {
    fractionIndex: number;
    proteinCount?: number;
    proteins: ProteinDto[];
};

type ParamsDto = {
    ligandType: LigandType;
    saltStart: number;
    saltEnd: number;
    saltAlpha: number;
    fractions: number;
    overlap: number;
    deadband: number;
};

type CountsDto = {
    total: number;
    wash: number;
    retained: number;
    skipped: number;
};

type XYPoint = { 
    x: number; 
    y: number; 
};

type HICResponse = {
    ok: boolean;
    params: ParamsDto;
    counts: CountsDto;
    wash: ProteinDto[];
    fractions: FractionDto[];
    error?: string;
};

const HydrophobicInteractionFractionation: React.FC = () => {
    const [fastaText, setFastaText] = useState<string>("");
    const [ligandType, setLigandType] = useState<LigandType>("butyl");
    const [saltStart, setSaltStart] = useState<number>(1.5);
    const [saltEnd, setSaltEnd] = useState<number>(0.0);
    const [saltAlpha, setSaltAlpha] = useState<number>(1.2);

    const [fractionCount, setFractionCount] = useState<number>(80);
    const [noise, setNoise] = useState<number>(0.1);
    const [deadband, setDeadband] = useState<number>(0.15);

    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const [data, setData] = useState<HICResponse | null>(null);

    const [fractionPage, setFractionPage] = useState<number>(0);
    const [fractionRowsPerPage, setFractionRowsPerPage] = useState<number>(10);
    
    const handleLoadFasta = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        setFastaText(text);
        event.target.value = "";
    };

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

    const fractionRows = useMemo(() => data?.fractions ?? [], [data]);

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

    const pagedFractions = useMemo(() => {
        const start = fractionPage * fractionRowsPerPage;
        const end = start + fractionRowsPerPage;
        return fractionRows.slice(start, end);
    }, [fractionRows, fractionPage, fractionRowsPerPage]);

    const chromatogramSignalPoints = useMemo(() => {
        if (!data) return [];

        const fractions = data.fractions ?? [];
        if (fractions.length === 0) return [];

        const minX = 1;
        const maxX = fractions.length;
        const step = 0.02;
        const width = 0.18;
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
                y += avgBindingStrength * Math.exp(-((x - center) ** 2) / (2 * width * width));
            });

            points.push({
                x: Number(x.toFixed(2)),
                y,
            });
        }

        return points;
    }, [data]);

    const saltGradientPoints = useMemo(() => {
        if (!data) return [];

        const fractions = data.fractions ?? [];
        const totalFractions = Math.max(1, fractions.length);
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
                    {error && (
                        <Alert severity="error" className="hic-alert">
                            {error}
                        </Alert>
                    )}

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
                            onChange={(e) => setSaltStart(parseFloat(e.target.value))}
                        />

                        <TextField
                            className="hic-field" 
                            label="Salt End"
                            type="number"
                            value={saltEnd}
                            onChange={(e) => setSaltEnd(parseFloat(e.target.value))}
                        />

                        <TextField
                            className="hic-field" 
                            label="Salt Alpha"
                            type="number"
                            value={saltAlpha}
                            onChange={(e) => setSaltAlpha(parseFloat(e.target.value))}
                        />

                        <TextField
                            className="hic-field"
                            label="Fractions"
                            type="number"
                            value={fractionCount}
                            onChange={(e) => setFractionCount(parseInt(e.target.value, 10))}
                        />

                        <TextField
                            className="hic-field hic-field-wide" 
                            label="Deadband (bindingStrength)"
                            type="number"
                            value={deadband}
                            onChange={(e) => setDeadband(parseFloat(e.target.value))}
                        />
                    </Box>

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

            {data && (
                <>
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

                    <Card className="hic-card">
                        <CardHeader title="Chromatogram (Signal + Salt Gradient)" />
                        <CardContent>
                            <Box className="hic-chart-box">
                                <Line data={saltChartData} options={saltChartOptions}/>
                            </Box>
                        </CardContent>
                    </Card>

                    <Card className="hic-table-card">
                        <CardHeader title="Fractions" />
                        <CardContent>
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



