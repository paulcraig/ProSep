import React, { useMemo, useState } from "react";

import { API_URL } from "../config";
import IonExchangeGraph from "../components/IonExchange/IonExchangeGraph";
import { Card, CardHeader, CardContent, TextField, FormControl, InputLabel, Select, MenuItem, Button, CircularProgress, Alert, Table, TableHead, TableRow, TableCell, TableBody } from "@mui/material";

type Protein = {
    name: string;
    id: string;
    description: string;
    sequence: string;
    molecularWeight: number;
    charge: number;
    color: string;
};

type Fraction = {
    fractionIndex: number;
    proteins: Protein[];
};

type IonExchangeResponse = {
    ok: boolean;
    error?: string;
    params?: {
        pH: number;
        exchanger: "anion" | "cation";
        fractions: number;
        overlap: number;
        deadband: number;  
    };
    counts?: {
        total: number;
        wash: number;
        retained: number;
    };
    wash?: Protein[];
    fractions?: Fraction[];
};

const IonExchange: React.FC = () => {
    const [file, newFile] = useState<File | null>(null);

    const [pH, setPH] = useState<number>(7.0);
    const [exchanger, setExchanger] = useState<"anion" | "cation">("anion");
    const [fractions, setFractions] = useState<number>(7);

    const [overlap, setOverlap] = useState<number>(0.1);
    const [deadband, setDeadband] = useState<number>(0.05);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [result, setResult] = useState<IonExchangeResponse | null>(null);

    const canRun = useMemo(() => !!file && !isLoading, [file, isLoading]);

    const runIonExchange = async () => {
        if (!file) return;

        setIsLoading(true);
        setErrorMessage(null);
        setResult(null);

        try {
            const params = new URLSearchParams();
            params.set("pH", String(pH));
            params.set("exchanger", String(exchanger));
            params.set("fractions", String(fractions));
            params.set("overlap", String(overlap));
            params.set("deadband", String(deadband));

            const form = new FormData();
            form.append("file", file);

            const url = `${API_URL}/sample-prep/ion-exchange?${params.toString()}`;
            console.log("Ion Exchange URL:", url);

            // const response = await fetch(
            //     `${API_URL}/sample-prep/ion-exchange?${params.toString()}`,
            //     {
            //         method: "POST",
            //         body: form,
            //     }
            // );

            const response = await fetch(url, {
                method: "POST",
                body: form,
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status} ${response.statusText}`);
            }

            const data: IonExchangeResponse = await response.json();
            if (!data.ok) {
                throw new Error(data.error || "Ion Exchange failed");
            }

            setResult(data);
        } catch (err: any) {
            setErrorMessage(`Error: ${err.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div style={{ padding: "2rem", maxWidth: 700 }}>
            <Card>
                <CardHeader title="Ion Exchange Sample Prep" />
                <CardContent style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                    <input
                        type="file"
                        accept=".fasta,.faa"
                        onChange={(e) => newFile(e.target.files?.[0] ?? null)}
                    />
                    <TextField label="Buffer pH" type="number" value={pH} onChange={(e) => setPH(Number(e.target.value))} />
                    <FormControl>
                        <InputLabel>Exchanger</InputLabel>
                        <Select value={exchanger} label="Exchanger" onChange={(e) => setExchanger(e.target.value)}>
                            <MenuItem value="anion">Anion</MenuItem>
                            <MenuItem value="cation">Cation</MenuItem>
                        </Select>
                    </FormControl>

                    <TextField label="Fractions" type="number" value={fractions} onChange={(e) => setFractions(Number(e.target.value))} />
                    <Button variant="contained" onClick={runIonExchange}>Run Ion Exchange</Button>

                    {isLoading && <CircularProgress />}
                    {errorMessage && <Alert security="error">{errorMessage}</Alert>}

                    {result?.counts && (
                        <div>
                            <p>Total: {result.counts.total}</p>
                            <p>Wash: {result.counts.wash}</p>
                            <p>Retained: {result.counts.retained}</p>
                        </div>
                    )}

                    {result && (
                        <Card variant="outlined" style={{ marginTop: "1rem" }}>
                            <CardHeader title="Proteins per Fraction"/>
                            <CardContent>
                                <IonExchangeGraph result={result}/>
                            </CardContent>
                        </Card>
                    )}   
                </CardContent>
            </Card>
        </div>
    );
};

export default IonExchange;