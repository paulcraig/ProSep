import { Suspense, useMemo, useRef } from 'react'
import { ChartLoadingPlaceholder, LazyBar, useChartTheme, useDownloadChart } from './Common'
import { Chart as ChartJS } from 'chart.js'
import { Box, Button } from '@mui/material'
import { Download } from '@mui/icons-material'
import { FractionDto, FractionationResponse, ProteinDto } from '../types'

const MAX_STACKED_SERIES = 200

export type HitGraphProteinDto = Pick<ProteinDto, "amount" | "id" | "color">
export type HitGraphFractionDto = 
    Omit<Pick<FractionDto, "fractionIndex" | "hitProteinIds">, "proteins"> 
    & { proteins: HitGraphProteinDto[] }

export type ChromatographyHitChartProps = {
    showWash: boolean
    useLogScale: boolean
    washLabel?: string
    afterWashLabel?: string
    fractionRows: HitGraphFractionDto[]
    data: FractionationResponse
    afterWash?: ProteinDto[]
}

export function ChromatographyHitGraph({ showWash, useLogScale, washLabel, afterWashLabel, data, fractionRows, afterWash }: ChromatographyHitChartProps) {
    const stackedChartRef = useRef<ChartJS<'bar'> | null>(null)
    const showAfterWash = !!afterWash && afterWash.length > 0
    const chartTheme = useChartTheme()

    const downloadChart = useDownloadChart()
    const exportStackedProteins = () => {
        downloadChart(stackedChartRef.current, 'stacked-proteins.png')
    }

    const stackedHitAmounts = useMemo(() => {
        const proteinColorById = new Map<string, string>()
        const proteinTotals = new Map<string, number>()
        const fractionAmountMaps: Array<Map<string, number>> = []
        const labels: string[] = []
        const baseOtherData: number[] = []

        const washAmountByProteinId = new Map<string, number>()
        let washOtherTotal = 0
        for (const protein of data?.wash ?? []) {
            washOtherTotal += protein.amount
        }

        if (showWash) {
            labels.push(washLabel ?? 'Wash')
            fractionAmountMaps.push(washAmountByProteinId)
            baseOtherData.push(washOtherTotal)
        }

        for (const fraction of fractionRows) {
            const amountByProteinId = new Map<string, number>()
            const hitIdSet = new Set(fraction.hitProteinIds ?? [])
            const hasHitFilter = hitIdSet.size > 0
            let fractionOtherTotal = 0

            labels.push(String(fraction.fractionIndex))

            for (const protein of fraction.proteins) {
                const isHitProtein = hasHitFilter && hitIdSet.has(protein.id)
                if (!isHitProtein) {
                    fractionOtherTotal += protein.amount
                    continue
                }

                const previous = amountByProteinId.get(protein.id) ?? 0
                const next = previous + protein.amount
                amountByProteinId.set(protein.id, next)

                proteinTotals.set(protein.id, (proteinTotals.get(protein.id) ?? 0) + protein.amount)

                if (!proteinColorById.has(protein.id)) {
                    proteinColorById.set(protein.id, protein.color)
                }
            }

            fractionAmountMaps.push(amountByProteinId)
            baseOtherData.push(fractionOtherTotal)
        }

        if (showAfterWash) {
            let afterWashOtherTotal = 0
            for (const protein of afterWash) {
                afterWashOtherTotal += protein.amount
            }
            labels.push(afterWashLabel ?? 'After Wash')
            fractionAmountMaps.push(new Map())
            baseOtherData.push(afterWashOtherTotal)
        }

        const sortedProteinIds = Array.from(proteinTotals.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([proteinId]) => proteinId)

        const keptProteinIds = sortedProteinIds.slice(0, MAX_STACKED_SERIES)
        const keptSet = new Set(keptProteinIds)

        const datasets = keptProteinIds.map(proteinId => ({
            label: proteinId,
            data: fractionAmountMaps.map(fractionMap => fractionMap.get(proteinId) ?? 0),
            backgroundColor: proteinColorById.get(proteinId) ?? 'rgba(107, 224, 57, 0.8)',
            stack: 'hit-protein-amounts',
            borderWidth: 0,
            barPercentage: 1,
            categoryPercentage: 1,
        }))

        const otherData = fractionAmountMaps.map((fractionMap, fractionIndex) => {
            let otherTotal = baseOtherData[fractionIndex] ?? 0
            fractionMap.forEach((amount, proteinId) => {
                if (!keptSet.has(proteinId)) {
                    otherTotal += amount
                }
            })
            return otherTotal
        })

        const hasOther = otherData.some(value => value > 0)
        if (hasOther) {
            datasets.push({
                label: showWash ? 'Other/Wash' : 'Other',
                data: otherData,
                backgroundColor: 'rgba(120, 120, 120, 0.85)',
                stack: 'hit-protein-amounts',
                borderWidth: 0,
                barPercentage: 1,
                categoryPercentage: 1,
            })
        }

        return {
            labels,
            datasets,
            hiddenProteinCount: Math.max(sortedProteinIds.length - MAX_STACKED_SERIES, 0),
        }
    }, [data, fractionRows, showWash, washLabel, showAfterWash, afterWash, afterWashLabel])

    return (
        <div>
            <div>
                <Suspense fallback={<ChartLoadingPlaceholder chartName='Stacked Proteins' />}>
                    <LazyBar
                        ref={stackedChartRef}
                        key={`stacked-hit-amounts-${fractionRows.length}-${stackedHitAmounts.datasets.length}`}
                        data={stackedHitAmounts}
                        options={{
                            responsive: true,
                            maintainAspectRatio: false,
                            animation: false,
                            normalized: true,
                            scales: {
                                x: {
                                    stacked: true,
                                    title: {
                                        display: true,
                                        text: showWash ? 'Wash / Fractions' : 'Fractions',
                                        color: chartTheme.text,
                                    },
                                    ticks: {
                                        color: chartTheme.text,
                                    },
                                    grid: {
                                        color: chartTheme.grid,
                                    },
                                },
                                y: {
                                    stacked: true,
                                    type: useLogScale ? 'logarithmic' : 'linear',
                                    title: {
                                        display: true,
                                        text: showWash ? 'Retained+Wash Amount' : 'Retained Amount',
                                        color: chartTheme.text,
                                    },
                                    ticks: {
                                        color: chartTheme.text,
                                    },
                                    grid: {
                                        color: chartTheme.grid,
                                    },
                                },
                            },
                            plugins: {
                                legend: {
                                    display: false,
                                },
                            },
                        }}
                    />
                </Suspense>
            </div>
            <Box sx={{ marginBottom: 4 }}>
                <Button variant='contained' onClick={exportStackedProteins} startIcon={<Download />}>
                    Download
                </Button>
            </Box>
        </div>
    )
}
