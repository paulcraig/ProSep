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
import { Bar, Scatter } from "react-chartjs-2";
import {
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
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
};

type IonExchangeResponse = {
  summary: Summary;
  fraction_overview: FractionOverview[];
  filtered_proteins: ProteinRow[];
  seqhits: SeqHitRow[];
  error?: string;
};

const IonExchangeFractionation: React.FC = () => {
  const [fastaText, setFastaText] = useState<string>("");
  const [ph, setPh] = useState<number>(7.0);
  const [mediaType, setMediaType] = useState<MediaType>("Q");
  const [fractionCount, setFractionCount] = useState<number>(80);
  const [noise, setNoise] = useState<number>(0.1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [data, setData] = useState<IonExchangeResponse | null>(null);

  const [proteinPage, setProteinPage] = useState<number>(0);
  const [proteinRowsPerPage, setProteinRowsPerPage] = useState<number>(10);
  const [fractionPage, setFractionPage] = useState<number>(0);
  const [fractionRowsPerPage, setFractionRowsPerPage] = useState<number>(10);

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

  const pagedProteins = useMemo(() => {
    const start = proteinPage * proteinRowsPerPage;
    return proteinRows.slice(start, start + proteinRowsPerPage);
  }, [proteinRows, proteinPage, proteinRowsPerPage]);

  const pagedFractions = useMemo(() => {
    const start = fractionPage * fractionRowsPerPage;
    return fractionRows.slice(start, start + fractionRowsPerPage);
  }, [fractionRows, fractionPage, fractionRowsPerPage]);

  const fractionChartData = useMemo(() => {
    return {
      labels: fractionRows.map((f) => f.fraction),
      datasets: [
        {
          label: "Protein count per fraction",
          data: fractionRows.map((f) => f.protein_count),
          backgroundColor: "rgba(69, 133, 226, 0.7)",
          borderColor: "rgba(69, 133, 226, 1)",
          borderWidth: 1,
        },
      ],
    };
  }, [fractionRows]);

  const scatterData = useMemo(() => {
    return {
      datasets: [
        {
          label: "Hit count by fraction",
          data: seqHitRows.map((s) => ({ x: s.fraction, y: s.hit_count })),
          backgroundColor: "rgba(107, 224, 57, 0.8)",
        },
      ],
    };
  }, [seqHitRows]);

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
              </div>
            </CardContent>
          </Card>

          <Card className="ionx-card">
            <CardHeader title="Fraction Distribution" />
            <CardContent>
              <div className="ionx-chart-wrap">
                <Bar
                  data={fractionChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                      x: { title: { display: true, text: "Fraction Number" } },
                      y: {
                        title: { display: true, text: "Protein Count" },
                        beginAtZero: true,
                      },
                    },
                  }}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="ionx-card">
            <CardHeader title="Hits by Fraction" />
            <CardContent>
              <div className="ionx-chart-wrap">
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
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Fraction</TableCell>
                      <TableCell>Protein Count</TableCell>
                      <TableCell>Hit Count</TableCell>
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
                                gap: 0.5,
                                maxWidth: 200,
                              }}
                            >
                              {row.hit_indices.map((hitIndex) => {
                                const protein = proteinByIndex.get(hitIndex);
                                const label = protein
                                  ? `${hitIndex} - ${String(protein.ID)}`
                                  : `${hitIndex} - Unknown`;
                                const chipColor = chipColorFromLabel(label);

                                return (
                                  <Chip
                                    key={`${row.fraction}-${hitIndex}`}
                                    size="small"
                                    label={label}
                                    sx={{
                                      border: `3px solid ${chipColor}`,
                                      backgroundColor: `rgba(0,0,0, 0.2)`,
                                      fontWeight: 600,
                                    }}
                                  />
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
                count={proteinRows.length}
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
                      <TableCell>index</TableCell>
                      <TableCell>sequence</TableCell>
                      <TableCell>description</TableCell>
                      <TableCell>{chargeKey}</TableCell>
                      <TableCell>ID</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pagedProteins.map((row, idx) => (
                      <TableRow key={`${row.ID}-${idx}`}>
                        <TableCell>{row.index}</TableCell>
                        <TableCell
                          sx={{
                            maxWidth: 280,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                          title={row.sequence}
                        >
                          {row.sequence}
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
                          {row.description}
                        </TableCell>
                        <TableCell>{row[chargeKey] as number}</TableCell>
                        <TableCell>{row.ID}</TableCell>
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
