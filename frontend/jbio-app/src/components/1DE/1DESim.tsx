import React, { useState, useMemo, useRef } from "react"
import { Button, Chip } from "@mui/material"

import InfoIcon from '@mui/icons-material/Info';
import StopIcon from "@mui/icons-material/Stop";
import UploadIcon from "@mui/icons-material/Upload";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import InsertChartIcon from "@mui/icons-material/InsertChart";


interface IDEProtein {
  name: string;
  molecularWeight: number;
  migrationDistance: number;
  color: string;
  id_num: string;
  id_str: string;
  count: number;
}


interface OneDEProps {
  axisTicks?: number
  initWells?: number
  initVoltage?: number
  initAcrylamide?: number
}


export default function OneDESim({
  axisTicks = 6,
  initWells = 5,
  initVoltage= 100,
  initAcrylamide= 7.5

} : OneDEProps ) {

  /* Consts */
  const SUB_TICKS = 3;
  const MAX_WELLS = 10;
  
  const BORDER = 4;
  const TICK_MAJOR = 20;
  const GUIDE_MAJOR = BORDER / 2;
  const TICK_MINOR = TICK_MAJOR / 2;
  const GUIDE_MINOR = GUIDE_MAJOR / 2;

  const STANDARDS: Record<string, IDEProtein> = {
    "6X1Q": { name: "B-Galactosidase",    molecularWeight: 116250, migrationDistance: 0, color: "#4dd0e1", id_num: "6X1Q", id_str: "pdb", count: 1 },
    "3LQ8": { name: "Phosphorylase B",    molecularWeight: 97400,  migrationDistance: 0, color: "#d3e24a", id_num: "3LQ8", id_str: "pdb", count: 1 },
    "1AO6": { name: "Serum Albumin",      molecularWeight: 66200,  migrationDistance: 0, color: "#3d98c1", id_num: "1AO6", id_str: "pdb", count: 1 },
    "1OVA": { name: "Ovalbumin",          molecularWeight: 45000,  migrationDistance: 0, color: "#f06292", id_num: "1OVA", id_str: "pdb", count: 1 },
    "1CA2": { name: "Carbonic Anhydrase", molecularWeight: 29000,  migrationDistance: 0, color: "#b8de7c", id_num: "1CA2", id_str: "pdb", count: 1 },
    "2PTC": { name: "Trypsin Inhibitor",  molecularWeight: 20100,  migrationDistance: 0, color: "#5c6bc0", id_num: "2PTC", id_str: "pdb", count: 1 },
    "6LYZ": { name: "Lysozyme",           molecularWeight: 14400,  migrationDistance: 0, color: "#81c784", id_num: "6LYZ", id_str: "pdb", count: 1 },
    "1AAP": { name: "Aprotinin",          molecularWeight: 6500,   migrationDistance: 0, color: "#e57373", id_num: "1AAP", id_str: "pdb", count: 1 },
  };

  /* Dimensions */
  const [slabHeight, setSlabHeight] = useState(850); // TODO: Update to dynamic sizing later.
  const [slabWidth,  setSlabWidth ] = useState(1000);

  /* Zoom and Drag */
  const [zoom,   setZoom  ] = useState(1);
  const [anchor, setAnchor] = useState(0.5);

  const rafRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastDragY, setlastDragY] = useState<number | null>(null);

  /* Top/Bottom Bars */
  const [showHelp, setShowHelp] = useState(false);
  const [showPlot, setShowPlot] = useState(false);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  /* Simulation */
  const [isRunning, setIsRunning] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [numTicks,   setNumTicks  ] = useState(axisTicks);
  const [numWells,   setNumWells  ] = useState(initWells);
  const [voltage,    setVoltage   ] = useState(initVoltage);
  const [acrylamide, setAcrylamide] = useState(initAcrylamide);

  const [proteins,   setProteins  ] = useState<Record<string, IDEProtein>[]>([]);
  const [selStandards, setSelStandards] = useState<IDEProtein[]>(Object.values(STANDARDS));

  
  /* Functions and Handlers */
  const { min, max } = useMemo(() => ({
    min: -(SUB_TICKS + 1) / (SUB_TICKS * 5),
    max: numTicks
  }), [numTicks]);


  const getY = (value: number, min: number, max: number, height: number, canZoom: boolean = true) => {
    const clamped = Math.max(min, Math.min(max, value));
    const normal = (clamped - min) / (max - min);

    if (canZoom)
      return height * ((normal <= anchor) ?
        anchor * Math.pow(normal / Math.max(anchor, 1e-9), zoom) :
        1 - (1 - anchor) * Math.pow((1 - normal) / Math.max(1 - anchor, 1e-9), zoom));

    return height * normal;
  };


  const handleZoom = (e: React.WheelEvent<HTMLDivElement>) => {
    if (rafRef.current) return;

    const deltaY = e.deltaY;
    const mouseY = e.clientY;
    const container = e.currentTarget.getBoundingClientRect();
    const relativeY = mouseY - container.top;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;

      const normalizedAnchor = ((relativeY / slabHeight) * (max - min)) / (max - min);
      const newAnchor = Math.max(0, Math.min(1, normalizedAnchor));
      const zoomFactor = deltaY < 0 ? 1.1 : 0.9;
      
      setZoom(z => {
        const newZoom = Math.min(50, Math.max(1, z * zoomFactor));

        if (newZoom === z) return z;
        if (newZoom > z) setAnchor(a => a + (newAnchor - a) * 0.1);
        return newZoom;
      });
    });
  }


  const handleDrag = (e: React.MouseEvent<HTMLElement>) => {
    if (!isDragging || lastDragY === null || rafRef.current) return;
    const clientY = e.clientY;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const dy = clientY - lastDragY;
      const normShift = dy / slabHeight;

      setlastDragY(clientY);
      setAnchor(a => Math.max(0, Math.min(1, a - normShift)));
    })
  }


  const handleDragMDown = (e: React.MouseEvent<HTMLElement>) => {
    setIsDragging(true);
    setlastDragY(e.clientY);
  }


  React.useEffect(() => {
    const handleDragMUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setlastDragY(null);
      }
    };
    window.addEventListener("mouseup", handleDragMUp);
    return () => window.removeEventListener("mouseup", handleDragMUp);
  }, [isDragging]);


  const handleHelp = () => setShowHelp(true);
  const handlePlot = () => setShowPlot(true);
  const handleReset = () => console.log("Reset");
  const handleClear = () => console.log("Clear");


  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    console.log("Uploading files:", files);
    e.target.value = "";
  };


  const handleRun = () => {
    setIsRunning(!isRunning);
    setIsStarted(true);
  };


  const handleToggleStandard = (protein: IDEProtein) => {
    setSelStandards(prev => {
      const isSelected = prev.some(p => p.id_num === protein.id_num);
      if (isSelected) {
        return prev.filter(p => p.id_num !== protein.id_num);
      } else {
        return [...prev, protein];
      }
    });
  };


  /* Components */
  const toolbar = useMemo(() => {
    const buttons = [
      { label: "Instructions", icon: <InfoIcon />, onClick: handleHelp },
      { 
        label: "Upload",
        icon: <UploadIcon />,
        onClick: () => document.getElementById("bulk-upload-input")?.click()
      },
      { 
        label: isRunning ? "Pause" : isStarted ? "Resume" : "Start",
        icon: isRunning ? <StopIcon /> : <PlayArrowIcon />,
        onClick: handleRun
      },
      { label: "Reset", icon: <RestartAltIcon />,  onClick: handleReset },
      { label: "Clear", icon: <ClearAllIcon />,    onClick: handleClear },
      { label: "Plot",  icon: <InsertChartIcon />, onClick: handlePlot }
    ];

    return (
      <>
        <div
          ref={toolbarRef}
          style={{
            display: "flex", justifyContent: "center", gap: "0.5rem",
            marginLeft: TICK_MAJOR, width: slabWidth + (TICK_MAJOR * 2),
          }}
        >
          {buttons.map(btn => (
            <Button
              key={btn.label}
              onClick={btn.onClick}
              variant="contained"
              startIcon={btn.icon}
              sx={{
                "&:hover": { backgroundColor: "var(--accent)" },
                backgroundColor: "var(--highlight)",
                textTransform: "none",
                fontSize: "0.85rem",
                color: "var(--text)"
              }}
            >
              {btn.label}
            </Button>
          ))}
        </div>

        <input
          id="bulk-upload-input"
          type="file"
          multiple
          accept=".fasta,.txt"
          style={{ display: "none" }}
          onChange={handleUpload}
        />
      </>
    );
  }, [isRunning, isStarted, slabWidth]);


  const acrylamideSlab = useMemo(() => {
    const width = slabWidth - 1;
    const height = slabHeight + BORDER / 2;
    const wellHeight = getY(min / 2, min, max, slabHeight, false) * 2;

    const n = numTicks + 1 + numTicks * SUB_TICKS;
    const dotOffset = (1 / (2 * (SUB_TICKS + 1)));
    let dotIdx = 0, tickIdx = 0, lineIdx = 0;

    const dots = new Array(n);
    const ticks = new Array(n);
    const lines = new Array(n);

    // Factories:
    const makeBuffers = () => {
      let path = `M 0 0 L 0 ${wellHeight * 2} L ${TICK_MAJOR} ${wellHeight * 2} L ${TICK_MAJOR} ${wellHeight}`;
      const wellWidth = slabWidth / (2 * numWells + 1);
      const fullWidth = slabWidth + (TICK_MAJOR * 2);
      
      for (let i = 0; i <= numWells; i++) {
        const base = (i * wellWidth * 2) + TICK_MAJOR;
        path += ` L ${base} ${wellHeight} L ${base + wellWidth} ${wellHeight} L ${base + wellWidth} ${wellHeight * 2}`;
        if (i < numWells) { path += ` L ${base + wellWidth * 2} ${wellHeight * 2}`; }
      }
      path += ` L ${fullWidth} ${wellHeight * 2} L ${fullWidth} 0 Z`;
      
      return (
        <>
          <svg
            viewBox={`${-BORDER / 2} ${-BORDER / 2} ${fullWidth + BORDER} ${wellHeight * 2 + BORDER}`}
            style={{
              position: "relative", zIndex: "2",
              top: `${-wellHeight}`, left: `${-TICK_MAJOR - (BORDER / 2)}`,
              width: `${fullWidth + BORDER}px`, height: `${wellHeight * 2 + BORDER}px`
            }}
          >
            <path
              d={path}
              fill="var(--sub-accent)" vectorEffect="non-scaling-stroke"
              stroke="var(--accent)" strokeLinejoin="round" strokeWidth={BORDER - 1}
            />
          </svg>
          <div
            style={{
              position: "absolute", boxSizing: "border-box", zIndex: 0,
              bottom: `-${(wellHeight * 2) - (BORDER / 2)}px`, left: `-${TICK_MAJOR}px`,
              width: `${slabWidth + TICK_MAJOR * 2}px`, height: `${wellHeight * 2}px`,
              background: "var(--sub-accent)", border: `${BORDER}px solid var(--accent)`, borderRadius: "2px"
            }}
          />
        </>
      );
    }

    const makeDots = (key: string, y: number, radius: number) => {
      const wellWidth = slabWidth / (2 * numWells + 1);
      const gap = wellWidth / 4;
      const amount = Math.floor(slabWidth / gap);
      const offset = (slabWidth - ((amount - 1) * gap + radius * 2)) / 2;
      
      return (
        <svg
          key={key}
          width={width} height={(radius * 2) + 1}
          style={{position: "absolute", top: `${y - radius}px`}}
        >
          {Array.from({length: amount}, (_, i) => (
            <circle 
              key={i}
              cx={offset + i * gap + radius} cy={radius}
              r={radius} fill="var(--sub-text)" opacity={0.15 / zoom}
            />
          ))}
        </svg>
      );
    }

    const makeTick = (key: string, y: number, isMajor: boolean, label?: number, fadeDist?: number) => {
      const tickWidth = isMajor ? TICK_MAJOR : TICK_MINOR;
      const thickness = isMajor ? GUIDE_MAJOR : GUIDE_MINOR;
      const opacity = (isMajor && fadeDist) ? Math.min(1, Math.min(y, slabHeight - y) / fadeDist) : 1;

      return (
        <div
          key={key}
          style={{position: "absolute", top: `${y}px`, left: `-${tickWidth}px`}}
        >
          {label !== undefined && (
            <span style={{ 
              position: "absolute", right: "8px",
              transform: "translateY(-50%)",
              pointerEvents: "none",
              color: "var(--text)",
              whiteSpace: "nowrap",
              fontSize: "0.85rem",
              opacity: opacity
            }}>
              {label}
            </span>
          )}
          <svg 
            width={tickWidth} height={thickness} 
            style={{position: "absolute", overflow: "visible"}}
          >
            <line
              x1={0} y1={thickness / 2}
              x2={tickWidth} y2={thickness / 2}
              stroke="var(--accent)" strokeWidth={thickness} vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      );
    }

    const makeLine = (key: string, y: number, isMajor: boolean) => {
      const lineHeight = isMajor ? GUIDE_MAJOR : GUIDE_MINOR;

      return (
        <svg
          key={key}
          width={width} height={lineHeight}
          style={{position: "absolute", top: `${y}px`, overflow: "visible"}}
        >
          <line
            x1={0} y1={lineHeight / 2}
            x2={width} y2={lineHeight / 2}
            stroke={isMajor ? "var(--text)" : "var(--sub-text)"}
            strokeWidth={lineHeight}
            strokeOpacity={isMajor ? 1 : 0.6}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      );
    };

    // Render:
    for (let i = 0; i <= numTicks; i++) {
      const dy = getY(i - dotOffset, min, max, height);
      const y = getY(i, min, max, height);

      dots[dotIdx++] = makeDots(`major-dots-${i}`, dy, BORDER);
      ticks[tickIdx++] = makeTick(`major-tick-${i}`, y, true, i, (i % numTicks ? wellHeight * 2 : undefined));
      
      if (i < numTicks) {
        lines[lineIdx++] = makeLine(`major-${i}`, y, i > 0);

        for (let j = 1; j <= SUB_TICKS; j++) {
          const dy = getY(i + j / (SUB_TICKS + 1) - dotOffset, min, max, height);
          const y = getY(i + j / (SUB_TICKS + 1), min, max, height);

          dots[dotIdx++] = makeDots(`minor-dots-${i}-${j}`, dy, BORDER);
          ticks[tickIdx++] = makeTick(`minor-tick-${i}-${j}`, y, false);
          lines[lineIdx++] = makeLine(`minor-${i}-${j}`, y, false);
        }
      }
    }

    return (
      <div
        style={{
          position: "relative", width: `${slabWidth}px`, height: `${slabHeight + 4}px`,
          margin: `${wellHeight}px ${TICK_MAJOR}px ${wellHeight * 2}px ${TICK_MAJOR * 2}px`,
          cursor: zoom > 1 ? isDragging ? "grabbing" : "grab" : "default",
          background: "var(--sub-background)",
          WebkitUserSelect: "none",
          userSelect: "none",
          overflow: "visible"
        }}
        onWheel={handleZoom}
        onMouseMove={handleDrag}
        onMouseDown={handleDragMDown}
      >
        <div
          style={{
            position: "absolute", inset: -1, zIndex: 1,
            border: `var(--accent) solid ${BORDER}px`
          }}
        />
        {ticks}
        {lines}
        {dots}
        {makeBuffers()}
      </div>
    );
  }, [slabWidth, slabHeight, numTicks, numWells, zoom, anchor, isDragging]);


  const standardChips = useMemo(() => {
    return (
      <div
        ref={chipsRef}
        style={{
          display: "flex", flexWrap: "wrap", justifyContent: "center",
          gap: "0.5rem", marginLeft: TICK_MAJOR,
          width: slabWidth + (TICK_MAJOR * 2)
        }}
      >
        {Object.values(STANDARDS).map(protein => {
          const isSelected = selStandards.some(p => p.id_num === protein.id_num);
          return (
            <Chip
              key={protein.id_num}
              label={protein.name}
              onClick={() => handleToggleStandard(protein)}
              style={{
                backgroundColor: isSelected ? protein.color : "var(--highlight)",
                color: "white",
                fontWeight: "bold",
                cursor: "pointer"
              }}
              sx={{"&:hover": { opacity: 0.8 }}}
            />
          );
        })}
      </div>
    );
  }, [selStandards, slabWidth]);


  const helpModal = useMemo(() => {
    if (!showHelp) return null;

    return (
      <div
        style={{
          position: "fixed", display: "flex", alignItems: "center", justifyContent: "center",
          top: 0, left: 0, right: 0, bottom: 0, zIndex: 1000,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
        }}
        onClick={() => setShowHelp(false)}
      >
        <div
          style={{
            position: "relative", padding: "1.5rem",
            width: "600px", maxWidth: "90%", maxHeight: "90vh",
            border: "4px solid var(--accent)", borderRadius: "8px",
            overflow: "auto", backgroundColor: "var(--sub-background)"
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 id="1de-page-instructions" style={{color: "var(--accent)", margin: 0}}>
            Instructions
          </h2>
          <ol style={{ paddingLeft: "1.25rem", lineHeight: 1.5, marginBottom: "1rem" }}>
            <li>Add or remove wells as needed.</li>
            <li>Select wells to upload FASTA files.</li>
            <ul style={{ lineHeight: 1.5, marginBlock: "0.5rem" }}>
              <li>Click and drag to swap well contents.</li>
              <li>Hover over wells to see uploaded files.</li>
              <li>Remove uploaded files by double-clicking</li>
            </ul>
            <li>Select or deselect protein standards.</li>
            <li>Choose the voltage setting (50 / 100 / 150 / 200 V).</li>
            <li>Choose the acrylamide concentration (7.5 / 10 / 12 / 15%).</li>
            <ul style={{ lineHeight: 1.5, marginBlock: "0.5rem" }}>
              <li>Click <strong>Start</strong> to begin the run.</li>
              <li>Click <strong>Stop</strong> to end the run manually.</li>
              <li>Click <strong>Clear</strong> to clear all uploaded files and reset.</li>
              <li>Click <strong>Reset</strong> to return bands to their starting positions.</li>
              <li>Click <strong>Upload</strong> to upload multiple FASTA files at once.</li>
            </ul>
          </ol>

          <h2 id="1de-page-notes" style={{color: "var(--accent)", margin: 0}}>
            Notes
          </h2>
          <ul style={{ paddingLeft: "1.25rem", lineHeight: 1.5, marginBottom: 0 }}>
            <li>The exact number of wells is flexible.</li>
            <li>Protein bands stop at their relative migration distances.</li>
          </ul>
        </div>
      </div>
    );
  }, [showHelp]);
  

  /* Render */
  return (
    <div style={{margin:"4rem", display: "flex", flexDirection: "column", gap: "1rem"}}>
      {toolbar}
      {acrylamideSlab}
      {standardChips}
      {helpModal}
    </div>
  );
}
