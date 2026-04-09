import React, {
  Suspense,
  lazy,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
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
  TableRow,
  TextField,
  Typography,
  Switch,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
} from "@mui/material";
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
import "./IonExchangeFractionation.css";
import {
  ArrowDropDown,
  ArrowDropUp,
  CheckCircleOutlined,
  ChecklistOutlined,
  ControlPointOutlined,
  ExpandMore,
  FileUpload,
  Download,
  PlayArrow,
  RemoveOutlined,
  SettingsOutlined,
  WashOutlined,
  Search,
} from "@mui/icons-material";

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

type MediaType = "Q" | "S";

type ProteinDto = {
  id: string;
  name: string;
  description: string;
  sequence: string;
  molecularWeight: number;
  charge: number;
  color: string;
  amount: number;
};

type FractionDto = {
  fractionIndex: number;
  proteinCount?: number;
  hitCount?: number;
  hitProteinIds?: string[];
  proteins: ProteinDto[];
};

type ParamsDto = {
  pH: number;
  mediaType: MediaType;
  exchanger: "anion" | "cation";
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

type IonExchangeResponse = {
  ok: boolean;
  params: ParamsDto;
  counts: CountsDto;
  wash: ProteinDto[];
  fractions: FractionDto[];
  error?: string;
};

type SortDirection = "asc" | "desc";

type FractionSortKey = "fractionIndex" | "proteinCount" | "hitCount";
type ProteinSortKey = "charge" | "molecularWeight";

const MAX_STACKED_SERIES = 200;

const LazyBar = lazy(() =>
  import("react-chartjs-2").then((module) => ({ default: module.Bar })),
);
const LazyLine = lazy(() =>
  import("react-chartjs-2").then((module) => ({ default: module.Line })),
);
const LazyScatter = lazy(() =>
  import("react-chartjs-2").then((module) => ({
    default: module.Scatter,
  })),
);

const ChartLoadingPlaceholder: React.FC<{ chartName: string }> = ({
  chartName,
}) => {
  return (
    <Box className="ionx-chart-loading">
      <CircularProgress size={34} thickness={4.5} />
      <Typography variant="body2">Loading {chartName}</Typography>
    </Box>
  );
};

const IonExchangeFractionation: React.FC = () => {
  const [fastaText, setFastaText] = useState<string>("");
  const [ph, setPh] = useState<number>(7.0);
  const [mediaType, setMediaType] = useState<MediaType>("Q");
  const [fractionCount, setFractionCount] = useState<number>(80);
  const [noise, setNoise] = useState<number>(0.1);
  const [deadband, setDeadband] = useState<number>(0.05);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<IonExchangeResponse | null>(null);

  const [fractionPage, setFractionPage] = useState<number>(0);
  const [fractionRowsPerPage, setFractionRowsPerPage] = useState<number>(10);
  const [proteinPage, setProteinPage] = useState<number>(0);
  const [proteinRowsPerPage, setProteinRowsPerPage] = useState<number>(10);
  const [showLineGraph, setShowLineGraph] = useState<boolean>(true);
  const [useLogScale, setUseLogScale] = useState<boolean>(true);
  const [showWash, setShowWash] = useState<boolean>(false);
  const [fractionSort, setFractionSort] = useState<{
    key: FractionSortKey;
    direction: SortDirection;
  }>({
    key: "fractionIndex",
    direction: "asc",
  });
  const [proteinSort, setProteinSort] = useState<{
    key: ProteinSortKey;
    direction: SortDirection;
  }>({
    key: "charge",
    direction: "asc",
  });
  const [fractionSearch, setFractionSearch] = useState<string>("");
  const [proteinSearch, setProteinSearch] = useState<string>("");

  const lineChartRef = useRef<ChartJS<"line"> | null>(null);
  const scatterChartRef = useRef<ChartJS<"scatter"> | null>(null);
  const stackedChartRef = useRef<ChartJS<"bar"> | null>(null);

  const downloadChart = useCallback(
    (chart: ChartJS | null, fileName: string) => {
      if (!chart) {
        return;
      }

      const canvas = chart.canvas;
      const exportCanvas = document.createElement("canvas");
      exportCanvas.width = canvas.width;
      exportCanvas.height = canvas.height;

      const exportCtx = exportCanvas.getContext("2d");
      if (!exportCtx) {
        return;
      }

      exportCtx.fillStyle = "#ffffff";
      exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
      exportCtx.drawImage(canvas, 0, 0);

      const base64Image = exportCanvas.toDataURL("image/png");

      const a = document.createElement("a");
      a.href = base64Image;
      a.download = fileName;
      a.click();
    },
    [],
  );

  const exportChromatogram = useCallback(() => {
    const activeChart = showLineGraph
      ? lineChartRef.current
      : scatterChartRef.current;
    downloadChart(activeChart, "chromatogram.png");
  }, [downloadChart, showLineGraph]);

  const exportStackedProteins = useCallback(() => {
    downloadChart(stackedChartRef.current, "stacked-proteins.png");
  }, [downloadChart]);

  const handleLoadFasta = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const text = await file.text();
    setFastaText(text);
    event.target.value = "";
  };

  const handleRunFractionation = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `${API_URL}/ion_exchange_fractionation/process`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fasta_content: fastaText,
            ph,
            media_type: mediaType,
            fraction_count: fractionCount,
            noise,
            deadband,
          }),
        },
      );

      const json = (await response.json()) as IonExchangeResponse;
      if (!response.ok || !json.ok || json.error) {
        throw new Error(
          json.error || "Failed to process ion exchange fractionation.",
        );
      }

      setData(json);
      setProteinPage(0);
      setFractionPage(0);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setLoading(false);
    }
  };

  const fractionRows = useMemo(() => data?.fractions ?? [], [data]);

  const retainedRows = useMemo(() => {
    const byKey = new Map<string, ProteinDto>();
    for (const fraction of fractionRows) {
      for (const protein of fraction.proteins) {
        byKey.set(`${protein.id}::${protein.sequence}`, protein);
      }
    }
    return Array.from(byKey.values()).sort(
      (a, b) => Math.abs(a.charge) - Math.abs(b.charge),
    );
  }, [fractionRows]);

  const filteredFractionRows = useMemo(() => {
    const query = fractionSearch.trim().toLowerCase();
    if (!query) {
      return fractionRows;
    }

    return fractionRows.filter((row) => {
      const proteinCount = row.proteinCount ?? row.proteins.length;
      const hitCount = row.hitCount ?? 0;
      const hitIds = (row.hitProteinIds ?? []).join(" ").toLowerCase();

      return (
        String(row.fractionIndex).includes(query) ||
        String(proteinCount).includes(query) ||
        String(hitCount).includes(query) ||
        hitIds.includes(query)
      );
    });
  }, [fractionRows, fractionSearch]);

  const sortedFractionRows = useMemo(() => {
    const rows = [...filteredFractionRows];
    const directionMultiplier = fractionSort.direction === "asc" ? 1 : -1;

    rows.sort((a, b) => {
      const aValue =
        fractionSort.key === "fractionIndex"
          ? a.fractionIndex
          : fractionSort.key === "proteinCount"
            ? (a.proteinCount ?? a.proteins.length)
            : (a.hitCount ?? 0);

      const bValue =
        fractionSort.key === "fractionIndex"
          ? b.fractionIndex
          : fractionSort.key === "proteinCount"
            ? (b.proteinCount ?? b.proteins.length)
            : (b.hitCount ?? 0);

      return (aValue - bValue) * directionMultiplier;
    });

    return rows;
  }, [filteredFractionRows, fractionSort]);

  const filteredRetainedRows = useMemo(() => {
    const query = proteinSearch.trim().toLowerCase();
    if (!query) {
      return retainedRows;
    }

    return retainedRows.filter((row) => {
      return (
        row.id.toLowerCase().includes(query) ||
        row.name.toLowerCase().includes(query) ||
        row.sequence.toLowerCase().includes(query) ||
        row.description.toLowerCase().includes(query) ||
        row.charge.toFixed(2).includes(query) ||
        row.molecularWeight.toFixed(2).includes(query)
      );
    });
  }, [retainedRows, proteinSearch]);

  const sortedRetainedRows = useMemo(() => {
    const rows = [...filteredRetainedRows];
    const directionMultiplier = proteinSort.direction === "asc" ? 1 : -1;

    rows.sort((a, b) => {
      const aValue =
        proteinSort.key === "charge" ? a.charge : a.molecularWeight;
      const bValue =
        proteinSort.key === "charge" ? b.charge : b.molecularWeight;

      return (aValue - bValue) * directionMultiplier;
    });

    return rows;
  }, [filteredRetainedRows, proteinSort]);

  const handleFractionSort = (
    key: FractionSortKey,
    direction: SortDirection,
  ) => {
    setFractionSort({ key, direction });
    setFractionPage(0);
  };

  const handleProteinSort = (key: ProteinSortKey, direction: SortDirection) => {
    setProteinSort({ key, direction });
    setProteinPage(0);
  };

  const pagedProteins = useMemo(() => {
    const start = proteinPage * proteinRowsPerPage;
    return sortedRetainedRows.slice(start, start + proteinRowsPerPage);
  }, [sortedRetainedRows, proteinPage, proteinRowsPerPage]);

  const pagedFractions = useMemo(() => {
    const start = fractionPage * fractionRowsPerPage;
    return sortedFractionRows.slice(start, start + fractionRowsPerPage);
  }, [sortedFractionRows, fractionPage, fractionRowsPerPage]);

  const proteinSeriesPoints = useMemo(() => {
    const points: Array<{ x: number; y: number }> = [];

    if (showWash) {
      points.push({ x: 0, y: data?.wash?.length ?? 0 });
    }

    for (const fraction of fractionRows) {
      points.push({
        x: fraction.fractionIndex,
        y: fraction.proteins.map((p) => p.amount).reduce((a, b) => a + b, 0),
      });
    }
    const maxY = Math.max(...points.map((p) => p.y), 1);
    for (const point of points) {
      point.y = Math.round((point.y / maxY) * 100) / 100;
    }
    return points;
  }, [data, fractionRows, showWash]);

  const scatterData = useMemo(() => {
    return {
      datasets: [
        {
          label: "Proteins per fraction",
          data: proteinSeriesPoints,
          backgroundColor: "rgba(107, 224, 57, 0.8)",
          pointRadius: 4,
        },
      ],
    };
  }, [proteinSeriesPoints]);

  const lineData = useMemo(() => {
    return {
      datasets: [
        {
          label: "Proteins per fraction",
          data: proteinSeriesPoints,
          borderColor: "rgba(107, 224, 57, 1)",
          backgroundColor: "rgba(107, 224, 57, 0.8)",
          pointRadius: 0,
          pointHoverRadius: 5,
          tension: 0.1,
          fill: false,
        },
      ],
    };
  }, [proteinSeriesPoints]);

  const stackedHitAmounts = useMemo(() => {
    const proteinColorById = new Map<string, string>();
    const proteinTotals = new Map<string, number>();
    const fractionAmountMaps: Array<Map<string, number>> = [];
    const labels: string[] = [];
    const baseOtherData: number[] = [];

    const washAmountByProteinId = new Map<string, number>();
    let washOtherTotal = 0;
    for (const protein of data?.wash ?? []) {
      washOtherTotal += protein.amount;
    }

    if (showWash) {
      labels.push("Wash");
      fractionAmountMaps.push(washAmountByProteinId);
      baseOtherData.push(washOtherTotal);
    }

    for (const fraction of fractionRows) {
      const amountByProteinId = new Map<string, number>();
      const hitIdSet = new Set(fraction.hitProteinIds ?? []);
      const hasHitFilter = hitIdSet.size > 0;
      let fractionOtherTotal = 0;

      labels.push(String(fraction.fractionIndex));

      for (const protein of fraction.proteins) {
        const isHitProtein = hasHitFilter && hitIdSet.has(protein.id);
        if (!isHitProtein) {
          fractionOtherTotal += protein.amount;
          continue;
        }

        const previous = amountByProteinId.get(protein.id) ?? 0;
        const next = previous + protein.amount;
        amountByProteinId.set(protein.id, next);

        proteinTotals.set(
          protein.id,
          (proteinTotals.get(protein.id) ?? 0) + protein.amount,
        );

        if (!proteinColorById.has(protein.id)) {
          proteinColorById.set(protein.id, protein.color);
        }
      }

      fractionAmountMaps.push(amountByProteinId);
      baseOtherData.push(fractionOtherTotal);
    }

    const sortedProteinIds = Array.from(proteinTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([proteinId]) => proteinId);

    const keptProteinIds = sortedProteinIds.slice(0, MAX_STACKED_SERIES);
    const keptSet = new Set(keptProteinIds);

    const datasets = keptProteinIds.map((proteinId) => ({
      label: proteinId,
      data: fractionAmountMaps.map(
        (fractionMap) => fractionMap.get(proteinId) ?? 0,
      ),
      backgroundColor:
        proteinColorById.get(proteinId) ?? "rgba(107, 224, 57, 0.8)",
      stack: "hit-protein-amounts",
      borderWidth: 0,
      barPercentage: 1,
      categoryPercentage: 1,
    }));

    const otherData = fractionAmountMaps.map((fractionMap, fractionIndex) => {
      let otherTotal = baseOtherData[fractionIndex] ?? 0;
      fractionMap.forEach((amount, proteinId) => {
        if (!keptSet.has(proteinId)) {
          otherTotal += amount;
        }
      });
      return otherTotal;
    });

    const hasOther = otherData.some((value) => value > 0);
    if (hasOther) {
      datasets.push({
        label: showWash ? "Other/Wash" : "Other",
        data: otherData,
        backgroundColor: "rgba(120, 120, 120, 0.85)",
        stack: "hit-protein-amounts",
        borderWidth: 0,
        barPercentage: 1,
        categoryPercentage: 1,
      });
    }

    return {
      labels,
      datasets,
      hiddenProteinCount: Math.max(
        sortedProteinIds.length - MAX_STACKED_SERIES,
        0,
      ),
    };
  }, [data, fractionRows, showWash]);

  return (
    <div className="ionx-page">
      <Card className="ionx-card">
        <CardHeader title="Ion Exchange Fractionation" />
        <CardContent>
          <Box className="ionx-controls">
            <Button
              className="ionx-button"
              component="label"
              variant="contained"
              startIcon={<FileUpload />}
            >
              Upload FASTA File
              <input
                type="file"
                hidden
                accept=".fasta,.fas,.fa,.faa"
                onChange={handleLoadFasta}
              />
            </Button>

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel id="media-type-label">Media</InputLabel>
              <Select
                labelId="media-type-label"
                value={mediaType}
                label="Media"
                onChange={(e) => setMediaType(e.target.value as MediaType)}
              >
                <MenuItem value="Q">Q media (Triethylamine +)</MenuItem>
                <MenuItem value="S">S media (Sulfite -)</MenuItem>
              </Select>
            </FormControl>
            <Button
              className="ionx-button"
              variant="contained"
              disabled={loading || fastaText.trim().length === 0}
              onClick={handleRunFractionation}
              startIcon={<PlayArrow />}
              sx={{ marginLeft: "auto" }}
            >
              {loading ? "Processing..." : "Run Fractionation"}
            </Button>
          </Box>
          <Box sx={{ marginTop: "1rem", marginBottom: "0.5rem" }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.5rem",
              }}
            >
              <Typography gutterBottom sx={{ margin: 0 }}>
                pH: {ph.toFixed(1)}
              </Typography>
              <TextField
                size="small"
                type="number"
                value={ph}
                onChange={(e) =>
                  setPh(
                    Math.max(0, Math.min(14, Number(e.target.value) || 7.0)),
                  )
                }
                inputMode="decimal"
                sx={{ width: 80 }}
              />
            </Box>
            <Slider
              min={0}
              max={14}
              step={0.5}
              value={ph}
              marks
              onChange={(_, value) => setPh(value as number)}
            />
          </Box>

          <Box sx={{ marginTop: "1rem", marginBottom: "0.5rem" }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "0.5rem",
              }}
            >
              <Typography gutterBottom sx={{ margin: 0 }}>
                Fractions: {fractionCount}
              </Typography>
              <TextField
                size="small"
                type="number"
                value={fractionCount}
                onChange={(e) =>
                  setFractionCount(Math.max(1, Number(e.target.value) || 80))
                }
                inputMode="numeric"
                sx={{ width: 80 }}
              />
            </Box>
            <Slider
              min={0}
              max={200}
              step={10}
              value={fractionCount}
              marks
              onChange={(_, value) => setFractionCount(value as number)}
            />
          </Box>

          <Accordion
            sx={{
              marginBottom: "0.5rem",
              backgroundColor: "var(--background)",
            }}
          >
            <AccordionSummary
              aria-controls="panel1-content"
              id="panel1-header"
              expandIcon={<ExpandMore />}
            >
              <SettingsOutlined sx={{ marginRight: "0.5rem" }} />
              <Typography component="span">Advanced</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Box sx={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}>
                <Typography gutterBottom>
                  Fuzzy overlap noise: {noise.toFixed(2)}
                </Typography>
                <Slider
                  min={0}
                  max={0.5}
                  step={0.01}
                  value={noise}
                  onChange={(_, value) => setNoise(value as number)}
                />
              </Box>

              <Box sx={{ marginTop: "0.5rem", marginBottom: "0.5rem" }}>
                <Typography gutterBottom>
                  Charge deadband: ±{deadband.toFixed(2)}
                </Typography>
                <Slider
                  min={0}
                  max={1}
                  step={0.01}
                  value={deadband}
                  onChange={(_, value) => setDeadband(value as number)}
                />
              </Box>
            </AccordionDetails>
          </Accordion>

          {error && (
            <Alert severity="error" sx={{ marginTop: "1rem" }}>
              {error}
            </Alert>
          )}
        </CardContent>
      </Card>

      {data && (
        <>
          <Card className="ionx-card">
            <CardHeader title="Summary" />
            <CardContent>
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                  gap: 2,
                }}
              >
                <Card className="ionx-summary-info-card">
                  <Box>
                    <ChecklistOutlined />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">
                      Processed Records
                    </Typography>
                    <Typography variant="h6">{data.counts.total}</Typography>
                  </Box>
                </Card>
                <Card className="ionx-summary-info-card">
                  <Box>
                    <CheckCircleOutlined />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">
                      Retained Proteins
                    </Typography>
                    <Typography variant="h6">{data.counts.retained}</Typography>
                  </Box>
                </Card>
                <Card className="ionx-summary-info-card">
                  <Box>
                    <WashOutlined />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="textSecondary">
                      Wash Proteins
                    </Typography>
                    <Typography variant="h6">{data.counts.wash}</Typography>
                  </Box>
                </Card>
                <Card className="ionx-summary-info-card">
                  {data.params.exchanger === "anion" ? (
                    <Box>
                      <ControlPointOutlined />
                    </Box>
                  ) : (
                    <Box>
                      <RemoveOutlined />
                    </Box>
                  )}
                  <Box>
                    <Typography variant="caption" color="textSecondary">
                      Exchanger
                    </Typography>
                    <Typography
                      variant="h6"
                      sx={{ textTransform: "capitalize" }}
                    >
                      {data.params.exchanger}
                    </Typography>
                  </Box>
                </Card>
              </Box>
            </CardContent>
          </Card>

          <Card className="ionx-card">
            <CardHeader title="Fractionation" />
            <CardContent>
              <div className="ionx-chart-wrap">
                <FormControlLabel
                  control={
                    <Switch
                      checked={showLineGraph}
                      onChange={(_, checked) => setShowLineGraph(checked)}
                    />
                  }
                  label="Line"
                  sx={{ marginBottom: "0.25rem" }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={useLogScale}
                      onChange={(_, checked) => setUseLogScale(checked)}
                    />
                  }
                  label="Log Scale"
                  sx={{ marginBottom: "0.25rem" }}
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={showWash}
                      onChange={(_, checked) => setShowWash(checked)}
                    />
                  }
                  label="Show Wash"
                  sx={{ marginBottom: "0.25rem" }}
                />
                <Box className="ionx-chart-actions">
                  <Button
                    className="ionx-button"
                    variant="contained"
                    onClick={exportChromatogram}
                    startIcon={<Download />}
                  >
                    Download
                  </Button>
                </Box>
                <div className="ionx-chart-surface">
                  {showLineGraph ? (
                    <Suspense
                      fallback={
                        <ChartLoadingPlaceholder chartName="Chromatogram" />
                      }
                    >
                      <LazyLine
                        ref={lineChartRef}
                        data={lineData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          scales: {
                            x: {
                              type: "linear",
                              title: {
                                display: true,
                                text: "Fractions",
                              },
                              beginAtZero: true,
                              ticks: {
                                callback: (value) =>
                                  Number(value) === 0
                                    ? showWash
                                      ? "Wash"
                                      : "0"
                                    : String(value),
                              },
                            },
                            y: {
                              type: useLogScale ? "logarithmic" : "linear",
                              title: {
                                display: true,
                                text: showWash ? "Retained+Wash" : "Retained",
                              },
                              beginAtZero: !useLogScale,
                            },
                          },
                        }}
                      />
                    </Suspense>
                  ) : (
                    <Suspense
                      fallback={
                        <ChartLoadingPlaceholder chartName="Chromatogram" />
                      }
                    >
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
                                text: "Fractions",
                              },
                              beginAtZero: true,
                              ticks: {
                                callback: (value) =>
                                  Number(value) === 0
                                    ? showWash
                                      ? "Wash"
                                      : "0"
                                    : String(value),
                              },
                            },
                            y: {
                              type: useLogScale ? "logarithmic" : "linear",
                              title: {
                                display: true,
                                text: showWash ? "Retained+Wash" : "Retained",
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

              <div className="ionx-chart-wrap ionx-stacked-chart-wrap">
                <Box className="ionx-chart-actions">
                  <Button
                    className="ionx-button"
                    variant="contained"
                    onClick={exportStackedProteins}
                    startIcon={<Download />}
                  >
                    Download
                  </Button>
                </Box>
                <div className="ionx-chart-surface">
                  <Suspense
                    fallback={
                      <ChartLoadingPlaceholder chartName="Stacked Proteins" />
                    }
                  >
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
                              text: showWash ? "Wash / Fractions" : "Fractions",
                            },
                          },
                          y: {
                            stacked: true,
                            type: useLogScale ? "logarithmic" : "linear",
                            title: {
                              display: true,
                              text: showWash
                                ? "Retained+Wash Amount"
                                : "Retained Amount",
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
            </CardContent>
          </Card>

          <Card className="ionx-card">
            <CardHeader
              title="Hits"
              action={
                <TextField
                  variant="outlined"
                  value={fractionSearch}
                  onChange={(e) => {
                    setFractionSearch(e.target.value);
                    setFractionPage(0);
                  }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
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
                component="div"
                count={sortedFractionRows.length}
                page={fractionPage}
                onPageChange={(_, newPage) => setFractionPage(newPage)}
                rowsPerPage={fractionRowsPerPage}
                onRowsPerPageChange={(e) => {
                  setFractionRowsPerPage(Number(e.target.value));
                  setFractionPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50]}
              />
              <TableContainer className="ionx-table-container ionx-fractions-table-container">
                <Table className="ionx-fractions-table">
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <Box
                          className="ionx-sort-header"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          Fraction
                          <IconButton
                            size="small"
                            color={
                              fractionSort.key === "fractionIndex" &&
                              fractionSort.direction === "asc"
                                ? "primary"
                                : "default"
                            }
                            onClick={() =>
                              handleFractionSort("fractionIndex", "asc")
                            }
                            title="Sort ascending"
                          >
                            <ArrowDropUp fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color={
                              fractionSort.key === "fractionIndex" &&
                              fractionSort.direction === "desc"
                                ? "primary"
                                : "default"
                            }
                            onClick={() =>
                              handleFractionSort("fractionIndex", "desc")
                            }
                            title="Sort descending"
                          >
                            <ArrowDropDown fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box
                          className="ionx-sort-header"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          Protein Count
                          <IconButton
                            size="small"
                            color={
                              fractionSort.key === "proteinCount" &&
                              fractionSort.direction === "asc"
                                ? "primary"
                                : "default"
                            }
                            onClick={() =>
                              handleFractionSort("proteinCount", "asc")
                            }
                            title="Sort ascending"
                          >
                            <ArrowDropUp fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color={
                              fractionSort.key === "proteinCount" &&
                              fractionSort.direction === "desc"
                                ? "primary"
                                : "default"
                            }
                            onClick={() =>
                              handleFractionSort("proteinCount", "desc")
                            }
                            title="Sort descending"
                          >
                            <ArrowDropDown fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box
                          className="ionx-sort-header"
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          Hit Count
                          <IconButton
                            size="small"
                            color={
                              fractionSort.key === "hitCount" &&
                              fractionSort.direction === "asc"
                                ? "primary"
                                : "default"
                            }
                            onClick={() =>
                              handleFractionSort("hitCount", "asc")
                            }
                            title="Sort ascending"
                          >
                            <ArrowDropUp fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color={
                              fractionSort.key === "hitCount" &&
                              fractionSort.direction === "desc"
                                ? "primary"
                                : "default"
                            }
                            onClick={() =>
                              handleFractionSort("hitCount", "desc")
                            }
                            title="Sort descending"
                          >
                            <ArrowDropDown fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell>Hit Protein IDs</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedFractions.map((row) => (
                      <TableRow key={row.fractionIndex}>
                        <TableCell>{row.fractionIndex}</TableCell>
                        <TableCell>
                          {row.proteinCount ?? row.proteins.length}
                        </TableCell>
                        <TableCell>{row.hitCount ?? 0}</TableCell>
                        <TableCell className="ionx-hit-ids-cell">
                          {(row.hitProteinIds ?? []).length === 0 ? (
                            "..."
                          ) : (
                            <Box className="ionx-hit-ids-scroll">
                              {(row.hitProteinIds ?? []).map(
                                (proteinId, proteinIndex) => {
                                  const protein = row.proteins.find(
                                    (item) => item.id === proteinId,
                                  );
                                  return (
                                    <Chip
                                      key={`${row.fractionIndex}-${proteinId}-${proteinIndex}`}
                                      size="small"
                                      label={proteinId}
                                      title={
                                        protein
                                          ? `${protein.description}\nCharge: ${protein.charge.toFixed(2)}`
                                          : proteinId
                                      }
                                      sx={{
                                        border: `2px solid ${protein?.color ?? "#777"}`,
                                        backgroundColor: "rgba(0,0,0,0.15)",
                                        fontWeight: 600,
                                        margin: "0.2rem",
                                      }}
                                    />
                                  );
                                },
                              )}
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

          <Card className="ionx-card">
            <CardHeader
              title="Filtered Proteins"
              action={
                <TextField
                  variant="outlined"
                  value={proteinSearch}
                  onChange={(e) => {
                    setProteinSearch(e.target.value);
                    setProteinPage(0);
                  }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
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
                component="div"
                count={sortedRetainedRows.length}
                page={proteinPage}
                onPageChange={(_, newPage) => setProteinPage(newPage)}
                rowsPerPage={proteinRowsPerPage}
                onRowsPerPageChange={(e) => {
                  setProteinRowsPerPage(Number(e.target.value));
                  setProteinPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50]}
              />
              <TableContainer className="ionx-table-container ionx-proteins-table-container">
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>ID</TableCell>
                      <TableCell>Name</TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          Charge at pH {ph.toFixed(1)}
                          <IconButton
                            size="small"
                            color={
                              proteinSort.key === "charge" &&
                              proteinSort.direction === "asc"
                                ? "primary"
                                : "default"
                            }
                            onClick={() => handleProteinSort("charge", "asc")}
                            title="Sort ascending"
                          >
                            <ArrowDropUp fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color={
                              proteinSort.key === "charge" &&
                              proteinSort.direction === "desc"
                                ? "primary"
                                : "default"
                            }
                            onClick={() => handleProteinSort("charge", "desc")}
                            title="Sort descending"
                          >
                            <ArrowDropDown fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.5,
                          }}
                        >
                          Molecular Weight
                          <IconButton
                            size="small"
                            color={
                              proteinSort.key === "molecularWeight" &&
                              proteinSort.direction === "asc"
                                ? "primary"
                                : "default"
                            }
                            onClick={() =>
                              handleProteinSort("molecularWeight", "asc")
                            }
                            title="Sort ascending"
                          >
                            <ArrowDropUp fontSize="small" />
                          </IconButton>
                          <IconButton
                            size="small"
                            color={
                              proteinSort.key === "molecularWeight" &&
                              proteinSort.direction === "desc"
                                ? "primary"
                                : "default"
                            }
                            onClick={() =>
                              handleProteinSort("molecularWeight", "desc")
                            }
                            title="Sort descending"
                          >
                            <ArrowDropDown fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                      <TableCell>Sequence</TableCell>
                      <TableCell>Description</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedProteins.map((row, idx) => (
                      <TableRow key={`${row.id}-${idx}`}>
                        <TableCell>{row.id}</TableCell>
                        <TableCell>{row.name || "-"}</TableCell>
                        <TableCell>{row.charge.toFixed(2)}</TableCell>
                        <TableCell>{row.molecularWeight.toFixed(2)}</TableCell>
                        <TableCell
                          title={row.sequence}
                          sx={{
                            maxWidth: "150px",
                            height: "1.5em",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.sequence}
                        </TableCell>
                        <TableCell
                          title={row.description}
                          sx={{
                            maxWidth: "150px",
                            height: "1.5em",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
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
    </div>
  );
};

export default IonExchangeFractionation;
