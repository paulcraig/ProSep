import React, { useState, useRef, useEffect } from "react";
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
  Checkbox,
  FormControlLabel,
  IconButton,
  Tooltip,
  styled,
  tooltipClasses,
  TooltipProps,
  Icon,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ContentCopy from "@mui/icons-material/ContentCopy";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Legend,
} from "chart.js";
import zoomPlugin, { zoom } from "chartjs-plugin-zoom";
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
  Info,
  ZoomOutOutlined,
  RestartAlt,
  ZoomInOutlined,
} from "@mui/icons-material";
import { ImageHoverPreview } from "../components/ImageHoverPreview";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Legend,
  annotationPlugin,
  zoomPlugin,
);

type PredictionSuccess = {
  peptide: string;
  smiles: string;
  log_sum_aa: number;
  log_vdw_vol: number;
  clog_p: number;
  predicted_tr: number;
  fromCache: boolean;
};

type CachedPrediction = Omit<PredictionSuccess, "fromCache">;

type PredictionError = {
  peptide: string;
  error: string;
};

const BTooltip = styled(({ className, ...props }: TooltipProps) => (
  <Tooltip {...props} arrow classes={{ popper: className }} />
))(({ theme }) => ({
  [`& .${tooltipClasses.arrow}`]: {
    color: theme.palette.common.black,
  },
  [`& .${tooltipClasses.tooltip}`]: {
    backgroundColor: theme.palette.common.black,
  },
}));

export type PredictionResult = PredictionSuccess | PredictionError;

