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
  Chip,
  FormControl,
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
  TableSortLabel,
  TextField,
  Typography,
  FormControlLabel,
  Tooltip as MuiTooltip,
  styled,
} from "@mui/material";
import { TooltipProps, tooltipClasses } from "@mui/material/Tooltip";
import { Line, Scatter } from "react-chartjs-2";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
} from "chart.js";
import { API_URL } from "../config";
import "./IonExchangeFractionation.css";
import { ExpandMore, FileUpload, PlayArrow } from "@mui/icons-material";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
);

type MediaType = "Q" | "S";

type FractionOverview = {
  fraction: number;
  fuzzymin: number;
  fuzzymax: number;
  protein_count: number;
  hit_count: number;
  hit_indices: number[];
};

type ProteinRow = {
  index: number;
  ID: string;
  sequence: string;
  description: string;
  [key: string]: number | string;
};

type SeqHitRow = {
  fraction: number;
  hit_count: number;
  hit_indices: number[];
};

type Summary = {
  processed: number;
  skipped: number;
  bound_count: number;
  wash_count: number;
  fraction_count: number;
  media_type?: MediaType;
  exchanger?: "anion" | "cation";
  deadband?: number;
};

type IonExchangeResponse = {
  summary: Summary;
  fraction_overview: FractionOverview[];
  filtered_proteins: ProteinRow[];
  seqhits: SeqHitRow[];
  error?: string;
};

