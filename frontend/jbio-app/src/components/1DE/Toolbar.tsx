import React from "react";
import { Button } from "@mui/material";

import StopIcon from "@mui/icons-material/Stop";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import InsertChartIcon from "@mui/icons-material/InsertChart";
import UploadIcon from "@mui/icons-material/Upload";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ClearAllIcon from "@mui/icons-material/ClearAll";

type Props = {
    isRunning: boolean;
    hasStarted: boolean;

    slabW: number;

    toolbarRef: React.RefObject<HTMLDivElement>;

    wellsCount: number;
    maxWells: number;
    uploadedProteins: Record<number, unknown>;
    onFileUpload: (wellIndex: number, file: File) => Promise<void>;
    setWellsCount: React.Dispatch<React.SetStateAction<number>>;

    onToggleRun: () => void;
    onPlot: () => void;
    onReset: () => void;
    onClear: () => void;

};

export default function Toolbar ({
    isRunning,
    hasStarted,
    slabW,
    toolbarRef,
    wellsCount,
    maxWells,
    uploadedProteins,
    onFileUpload,
    setWellsCount,
    onToggleRun,
    onPlot,
    onReset,
    onClear,
}: Props) {
    const bulkInputId = "bulk-upload-input";

    return (
        <>
            {/* Toolbar */}
            <div
                ref={toolbarRef}
                style={{
                    display: 'flex',
                    justifyContent: 'center',
                    paddingLeft: '3.75rem',
                    paddingBottom: '1rem',
                    gap: '0.5rem',
                    width: slabW
                }}
            >
                {[
                    { 
                        label: isRunning ? 'Pause' : hasStarted ? 'Resume' : 'Start',
                        icon: isRunning ? <StopIcon /> : <PlayArrowIcon />,
                        onClick: onToggleRun
                    },
                    { label: 'Plot',  icon: <InsertChartIcon />, onClick: onPlot },
                    { label: 'Reset', icon: <RestartAltIcon />,  onClick: onReset },
                    { label: 'Clear', icon: <ClearAllIcon />,    onClick: onClear },
                    { 
                        label: 'Upload',
                        icon: <UploadIcon />,
                        onClick: () => document.getElementById('bulk-upload-input')?.click()
                    }
                ]
                .map(btn => (
                    <Button
                        key={btn.label}
                        onClick={btn.onClick}
                        variant='contained'
                        startIcon={btn.icon}
                        sx={{
                            '&:hover': { backgroundColor: 'var(--accent)' },
                            backgroundColor: 'var(--highlight)',
                            textTransform: 'none',
                            color: 'var(--text)'
                        }}
                    >
                        {btn.label}
                    </Button>
                ))}
            </div>

            <input
                id='bulk-upload-input'
                type='file'
                multiple
                accept='.fasta,.txt'
                style={{ display: 'none' }}
                onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (!files.length) return;

                    let fileIdx = 0;
                    let currentCount = wellsCount;

                    for (let wi = 1; fileIdx < files.length && wi < maxWells; wi++) {
                        if (wi >= currentCount) {
                        setWellsCount(prev => prev + 1);
                        currentCount++;
                        }
                        if (!uploadedProteins[wi]) {
                        await onFileUpload(wi, files[fileIdx++]);
                        }
                    }
                    if (fileIdx < files.length) {
                        alert(`Only ${fileIdx}/${maxWells} wells were filled.`);
                    }

                    e.target.value = '';
                }}
            />
        </>
    );
}