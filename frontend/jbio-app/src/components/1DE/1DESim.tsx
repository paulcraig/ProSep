import React, { useState, useMemo, useRef } from "react"
import { Button, Chip } from "@mui/material"

import InfoIcon from '@mui/icons-material/Info';
import StopIcon from "@mui/icons-material/Stop";
import UploadIcon from "@mui/icons-material/Upload";
import ClearAllIcon from "@mui/icons-material/ClearAll";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import InsertChartIcon from "@mui/icons-material/InsertChart";

import blackWire from '../../assets/electrophoresis/blackwire.png'
import redWire from '../../assets/electrophoresis/redwire.png'


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
  initWells = 6,
  initVoltage= 100,
  initAcrylamide= 7.5

} : OneDEProps ) {

  /* Consts */
  const SUB_TICKS = 3;
  
  const MIN_WELLS = 4;
  const MAX_WELLS = 11;
  const WELL_SCALE = 800 / 6;
  
  const BORDER = 4;
  const TICK_MAJOR = 20;
  const GUIDE_MAJOR = BORDER / 2;
  const TICK_MINOR = TICK_MAJOR / 2;
  const GUIDE_MINOR = GUIDE_MAJOR / 2;

  const DOT_RADIUS = BORDER * 0.9;

  const V_SELECT_HEIGHT = 20;
  const V_END_HEIGHT = 60;
  const V_END_WIDTH = 60;

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
  const [slabHeight, setSlabHeight] = useState(WELL_SCALE * initWells);
  const [slabWidth,  setSlabWidth ] = useState(WELL_SCALE * initWells);
  
  const rootRef = useRef<HTMLDivElement>(null);
  const slabRef = useRef<HTMLDivElement>(null);
  const buffRef = useRef<HTMLDivElement>(null);

  /* Zoom and Drag */
  const [zoom,   setZoom  ] = useState(1);
  const [anchor, setAnchor] = useState(0.5);

  const rafRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastDragY, setlastDragY] = useState<number | null>(null);

  /* Simulation */
  const [showHelp, setShowHelp] = useState(false);
  const [showPlot, setShowPlot] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isStarted, setIsStarted] = useState(false);

  const [numTicks,   setNumTicks  ] = useState(axisTicks);
  const [numWells,   setNumWells  ] = useState(initWells);
  const [voltage,    setVoltage   ] = useState(initVoltage);
  const [acrylamide, setAcrylamide] = useState(initAcrylamide);

  const [proteins,   setProteins  ] = useState<Record<string, IDEProtein>[]>([]);
  const [selStandards, setSelStandards] = useState<IDEProtein[]>(Object.values(STANDARDS));

  
  /* Functions and Handlers */
  React.useLayoutEffect(() => {
    const computeHeight = () => {
      if (!rootRef.current || !slabRef.current || !buffRef.current) return;

      const rootRect = rootRef.current.getBoundingClientRect();
      const slabRect = slabRef.current.getBoundingClientRect();
      const buffRect = buffRef.current.getBoundingClientRect();

      const available = window.innerHeight - rootRect.top;
      const nonSlab = rootRect.height - slabRect.height + buffRect.height + BORDER;
      const next = Math.max(500, Math.floor(available - nonSlab - 1));

      setSlabHeight(prev => (Math.abs(prev - next) > 2 ? next : prev));
    };

    const observer = new ResizeObserver(computeHeight);
    
    if (rootRef.current) observer.observe(rootRef.current);
    window.addEventListener("resize", computeHeight);
    computeHeight();

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", computeHeight);
    };
  }, []);


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


  const addNumWells = (n: number) => {
    const newNum = numWells + n;
    
    if (newNum >= MIN_WELLS && newNum <= MAX_WELLS) {
      setSlabWidth(WELL_SCALE * newNum);
      setNumWells(newNum);
    }
  }


  const handleHelp = () => setShowHelp(true);
  const handlePlot = () => setShowPlot(true);


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


  const handleReset = () => console.log("Reset");
  const handleClear = () => console.log("Clear");


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
  const toolBar = useMemo(() => {
    const buttons = [
      { label: "Info", icon: <InfoIcon />, onClick: handleHelp },
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
                "&:hover": { backgroundColor: "var(--accent)", color: "#fff" },
                backgroundColor: "var(--highlight)",
                textTransform: "none",
                fontSize: "0.875rem",
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
    const width = slabWidth;
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
      const wellWidth = slabWidth / (2 * numWells + 1);
      const fullWidth = slabWidth + (TICK_MAJOR * 2);

      let path = `M 0 0 L 0 ${wellHeight * 2} L ${TICK_MAJOR} ${wellHeight * 2}`;

      for (let i = 0; i <= numWells; i++) {
        const base = (i * wellWidth * 2) + TICK_MAJOR;
        path += ` L ${base} ${wellHeight} L ${base + wellWidth} ${wellHeight} L ${base + wellWidth} ${wellHeight * 2}`;
        if (i < numWells) { path += ` L ${base + wellWidth * 2} ${wellHeight * 2}`; }
      }
      path += ` L ${fullWidth} ${wellHeight * 2} L ${fullWidth} 0 Z`;
      
      return (
        <div ref={buffRef}>
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
              stroke="var(--accent)" strokeLinejoin="round" strokeWidth={BORDER }
            />
          </svg>
          <div
            style={{
              position: "absolute", boxSizing: "border-box", zIndex: 0,
              bottom: `-${(wellHeight * 2) - (BORDER / 2)}px`, left: `-${TICK_MAJOR}px`,
              width: `${slabWidth + TICK_MAJOR * 2}px`, height: `${wellHeight * 2}px`,
              background: "var(--sub-accent)", border: `${BORDER}px solid var(--accent)`, borderRadius: "2px",
              display: "flex", alignItems: "center", paddingLeft: "12px"
            }}
          >
            <select
              value={acrylamide}
              onChange={(e) => setAcrylamide(Number(e.target.value))}
              style={{
                background: "transparent",
                fontWeight: "bold",
                color: "var(--text)", cursor: "pointer",
                border: "none", outline: "none", paddingRight: "4px"
              }}
            >
              <option value={7.5} style={{ background: "var(--sub-background)" }}>Acrylamide 7.5%</option>
              <option value={10} style={{ background: "var(--sub-background)" }}>Acrylamide 10%</option>
              <option value={12} style={{ background: "var(--sub-background)" }}>Acrylamide 12%</option>
              <option value={15} style={{ background: "var(--sub-background)" }}>Acrylamide 15%</option>
            </select>
          </div>
        </div>
      );
    }

    const makeWellButtons = () => {
      const r = Math.min(getY(min / 2, min, max, slabHeight, false), 20);
      const wellWidth = slabWidth / (2 * numWells + 1);
      const sidePad = wellWidth / 2;

      return (
        <svg
          width={slabWidth} height={slabHeight}
          style={{ position: "absolute", top: 0, left: 0, zIndex: 3 }}
        >
          {/* Upload file */}
          {Array.from({ length: numWells }, (_, index) => {
            return (
              <g
                key={`well-upload-${index}`}
                transform={`translate(${(2 * (index + 1) + 1) * wellWidth + wellWidth / 2}, ${r})`}
                style={{ cursor: "pointer" }}
                onClick={() => {
                  const input = document.createElement('input');

                  input.type = 'file';
                  input.accept = '.fasta,.fa,.faa,.txt';

                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) console.log(`TODO ${index}:`, file);
                  };

                  input.click();
                }}
              >
                <circle r={r * 0.7} fill="var(--accent)" opacity={0.3} />
                <foreignObject
                  x={-r / 2} y={-r / 2}
                  width={r} height={r}
                  style={{ pointerEvents: "none" }}
                >
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "100%", height: "100%"
                  }}>
                    <UploadIcon style={{ color: "var(--text)", fontSize: r * 0.8 }} />
                  </div>
                </foreignObject>
                <title>Upload Protein Sequence</title>
              </g>
            );
          })}

          {/* Remove well */}
          {(numWells > MIN_WELLS) &&
            <g
              transform={`translate(${sidePad},${(r * 2) + (GUIDE_MINOR / 2)})`}
              style={{ cursor: "pointer" }}
              onClick={() => addNumWells(-1)}
            >
              <circle r={r * 0.7} fill="var(--accent)" opacity={0.3} />
              <line
                x1={-r / 4} y1={0} x2={r / 4} y2={0}
                strokeLinecap="round"
                stroke="var(--text)"
                strokeWidth={GUIDE_MAJOR}
              />
              <title>Remove well</title>
            </g>
          }

          {/* Add well */}
          {(numWells < MAX_WELLS) &&
            <g
              transform={`translate(${slabWidth - sidePad},${(r * 2) + (GUIDE_MINOR / 2)})`}
              style={{ cursor: "pointer" }}
              onClick={() => addNumWells(1)}
            >
              <circle r={r * 0.7} fill="var(--accent)" opacity={0.3} />
              <line
                x1={-r / 4} y1={0} x2={r / 4} y2={0}
                strokeLinecap="round"
                stroke="var(--text)"
                strokeWidth={GUIDE_MAJOR}
              />
              <line
                x1={0} y1={-r / 4} x2={0} y2={r / 4}
                strokeLinecap="round"
                stroke="var(--text)"
                strokeWidth={GUIDE_MAJOR}
              />
              <title>Add well</title>
            </g>
          }
        </svg>
      );
    };

    const makeDots = (key: string, y: number, radius: number) => {
      const acrylamideMult = (1.5 - acrylamide / 15);
      const wellWidth = slabWidth / (2 * numWells + 1);
      const gap = wellWidth / 4;

      radius = radius * acrylamideMult;

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
              fontSize: "0.875rem",
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

      dots[dotIdx++] = makeDots(`major-dots-${i}`, dy, DOT_RADIUS);
      ticks[tickIdx++] = makeTick(`major-tick-${i}`, y, true, i, (i % numTicks ? wellHeight * 2 : undefined));
      
      if (i < numTicks) {
        lines[lineIdx++] = makeLine(`major-${i}`, y, i > 0);

        for (let j = 1; j <= SUB_TICKS; j++) {
          const dy = getY(i + j / (SUB_TICKS + 1) - dotOffset, min, max, height);
          const y = getY(i + j / (SUB_TICKS + 1), min, max, height);

          dots[dotIdx++] = makeDots(`minor-dots-${i}-${j}`, dy, DOT_RADIUS);
          ticks[tickIdx++] = makeTick(`minor-tick-${i}-${j}`, y, false);
          lines[lineIdx++] = makeLine(`minor-${i}-${j}`, y, false);
        }
      }
    }

    return (
      <div
        ref={slabRef}
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
            borderLeft: `var(--accent) solid ${BORDER}px`,
            borderRight: `var(--accent) solid ${BORDER}px`
          }}
        />
        {ticks}
        {lines}
        {dots}
        {makeBuffers()}
        {makeWellButtons()}
      </div>
    );
  }, [slabWidth, slabHeight, numTicks, numWells, acrylamide, zoom, anchor, isDragging]);


  const voltageCircuit = useMemo(() => {
    const wellHeight = getY(min / 2, min, max, slabHeight, false) * 2;    
    const circuitWidth = V_END_WIDTH + TICK_MINOR;
    const totalHeight = slabHeight + wellHeight;
    const midPoint = totalHeight / 2;

    return (
      <div
        style={{
          position: "absolute",
          top: `${wellHeight}px`,
          left: `${slabWidth + V_END_WIDTH * 0.9}px`,
          width: `${circuitWidth}px`,
          height: `${totalHeight}px`,
          pointerEvents: "none",
          zIndex: 2
        }}
      >
        <svg
          width={circuitWidth}
          height={totalHeight}
          style={{ overflow: "visible" }}
        >
          {/* Black wire */}
          <line
            x1={V_END_WIDTH}
            y1={0}
            x2={V_END_WIDTH}
            y2={midPoint - V_SELECT_HEIGHT}
            stroke="#191919"
            strokeWidth={BORDER * 2}
            strokeLinecap="round"
          />
          
          {/* Red wire */}
          <line
            x1={V_END_WIDTH}
            y1={midPoint + V_SELECT_HEIGHT}
            x2={V_END_WIDTH}
            y2={totalHeight}
            stroke="#ff3636"
            strokeWidth={BORDER * 2}
            strokeLinecap="round"
          />

          {/* Voltage connection lines */}
          <line
            x1={V_END_WIDTH - TICK_MINOR}
            y1={midPoint - V_SELECT_HEIGHT}
            x2={V_END_WIDTH + TICK_MINOR}
            y2={midPoint - V_SELECT_HEIGHT}
            stroke="#191919"
            strokeWidth={BORDER * 2}
            strokeLinecap="round"
          />
          <line
            x1={V_END_WIDTH - TICK_MAJOR}
            y1={midPoint + V_SELECT_HEIGHT}
            x2={V_END_WIDTH + TICK_MAJOR}
            y2={midPoint + V_SELECT_HEIGHT}
            stroke="#ff3636"
            strokeWidth={BORDER * 2}
            strokeLinecap="round"
          />

          {/* Voltage selector */}
          <foreignObject
            x={V_END_WIDTH / 2}
            y={midPoint - (V_SELECT_HEIGHT / 2)}
            width={100}
            height={32}
            style={{ pointerEvents: "auto" }}
          >
            <select
              value={voltage}
              onChange={(e) => setVoltage(Number(e.target.value))}
              style={{
                background: "transparent",
                fontWeight: "bold",
                color: "var(--text)", cursor: "pointer",
                border: "none", outline: "none", paddingRight: "4px"
              }}
            >
              <option value={50} style={{ background: "var(--sub-background)" }}>50V</option>
              <option value={100} style={{ background: "var(--sub-background)" }}>100V</option>
              <option value={150} style={{ background: "var(--sub-background)" }}>150V</option>
              <option value={200} style={{ background: "var(--sub-background)" }}>200V</option>
            </select>
          </foreignObject>

          {/* Alligator clips */}
          <image
            href={blackWire}
            x={0}
            y={-V_END_HEIGHT / 2}
            height={V_END_HEIGHT}
            width={V_END_WIDTH}
            preserveAspectRatio="xMidYMid meet"
          />
          <image
            href={redWire}
            x={0}
            y={totalHeight - V_END_HEIGHT / 2}
            height={V_END_HEIGHT}
            width={V_END_WIDTH}
            preserveAspectRatio="xMidYMid meet"
          />
        </svg>
      </div>
    );
  }, [slabWidth, slabHeight, voltage, min, max]);


  const standardChips = useMemo(() => {
    const getContrast = (hex: string): string => {
      const [r, g, b] = hex.match(/\w\w/g)!.map(x => parseInt(x, 16));
      return (0.299 * r + 0.587 * g + 0.114 * b) > 186 ? "var(--dark)" : "#fff";
    };

    return (
      <div
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
                color: getContrast(isSelected ? protein.color : "var(--highlight)"),
                fontSize: "0.875rem", fontWeight: "bold", cursor: "pointer"
              }}
              sx={{
                boxShadow: (theme) => theme.shadows[2],
                "&:hover": { opacity: 0.8, boxShadow: (theme) => theme.shadows[4] }
              }}
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
    <div
      ref={rootRef}
      style={{
        gap: "1rem",
        margin: "4rem auto",
        display: "flex",
        flexDirection: "column",
        width: `${slabWidth + V_END_WIDTH + (TICK_MAJOR * 4)}px`
    }}>
      {toolBar}
      <div style={{ position: "relative" }}>
        {acrylamideSlab}
        {voltageCircuit}
      </div>
      {standardChips}
      {helpModal}
    </div>
  );
}
