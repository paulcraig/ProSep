import type { StandardProtein } from "./standards";

export interface ElectrophoresisProps {
    ticks?: number;
    wells?: number;
    voltage?: number;
    acrylamide?: number;
}

export type UploadedProteinsMap = Record<number, { name: string, proteins: StandardProtein[] }>;
export type PositionsMap = Record<number, Record<string, number>>;
