import { useState, useMemo, useRef } from "react"


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
  const SUB_TICKS = 2;
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
  const [slabHeight, setSlabHeight] = useState(1000); // TODO: Update to dynamic sizing later.
  const [slabWidth,  setSlabWidth ] = useState(1000);

  /* Zoom and Drag */
  const [zoom,   setZoom  ] = useState(1);
  const [anchor, setAnchor] = useState(0.5);

  const rafRef = useRef<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lastDragY, setlastDragY] = useState<number | null>(null);

  /* Simulation */
  const [numTicks,   setNumTicks  ] = useState(axisTicks);
  const [numWells,   setNumWells  ] = useState(initWells);
  const [voltage,    setVoltage   ] = useState(initVoltage);
  const [acrylamide, setAcrylamide] = useState(initAcrylamide);
  const [proteins,   setProteins  ] = useState<Record<string, IDEProtein>[]>([]);

  
  /* Functions and Handlers */
  const { min, max } = useMemo(() => ({
    min: -(SUB_TICKS + 1) / 10,
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
    e.preventDefault();
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


  /* Components */
  const acrylamideSlab = useMemo(() => {
    const width = slabWidth - 1;
    const height = slabHeight + BORDER / 2;
    const wellHeight = getY(min / 2, min, max, slabHeight, false) * 2;

    const n = numTicks + 1 + numTicks * SUB_TICKS;
    let dotIdx = 0, tickIdx = 0, lineIdx = 0;

    const dots = new Array(n);
    const ticks = new Array(n);
    const lines = new Array(n);

    // Factories:
    const makeBuffers = () => {
      const wellWidth = slabWidth / (2 * numWells + 1);
      const fullWidth = slabWidth + (TICK_MAJOR * 2);

      let path = `M 0 0 L 0 ${wellHeight * 2} L ${TICK_MAJOR} ${wellHeight * 2} L ${TICK_MAJOR} ${wellHeight}`;
      
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
              position: "relative", zIndex: '2',
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
              bottom: `-${(wellHeight * 2) - 1}px`, left: `-${TICK_MAJOR}px`,
              width: `${slabWidth + TICK_MAJOR * 2}px`, height: `${wellHeight * 2}px`,
              background: "var(--sub-accent)", border: `${BORDER}px solid var(--accent)`, borderRadius: '2px'
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
          width={width} height={radius * 2}
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
              color: "var(--text)",
              whiteSpace: "nowrap",
              fontSize: "14px",
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
      const dy = getY(i - ((SUB_TICKS + 1) / 20), min, max, height);
      const y = getY(i, min, max, height);

      dots[dotIdx++] = makeDots(`major-dots-${i}`, dy, BORDER);
      ticks[tickIdx++] = makeTick(`major-tick-${i}`, y, true, i, (i % numTicks ? wellHeight * 2 : undefined));
      
      if (i < numTicks) {
        lines[lineIdx++] = makeLine(`major-${i}`, y, i > 0);

        for (let j = 1; j <= SUB_TICKS; j++) {
          const dy = getY(i + j / (SUB_TICKS + 1) - ((SUB_TICKS + 1) / 20), min, max, height);
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
          position: "absolute",
          width: `${slabWidth}px`,
          height: `${slabHeight + 4}px`,
          margin: `${wellHeight}px ${TICK_MAJOR}px ${wellHeight * 2}px ${TICK_MAJOR * 2}px`,
          background: "var(--sub-background)", 
          overflow: "visible",
        }}
        onWheel={handleZoom}
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
  }, [slabWidth, slabHeight, numTicks, numWells, zoom]);
  

  /* Render */
  return (
    <div style={{margin:"4rem"}}>
      {acrylamideSlab}
    </div>
  );
}
