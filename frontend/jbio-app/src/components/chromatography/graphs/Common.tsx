import { Box, CircularProgress, Typography } from '@mui/material'
import { Chart as ChartJS } from 'chart.js'
import { lazy, useCallback } from 'react'

export const LazyBar = lazy(() => import('react-chartjs-2').then(module => ({ default: module.Bar })))
export const LazyLine = lazy(() => import('react-chartjs-2').then(module => ({ default: module.Line })))
export const LazyScatter = lazy(() =>
    import('react-chartjs-2').then(module => ({
        default: module.Scatter,
    })),
)

export const ChartLoadingPlaceholder: React.FC<{ chartName: string }> = ({ chartName }) => {
    return (
        <Box className='ionx-chart-loading'>
            <CircularProgress size={34} thickness={4.5} />
            <Typography variant='body2'>Loading {chartName}</Typography>
        </Box>
    )
}

export function useDownloadChart() {
    return useCallback((chart: ChartJS | null, fileName: string) => {
        if (!chart) {
            return
        }

        const canvas = chart.canvas
        const exportCanvas = document.createElement('canvas')
        exportCanvas.width = canvas.width
        exportCanvas.height = canvas.height

        const exportCtx = exportCanvas.getContext('2d')
        if (!exportCtx) {
            return
        }

        exportCtx.fillStyle = '#ffffff'
        exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
        exportCtx.drawImage(canvas, 0, 0)

        const base64Image = exportCanvas.toDataURL('image/png')

        const a = document.createElement('a')
        a.href = base64Image
        a.download = fileName
        a.click()
    }, [])
}
