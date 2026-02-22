import React from "react";
import { PositionsMap } from "./types";
import type { StandardProtein } from "./standards";

export type TooltipData = {
    protein: StandardProtein;
    x: number;
    y: number;
};

type Props = {
    tooltipData: TooltipData;
    setTooltipData: React.Dispatch<React.SetStateAction<TooltipData | null>>;

    positions: PositionsMap;
    ticks: number;

    isDraggingTooltip: boolean;
    setIsDraggingTooltip: React.Dispatch<React.SetStateAction<boolean>>;
    tooltipDragStart: { x: number; y: number } | null;
    setTooltipDragStart: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
};

export default function ProteinTooltip({
    tooltipData,
    setTooltipData,
    positions,
    ticks,
    isDraggingTooltip,
    setIsDraggingTooltip,
    tooltipDragStart,
    setTooltipDragStart,
}: Props) {
    return (
        <div
            className="protein-tooltip"
            style={{
                left: tooltipData.x,
                top: tooltipData.y,
                transform: "translate(40px, -100%)",
                cursor: isDraggingTooltip ? "grabbing" : "grab",
            }}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => {
                setIsDraggingTooltip(true);
                setTooltipDragStart({
                    x: e.clientX - tooltipData.x,
                    y: e.clientY - tooltipData.y,
                });
            }}
            onMouseMove={(e) => {
                if (isDraggingTooltip && tooltipDragStart) {
                    setTooltipData({
                        ...tooltipData,
                        x: e.clientX - tooltipDragStart.x,
                        y: e.clientY - tooltipDragStart.y
                    });
                }
            }}
            onMouseUp={() => {
                setIsDraggingTooltip(false);
                setTooltipDragStart(null);
            }}
            onMouseLeave={() => {
                if (isDraggingTooltip) {
                    setIsDraggingTooltip(false);
                    setTooltipDragStart(null);
                }
            }}  
        >
            <div className="protein-tooltip-title">Protein Information</div> 

            <div>Name: {tooltipData.protein.name}</div>
            <div>Molecular Weight: {tooltipData.protein.molecularWeight.toLocaleString()}</div>
            <div>
                Rm Value:{" "}
                {(() => {
                    const wellIndex = Object.entries(positions).find(([_, proteins]) =>
                        Object.prototype.hasOwnProperty.call(
                            proteins,
                            tooltipData.protein.id_num
                        )
                    )?.[0];

                    const value = wellIndex ? positions[Number(wellIndex)]?.[tooltipData.protein.id_num] ?? 0 : 0;

                    return (value / ticks).toFixed(3);
                })()}  
            </div>

            <div>
                PDB:{' '}
                <a
                    href={`https://www.rcsb.org/structure/${tooltipData.protein.id_num}`}
                    target='_blank'
                    rel='noopener noreferrer'
                >
                    {tooltipData.protein.id_num}
                </a>
            </div>
        </div>
    );
}
