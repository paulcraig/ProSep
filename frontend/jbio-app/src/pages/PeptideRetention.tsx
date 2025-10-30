import React, { useState } from 'react';
import { TextField, IconButton, Button, Chip, CircularProgress, Table, TableBody, TableCell, TableHead, TableRow, Card, CardHeader, CardContent, Alert } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { API_URL } from '../config';
import "./PeptideRetention.css";

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
      const loadedPeptides = content.split(',').map((peptide) => peptide.trim());
      setPeptides((prevPeptides) => Array.from(new Set([...prevPeptides, ...loadedPeptides])));
    };
    reader.readAsText(file);
  };

  return (
    <div className="peptide-retention-page">
      <div className="input-section">
        <TextField
          className="peptide-input"
          label="Peptide Sequence"
          variant="outlined"
          value={newPeptide}
          onChange={(e) => setNewPeptide(e.target.value)}
          onKeyUp={handleKeyUp}
          color="primary"
        />
        <IconButton
          color="primary"
          onClick={addPeptide}
          disabled={!newPeptide.trim()}
        >
          <AddIcon />
        </IconButton>
      </div>

      {peptides.length > 0 && (
        <div className="peptides-list">
          <div>Peptides to predict:</div>
          {peptides.map((peptide) => (
            <Chip
              key={peptide}
              label={peptide}
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
      >
        {isLoading ? "Predicting..." : "Predict All"}
      </Button>

      {isLoading && <CircularProgress className="loading-spinner" />}

      {results.length > 0 && (
        <Card className="results-card">
          <CardHeader
            title="Prediction Results"
            action={
              <Button variant="text" color="primary" onClick={exportCsv}>
                Export CSV
              </Button>
            }
          />
          <CardContent>
            <Table>
              <TableHead>
                <TableRow className='results-header'>
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
                    <TableCell><b>{result.peptide}</b></TableCell>
                    <TableCell>{result.predicted_tr.toFixed(2)}</TableCell>
                    <TableCell>{result.smiles}</TableCell>
                    <TableCell>{result.log_sum_aa.toFixed(4)}</TableCell>
                    <TableCell>{result.log_vdw_vol.toFixed(4)}</TableCell>
                    <TableCell>{result.clog_p.toFixed(4)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {errorMessage && (
        <Alert severity="error" className="error-alert">
          {errorMessage}
        </Alert>
      )}

      <div className="file-upload-section">
        <Button
          variant="contained"
          component="label"
          className="load-file-button"
        >
          Load from File
          <input
            type="file"
            accept=".txt,.csv"
            hidden
            onChange={loadFromFile}
          />
        </Button>
      </div>
    </div>
  );
};

export default PeptideRetention;