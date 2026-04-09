import React, { useMemo, useState } from "react";
 

import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
} from "chart.js";
import { API_URL } from "../config";
import "./SizeExclusion.css"; // ✅ IMPORT CSS
import { Alert, Box, Button, Card, CardContent, CardHeader, FormControl, InputLabel, MenuItem, Select, SelectChangeEvent, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
// Gel dictionary
const gelDict: { [key: string]: [number, number] } = {
  "Bio-P 0.1-1.8 kDa": [100, 1800],
  "Bio-P 0.8-4.0 kDa": [800, 4000],
  "Bio-P 1.0-6.0 kDa": [1000, 6000],
  "Bio-P 1.5-20.0 kDa": [1500, 20000],
  "Bio-P 2.5-40.0 kDA": [2500, 40000],
  "Bio-P 3.0-60.0 kDa": [3000, 60000],
  "Bio-P 5.0-100 kDa": [5000, 100000],
  "S-X 0.4-14.0 kDa": [400, 14000],
  "S-X <2.0 kDA": [0, 2000],
  "S-X <0.4 kDA": [0, 400],
  "Bio-A 10.0 - 500 kDA": [10000, 500000],
  "Bio-A 10.0 - 1500 kDA": [10000, 1500000],
};


ChartJS.register(
  CategoryScale,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
  Legend
);

type ProteinDto = {
  id: string;
  name: string;
  molecularWeight: number;
  hydrophobicity: number;
  bindingStrength: number;
};

type SizeExclusionResponse = {
  ok: boolean;
  counts: {
    total: number;
    to_small: number;
    to_big: number;
    inside: number;
  };
  proteins: ProteinDto[];
  error?: string;
};


const SizeExclusionPage: React.FC = () => {
  const [fastaText, setFastaText] = useState("");
  const gelNames = Object.keys(gelDict);
  const [selectedGel, setSelectedGel] = useState(gelNames[0]);
  const [minSize, setMinSize] = useState(gelDict[gelNames[0]][0]);
  const [maxSize, setMaxSize] = useState(gelDict[gelNames[0]][1]);
  const [fractionCount, setFractionCount] = useState(5); // x fractions inside range

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<SizeExclusionResponse | null>(null);

  const handleLoadFasta = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setFastaText(text);
  };

  const handleGelChange = (event: SelectChangeEvent<string>) => {
    const gel = event.target.value as string;
    setSelectedGel(gel);
    setMinSize(gelDict[gel][0]);
    setMaxSize(gelDict[gel][1]);
  };

  const handleRun = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/size_exclusion/process`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fasta_content: fastaText,
          gel_name: selectedGel,
          proteinList: [],
        }),
      });
      const json = (await res.json()) as SizeExclusionResponse;
      if (!res.ok || !json.ok || json.error) {
        throw new Error(json.error || "Failed to process.");
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setData(null);
    } finally {
      setLoading(false);
    }
  };


  const fractionCounts = useMemo(() => {
    if (!data) return [];
    const fractions = Array(fractionCount + 2).fill(0);
    fractions[0] = data.counts.to_big;
    fractions[fractionCount + 1] = data.counts.to_small;
    const step = (maxSize - minSize) / fractionCount;
    data.proteins.forEach((p) => {
      if (p.molecularWeight >= minSize && p.molecularWeight <= maxSize) {
        let idx = Math.floor((p.molecularWeight - minSize) / step) + 1;
        if (idx > fractionCount) idx = fractionCount; // Clamp
        fractions[idx]++;
      }
    });
    return fractions;
  }, [data, minSize, maxSize, fractionCount]);

  const chartData = useMemo(() => {
    if (!data) return { labels: [], datasets: [] };
    const labels = [
      "Too Big",
      ...Array.from({ length: fractionCount }, (_, i) => {
        const start = minSize + i * (maxSize - minSize) / fractionCount;
        const end = minSize + (i + 1) * (maxSize - minSize) / fractionCount;
        return `${start.toFixed(0)}-${end.toFixed(0)}`;
      }),
      "Too Small",
    ];
    return {
      labels,
      datasets: [
        {
          label: "Protein Count",
          data: fractionCounts,
          backgroundColor: "#66d1b2",
        },
      ],
    };
  }, [fractionCounts, minSize, maxSize, fractionCount, data]);

  const chartOptions = {
    responsive: true,
    scales: {
      x: {
        title: { display: true, text: "Fraction" },
      },
      y: {
        title: { display: true, text: "Protein Count" },
        beginAtZero: true,
        ticks: { stepSize: 1 },
      },
    },
  };


  return (
    <Box className="sec-page">
      <Card className="sec-card">
        <CardHeader title="Size Exclusion Chromatography" />
        <CardContent>
          {error && <Alert severity="error">{error}</Alert>}

          <Box className="sec-controls">
            <FormControl fullWidth>
              <InputLabel id="gel-select-label">Gel Type</InputLabel>
              <Select
                labelId="gel-select-label"
                value={selectedGel}
                label="Gel Type"
                onChange={handleGelChange}
              >
                {gelNames.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name} ({gelDict[name][0]} - {gelDict[name][1]} Da)
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
         
            <TextField
              label="Fractions (x)"
              type="number"
              value={fractionCount}
              onChange={e => setFractionCount(Math.max(1, parseInt(e.target.value) || 1))}
              inputProps={{ min: 1 }}
            />
          </Box>

          <Box mt={2}>
            <Button className="sec-button" variant="contained" component="label">
              Upload FASTA
              <input hidden type="file" onChange={handleLoadFasta} />
            </Button>

            <Button
              className="sec-button"
              variant="contained"
              onClick={handleRun}
              disabled={loading || !fastaText.trim()}
              sx={{ ml: 2 }}
            >
              {loading ? "Running..." : "Run"}
            </Button>
          </Box>
        </CardContent>
      </Card>

      {data && (
        <>
          <Card className="sec-card">
            <CardContent>
              <Box className="sec-chart-wrap">
                <Line data={chartData} options={chartOptions} />
              </Box>
              <Box className="sec-summary-info-card">
                <Typography>
                  Total: {data.counts.total} | Too Small: {data.counts.to_small} | Too Big: {data.counts.to_big} | Inside: {data.counts.inside}
                </Typography>
              </Box>
            </CardContent>
          </Card>

          <Card className="sec-card">
            <CardHeader title="Proteins (Inside Range)" />
            <CardContent>
              <TableContainer>
                <Table size="small" className="sec-protein-table">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Molecular Weight</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.proteins.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>{p.name}</TableCell>
                        <TableCell>{p.molecularWeight}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </>
      )}
    </Box>
  );
};

export default SizeExclusionPage;