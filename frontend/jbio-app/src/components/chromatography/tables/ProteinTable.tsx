import {
    Box,
    Card,
    CardContent,
    CardHeader,
    InputAdornment,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TableSortLabel,
    TextField,
    Typography,
} from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { FractionDto, ProteinDto } from '../types'
import { Search } from '@mui/icons-material'
import { SortDirection } from './Common'

type ProteinTableProteinDto = Pick<ProteinDto, "id" | "name" | "description" | "sequence" | "molecularWeight" | "color">

export type ProteinTableMetricDto<P> = {
    label: string
    value: (protein: P) => number
    format?: (value: number) => string
}

type ProteinTableFractionDto<P> = Pick<FractionDto, "fractionIndex"> & {
    proteins: P[]
}

export type ProteinTableProps<P> = {
    fractionRows: ProteinTableFractionDto<P>[]
    metrics?: ProteinTableMetricDto<P>[]
}

export function ProteinTable<P extends ProteinTableProteinDto>({ fractionRows, metrics = [] }: ProteinTableProps<P>) {
    const [proteinSort, setProteinSort] = useState<{
        key: string
        direction: SortDirection
    }>({
        key: 'molecularWeight',
        direction: 'asc',
    })

    const [proteinPage, setProteinPage] = useState<number>(0)
    const [proteinRowsPerPage, setProteinRowsPerPage] = useState<number>(10)

    const [proteinSearch, setProteinSearch] = useState<string>('')

    const handleProteinSort = (key: string, direction: SortDirection) => {
        setProteinSort({ key, direction })
        setProteinPage(0)
    }

    const retainedRows = useMemo(() => {
        const byKey = new Map<string, P>()
        for (const fraction of fractionRows) {
            for (const protein of fraction.proteins) {
                byKey.set(`${protein.id}::${protein.sequence}`, protein)
            }
        }
        return Array.from(byKey.values())
    }, [fractionRows])

    const filteredRetainedRows = useMemo(() => {
        const query = proteinSearch.trim().toLowerCase()
        if (!query) {
            return retainedRows
        }

        return retainedRows.filter(row => {
            return row.name.toLowerCase().includes(query) || row.sequence.toLowerCase().includes(query) || row.description.toLowerCase().includes(query)
        })
    }, [retainedRows, proteinSearch])

    const getSortValue = (row: P, key: string) => {
        if (key === 'molecularWeight') {
            return row.molecularWeight
        }
        const metric = metrics.find(m => m.label === key)
        return metric ? metric.value(row) : 0
    }

    const sortedRetainedRows = useMemo(() => {
        const rows = [...filteredRetainedRows]
        const directionMultiplier = proteinSort.direction === 'asc' ? 1 : -1

        rows.sort((a, b) => {
            return (getSortValue(a, proteinSort.key) - getSortValue(b, proteinSort.key)) * directionMultiplier
        })

        return rows
    }, [filteredRetainedRows, proteinSort, metrics])

    const pagedProteins = useMemo(() => {
        const start = proteinPage * proteinRowsPerPage
        return sortedRetainedRows.slice(start, start + proteinRowsPerPage)
    }, [sortedRetainedRows, proteinPage, proteinRowsPerPage])

    useEffect(() => {
        setProteinPage(0)
    }, [fractionRows])

    const formatMetricValue = (metric: ProteinTableMetricDto<P>, value: number) => {
        return metric.format ? metric.format(value) : value.toFixed(2)
    }

    return (
        <Card>
            <CardHeader
                title='Filtered Proteins'
                action={
                    <TextField
                        variant='outlined'
                        value={proteinSearch}
                        placeholder='Search'
                        onChange={e => {
                            setProteinSearch(e.target.value)
                            setProteinPage(0)
                        }}
                        slotProps={{
                            input: {
                                startAdornment: (
                                    <InputAdornment position='start'>
                                        <Search />
                                    </InputAdornment>
                                ),
                            },
                        }}
                    />
                }
            />
            <CardContent>
                <TablePagination
                    component='div'
                    count={sortedRetainedRows.length}
                    page={proteinPage}
                    onPageChange={(_, newPage) => setProteinPage(newPage)}
                    rowsPerPage={proteinRowsPerPage}
                    onRowsPerPageChange={e => {
                        setProteinRowsPerPage(Number(e.target.value))
                        setProteinPage(0)
                    }}
                    rowsPerPageOptions={[10, 25, 50]}
                />
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>ID</TableCell>
                                <TableCell>Name</TableCell>
                                {metrics.map(metric => (
                                    <TableCell key={metric.label}>
                                        <TableSortLabel
                                            active={proteinSort.key === metric.label}
                                            direction={proteinSort.key === metric.label ? proteinSort.direction : 'asc'}
                                            onClick={() => handleProteinSort(metric.label, proteinSort.key === metric.label && proteinSort.direction === 'asc' ? 'desc' : 'asc')}
                                        >
                                            {metric.label}
                                        </TableSortLabel>
                                    </TableCell>
                                ))}
                                <TableCell>
                                    <TableSortLabel
                                        active={proteinSort.key === 'molecularWeight'}
                                        direction={proteinSort.key === 'molecularWeight' ? proteinSort.direction : 'asc'}
                                        onClick={() => handleProteinSort('molecularWeight', proteinSort.key === 'molecularWeight' && proteinSort.direction === 'asc' ? 'desc' : 'asc')}
                                    >
                                        Molecular Weight
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>Sequence</TableCell>
                                <TableCell>Description</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {pagedProteins.map((row, idx) => (
                                <TableRow key={`${row.id}-${idx}`}>
                                    <TableCell>
                                        <Box
                                            sx={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 1,
                                            }}
                                        >
                                            <Box
                                                sx={{
                                                    width: 16,
                                                    height: 16,
                                                    backgroundColor: row.color ?? 'transparent',
                                                    borderRadius: '50%',
                                                    border: row.color ? '1px solid #333' : 'none',
                                                }}
                                            />
                                            <Typography
                                                variant='body2'
                                                sx={{
                                                    fontFamily: 'monospace',
                                                }}
                                            >
                                                {row.id}
                                            </Typography>
                                        </Box>
                                    </TableCell>
                                    <TableCell>{row.name || '-'}</TableCell>
                                    {metrics.map(metric => (
                                        <TableCell key={metric.label}>{formatMetricValue(metric, metric.value(row))}</TableCell>
                                    ))}
                                    <TableCell>{row.molecularWeight.toFixed(2)}</TableCell>
                                    <TableCell
                                        title={row.sequence}
                                        sx={{
                                            maxWidth: '150px',
                                            height: '1.5em',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {row.sequence}
                                    </TableCell>
                                    <TableCell
                                        title={row.description}
                                        sx={{
                                            maxWidth: '150px',
                                            height: '1.5em',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                        }}
                                    >
                                        {row.description}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </CardContent>
        </Card>
    )
}
