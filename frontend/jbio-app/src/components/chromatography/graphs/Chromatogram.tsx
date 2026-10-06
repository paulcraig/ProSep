import { Suspense, useCallback, useMemo, useRef } from 'react'
import { ChartLoadingPlaceholder, LazyLine, LazyScatter, useDownloadChart } from './Common'
import { ChartData, Chart as ChartJS } from 'chart.js'
import { FractionDto, IonExchangeResponse } from '../../../pages/IonExchangeFractionation'
import { Box, Button } from '@mui/material'
import { Download } from '@mui/icons-material'

export type ChromatogramProps = {
    showLineGraph: boolean
    useLogScale: boolean
    showWash: boolean
    fractionRows: FractionDto[]
    data: IonExchangeResponse
}

export function Chromatogram({ showLineGraph, useLogScale, showWash, fractionRows, data }: ChromatogramProps) {
    const lineChartRef = useRef<ChartJS<'line'> | null>(null)
    const scatterChartRef = useRef<ChartJS<'scatter'> | null>(null)

    const proteinSeriesPoints = useMemo(() => {
        const points: Array<{ x: number; y: number }> = []

        if (showWash) {
            points.push({ x: 0, y: data?.wash?.length ?? 0 })
        }

        for (const fraction of fractionRows) {
            points.push({
                x: fraction.fractionIndex,
                y: fraction.proteins.map(p => p.amount).reduce((a, b) => a + b, 0),
            })
        }
        const maxY = Math.max(...points.map(p => p.y), 1)
        for (const point of points) {
            point.y = Math.round((point.y / maxY) * 100) / 100
        }
        return points
    }, [data, fractionRows, showWash])

    const scatterData = useMemo(() => {
        return {
            datasets: [
                {
                    label: 'Proteins per fraction',
                    data: proteinSeriesPoints,
                    backgroundColor: 'rgba(107, 224, 57, 0.8)',
                    pointRadius: 4,
                },
            ],
        }
    }, [proteinSeriesPoints])

    const lineData = useMemo(() => {
        return {
            datasets: [
                {
                    label: 'Proteins per fraction',
                    data: proteinSeriesPoints,
                    borderColor: 'rgba(107, 224, 57, 1)',
                    backgroundColor: 'rgba(107, 224, 57, 0.8)',
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    tension: 0.1,
                    fill: false,
                },
            ],
        }
    }, [proteinSeriesPoints])

    const activeChart = showLineGraph ? lineChartRef.current : scatterChartRef.current
    const downloadChart = useDownloadChart()
    const exportChromatogram = () => {
        downloadChart(activeChart, 'chromatogram.png')
    }

    return (
        <div>
            <Box>
                <Button variant='contained' onClick={exportChromatogram} startIcon={<Download />}>
                    Download
                </Button>
            </Box>
            <div>
                {showLineGraph ? (
                    <Suspense fallback={<ChartLoadingPlaceholder chartName='Chromatogram' />}>
                        <LazyLine
                            ref={lineChartRef}
                            data={lineData}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                scales: {
                                    x: {
                                        type: 'linear',
                                        title: {
                                            display: true,
                                            text: 'Fractions',
                                        },
                                        beginAtZero: true,
                                        ticks: {
                                            callback: value => (Number(value) === 0 ? (showWash ? 'Wash' : '0') : String(value)),
                                        },
                                    },
                                    y: {
                                        type: useLogScale ? 'logarithmic' : 'linear',
                                        title: {
                                            display: true,
                                            text: showWash ? 'Retained+Wash' : 'Retained',
                                        },
                                        beginAtZero: !useLogScale,
                                    },
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
                                scales: {
                                    x: {
                                        title: {
                                            display: true,
                                            text: 'Fractions',
                                        },
                                        beginAtZero: true,
                                        ticks: {
                                            callback: value => (Number(value) === 0 ? (showWash ? 'Wash' : '0') : String(value)),
                                        },
                                    },
                                    y: {
                                        type: useLogScale ? 'logarithmic' : 'linear',
                                        title: {
                                            display: true,
                                            text: showWash ? 'Retained+Wash' : 'Retained',
                                        },
                                        beginAtZero: !useLogScale,
                                    },
                                },
                            }}
                        />
                    </Suspense>
                )}
            </div>
        </div>
    )
}
