import { Search } from '@mui/icons-material'
import { Card, CardHeader, TextField, InputAdornment, CardContent, TablePagination, TableContainer, Table, TableHead, TableRow, TableCell, TableSortLabel, TableBody, Box, Chip } from '@mui/material'
import { useEffect, useMemo, useState } from 'react'
import { FractionDto } from '../../../pages/IonExchangeFractionation'
import { SortDirection } from './Common'

type FractionSortKey = 'fractionIndex' | 'proteinCount' | 'hitCount'

export type HitTableProps = { fractionRows: FractionDto[] }

export function HitTable({ fractionRows }: HitTableProps) {
    const [fractionSearch, setFractionSearch] = useState<string>('')

    const [fractionPage, setFractionPage] = useState<number>(0)
    const [fractionRowsPerPage, setFractionRowsPerPage] = useState<number>(10)
    const [fractionSort, setFractionSort] = useState<{
        key: FractionSortKey
        direction: SortDirection
    }>({
        key: 'fractionIndex',
        direction: 'asc',
    })

    const handleFractionSort = (key: FractionSortKey, direction: SortDirection) => {
        setFractionSort({ key, direction })
        setFractionPage(0)
    }

    const filteredFractionRows = useMemo(() => {
        const query = fractionSearch.trim().toLowerCase()
        if (!query) {
            return fractionRows
        }

        return fractionRows.filter(row => {
            const hitIds = (row.hitProteinIds ?? []).join(' ').toLowerCase()

            return hitIds.includes(query)
        })
    }, [fractionRows, fractionSearch])

    const sortedFractionRows = useMemo(() => {
        const rows = [...filteredFractionRows]
        const directionMultiplier = fractionSort.direction === 'asc' ? 1 : -1

        rows.sort((a, b) => {
            const aValue = fractionSort.key === 'fractionIndex' ? a.fractionIndex : fractionSort.key === 'proteinCount' ? (a.proteinCount ?? a.proteins.length) : (a.hitCount ?? 0)

            const bValue = fractionSort.key === 'fractionIndex' ? b.fractionIndex : fractionSort.key === 'proteinCount' ? (b.proteinCount ?? b.proteins.length) : (b.hitCount ?? 0)

            return (aValue - bValue) * directionMultiplier
        })

        return rows
    }, [filteredFractionRows, fractionSort])

    const pagedFractions = useMemo(() => {
        const start = fractionPage * fractionRowsPerPage
        return sortedFractionRows.slice(start, start + fractionRowsPerPage)
    }, [sortedFractionRows, fractionPage, fractionRowsPerPage])

    useEffect(() => {
        setFractionPage(0)
    }, [fractionRows])

    return (
        <Card>
            <CardHeader
                title='Hits'
                action={
                    <TextField
                        variant='outlined'
                        value={fractionSearch}
                        placeholder='Search'
                        onChange={e => {
                            setFractionSearch(e.target.value)
                            setFractionPage(0)
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
                    count={sortedFractionRows.length}
                    page={fractionPage}
                    onPageChange={(_, newPage) => setFractionPage(newPage)}
                    rowsPerPage={fractionRowsPerPage}
                    onRowsPerPageChange={e => {
                        setFractionRowsPerPage(Number(e.target.value))
                        setFractionPage(0)
                    }}
                    rowsPerPageOptions={[10, 25, 50]}
                />
                <TableContainer>
                    <Table>
                        <TableHead>
                            <TableRow>
                                <TableCell>
                                    <TableSortLabel
                                        active={fractionSort.key === 'fractionIndex'}
                                        direction={fractionSort.key === 'fractionIndex' ? fractionSort.direction : 'asc'}
                                        onClick={() => handleFractionSort('fractionIndex', fractionSort.key === 'fractionIndex' && fractionSort.direction === 'asc' ? 'desc' : 'asc')}
                                    >
                                        Fraction
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                    <TableSortLabel
                                        active={fractionSort.key === 'proteinCount'}
                                        direction={fractionSort.key === 'proteinCount' ? fractionSort.direction : 'asc'}
                                        onClick={() => handleFractionSort('proteinCount', fractionSort.key === 'proteinCount' && fractionSort.direction === 'asc' ? 'desc' : 'asc')}
                                    >
                                        Protein Count
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>
                                    <TableSortLabel
                                        active={fractionSort.key === 'hitCount'}
                                        direction={fractionSort.key === 'hitCount' ? fractionSort.direction : 'asc'}
                                        onClick={() => handleFractionSort('hitCount', fractionSort.key === 'hitCount' && fractionSort.direction === 'asc' ? 'desc' : 'asc')}
                                    >
                                        Hit Count
                                    </TableSortLabel>
                                </TableCell>
                                <TableCell>Hit Protein IDs</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {pagedFractions.map(row => (
                                <TableRow key={row.fractionIndex}>
                                    <TableCell>{row.fractionIndex}</TableCell>
                                    <TableCell>{row.proteinCount ?? row.proteins.length}</TableCell>
                                    <TableCell>{row.hitCount ?? 0}</TableCell>
                                    <TableCell>
                                        {(row.hitProteinIds ?? []).length === 0 ? (
                                            '...'
                                        ) : (
                                            <Box>
                                                {(row.hitProteinIds ?? []).map((proteinId, proteinIndex) => {
                                                    const protein = row.proteins.find(item => item.id === proteinId)
                                                    return (
                                                        <Chip
                                                            key={`${row.fractionIndex}-${proteinId}-${proteinIndex}`}
                                                            size='medium'
                                                            clickable
                                                            label={proteinId}
                                                            title={'Copy Sequence'}
                                                            sx={{
                                                                border: '2px solid #333',
                                                                backgroundColor: protein?.color ?? 'inherit',
                                                                color: '#fff',
                                                                fontWeight: 600,
                                                                fontSize: '1rem',
                                                                margin: '0.2rem',
                                                                fontFamily: 'monospace',
                                                                textShadow: '0 0 3px rgba(0,0,0,0.9)',
                                                            }}
                                                            onClick={() => {
                                                                if (!protein) return
                                                                navigator.clipboard.writeText(protein.sequence)
                                                            }}
                                                        />
                                                    )
                                                })}
                                            </Box>
                                        )}
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
