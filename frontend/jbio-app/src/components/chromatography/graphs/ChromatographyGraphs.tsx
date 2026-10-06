import { Box, Card, CardContent, CardHeader, FormControlLabel, Switch, Typography } from '@mui/material'
import { useState } from 'react'
import { FractionDto, IonExchangeResponse } from '../../../pages/IonExchangeFractionation'
import { Chromatogram } from './Chromatogram'
import { ChromatographyHitGraph } from './HitGraph'

export type ChromatographyGraphsProps = {
    fractionCount: number
    fractionRows: FractionDto[]
    data: IonExchangeResponse
}

export function ChromatographyGraphs(props: ChromatographyGraphsProps) {
    const data = props.data

    const [showLineGraph, setShowLineGraph] = useState<boolean>(true)
    const [useLogScale, setUseLogScale] = useState<boolean>(true)
    const [showWash, setShowWash] = useState<boolean>(false)

    return (
        <Card>
            <CardHeader title='Fractionation' />
            <CardContent>
                <FormControlLabel control={<Switch checked={showLineGraph} onChange={(_, checked) => setShowLineGraph(checked)} />} label='Line' sx={{ marginBottom: '0.25rem' }} />
                <FormControlLabel control={<Switch checked={useLogScale} onChange={(_, checked) => setUseLogScale(checked)} />} label='Log Scale' sx={{ marginBottom: '0.25rem' }} />
                <FormControlLabel control={<Switch checked={showWash} onChange={(_, checked) => setShowWash(checked)} />} label='Show Wash' sx={{ marginBottom: '0.25rem' }} />

                <Chromatogram {...{ ...props, showLineGraph, showWash, useLogScale }} />
                <ChromatographyHitGraph {...{ ...props, showWash, useLogScale }} />
                <Box>
                    <Typography variant='body2'>
                        Total: {data.counts.total} | Retained: {data.counts.retained} | Wash: {data.counts.wash} | Exchanger:{' '}
                        <span style={{ textTransform: 'capitalize' }}>{data.params.exchanger}</span>
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    )
}
