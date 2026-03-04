import React, { useMemo, useState } from "react";
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
  IconButton,
} from "@mui/material";
import { Line, Scatter } from "react-chartjs-2";
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
  PlayArrow,
  RemoveOutlined,
  RemoveRedEyeOutlined,
  SettingsOutlined,
  WashOutlined,
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
  const [useLogScale, setUseLogScale] = useState<boolean>(false);
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

  const sortedFractionRows = useMemo(() => {
    const rows = [...fractionRows];
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
  }, [fractionRows, fractionSort]);

  const sortedRetainedRows = useMemo(() => {
    const rows = [...retainedRows];
    const directionMultiplier = proteinSort.direction === "asc" ? 1 : -1;

    rows.sort((a, b) => {
      const aValue =
        proteinSort.key === "charge" ? a.charge : a.molecularWeight;
      const bValue =
        proteinSort.key === "charge" ? b.charge : b.molecularWeight;

      return (aValue - bValue) * directionMultiplier;
    });

    return rows;
  }, [retainedRows, proteinSort]);

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
    const points: Array<{ x: number; y: number }> = [
      { x: 0, y: data?.wash?.length ?? 0 },
    ];

    for (const fraction of fractionRows) {
      points.push({
        x: fraction.fractionIndex,
        y: fraction.proteinCount ?? fraction.proteins.length,
      });
    }

    return points;
  }, [data, fractionRows]);

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
          pointRadius: 3,
          pointHoverRadius: 5,
          tension: 0.25,
          fill: false,
        },
      ],
    };
  }, [proteinSeriesPoints]);

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
            <CardHeader title="Proteins by Fraction" />
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
                {showLineGraph ? (
                  <Line
                    data={lineData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        x: {
                          type: "linear",
                          title: {
                            display: true,
                            text: "0 = Wash, 1..N = Fractions",
                          },
                          beginAtZero: true,
                          ticks: {
                            callback: (value) =>
                              Number(value) === 0 ? "Wash" : String(value),
                          },
                        },
                        y: {
                          type: useLogScale ? "logarithmic" : "linear",
                          title: {
                            display: true,
                            text: "Protein Count",
                          },
                          beginAtZero: !useLogScale,
                        },
                      },
                    }}
                  />
                ) : (
                  <Scatter
                    data={scatterData}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      scales: {
                        x: {
                          title: {
                            display: true,
                            text: "0 = Wash, 1..N = Fractions",
                          },
                          beginAtZero: true,
                          ticks: {
                            callback: (value) =>
                              Number(value) === 0 ? "Wash" : String(value),
                          },
                        },
                        y: {
                          type: useLogScale ? "logarithmic" : "linear",
                          title: {
                            display: true,
                            text: "Protein Count",
                          },
                          beginAtZero: !useLogScale,
                        },
                      },
                    }}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="ionx-card">
            <CardHeader title="Fractions" />
            <CardContent>
              <TablePagination
                component="div"
                count={fractionRows.length}
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
            <CardHeader title="Filtered Proteins" />
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
                      <TableCell>Sequence</TableCell>
                      <TableCell>Description</TableCell>
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
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedProteins.map((row, idx) => (
                      <TableRow key={`${row.id}-${idx}`}>
                        <TableCell>{row.id}</TableCell>
                        <TableCell>{row.name || "-"}</TableCell>
                        <TableCell
                          sx={{
                            maxWidth: 280,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={row.sequence}
                        >
                          <span>{row.sequence}</span>
                        </TableCell>
                        <TableCell
                          sx={{
                            maxWidth: 320,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={row.description}
                        >
                          <span>{row.description}</span>
                        </TableCell>
                        <TableCell>{row.charge.toFixed(2)}</TableCell>
                        <TableCell>{row.molecularWeight.toFixed(2)}</TableCell>
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
