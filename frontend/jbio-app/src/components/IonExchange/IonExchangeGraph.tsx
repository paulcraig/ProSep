import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";
import { ChartData, ChartOptions } from "chart.js";

import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
} from "chart.js";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Legend
);

type Protein = {
    id: string;
    name: string;
    description: string;
    sequence: string;
    molecularWeight: number;
    charge: number;
    color: string;
};

type Fraction  = {
    fractionIndex: number;
    proteins: Protein[];
};

type IonExchangeResponse = {
    ok: boolean;
    counts?: {
        total: number;
        wash: number;
        retained: number;
    };
    wash?: Protein[];
    fractions?: Fraction[];
};

const IonExchangeGraph: React.FC<{ result: IonExchangeResponse }> = ({ result }) => {
    const labels = useMemo((): string[] =>  {
        const labs: string[] = [];
        labs.push("Wash");
        for (const f of result.fractions ?? []) {
            labs.push(`F${f.fractionIndex}`);
        }
        return labs;
    }, [result]);

    const counts = useMemo((): number[] =>  {
        const vals: number[] = [];
        vals.push(result.wash?.length ?? 0);
        for (const f of result.fractions ?? []) {
            vals.push(f.proteins?.length ?? 0);
        }
        return vals;
    }, [result]);

    const chartData = useMemo<ChartData<"line", number[], string>>(() => {
        return {
            labels,
            datasets: [
                {
                    label: "Proteins per fraction",
                    data: counts,
                    tension: 0.25,
                    borderColor: "#4da6ff",    
                    backgroundColor: "rgba(77,166,255,0.25)", 
                    pointBackgroundColor: "#4da6ff",
                    pointBorderColor: "#ffffff",
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    fill: true,
                },
            ],
        };
    }, [labels, counts]);

    const options = useMemo<ChartOptions<"line">>(() => {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: true },
                tooltip: { enabled: true },
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: "Elution fraction",
                        color: "#ffffff",
                    },
                    ticks: { color: "#dddddd" },
                    grid: { color: "rgba(255,255,255,0.1)" },
                },
                y: {
                    title: {
                        display: true,
                        text: "# proteins",
                        color: "#ffffff",
                    },
                    ticks: {
                        color: "#dddddd",
                        precision: 0,
                    },
                    grid: { color: "rgba(255,255,255,0.1)" },
                    beginAtZero: true,
                },
            },
        };
    }, []);

    return (
        <div style={{ width: "100%", height: 320 }}>
            <Line data={chartData} options={options} />
        </div>
    );
};

export default IonExchangeGraph;