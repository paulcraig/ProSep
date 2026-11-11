import { Suspense, useMemo, useRef } from 'react'
import { ChartLoadingPlaceholder, LazyLine, LazyScatter, useChartTheme, useDownloadChart } from './Common'
import { Chart as ChartJS, ChartDataset } from 'chart.js'
import { FractionDto, FractionationResponse, ProteinDto } from '../types'
import { Box, Button } from '@mui/material'
import { Download } from '@mui/icons-material'

export type ChromatogramFractionDto = Pick<FractionDto, "fractionIndex" | "absorbanceScore">

export type ChromatogramProps = {
    showLineGraph: boolean
    useLogScale: boolean
    showWash?: boolean
    fractionRows: ChromatogramFractionDto[]
    data: FractionationResponse
    elutionPoints?: Array<{ x: number; y: number }>
    elutionLabel?: string,
    elutionAxisLabel?: string
    isSizeExclusion?: boolean
}

export function Chromatogram({ showLineGraph, useLogScale, showWash, fractionRows, data, elutionPoints, elutionLabel = "Salt Gradient", elutionAxisLabel = "Salt Concentration", isSizeExclusion = false}: ChromatogramProps) {
    const lineChartRef = useRef<ChartJS<'line'> | null>(null)
    const scatterChartRef = useRef<ChartJS<'scatter'> | null>(null)
    const chartTheme = useChartTheme()

    const lastFractionX = fractionRows.length > 0 ? Math.max(...fractionRows.map(f => f.fractionIndex)) : 0

    const proteinSeriesPoints = useMemo(() => {
        const points: Array<{ x: number; y: number }> = []

        for (const fraction of fractionRows) {
            points.push({
                x: fraction.fractionIndex,
                y: fraction.absorbanceScore ?? 0,
            })
        }

        if (isSizeExclusion && showWash) {
            points.splice(0, 0, { x: 0, y: data?.wash?.length ?? 0 })
            points.push({ x: lastFractionX + 1, y: data?.afterWash?.length ?? 0 })
        }

        // TODO: normal chromatographies no longer have a hide wash setting. Adding this requires the passing around of our magic 18% constant

        const maxY = Math.max(...points.map(p => p.y), 1)
        for (const point of points) {
            point.y = Math.round((point.y / maxY) * 100) / 100
            if(point.y === 0) point.y = 0.001 
        }
        return points
    }, [data, fractionRows, showWash, lastFractionX])

    const fractionTickLabel = (value: string | number) => {
        if (!isSizeExclusion) return value
        
        const tick = Number(value)
        if (tick === 0) {
            return showWash ? 'Too Big' : value
        }
        if (tick === lastFractionX + 1) {
            return showWash ? 'Too Small' : value
        }
        return String(value)
    }

    const scatterData = useMemo(() => {
        return {
            datasets: [
                {
                    label: 'UV Absorbances',
                    data: proteinSeriesPoints,
                    backgroundColor: 'rgba(107, 224, 57, 0.8)',
                    pointRadius: 4,
                },
            ],
        }
    }, [proteinSeriesPoints])

    const lineData = useMemo(() => {
        const datasets: ChartDataset<'line'>[] = [
            {
                label: 'UV Absorbance',
                data: proteinSeriesPoints,
                borderColor: 'rgba(107, 224, 57, 1)',
                backgroundColor: 'rgba(107, 224, 57, 0.8)',
                pointRadius: 0,
                pointHoverRadius: 5,
                tension: 0.1,
                fill: false,
                yAxisID: 'y',
            },
        ]

        if (elutionPoints && elutionPoints.length > 0) {
            datasets.push({
                label: elutionLabel,
                data: elutionPoints,
                borderColor: 'rgba(255, 107, 107, 1)',
                backgroundColor: 'rgba(255, 107, 107, 1)',
                pointRadius: 0,
                pointHoverRadius: 5,
                tension: 0,
                borderWidth: 2,
                borderDash: [6, 6],
                fill: false,
                yAxisID: 'y1',
            })

            const elutionScale = {
                y1: {
                    type: 'linear',
                    position: 'right',
                    title: {
                        display: true,
                        text: elutionAxisLabel,
                        color: chartTheme.text,
                    },
                    ticks: {
                        color: chartTheme.text,
                    },
                    grid: {
                        color: chartTheme.grid,
                        drawOnChartArea: false,
                    },
                },
            } as const

            return { datasets, elutionScale }
        }

        return { datasets }
    }, [proteinSeriesPoints, elutionPoints, elutionLabel, elutionAxisLabel, chartTheme.text, chartTheme.grid])

    const activeChart = showLineGraph ? lineChartRef.current : scatterChartRef.current
    const downloadChart = useDownloadChart()
    const exportChromatogram = () => {
        downloadChart(activeChart, 'chromatogram.png')
    }

    return (
        <div>
            <div style={{ height: 300 }}>
                {showLineGraph ? (
                    <Suspense fallback={<ChartLoadingPlaceholder chartName='Chromatogram' />}>
                        <LazyLine
                            ref={lineChartRef}
                            data={lineData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: {
                                        labels: {
                                            color: chartTheme.text,
                                        },
                                    },
                                },
                                scales: {
                                    x: {
                                        type: 'linear',
                                        title: {
                                            display: true,
                                            text: 'Fractions',
                                            color: chartTheme.text,
                                        },
                                        // TODO: this always shows zeroth (wash) fraction, either change how wash works or conditionally remove
                                        beginAtZero: true,
                                        ticks: {
                                            callback: fractionTickLabel,
                                            color: chartTheme.text,
                                            stepSize: 1,
                                        },
                                        grid: {
                                            color: chartTheme.grid,
                                        },
                                        min: showWash ? 0 : 1
                                    },
                                    y: {
                                        type: useLogScale ? 'logarithmic' : 'linear',
                                        title: {
                                            display: true,
                                            text: showWash ? 'Retained+Wash' : 'Retained',
                                            color: chartTheme.text,
                                        },
                                        beginAtZero: !useLogScale,
                                        ticks: {
                                            color: chartTheme.text,
                                        },
                                        grid: {
                                            color: chartTheme.grid,
                                        },
                                    },
                                    ...(lineData.elutionScale ?? {})
                                },
                            }}
                        />
                    </Suspense>
                ) : (
                    <Suspense fallback={<ChartLoadingPlaceholder chartName='Chromatogram' />}>
                        <LazyScatter
                            ref={scatterChartRef}
                            data={scatterData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                    legend: {
                                        labels: {
                                            color: chartTheme.text,
                                        },
                                    },
                                },
                                scales: {
                                    x: {
                                        title: {
                                            display: true,
                                            text: 'Fractions',
                                            color: chartTheme.text,
                                        },
                                        // TODO: this always shows zeroth (wash) fraction, either change how wash works or conditionally remove
                                        beginAtZero: true,
                                        ticks: {
                                            callback: fractionTickLabel,
                                            color: chartTheme.text,
                                            stepSize: 1,
                                        },
                                        grid: {
                                            color: chartTheme.grid,
                                        },
                                        min: showWash ? 0 : 1
                                    },
                                    y: {
                                        type: useLogScale ? 'logarithmic' : 'linear',
                                        title: {
                                            display: true,
                                            text: showWash ? 'Retained+Wash' : 'Retained',
                                            color: chartTheme.text,
                                        },
                                        beginAtZero: !useLogScale,
                                        ticks: {
                                            color: chartTheme.text,
                                        },
                                        grid: {
                                            color: chartTheme.grid,
                                        },
                                    },
                                    ...(lineData.elutionScale ?? {})
                                },
                            }}
                        />
                    </Suspense>
                )}
            </div>
            <Box sx={{ marginBottom: 4 }}>
                <Button variant='contained' onClick={exportChromatogram} startIcon={<Download />}>
                    Download
                </Button>
            </Box>
        </div>
    )
}
