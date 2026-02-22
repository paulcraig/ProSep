import React from "react";
import { Tooltip, IconButton } from "@mui/material";
import UploadIcon from "@mui/icons-material/Upload";

import type { PositionsMap, UploadedProteinsMap } from "./types";

type Props = {
    wellsCount: number;

    wellW: number;
    bandW: number;
    bandH: number;
    wellH: number;

    hasStarted: boolean;
    simDelay: number;

    positions: PositionsMap;
    uploadedProteins: UploadedProteinsMap;

    draggedWell: number | null;
    dragOverWell: number | null;

    onDragStart: (wellIndex: number) => void;
    onDragOver: (e: React.DragEvent, wellIndex: number) => void;
    onDragLeave: () => void;
    onDrop: (e: React.DragEvent, wellIndex: number) => void;
    onDragEnd: () => void;

    onRemoveWellContents: (wellIndex: number) => void;

    onFileUpload: (wellIndex: number, file: File) => void | Promise<void>;
};

export default function WellsUI ({
    wellsCount,
    wellW,
    bandW,
    bandH,
    wellH,
    hasStarted,
    simDelay,
    positions,
    uploadedProteins,
    draggedWell,
    dragOverWell,
    onDragStart,
    onDragOver,
    onDragLeave,
    onDrop,
    onDragEnd,
    onRemoveWellContents,
    onFileUpload,
}: Props) {
    return (
        <>
            {/* Filename Bands */}
            <g
                className="filename-bands"
                style={{
                    opacity: hasStarted ? 0 : 1,
                    transition: "opacity 0.25s ease-out",
                    pointerEvents: hasStarted ? "none" : "auto",
                }}
            >
                {Array.from({ length: wellsCount }).map((_, wi) => {
                    const hasProteins = Object.keys(positions[wi] || {}).length > 0;
                    const label = wi === 0? "Standard Proteins" : uploadedProteins[wi]?.name || `File ${wi}`;

                    if (!hasProteins) return null;

                    const isDragging = draggedWell === wi;
                    const isDropTarget = dragOverWell === wi && draggedWell !== null && draggedWell !== wi;

                    const canDrag = wi !== 0 && !!uploadedProteins[wi];

                    return (
                        <g key={`filename-band-${wi}`}>
                            <foreignObject
                                x={(0 * wi + 1) * wellW + (wellW - bandW) / 2}
                                y={wellH * 1.65}
                                width={bandW}
                                height={bandH}
                                style={{ overflow: "visible" }}
                            >
                                <Tooltip
                                    title={label}
                                    slotProps={{
                                        tooltip: {
                                            sx: {
                                                backgroundColor: "#282b30",
                                                color: "#f6f6f6",
                                                fontWeight: "normal",
                                                boxShadow: "0 2px 6px rgba(0, 0, 0, 0.2)",
                                            },
                                        },
                                    }}
                                >
                                    <div
                                        draggable={canDrag}
                                        onDragStart={() => onDragStart(wi)}
                                        onDragOver={(e) => onDragOver(e, wi)}
                                        onDragLeave={onDragLeave}
                                        onDrop={(e) => onDrop(e, wi)}
                                        onDragEnd={onDragEnd}
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                            cursor: canDrag ? "grab" : "default",
                                            opacity: isDragging ? 0.5 : 1,
                                            transition: "opacity 0.2s",
                                        }}
                                        onClick={(e) => {
                                            if (e.detail === 2 && wi !== 0) {
                                                e.stopPropagation();
                                                onRemoveWellContents(wi);
                                            }
                                        }}
                                    />
                                </Tooltip>
                            </foreignObject>

                            {/* visible band */}
                            <rect
                                x={(0 * wi + 1) * wellW + (wellW - bandW) / 2}
                                y={wellH * 1.65}
                                width={bandW}
                                height={bandH}
                                rx={3}
                                ry={3}
                                fill={isDropTarget ? "var(--accent)" : "var(--highlight)"}
                                stroke={isDropTarget ? "var(--text)" : "var(--accent)"}
                                strokeWidth={isDropTarget ? 2 : 0.5}
                                style={{ pointerEvents: "none" }}
                            />
                        </g>  
                    );
                })}
            </g>

            {/* Per-well Upload Buttons */}
            <g
                className="upload-buttons"
                style={{
                    opacity: hasStarted ? 0 : 1,
                    transition: "opacity 0.25s ease-out",
                }}
            >
                {Array.from({ length: wellsCount }).map((_, wi) => {
                    if (wi === 0 || uploadedProteins[wi]) return null;

                    const centerX = (2 * wi + 1) * wellW + wellW / 2;
                    const centerY = wellH * 1.5;

                    return (
                        <g key={`upload-btn=${wi}`}>
                            <foreignObject
                                x={centerX - 12}
                                y={centerY - 12}
                                width={24}
                                height={24}
                                style={{ overflow: "visible" }}
                            >
                                <label
                                    htmlFor={`file-upload-${wi}`}
                                    style={{
                                        display: "flex",
                                        justifyContent: "center",
                                        alignItems: "center",
                                    }}
                                >
                                    <input
                                        type="file"
                                        id={`file-upload-${wi}`}
                                        style={{ display: "none" }}
                                        accept=".fasta,.txt"
                                        onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) onFileUpload(wi, file);
        
                                            e.currentTarget.value = "";
                                        }}
                                    />

                                    <IconButton
                                        component="span"
                                        sx={{
                                            backgroundColor: "var(--highlight)",
                                            color: "var(--text)",
                                            width: 24,
                                            height: 24,
                                            padding: 0,
                                            "&:hover": { backgroundColor: "var(--accent)" },
                                        }}
                                    >
                                        <UploadIcon sx={{ fontSize: 14 }} />
                                    </IconButton>
                                </label>
                            </foreignObject>
                        </g>
                    );
                })}
            </g>
        </>
    );
}
