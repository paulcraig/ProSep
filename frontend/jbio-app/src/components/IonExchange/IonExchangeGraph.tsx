import React, { useMemo } from "react";
import { BarChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis, Tooltip, Bar, Line } from "recharts";

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

type ChartRow = {
    label: string;
    count: number;
};

const IonExchangeGraph: React.FC<{ result: IonExchangeResponse }> = ({
    result,
}) => {
    const data: ChartRow[] = useMemo(() => {
        const rows: ChartRow[] = [];

        const washCount = result.wash?.length ?? 0;
        rows.push({ label: "Wash", count: washCount });

        const fracs = result.fractions ?? [];
        for (const f of fracs) {
            rows.push({
                label: `F${f.fractionIndex}`,
                count: f.proteins?.length ?? 0,
            });
        }

        return rows;
    }, [result]);

    if (!data.length) return null;

    return (
        <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis allowDecimals={false} />
                    <Tooltip />

                    {/* Bars = fraction protein counts */}
                    <Bar 
                        dataKey="count" 
                        fill="var(--accent)"
                    />

                    <Line 
                        type="monotone"
                        dataKey="count"
                        stroke="white"
                        strokeWidth={2}
                        dot={false} 
                    />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
};

export default IonExchangeGraph;