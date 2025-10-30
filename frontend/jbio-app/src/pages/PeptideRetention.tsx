import React, { useEffect, useState } from "react";
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
  DownloadOutlined,
  FileOpenOutlined,
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

type PredictionResult = {
  peptide: string;
  smiles: string;
  log_sum_aa: number;
  log_vdw_vol: number;
  clog_p: number;
  predicted_tr: number;
};

const PeptideRetention: React.FC = () => {
  const [newPeptide, setNewPeptide] = useState<string>("");
  const [peptides, setPeptides] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const addPeptide = () => {
    if (newPeptide.trim() && !peptides.includes(newPeptide)) {
      setPeptides([...peptides, newPeptide]);
      setNewPeptide("");
    }
  };
  const removePeptide = (peptide: string) => {
    setPeptides(peptides.filter((p) => p !== peptide));
  };
  const handleKeyUp = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      addPeptide();
    }
  };
  const predictAll = async () => {
    if (!peptides.length) return;

    setIsLoading(true);
    setErrorMessage(null);
    setResults([]);

    try {
      console.log(
        `${API_URL}/pr/predict?peptides=${encodeURIComponent(
          peptides.join(",")
        )}`
      );
      const response = await fetch(
        `${API_URL}/pr/predict?peptides=${encodeURIComponent(
          peptides.join(",")
        )}`,
        { method: "GET" }
      );
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setResults(data);
    } catch (error: any) {
      setErrorMessage(`Error: ${error.message}`);
    }

    setIsLoading(false);
  };
  const exportCsv = () => {
    let csv = "Peptide,Predicted tR (min),SMILES,log SumAA,log VDW Vol,clogP\n";
    results.forEach((result) => {
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
  const loadFromFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
  };
  const generateChromatogramData = () => {
    const scalingFactor = 6.5;
    const xVals = Array.from({ length: 500 }, (_, i) => (i / 499) * 100);
    const chromatogram = new Array(xVals.length).fill(0);
    const noise = Array.from(
      { length: xVals.length },
      () => Math.random() - 0.5
    );
    const annotations: any = {};

    let maxChrom = 0;

    results.forEach((result, index) => {
      const peptide = result.peptide.replace(/-NH2/g, "").replace(/Ac-/g, "");
      const aaCount = peptide.length;
      const rt = result.predicted_tr * scalingFactor;
      const height = aaCount * 10;
      xVals.forEach((x, i) => {
        chromatogram[i] +=
          height * Math.exp(-Math.pow(x - rt, 2) / (2 * Math.pow(0.35, 2)));
      });
      if (height > 20) {
        annotations[`peak-${index}`] = {
          type: "label",
          xValue: rt * 5,
          yValue: height + 3,
          content: peptide,
          font: { size: 8, weight: "bold", color: "var(--text)" },
          rotation: 30,
          position: "center",
        };
      }
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
          borderColor: results.length === 0 ? "transparent" : "#42a5f5",
          borderWidth: 2,
          fill: false,
        },
      ],
      max: maxChrom,
      annotations: annotations,
    };
  };

  const exportGraphSVG = () => {};

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
            label: { color: "var(--text)" },
          }}
        />
        <Button
          onClick={addPeptide}
          disabled={!newPeptide.trim()}
          className="predict-button"
        >
          <AddIcon />
        </Button>
      </div>

      {peptides.length > 0 && (
        <div className="peptides-list">
          <div>Peptides to predict:</div>
          {peptides.map((peptide) => (
            <Chip
              key={peptide}
              label={<div className="pr-label">{peptide}</div>}
              onDelete={() => removePeptide(peptide)}
              className="peptide-chip"
            />
          ))}
        </div>
      )}

      <Button
        variant="contained"
        onClick={predictAll}
        disabled={isLoading || peptides.length === 0}
        className="predict-button"
        startIcon={<CheckCircle />}
      >
        {isLoading ? "Predicting..." : "Predict All"}
      </Button>
      <Button
        variant="contained"
        component="label"
        className="predict-button"
        style={{ float: "right" }}
        startIcon={<FileOpenOutlined />}
      >
        Load from File
        <input type="file" accept=".txt,.csv" hidden onChange={loadFromFile} />
      </Button>

      <Card className="results-card">
        <CardHeader
          title="Prediction Results"
          action={
            <Button
              className="predict-button"
              variant="contained"
              component="label"
              onClick={exportCsv}
              disabled={results.length === 0}
              startIcon={<DownloadOutlined />}
            >
              Export CSV
            </Button>
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
                {results.map((result, index) => (
                  <TableRow key={index}>
                    <TableCell>
                      <b>{result.peptide}</b>
                    </TableCell>
                    <TableCell>{result.predicted_tr.toFixed(2)}</TableCell>
                    <TableCell>{result.smiles}</TableCell>
                    <TableCell>{result.log_sum_aa.toFixed(4)}</TableCell>
                    <TableCell>{result.log_vdw_vol.toFixed(4)}</TableCell>
                    <TableCell>{result.clog_p.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {isLoading && <CircularProgress className="loading-overlay" />}
          </div>
        </CardContent>
      </Card>
      <Card className="results-card">
        <CardHeader
          title="Chromatogram"
          action={
            <Button
              variant="text"
              color="primary"
              component="label"
              startIcon={<DownloadOutlined />}
              className="predict-button"
              onClick={exportGraphSVG}
              disabled={results.length === 0}
            >
              Export SVG
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
                  style={{
                    backgroundColor: "#fff",
                    padding: "30px",
                    borderRadius: "8px",
                  }}
                  data={chromatogramData}
                  options={{
                    responsive: true,
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
                          maxTicksLimit: 6,
                          callback: (value) => Number(value).toFixed(0),
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
                        max: chromatogramData.max + 10,
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