const PeptideRetention: React.FC = () => {
  const [newPeptide, setNewPeptide] = useState<string>("");
  const [peptides, setPeptides] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [results, setResults] = useState<PredictionResult[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [stopRequested, setStopRequested] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [useCached, setUseCached] = useState(true);

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const chartRef = useRef<any>(null);

  const [colors, setColors] = useState({
    text: "#000000",
    background: "#ffffff",
    line: "#000000",
  });

  const getCache = (): Record<string, CachedPrediction> => {
    try {
      return JSON.parse(localStorage.getItem("peptideCache") || "{}");
    } catch {
      return {};
    }
  };

  const setCache = (cache: Record<string, CachedPrediction>) => {
    localStorage.setItem("peptideCache", JSON.stringify(cache));
  };

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

  const chunkPredict = async (
    peps: string[],
    size?: number,
    cache?: Record<string, CachedPrediction>,
  ) => {
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

      setResults((prev) => [
        ...prev,
        ...data.map((r: PredictionResult) => ({ ...r, fromCache: false })),
      ]);

      if (cache) {
        data.forEach((result: PredictionResult) => {
          if ("predicted_tr" in result) {
            const { fromCache, ...toCache } = result;
            cache[result.peptide] = toCache;
          }
        });
        setCache(cache);
      }
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
      const cache = getCache();
      let peptidesToPredict = peptides;
      const cachedResults: PredictionResult[] = [];

      if (useCached) {
        peptides.forEach((peptide) => {
          if (cache[peptide]) {
            cachedResults.push({ ...cache[peptide], fromCache: true });
          }
        });
        peptidesToPredict = peptides.filter((p) => !cache[p]);
      }

      setResults(cachedResults);

      if (peptidesToPredict.length > 0) {
        const { trivial, normal, nightmare } =
          bucketPeptides(peptidesToPredict);

        if (!stopRequested && trivial.length > 0)
          await chunkPredict(trivial, undefined, cache);

        if (!stopRequested && normal.length > 0)
          await chunkPredict(normal, 8, cache);

        if (!stopRequested && nightmare.length > 0)
          await chunkPredict(nightmare, 3, cache);
      }
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
        4,
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

  const copyRow = (result: PredictionSuccess) => {
    const text = `${result.peptide},${result.predicted_tr.toFixed(2)},${result.smiles},${result.log_sum_aa.toFixed(4)},${result.log_vdw_vol.toFixed(4)},${result.clog_p.toFixed(4)}`;
    navigator.clipboard.writeText(text);
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
          Array.from(new Set([...prevPeptides, ...loadedPeptides])),
        );
      };
      reader.readAsText(file);
    });

    event.target.value = "";
  };

  const ClearFunc = () => {
    setPeptides([]);
    setResults([]);
  };

  const generateChromatogramData = (textColor: string) => {
    const scalingFactor = 6.5;
    const numPoints = 1000;
    const xVals = Array.from(
      { length: numPoints },
      (_, i) => (i / (numPoints - 1)) * 100,
    );
    const chromatogram = new Array(numPoints).fill(0);
    const noise = Array.from({ length: numPoints }, () => Math.random());
    const annotations: any = {};
    let maxChrom = 0;

    const step = 100 / (numPoints - 1);
    const sigma = 0.35;
    const sigmaSq2 = 2 * sigma ** 2;
    const rangeDist = 5 * sigma;
    const rangeIdx = Math.ceil(rangeDist / step);

    results.forEach((result, index) => {
      if ("error" in result) return;

      const peptide = result.peptide.replace(/-NH2/g, "").replace(/Ac-/g, "");
      const aaCount = peptide.length;
      const rt = result.predicted_tr * scalingFactor;
      const height = aaCount * 10;

      const centerIdx = Math.round((rt / 100) * (numPoints - 1));
      const startIdx = Math.max(0, centerIdx - rangeIdx);
      const endIdx = Math.min(numPoints - 1, centerIdx + rangeIdx);

      for (let j = startIdx; j <= endIdx; j++) {
        const x = j * step;
        chromatogram[j] += height * Math.exp(-((x - rt) ** 2) / sigmaSq2);
      }

      annotations[`peak-label-${index}`] = {
        type: "label",
        xValue: rt * 10 - 0.5,
        yValue: height + peptide.length + 10,
        content: peptide,
        font: { size: 13, weight: "bold", color: textColor },
        rotation: -90,
        xAdjust: 0,
        yAdjust: 0,
        backgroundColor: "rgb(255, 255, 255)",
        color: textColor,
        borderRadius: 4,
        padding: 4,
      };

      annotations[`peak-point-${index}`] = {
        type: "point",
        xValue: rt * 10 - 0.5,
        yValue: height,
        radius: 6,
        backgroundColor: "#1976d2",
        borderWidth: 2,
        borderColor: "#fff",
      };
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
          borderColor: results.length === 0 ? "transparent" : colors.line,
          borderWidth: 2,
          backgroundColor: colors.background,
          fill: true,
        },
      ],
      max: maxChrom,
      annotations,
    };
  };

  const exportChromatogram = () => {
    if (!chartRef.current) return;

    const bgColor =
      getComputedStyle(document.documentElement)
        .getPropertyValue("--sub-background")
        .trim() || "#ffffff";

    const canvas = chartRef.current.canvas;
    const ctx = canvas.getContext("2d");

    ctx.save();

    ctx.globalCompositeOperation = "destination-over";
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const base64Image = canvas.toDataURL("image/png");

    ctx.restore();

    const a = document.createElement("a");
    a.href = base64Image;
    a.download = "chromatogram.png";
    a.click();
  };

  const getPeptideImage = (smiles: string) => {
    return `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(
      smiles,
    )}/PNG?image_size=500x500`;
  };

  const resetZoom = () => {
    if (chartRef.current) {
      chartRef.current.resetZoom();
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
        <FormControlLabel
          control={
            <Checkbox
              checked={useCached}
              onChange={(e) => setUseCached(e.target.checked)}
              sx={{
                color: "var(--accent)",
                "&.Mui-checked": {
                  color: "var(--accent)",
                },
                "& .MuiSvgIcon-root": {
                  fill: "var(--accent)",
                },
              }}
            />
          }
          label="Use Cached"
        />
        <Button
          variant="contained"
          onClick={() => ClearFunc()}
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
                  <TableCell></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {peptideResults.map((item) => (
                  <TableRow key={item.peptide}>
                    <TableCell>
                      <>
                        <b>{item.peptide}</b>
                        {item.result &&
                          "fromCache" in item.result &&
                          item.result.fromCache && (
                            <BTooltip
                              title="Loaded from cache"
                              arrow
                              placement="top"
                            >
                              <span
                                style={{
                                  marginLeft: "5px",
                                  cursor: "help",
                                  display: "inline-flex",
                                  alignItems: "center",
                                }}
                              >
                                <Info fontSize="small" color="success" />
                              </span>
                            </BTooltip>
                          )}
                      </>
                    </TableCell>
                    {item.result ? (
                      "error" in item.result ? (
                        <TableCell colSpan={6} style={{ color: "red" }}>
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
                          <TableCell>
                            <BTooltip title="Copy Row" arrow placement="top">
                              <IconButton
                                onClick={() =>
                                  copyRow(item.result as PredictionSuccess)
                                }
                                sx={{ color: "var(--text)" }}
                              >
                                <ContentCopy />
                              </IconButton>
                            </BTooltip>
                            <BTooltip
                              title="View Peptide"
                              arrow
                              placement="top"
                            >
                              <ImageHoverPreview
                                url={getPeptideImage(item.result.smiles)}
                              />
                            </BTooltip>
                          </TableCell>
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
                        <TableCell></TableCell>
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
            <div>
              <Button
                variant="contained"
                startIcon={<DownloadOutlined />}
                className="predict-button"
                onClick={exportChromatogram}
                disabled={results.length === 0}
              >
                Export As Image
              </Button>
            </div>
          }
        />
        <CardContent>
          <div
            className={`chromatogram-section ${results.length === 0 ? "disabled" : ""}`}
          >
            {isLoading && (
              <CircularProgress className="chromatogram-loading-overlay" />
            )}
            {(() => {
              const chromatogramData = generateChromatogramData(colors.text);
              return (
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "500px",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      bottom: 10,
                      left: 10,
                      zIndex: 20,
                      display: "flex",
                      gap: "8px",
                      background: "rgba(0,0,0,0)",
                      padding: "6px 10px",
                      borderRadius: "6px",
                      alignItems: "center",
                      color: "var(--text)",
                      fontSize: "0.85rem",
                    }}
                  >
                    <Tooltip title="Zoom in" arrow>
                      <IconButton
                        size="small"
                        onClick={() => chartRef.current?.zoom(1.05)}
                        sx={{ color: colors.text }}
                      >
                        <ZoomInOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Zoom out" arrow>
                      <IconButton
                        size="small"
                        onClick={() => chartRef.current?.zoom(0.95)}
                        sx={{ color: colors.text }}
                      >
                        <ZoomOutOutlined fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <Tooltip title="Reset zoom & pan" arrow>
                      <IconButton
                        size="small"
                        onClick={resetZoom}
                        sx={{ color: colors.text }}
                      >
                        <RestartAlt fontSize="small" />
                      </IconButton>
                    </Tooltip>

                    <div
                      style={{
                        marginLeft: "8px",
                        color: colors.text,
                        whiteSpace: "nowrap",
                      }}
                    >
                      Ctrl + drag / wheel / pinch to zoom. Drag to pan.
                    </div>
                  </div>
                  <Line
                    ref={(chart) => {
                      if (chart) {
                        chartRef.current = chart;
                      }
                    }}
                    style={{
                      backgroundColor: colors.background,
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
                        zoom: {
                          zoom: {
                            wheel: { enabled: true },
                            pinch: { enabled: true },
                            drag: { enabled: true, modifierKey: "ctrl" },
                            mode: "x",
                          },
                          pan: { enabled: true, mode: "x" },
                        },
                      },
                      elements: {
                        point: { radius: 0 },
                        line: { borderWidth: 1 },
                      },
                      scales: {
                        x: {
                          min: 0,
                          max: 100,
                          title: {
                            display: true,
                            text: "Retention Time (min)",
                            color: colors.text,
                          },
                          ticks: {
                            maxTicksLimit: 7,
                            callback: (value) =>
                              (Number(value) / 65).toFixed(1),
                            color: colors.text,
                          },
                        },
                        y: {
                          min: 0,
                          max: Math.ceil(chromatogramData.max * 1.2),
                          title: {
                            display: true,
                            text: "Relative Intensity",
                            color: colors.text,
                          },
                          ticks: { color: colors.text },
                        },
                      },
                    }}
                  />
                </div>
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
