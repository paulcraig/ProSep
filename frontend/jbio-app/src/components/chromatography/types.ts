export type ProteinDto = {
    id: string
    name: string
    description: string
    sequence: string
    molecularWeight: number
    color: string
    amount: number
}

export type FractionDto = {
    fractionIndex: number
    proteinCount?: number
    hitCount?: number
    hitProteinIds?: string[]
    absorbanceScore?: number
    proteins: ProteinDto[]
}

export type FractionationResponse = {
    ok: boolean
    params: Record<string, unknown>
    counts: Record<string, number>
    wash?: FractionDto
    afterWash?: FractionDto
    fractions: FractionDto[]
    error?: string
}
