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