const BTooltip = styled(({ className, ...props }: TooltipProps) => (
  <MuiTooltip {...props} arrow classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.arrow}`]: {
    color: theme.palette.common.black,
  },
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: "rgba(0, 0, 0, 0.85)",
    color: "#fff !important",
  },
}));

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

  const [proteinPage, setProteinPage] = useState<number>(0);
  const [proteinRowsPerPage, setProteinRowsPerPage] = useState<number>(10);
  const [fractionPage, setFractionPage] = useState<number>(0);
  const [fractionRowsPerPage, setFractionRowsPerPage] = useState<number>(10);
  const [showLineGraph, setShowLineGraph] = useState<boolean>(false);

  const [fractionSortBy, setFractionSortBy] = useState<
    "fraction" | "protein_count" | "hit_count"
  >("fraction");
  const [fractionSortDir, setFractionSortDir] = useState<"asc" | "desc">("asc");

  const [proteinPhSortDir, setProteinPhSortDir] = useState<
    "asc" | "desc" | null
  >(null);

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
      if (!response.ok || json.error) {
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

  const proteinRows = useMemo(() => data?.filtered_proteins ?? [], [data]);
  const fractionRows = useMemo(() => data?.fraction_overview ?? [], [data]);
  const seqHitRows = useMemo(() => data?.seqhits ?? [], [data]);

  const proteinByIndex = useMemo(() => {
    const map = new Map<number, ProteinRow>();
    for (const protein of proteinRows) {
      map.set(Number(protein.index), protein);
    }
    return map;
  }, [proteinRows]);

  const chipColorFromLabel = (label: string) => {
    let hash = 0;
    for (let i = 0; i < label.length; i += 1) {
      hash = label.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = Math.abs(hash) % 360;
    return `hsl(${hue} 65% 42%)`;
  };
  const chargeKey = useMemo(() => {
    if (proteinRows.length === 0) {
      return `charge_at_ph_${ph}`;
    }

    const detectedKey = Object.keys(proteinRows[0]).find((key) =>
      key.startsWith("charge_at_ph_"),
    );

    return detectedKey ?? `charge_at_ph_${ph}`;
  }, [proteinRows, ph]);

  const sortedFractionRows = useMemo(() => {
    const rows = [...fractionRows];
    rows.sort((a, b) => {
      const aVal = a[fractionSortBy];
      const bVal = b[fractionSortBy];
      if (aVal === bVal) {
        return 0;
      }
      const baseCmp = aVal < bVal ? -1 : 1;
      return fractionSortDir === "asc" ? baseCmp : -baseCmp;
    });
    return rows;
  }, [fractionRows, fractionSortBy, fractionSortDir]);

  const sortedProteinRows = useMemo(() => {
    if (!proteinPhSortDir) {
      return proteinRows;
    }

    const rows = [...proteinRows];
    rows.sort((a, b) => {
      const aVal = Number(a[chargeKey]);
      const bVal = Number(b[chargeKey]);
      if (Number.isNaN(aVal) && Number.isNaN(bVal)) {
        return 0;
      }
      if (Number.isNaN(aVal)) {
        return 1;
      }
      if (Number.isNaN(bVal)) {
        return -1;
      }
      return proteinPhSortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
    return rows;
  }, [proteinRows, chargeKey, proteinPhSortDir]);

  const pagedProteins = useMemo(() => {
    const start = proteinPage * proteinRowsPerPage;
    return sortedProteinRows.slice(start, start + proteinRowsPerPage);
  }, [sortedProteinRows, proteinPage, proteinRowsPerPage]);

  const pagedFractions = useMemo(() => {
    const start = fractionPage * fractionRowsPerPage;
    return sortedFractionRows.slice(start, start + fractionRowsPerPage);
  }, [sortedFractionRows, fractionPage, fractionRowsPerPage]);

  const handleFractionSort = (
    key: "fraction" | "protein_count" | "hit_count",
  ) => {
    setFractionPage(0);
    if (fractionSortBy === key) {
      setFractionSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setFractionSortBy(key);
    setFractionSortDir("asc");
  };

  const handleProteinPhSort = () => {
    setProteinPage(0);
    setProteinPhSortDir((prev) => {
      if (prev === null) {
        return "asc";
      }
      return prev === "asc" ? "desc" : "asc";
    });
  };

  const hitSeriesPoints = useMemo(
    () => seqHitRows.map((s) => ({ x: s.fraction, y: s.hit_count })),
    [seqHitRows],
  );

  const scatterData = useMemo(() => {
    return {
      datasets: [
        {
          label: "Hit count by fraction",
          data: hitSeriesPoints,
          backgroundColor: "rgba(107, 224, 57, 0.8)",
          pointRadius: 4,
        },
      ],
    };
  }, [hitSeriesPoints]);

  const lineData = useMemo(() => {
    return {
      datasets: [
        {
          label: "Hit count by fraction",
          data: hitSeriesPoints,
          borderColor: "rgba(107, 224, 57, 1)",
          backgroundColor: "rgba(107, 224, 57, 0.8)",
          borderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 5,
          tension: 0.25,
          fill: false,
        },
      ],
    };
  }, [hitSeriesPoints]);

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

            <TextField
              size="small"
              type="number"
              label="Fractions"
              value={fractionCount}
              onChange={(e) =>
                setFractionCount(Math.max(1, Number(e.target.value) || 80))
              }
              sx={{ width: 140 }}
            />

            <Button
              className="ionx-button"
              variant="contained"
              disabled={loading || fastaText.trim().length === 0}
              onClick={handleRunFractionation}
              startIcon={<PlayArrow />}
              sx={{ float: "right" }}
            >
              {loading ? "Processing..." : "Run Fractionation"}
            </Button>
          </Box>

          <Box sx={{ marginTop: "1rem", marginBottom: "0.5rem" }}>
            <Typography gutterBottom>pH: {ph.toFixed(1)}</Typography>
            <Slider
              min={0}
              max={14}
              step={0.1}
              value={ph}
              onChange={(_, value) => setPh(value as number)}
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
              <div className="ionx-summary-grid">
                <div>Processed records: {data.summary.processed}</div>
                <div>Skipped records: {data.summary.skipped}</div>
                <div>Bound proteins: {data.summary.bound_count}</div>
                <div>Wash proteins: {data.summary.wash_count}</div>
                <div>Resin mode: {data.summary.exchanger ?? "-"}</div>
                <div>
                  Deadband: ±{(data.summary.deadband ?? deadband).toFixed(2)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="ionx-card">
            <CardHeader title="Hits by Fraction" />
            <CardContent>
              <div className="ionx-chart-wrap">
                <FormControlLabel
                  control={
                    <Switch
                      checked={showLineGraph}
                      onChange={(_, checked) => setShowLineGraph(checked)}
                    />
                  }
                  label="Line Chart"
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
                          title: { display: true, text: "Fraction Number" },
                          beginAtZero: true,
                        },
                        y: {
                          title: {
                            display: true,
                            text: "Hit Count",
                          },
                          beginAtZero: true,
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
                          title: { display: true, text: "Fraction Number" },
                          beginAtZero: true,
                        },
                        y: {
                          title: {
                            display: true,
                            text: "Hit Count",
                          },
                          beginAtZero: true,
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
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>
                        <TableSortLabel
                          active={fractionSortBy === "fraction"}
                          direction={
                            fractionSortBy === "fraction"
                              ? fractionSortDir
                              : "asc"
                          }
                          onClick={() => handleFractionSort("fraction")}
                        >
                          Fraction
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={fractionSortBy === "protein_count"}
                          direction={
                            fractionSortBy === "protein_count"
                              ? fractionSortDir
                              : "asc"
                          }
                          onClick={() => handleFractionSort("protein_count")}
                        >
                          Protein Count
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={fractionSortBy === "hit_count"}
                          direction={
                            fractionSortBy === "hit_count"
                              ? fractionSortDir
                              : "asc"
                          }
                          onClick={() => handleFractionSort("hit_count")}
                        >
                          Hit Count
                        </TableSortLabel>
                      </TableCell>
                      <TableCell sx={{ width: 250 }}>Hits</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedFractions.map((row) => (
                      <TableRow key={row.fraction}>
                        <TableCell>{row.fraction}</TableCell>
                        <TableCell>{row.protein_count}</TableCell>
                        <TableCell>{row.hit_count}</TableCell>
                        <TableCell>
                          {row.hit_indices.length === 0 ? (
                            "..."
                          ) : (
                            <Box
                              sx={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: 1,
                                minWidth: 600,
                              }}
                            >
                              {row.hit_indices.map((hitIndex) => {
                                const protein = proteinByIndex.get(hitIndex);
                                const label = protein
                                  ? `${hitIndex} - ${String(protein.ID)}`
                                  : `${hitIndex} - Unknown`;
                                const truncLabel =
                                  label.length > 50
                                    ? label.slice(0, 47) + "..."
                                    : label;
                                const chipColor =
                                  chipColorFromLabel(truncLabel);

                                return (
                                  <BTooltip
                                    key={`${row.fraction}-${hitIndex}`}
                                    title={
                                      protein
                                        ? `${protein.sequence}\n${protein.description}`
                                        : "Unknown protein"
                                    }
                                    placement="top"
                                  >
                                    <Chip
                                      size="small"
                                      label={truncLabel}
                                      sx={{
                                        border: `3px solid ${chipColor}`,
                                        backgroundColor: `rgba(0,0,0, 0.2)`,
                                        fontWeight: 600,
                                      }}
                                    />
                                  </BTooltip>
                                );
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

          <Card className="ionx-card">
            <CardHeader title="Filtered Proteins" />
            <CardContent>
              <TablePagination
                component="div"
                count={sortedProteinRows.length}
                page={proteinPage}
                onPageChange={(_, newPage) => setProteinPage(newPage)}
                rowsPerPage={proteinRowsPerPage}
                onRowsPerPageChange={(e) => {
                  setProteinRowsPerPage(Number(e.target.value));
                  setProteinPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50]}
              />
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>#</TableCell>
                      <TableCell>Sequence</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell>
                        <TableSortLabel
                          active={proteinPhSortDir !== null}
                          direction={proteinPhSortDir ?? "asc"}
                          onClick={handleProteinPhSort}
                        >
                          {chargeKey.replace("charge_at_ph_", "Charge at pH ")}
                        </TableSortLabel>
                      </TableCell>
                      <TableCell>ID</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedProteins.map((row, idx) => (
                      <TableRow key={`${row.ID}-${idx}`}>
                        <TableCell>
                          <MuiTooltip title={String(row.index)} arrow>
                            <span>{row.index}</span>
                          </MuiTooltip>
                        </TableCell>
                        <TableCell
                          sx={{
                            maxWidth: 280,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          <MuiTooltip title={String(row.sequence)} arrow>
                            <span>{row.sequence}</span>
                          </MuiTooltip>
                        </TableCell>
                        <TableCell
                          sx={{
                            maxWidth: 320,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          <MuiTooltip title={String(row.description)} arrow>
                            <span>{row.description}</span>
                          </MuiTooltip>
                        </TableCell>
                        <TableCell>{row[chargeKey] as number}</TableCell>
                        <TableCell>
                          <MuiTooltip title={String(row.ID)} arrow>
                            <span>{row.ID}</span>
                          </MuiTooltip>
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
