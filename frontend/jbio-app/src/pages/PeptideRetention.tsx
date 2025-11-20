import React, { useState, useRef } from "react";
import {
  TextField,
  Button,
  Chip,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Card,
  CardHeader,
  CardContent,
  Alert,
  Skeleton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import annotationPlugin from "chartjs-plugin-annotation";
import { API_URL } from "../config";
import "./PeptideRetention.css";
import {
  CheckCircle,
  ClearAll,
  DownloadOutlined,
  FileOpenOutlined,
  StopCircle,
  Timer,
} from "@mui/icons-material";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  annotationPlugin
);

type PredictionSuccess = {
  peptide: string;
  smiles: string;
  log_sum_aa: number;
  log_vdw_vol: number;
  clog_p: number;
  predicted_tr: number;
};

type PredictionError = {
  peptide: string;
  error: string;
};

export type PredictionResult = PredictionSuccess | PredictionError;

const PeptideRetention: React.FC = () => {
  const [newPeptide, setNewPeptide] = useState<string>("");
  const [peptides, setPeptides] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stopRequested, setStopRequested] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chartRef = useRef<any>(null);

  const peptideResults = peptides
    .map((peptide) => {
      const result = results.find((r) => r.peptide === peptide);
      return { peptide, result };
    })
    .sort((a, b) => {
      const aTr =
        a.result && "predicted_tr" in a.result
          ? a.result.predicted_tr
          : Infinity;
      const bTr =
        b.result && "predicted_tr" in b.result
          ? b.result.predicted_tr
          : Infinity;
      if (aTr !== bTr) return aTr - bTr;
      return a.peptide.localeCompare(b.peptide);
    });

  const addPeptide = () => {
    var toAdd = newPeptide
      .trim()
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    if (toAdd.length === 0) return;
    setPeptides((prev) => Array.from(new Set([...prev, ...toAdd])));
    setNewPeptide("");
  };

  const removePeptide = (peptide: string) => {
    setPeptides(peptides.filter((p) => p !== peptide));
  };

  const handleKeyUp = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      addPeptide();
    }
  };

  const bucketPeptides = (list: string[]) => {
    const trivial: string[] = [];
    const normal: string[] = [];
    const nightmare: string[] = [];

    const scorer = (seq: string) => {
      let clean = seq.replace("Ac-", "").replace("-NH2", "");
      const len = clean.length;
      let mods = 0;

      if (seq.includes("-NH2")) mods += 2;
      if (seq.startsWith("Ac-")) mods += 2;
      if (/^pE/i.test(seq)) mods += 4;

      return len + mods;
    };

    for (const p of list) {
      const score = scorer(p);

      if (score <= 6) trivial.push(p);
      else if (score < 15) normal.push(p);
      else nightmare.push(p);
    }
    return { trivial, normal, nightmare };
  };

  const stopPredicting = () => {
    setStopRequested(true);
    abortRef.current?.abort();

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsLoading(false);
  };

  const chunkPredict = async (peps: string[], size?: number) => {
    const step = size ?? peps.length;

    for (let i = 0; i < peps.length; i += step) {
      if (stopRequested) return;

      const batch = peps.slice(i, i + step);

      const res = await fetch(`${API_URL}/pr/predict-multiple`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peptides: batch }),
        signal: abortRef.current?.signal,
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setResults((prev) => [...prev, ...data]);
    }
  };

  const predictAll = async () => {
    if (!peptides.length) return;

    setIsLoading(true);
    setStopRequested(false);
    setErrorMessage(null);
    setResults([]);
    setElapsed(0);

    abortRef.current = new AbortController();

    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);

    try {
      const { trivial, normal, nightmare } = bucketPeptides(peptides);

      if (!stopRequested && trivial.length > 0) await chunkPredict(trivial);

      if (!stopRequested && normal.length > 0) await chunkPredict(normal, 8);

      if (!stopRequested && nightmare.length > 0)
        await chunkPredict(nightmare, 3);
    } catch (err: any) {
      if (err.name !== "AbortError") setErrorMessage(`Error: ${err.message}`);
    }

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsLoading(false);
  };

  const formatTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return secs > 0
      ? `${mins}m ${secs.toString().padStart(2, "0")}s`
      : `${secs}s`;
  };

  const exportCsv = () => {
    let csv = "Peptide,Predicted tR (min),SMILES,log SumAA,log VDW Vol,clogP\n";
    results.forEach((result) => {
      if ("error" in result) return;

      csv += `${result.peptide},${result.predicted_tr.toFixed(2)},${
        result.smiles
      },${result.log_sum_aa.toFixed(4)},${result.log_vdw_vol.toFixed(
        4
      )},${result.clog_p.toFixed(4)}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "predictions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadFromFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const loadedPeptides = content
          .split(",")
          .map((peptide) => peptide.trim());
        setPeptides((prevPeptides) =>
          Array.from(new Set([...prevPeptides, ...loadedPeptides]))
        );
      };
      reader.readAsText(file);
    });

    event.target.value = "";
  };

  const generateChromatogramData = () => {
    const scalingFactor = 6.5;
    const xVals = Array.from({ length: 1000 }, (_, i) => (i / 999) * 100);
    const chromatogram = new Array(xVals.length).fill(0);
    const noise = Array.from({ length: xVals.length }, () => Math.random());
    const annotations: any = {};

    let maxChrom = 0;

    results.forEach((result, index) => {
      if ("error" in result) return;

      const peptide = result.peptide.replace(/-NH2/g, "").replace(/Ac-/g, "");
      const aaCount = peptide.length;
      const rt = result.predicted_tr * scalingFactor;
      const height = aaCount * 10;

      xVals.forEach((x, i) => {
        chromatogram[i] +=
          height * Math.exp(-Math.pow(x - rt, 2) / (2 * Math.pow(0.35, 2)));
        if (height > 20) {
          annotations[`peak-label-${index}`] = {
            type: "label",
            xValue: rt * 10,
            yValue: height + 10,
            content: peptide,
            font: { size: 10, weight: "bold", color: "var(--text)" },
            rotation: -30,
          };
          annotations[`peak-point-${index}`] = {
            type: "point",
            xValue: rt * 10,
            yValue: height,
            radius: 5,
          };
        }
      });
    });

    chromatogram.forEach((val, i) => {
      chromatogram[i] = Math.max(0, val + noise[i]);
      if (chromatogram[i] > maxChrom) maxChrom = chromatogram[i];
    });

    return {
      labels: xVals,
      datasets: [
        {
          label: "Chromatogram",
          data: chromatogram,
          borderColor: results.length === 0 ? "transparent" : "black",
          borderWidth: 2,
        },
      ],
      max: maxChrom,
      annotations: annotations,
    };
  };

  const exportChromatogram = () => {
    if (chartRef.current) {
      const base64Image = chartRef.current.toBase64Image();
      const a = document.createElement("a");
      a.href = base64Image;
      a.download = "chromatogram.png";
      a.click();
    }
  };

  return (
    <div className="peptide-retention-page">
      <div className="input-section">
        <TextField
          className="peptide-input"
          label="Enter Peptide Sequence"
          variant="filled"
          size="small"
          value={newPeptide}
          onChange={(e) => setNewPeptide(e.target.value)}
          onKeyUp={handleKeyUp}
          focused
          sx={{
            input: { color: "var(--text)" },
            label: { color: "var(--accent) !important" },
            "& .MuiInputLabel-root": { color: "var(--accent) !important" },
            "& .MuiInputLabel-root.Mui-focused": {
              color: "var(--accent) !important",
            },
            "& .MuiFilledInput-root": {
              "&:before": { borderBottomColor: "var(--accent)" },
              "&:after": { borderBottomColor: "var(--accent)" },
              "&:hover:before": { borderBottomColor: "var(--accent)" },
            },
          }}
        />
        <Button
          onClick={addPeptide}
          disabled={!newPeptide.trim()}
          className="predict-button"
          variant="contained"
          startIcon={<AddIcon />}
        >
          Add
        </Button>
      </div>

      {isLoading ? (
        <Button
          variant="contained"
          onClick={stopPredicting}
          className="predict-button"
          color="error"
          startIcon={<StopCircle />}
        >
          Stop Predicting
        </Button>
      ) : (
        <Button
          variant="contained"
          onClick={predictAll}
          disabled={peptides.length === 0}
          className="predict-button"
          startIcon={<CheckCircle />}
        >
          Predict All
        </Button>
      )}
      <div style={{ float: "right", display: "flex", gap: "1rem" }}>
        <Button
          variant="contained"
          onClick={() => setPeptides([])}
          disabled={peptides.length === 0}
          className="predict-button"
          startIcon={<ClearAll />}
        >
          Clear All
        </Button>
        <Button
          variant="contained"
          component="label"
          className="predict-button"
          startIcon={<FileOpenOutlined />}
        >
          Load from File(s)
          <input
            type="file"
            accept=".txt,.csv"
            multiple
            hidden
            onChange={loadFromFiles}
          />
        </Button>
      </div>

      {peptides.length > 0 && (
        <div className="peptides-list">
          {peptides.map((peptide) => (
            <Chip
              key={peptide}
              label={<div className="pr-label">{peptide}</div>}
              onDelete={() => removePeptide(peptide)}
              className="peptide-chip"
              sx={{
                "& .MuiChip-deleteIcon": {
                  color: "#a26363",
                },
              }}
            />
          ))}
        </div>
      )}

      <Card className="results-card">
        <CardHeader
          title="Prediction Results"
          action={
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              {(isLoading || results.length > 0) && (
                <>
                  <div /* Timer */
                    style={{
                      display: "flex",
                      alignItems: "center",
                      fontWeight: "bold",
                      color: "var(--sub-text)",
                    }}
                  >
                    <Timer
                      fontSize="small"
                      style={{ marginRight: "0.25rem", fill: "var(--text)" }}
                    />
                    {formatTime(elapsed)}
                  </div>

                  <div /* Progress */
                    style={{
                      display: "flex",
                      alignItems: "center",
                      fontWeight: "bold",
                      color: "var(--sub-text)",
                    }}
                  >
                    <CheckCircle
                      fontSize="small"
                      style={{ marginRight: "0.25rem", fill: "var(--text)" }}
                    />
                    {results.length} / {peptides.length}
                  </div>
                </>
              )}

              <Button
                variant="contained"
                className="predict-button"
                onClick={exportCsv}
                disabled={results.length === 0}
                startIcon={<DownloadOutlined />}
                style={{ marginRight: "0.75rem" }}
              >
                Export CSV
              </Button>
            </div>
          }
        />
        <CardContent>
          <div className="table-container">
            <Table className={results.length === 0 ? "disabled" : ""}>
              <TableHead>
                <TableRow className="results-header">
                  <TableCell>Peptide</TableCell>
                  <TableCell>Predicted tR (min)</TableCell>
                  <TableCell>SMILES</TableCell>
                  <TableCell>log SumAA</TableCell>
                  <TableCell>log VDW Vol</TableCell>
                  <TableCell>clogP</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {peptideResults.map((item) => (
                  <TableRow key={item.peptide}>
                    <TableCell>
                      <b>{item.peptide}</b>
                    </TableCell>
                    {item.result ? (
                      "error" in item.result ? (
                        <TableCell colSpan={5} style={{ color: "red" }}>
                          {item.result.error}
                        </TableCell>
                      ) : (
                        <>
                          <TableCell>
                            {item.result.predicted_tr.toFixed(2)}
                          </TableCell>
                          <TableCell>{item.result.smiles}</TableCell>
                          <TableCell>
                            {item.result.log_sum_aa.toFixed(4)}
                          </TableCell>
                          <TableCell>
                            {item.result.log_vdw_vol.toFixed(4)}
                          </TableCell>
                          <TableCell>{item.result.clog_p.toFixed(4)}</TableCell>
                        </>
                      )
                    ) : (
                      <>
                        <TableCell>
                          <Skeleton />
                        </TableCell>
                        <TableCell>
                          <Skeleton />
                        </TableCell>
                        <TableCell>
                          <Skeleton />
                        </TableCell>
                        <TableCell>
                          <Skeleton />
                        </TableCell>
                        <TableCell>
                          <Skeleton />
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      <Card className="results-card">
        <CardHeader
          title="Chromatogram"
          action={
            <Button
              variant="contained"
              startIcon={<DownloadOutlined />}
              className="predict-button"
              onClick={exportChromatogram}
              disabled={results.length === 0}
            >
              Export As Image
            </Button>
          }
        />
        <CardContent>
          <div
            className={`chromatogram-section ${
              results.length === 0 ? "disabled" : ""
            }`}
          >
            {isLoading && (
              <CircularProgress className="chromatogram-loading-overlay" />
            )}
            {(() => {
              const chromatogramData = generateChromatogramData();
              var textColor = "#000";
              return (
                <Line
                  ref={(chart) => {
                    if (chart) {
                      chartRef.current = chart;
                    }
                  }}
                  style={{
                    backgroundColor: "#fff",
                    padding: "30px",
                    borderRadius: "8px",
                    minHeight: "450px",
                    width: "100%",
                  }}
                  data={chromatogramData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false },
                      annotation: {
                        annotations: chromatogramData.annotations,
                      },
                    },
                    elements: {
                      point: {
                        radius: 0,
                      },
                      line: {
                        borderWidth: 1,
                      },
                    },
                    scales: {
                      x: {
                        title: {
                          display: true,
                          text: "Retention Time (min)",
                          color: textColor,
                        },
                        min: 0,
                        max: 100,
                        grid: {
                          display: true,
                        },
                        ticks: {
                          maxTicksLimit: 7,
                          callback: (value) => (Number(value) / 65).toFixed(1),
                          color: textColor,
                        },
                      },
                      y: {
                        title: {
                          display: true,
                          text: "Relative Intensity",
                          color: textColor,
                        },
                        min: 0,
                        max: Math.ceil(chromatogramData.max * 1.2),
                        grid: {
                          display: true,
                        },
                        ticks: {
                          color: textColor,
                        },
                      },
                    },
                  }}
                />
              );
            })()}
          </div>
        </CardContent>
      </Card>

      {errorMessage && (
        <Alert severity="error" className="error-alert">
          {errorMessage}
        </Alert>
      )}
    </div>
  );
};

export default PeptideRetention;
