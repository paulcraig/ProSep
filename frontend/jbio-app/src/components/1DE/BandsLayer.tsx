import React from "react";
import type { StandardProtein } from "./Standards";
import type { PositionsMap, UploadedProteinsMap } from "./types";

type TooltipState = { protein: StandardProtein; x: number; y: number} | null;

type Props = {
    wellsCount: number;

    wellW: number;
    bandW: number;
    bandH: number;
    wellH: number;
    bandMin: number;

    hasStarted: boolean;
    simDelay: number;
    ticks: number;

    selectedStandards: StandardProtein[];
    uploadedProteins: UploadedProteinsMap;
    positions: PositionsMap;

    valueToY: (v: number) => number;

    tooltipData: TooltipState;
    setTooltipData: React.Dispatch<React.SetStateAction<TooltipState>>;
};

export default function BandsLayer ({
    wellsCount,
    wellW,
    bandW,
    bandH,
    wellH,
    bandMin,
    hasStarted,
    simDelay,
    ticks,
    selectedStandards,
    uploadedProteins,
    positions,
    valueToY,
    tooltipData,
    setTooltipData,
}: Props ) {
    const fadeStyle: React.CSSProperties = {
        opacity: hasStarted ? 1 : 0,
        transition: hasStarted 
            ? `opacity ${simDelay / 1000}s ease-in ${simDelay / 1000}s` 
            : "none",
    };

    const onBandClick = (e: React.MouseEvent<SVGRectElement, MouseEvent>, protein: StandardProtein) => {
        if (tooltipData?.protein !== protein) {
            e.stopPropagation();
            const rect = (e.currentTarget as SVGElement).getBoundingClientRect();

            setTooltipData({
                protein,
                x: rect.left + rect.width / 2,
                y: rect.top,
            });

            return;
        }
        setTooltipData(null);
    };

    return (
        <>
            {/* Standards Bands (well 0) */}
            <g className='standards-well' style={fadeStyle}>
                {selectedStandards.map((protein) => (
                    <rect
                        key={protein.id_num}
                        x={wellW + ((wellW - bandW) / 2)} 
                        y={Math.max(valueToY(positions[0]?.[protein.id_num] ?? 0) - (bandH * 1.25), bandMin)}
                        width={bandW} 
                        height={bandH} 
                        rx={3} 
                        ry={3}
                        fill={protein.color}
                        stroke='var(--background)'
                        strokeWidth={0.5}
                        style={{ cursor: 'pointer' }}
                        onClick={(e) => onBandClick(e, protein)}
                    />
                ))}
            </g>

            {/* Uploaded Bands (wells 1..n) */}
            {Array.from({ length: wellsCount }).map((_, wi) => {
                if (wi === 0 || !uploadedProteins[wi]) return null;

                return (
                    <g
                        key={`uploaded-well-${wi}`}
                        className='uploaded-well'
                        style={fadeStyle}
                    >
                        {uploadedProteins[wi].proteins.map((protein) => (
                            <rect
                                x={(2 * wi + 1) * wellW + ((wellW - bandW) / 2)}
                                y={Math.max(valueToY(positions[wi]?.[protein.id_num] ?? 0) - (bandH * 1.25), bandMin)}
                                width={bandW} 
                                height={bandH} 
                                rx={3} 
                                ry={3}
                                key={`${wi}-${protein.id_num}`}
                                fill={protein.color || 'var(--accent)'}
                                stroke='var(--background)'
                                strokeWidth={0.5}
                                style={{ cursor: 'pointer' }}
                                onClick={(e) => onBandClick(e, protein)}
                            />
                        ))}
                    </g>
                );
            })}
        </>
    );
}
