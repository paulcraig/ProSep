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
import { FractionDto, ProteinDto } from '../../../pages/IonExchangeFractionation'
import { Search } from '@mui/icons-material'
import { SortDirection } from './Common'

type ProteinSortKey = 'charge' | 'molecularWeight'

export type ProteinTableProps = {
    fractionRows: FractionDto[]
    ph: number
}

export function ProteinTable({ fractionRows, ph }: ProteinTableProps) {
    const [proteinSort, setProteinSort] = useState<{
        key: ProteinSortKey
        direction: SortDirection
    }>({
        key: 'charge',
        direction: 'asc',
    })

    const [proteinPage, setProteinPage] = useState<number>(0)
    const [proteinRowsPerPage, setProteinRowsPerPage] = useState<number>(10)

    const [proteinSearch, setProteinSearch] = useState<string>('')

    const handleProteinSort = (key: ProteinSortKey, direction: SortDirection) => {
        setProteinSort({ key, direction })
        setProteinPage(0)
    }

    const retainedRows = useMemo(() => {
        const byKey = new Map<string, ProteinDto>()
        for (const fraction of fractionRows) {
            for (const protein of fraction.proteins) {
                byKey.set(`${protein.id}::${protein.sequence}`, protein)
            }
        }
        return Array.from(byKey.values()).sort((a, b) => Math.abs(a.charge) - Math.abs(b.charge))
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

    const sortedRetainedRows = useMemo(() => {
        const rows = [...filteredRetainedRows]
        const directionMultiplier = proteinSort.direction === 'asc' ? 1 : -1

        rows.sort((a, b) => {
            const aValue = proteinSort.key === 'charge' ? a.charge : a.molecularWeight
            const bValue = proteinSort.key === 'charge' ? b.charge : b.molecularWeight

            return (aValue - bValue) * directionMultiplier
        })

        return rows
    }, [filteredRetainedRows, proteinSort])

    const pagedProteins = useMemo(() => {
        const start = proteinPage * proteinRowsPerPage
        return sortedRetainedRows.slice(start, start + proteinRowsPerPage)
    }, [sortedRetainedRows, proteinPage, proteinRowsPerPage])

    useEffect(() => {
        setProteinPage(0)
    }, [fractionRows])

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
                                <TableCell>
                                    <TableSortLabel
                                        active={proteinSort.key === 'charge'}
                                        direction={proteinSort.key === 'charge' ? proteinSort.direction : 'asc'}
                                        onClick={() => handleProteinSort('charge', proteinSort.key === 'charge' && proteinSort.direction === 'asc' ? 'desc' : 'asc')}
                                    >
                                        Charge at pH {ph.toFixed(1)}
                                    </TableSortLabel>
                                </TableCell>
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
                                    <TableCell>{row.charge.toFixed(2)}</TableCell>
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
