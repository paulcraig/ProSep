import React, { useState } from 'react'
import './1DESimulation.css'

import blackWire from '../assets/electrophoresis/blackwire.png'
import redWire from '../assets/electrophoresis/redwire.png'

import { Select, MenuItem, Button, Chip } from '@mui/material'
import { Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material'

import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import InsertChartIcon from '@mui/icons-material/InsertChart';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import CloseIcon from '@mui/icons-material/Close'


const standards = [
  { name: 'B-Galactosidase',    molecularWeight: 116250,  migrationDistance: 0, color: '#4dd0e1',   id_num: '6X1Q', id_str: 'pdb' },
  { name: 'Phosphorylase B',    molecularWeight: 97400,   migrationDistance: 0, color: '#d3e24aff', id_num: '3LQ8', id_str: 'pdb' },
  { name: 'Serum Albumin',      molecularWeight: 66200,   migrationDistance: 0, color: '#3d98c1ff', id_num: '1AO6', id_str: 'pdb' },
  { name: 'Ovalbumin',          molecularWeight: 45000,   migrationDistance: 0, color: '#f06292',   id_num: '1OVA', id_str: 'pdb' },
  { name: 'Carbonic Anhydrase', molecularWeight: 29000,   migrationDistance: 0, color: '#b8de7cff', id_num: '1CA2', id_str: 'pdb' },
  { name: 'Trypsin Inhibitor',  molecularWeight: 20100,   migrationDistance: 0, color: '#5c6bc0',   id_num: '2PTC', id_str: 'pdb' },
  { name: 'Lysozyme',           molecularWeight: 14400,   migrationDistance: 0, color: '#81c784',   id_num: '6LYZ', id_str: 'pdb' },
  { name: 'Aprotinin',          molecularWeight: 6500,    migrationDistance: 0, color: '#e57373',   id_num: '1AAP', id_str: 'pdb' }
];


interface ElectrophoresisProps {
  ticks?: number
  wells?: number
  voltage?: number
  acrylamide?: number
}


const OneDESim: React.FC<ElectrophoresisProps> = ({
  ticks = 6,
  wells = 3,
  voltage = 100,
  acrylamide = 7.5,
}) => {

  const [wellsCount, setWellsCount] = useState(wells);
  const [voltageAmt, setVoltageAmt] = useState(voltage);
  const [acrylamidePct, setAcrylamidePct] = useState(acrylamide);

  const [zoom, setZoom] = useState(1);
  const [anchor, setAnchor] = useState(0.5);
  const [isDragging, setIsDragging] = useState(false);
  const [lastY, setwellWastY] = useState<number | null>(null);
  const rafRef = React.useRef<number | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const timerRef = React.useRef<number | null>(null);

  const [showChart, setShowChart] = useState(false);

  const [selectedStandards, setSelectedStandards] = useState<typeof standards[number][]>(standards);
  const [positions, setPositions] = useState<Record<number, Record<string, number>>>(() =>
    Object.fromEntries(
      Array.from({ length: wellsCount }).map((_, wi) => [
        wi, wi === 0 ? Object.fromEntries(standards.map(p => [p.id_num, 0])) : {}
      ])
    )
  );

  const minTickH = 20;
  const totalH = 700;
  const slabW = 575;
  const wellH = 45;
  const wireH = 25;
  const wireW = 75;
  const wireO = 10;

  const buffH = totalH * 0.15;
  const anodeT = totalH - buffH;

  const slabH = totalH - wellH - buffH;
  const wellW = slabW / (2 * wellsCount + 1);

  const bandW = wellW * 0.8;
  const bandH = wellH * 0.2;


  const getRelativeMobility = (pct: number, MW: number) => {
    // Ferguson-like relation: u = u0 * exp( -Kr * %T ):

    const logMW = Math.log10(MW);
    const mu0 = 0.95 - 0.18 * logMW;
    const Kr_base = 0.005 + 0.015 * logMW;
    const sieving = 1 / (1 + Math.exp(-(pct - 10) / 2.5));

    const mu = mu0 * Math.exp(-(Kr_base * sieving) * pct);
    return Math.max(0, Math.min(1, mu));
  }


  const valueToY = (v: number) => {
    const norm = v / ticks;
    const a = anchor;
    let mapped;

    if (norm <= a) {
      mapped = a * Math.pow(norm / Math.max(a, 1e-9), zoom);
    } else {
      mapped = 1 - (1 - a) * Math.pow((1 - norm) / Math.max(1 - a, 1e-9), zoom);
    }
    return (wellH * 2) + (mapped * (slabH - wellH));
  }


  const GoogleScatterModal: React.FC<{
    open: boolean;
    onClose: () => void;
    positions: Record<number, Record<string, number>>;
    selectedStandards: typeof standards;
    ticks: number;

  }> = ({ open, onClose, positions, selectedStandards, ticks }) => {
    const divRef = React.useRef<HTMLDivElement>(null);
    const [ready, setReady] = React.useState(false);

    React.useEffect(() => {
      const g = (window as any).google;

      if (g?.visualization) {
        setReady(true);
        return;
      }

      const existing = document.querySelector<HTMLScriptElement>(
        "script[src='https://www.gstatic.com/charts/loader.js']"
      );

      const ensureLoaded = () => {
        (window as any).google.charts.load('current', { packages: ['corechart'] });
        (window as any).google.charts.setOnLoadCallback(() => setReady(true));
      };

      if (existing) {
        existing.addEventListener('load', ensureLoaded, { once: true });
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://www.gstatic.com/charts/loader.js';
      script.onload = ensureLoaded;
      script.onerror = () => console.error('Failed to load Google Charts.');
      document.head.appendChild(script);
    }, []);

    const buildRows = React.useCallback(() => {
      type Row = [number, number, string, string];
      const rows: Row[] = [];

      for (const [wi, wellProteins] of Object.entries(positions)) {
        for (const protein of selectedStandards) {
          const v = wellProteins[protein.id_num];

          if (v === undefined || v <= 0) continue;

          const rf = Number(v) / ticks;
          const logMW = Number(Math.log10(protein.molecularWeight).toFixed(2));

          const tip = `
            <div style='padding:10px; line-height:1.5; min-width:150px; font-family:Arial, sans-serif; font-size:14px;'>
              <strong>${protein.name}</strong><br/>
                Well: ${wi}<br/>
                Relative Migration: ${rf.toFixed(3)}<br/>
                Log Molecular Weight: ${logMW.toFixed(2)}<br/>
                Molecular Weight: ${protein.molecularWeight.toLocaleString()}
            </div>
          `;

          rows.push([rf, logMW, `point { fill-color: ${protein.color.slice(0, 7)}; }`, tip]);
        }
      }
      rows.sort((a, b) => a[0] - b[0]);
      return rows;

    }, [positions, selectedStandards, ticks]);

    React.useEffect(() => {
      if (!open || !ready || !divRef.current) return;

      const g = (window as any).google;
      const data = new g.visualization.DataTable();
      const chart = new g.visualization.ScatterChart(divRef.current);

      data.addColumn('number', 'Relative Migration');
      data.addColumn('number', 'Log Molecular Weight');
      data.addColumn({ type: 'string', role: 'style' });
      data.addColumn({ type: 'string', role: 'tooltip', p: { html: true } });

      data.addRows(buildRows());

      const options = {
        legend: 'none',
        tooltip: { isHtml: true },
        pointSize: 7,
        hAxis: { title: 'Relative Migration', minValue: 0, maxValue: 1 },
        vAxis: { title: 'Log Molecular Weight', minValue: 0, maxValue: 6 },
        chartArea: { left: 80, top: 50, width: '80%', height: '70%' },
        trendlines: {
          0: {
            type: 'linear',
            color: 'gray',
            lineWidth: 2,
            opacity: 0.3,
            showR2: true,
            visibleInLegend: true,
          },
        },
      } as google.visualization.ScatterChartOptions;

      
      chart.draw(data, options);
      const onResize = () => chart.draw(data, options);
      window.addEventListener('resize', onResize);

      return () => window.removeEventListener('resize', onResize);
    }, [open, ready, buildRows]);

    return (
      <Dialog open={open} onClose={onClose} maxWidth='lg' fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Log MW vs. Relative Migration
          <IconButton onClick={onClose}><CloseIcon /></IconButton>
        </DialogTitle>
        <DialogContent>
          <div ref={divRef} style={{ width: '100%', height: 420 }} />
        </DialogContent>
      </Dialog>
    );
  };


  const onPlot = () => {
    onStop();
    setShowChart(true);
  };


  const onStop = () => {
    setIsRunning(false);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  
  const onToggleRun = () => {
    if (isRunning) {
      onStop();
    } else {
      setIsRunning(true);
      setHasStarted(true);

      timerRef.current = window.setInterval(() => {
        setPositions(prev => {
          const updated: typeof prev = { ...prev }

          for (const [wi, wellProteins] of Object.entries(prev)) {
            const idx = Number(wi);
            updated[idx] = { ...wellProteins }

            for (const protein of selectedStandards) {
              const rf = getRelativeMobility(acrylamidePct, protein.molecularWeight);
              const target = Math.min(rf * ticks * ticks, ticks);
              const current = wellProteins[protein.id_num];
              const step = (target - current) / ((50 / voltageAmt) * 500);

              updated[idx][protein.id_num] = Math.min(current + step, target);
            }
          }
          return updated;
        })
      }, 10)
    }
  }
  

  const onReset = () => {
    onStop();
    setHasStarted(false);

    setPositions(prev => {
      const next: typeof prev = { ...prev }
      next[0] = Object.fromEntries(standards.map(p => [p.id_num, 0]));

      for (let wi = 1; wi < wellsCount; wi++) {
        next[wi] = {};
      }
      return next;
    })
  }


  const onClear = () => {
    setSelectedStandards(standards);
    onReset();
  }


  const buildWells = () => {
    let fill = `M0,${wellH}`;
    let x = 0;

    for (let i = 0; i < wellsCount; i++) {
      fill += ` H${x + wellW} V${wellH + wellH} H${x + 2 * wellW} V${wellH}`;
      x += 2 * wellW;
    }

    fill += ` H${x + wellW} V${wellH + slabH} H0 Z`;
    let top = `M0,${wellH} H${wellW}`;

    for (let i = 0; i < wellsCount; i++) {
      const rightX = (2 * i + 2) * wellW;
      const nextT = (2 * i + 3) * wellW;
      top += ` V${wellH + wellH} H${rightX} V${wellH} H${nextT}`;
    }

    const sides = `M0,${wellH} V${wellH + slabH} H${slabW} V${wellH}`;
    return { fill, top, sides };
  }
  const { fill: pathFill, top: pathTop, sides: pathSides } = buildWells();


  const onAddWell = (e: React.MouseEvent) => {
    e.stopPropagation();
    setWellsCount(w => Math.min(6, w + 1));
  }


  const onRemoveWell = (e: React.MouseEvent) => {
    e.stopPropagation();
    setWellsCount(w => Math.max(2, w - 1));
  }


  const onToggleProtein = (protein: typeof standards[number]) => {
    setSelectedStandards(prev =>
      prev.some(p => p.id_num === protein.id_num)
        ? prev.filter(p => p.id_num !== protein.id_num)
        : [...prev, protein]
    );
  }


  const onWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    if (rafRef.current) return;

    // Cache values:
    const currentTarget = e.currentTarget as SVGSVGElement;
    const eventTarget = e.target as Node;
    const clientY = e.clientY;
    const deltaY = e.deltaY;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;

      const container = currentTarget.querySelector('.acrylamide-slab');
      if (!container || !container.contains(eventTarget)) return;

      const rect = currentTarget.getBoundingClientRect();
      const mouseY = clientY - rect.top;
      const slabTop = wellH + wellH;

      if (mouseY < slabTop || mouseY > anodeT) return;

      const frac = (mouseY - slabTop) / (slabH - wellH);
      const newAnchor = Math.max(0, Math.min(1, frac));
      const zoomFactor = deltaY < 0 ? 1.1 : 0.9;

      setZoom(z => {
        const newZoom = Math.min(5, Math.max(1, z * zoomFactor));
        if (newZoom === z) return z;
        if (newZoom > z) setAnchor(newAnchor);
        return newZoom;
      });
    })
  }


  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsDragging(true);
    setwellWastY(e.clientY);
  }


  const onMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging || lastY === null || rafRef.current) return;

    // Cache value:
    const clientY = e.clientY;

    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      const dy = clientY - lastY;
      const normShift = dy / (slabH - wellH);
      setwellWastY(clientY);
      setAnchor(a => Math.max(0, Math.min(1, a - normShift)));
    })
  }

  
  const onMouseUp = () => {
    setIsDragging(false);
    setwellWastY(null);
  }


  const axisTicks = React.useMemo(() => {
    let lastTickY = -Infinity;

    return Array.from({ length: ticks + 1 }).map((_, i) => {
      const y = valueToY(i);
      const dx = y - lastTickY;

      let opacity = Math.pow(Math.max(0, Math.min(1, dx / minTickH)), 2);

      if (i === 0 || i === ticks) {
        opacity = 1;
        lastTickY = y;
      } else if (opacity > 0.05) {
        lastTickY = y;
      }

      if (i !== ticks) {
        const yN = valueToY(ticks);
        const fadeNearN = Math.pow(Math.max(0, Math.min(1, (yN - y) / minTickH)), 2);

        opacity = Math.min(opacity, fadeNearN);
      }

      return (
        <g key={`axis-${i}`} opacity={opacity}>
          <line
            x1={0} y1={y} x2={slabW} y2={y}
            stroke={(i === 0 || i === ticks) ? 'var(--sub-text)' : 'var(--text)'}
            strokeWidth={i === 0 || i === ticks ? '0.05rem' : '0.125rem'}
          />
          <line
            x1={-20} y1={y} x2={0} y2={y}
            stroke='var(--accent)'
            strokeWidth='0.125rem'
          />
          <text
            x={-30} y={y + 6}
            fill='var(--text)'
            textAnchor='end'
            fontWeight='bold'
          >
            {i}
          </text>
          {i < ticks &&
            [1, 2].map(j => {
              const subY = valueToY(i + j / 3)
              const subOpacity = Math.pow(Math.max(0, Math.min(1, (subY - y) / (minTickH / 2))), 2)
              const fadeNearN = Math.pow(Math.max(0, Math.min(1, valueToY(ticks) - subY / (minTickH / 2))), 2)

              return (
                <g key={`sub-${i}-${j}`} opacity={subOpacity * fadeNearN}>
                  <line
                    x1={0} y1={subY} x2={slabW} y2={subY}
                    stroke='var(--sub-text)'
                    strokeWidth='0.05rem'
                  />
                  <line
                    x1={-12} y1={subY} x2={0} y2={subY}
                    stroke='var(--accent)'
                    strokeWidth='0.05rem'
                  />
                </g>
              )
            })}
        </g>
      )
    })
  }, [ticks, zoom, anchor]);


  const dots = React.useMemo(() => {
    const pct = Math.min(15, Math.max(7.5, acrylamidePct));
    const poreSize = 40 / Math.sqrt(pct);
    const subTicks = 3;

    const spacingX = wellW / (Math.max(2, Math.round((wellW * pct) / 120)));
    const opacity = Math.max(0, 0.25 * (1 - (zoom - 1)));

    const slabDots = Array.from({ length: ticks }).flatMap((_, i) =>
      Array.from({ length: subTicks }).flatMap((__, sub) => {
        const cols = Math.floor(slabW / spacingX);

        return Array.from({ length: cols }).map((__, j) => (
          <circle
            key={`band-dot-${i}-${sub}-${j}`}
            fill='var(--sub-text)'
            opacity={opacity}

            cx={j * spacingX + spacingX / 2}
            cy={valueToY(i + (sub + 0.5) / subTicks)}
            r={poreSize * 0.25}
          />
        ));
      })
    );

    const y0 = valueToY(0);
    const y1 = valueToY(1);

    const rowPadPx = Math.max(1, (y1 - y0) / subTicks);
    const totalPx = y0 - wellH;

    const rows = Math.max(2, Math.floor(totalPx / rowPadPx));
    const cols = Math.floor(slabW / spacingX) + 1;

    const wellDots = Array.from({ length: rows }).flatMap((_, rIdx) => {
      const y = (y0 - totalPx) + (rIdx + 0.75) * rowPadPx;

      if (y > y0) return [];

      return Array.from({ length: cols }).map((__, j) => (
        <circle
          key={`well-dot-${rIdx}-${j}`}
          fill='var(--sub-text)'
          opacity={opacity}
          
          cx={j * spacingX + spacingX / 2}
          cy={y} r={poreSize * 0.25}
        />
      ))
    })

    return [...wellDots, ...slabDots];
  }, [acrylamidePct, ticks, zoom, anchor]);
  

  return (
    <div className='gel-wrapper'>
      {/* Toolbar */}
      <div
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
            { label: 'Clear', icon: <ClearAllIcon />,    onClick: onClear }
          ].map(btn => (
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

      {/* Simulation */}
      <div className='gel-container'>
        <svg
          className='gel-svg'
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseUp}
          onMouseUp={onMouseUp}

          height={totalH}
          width={slabW * 1.4} // Yeah... I'll fix this later
          viewBox={`-60 0 ${slabW * 1.4} ${totalH}`}
          style={{ cursor: zoom === 1 ? 'default' : isDragging ? 'grabbing' : 'grab' }}
        >
          <line
            x1={slabW + wireW + wireO} y1={wellH}
            x2={slabW + wireW + wireO} y2={(totalH / 2) - 20}
            stroke='#191919'
            strokeWidth='0.75rem'
            strokeLinecap='round'
          />
          <line
            x1={slabW + wireW + wireO} y1={(totalH / 2) + 20}
            x2={slabW + wireW + wireO} y2={anodeT + wellH}
            stroke='#ff3636'
            strokeWidth='0.75rem'
            strokeLinecap='round'
          />
          <g>
            <line
              x1={slabW + wireW + wireO - 20} y1={(totalH / 2) - 20}
              x2={slabW + wireW + wireO + 20} y2={(totalH / 2) - 20}
              stroke='#191919'
              strokeWidth='0.75rem'
            />
            <line
              x1={slabW + wireW + wireO - 40}
              y1={(totalH / 2) + 20}
              x2={slabW + wireW + wireO + 40}
              y2={(totalH / 2) + 20}
              stroke='#ff3636'
              strokeWidth='0.75rem'
            />
            <foreignObject
              x={slabW + wireW + wireO - 48} y={totalH / 2 - 14}
              width={96} height={28}
            >
              <Select
                variant='standard'
                value={voltageAmt}
                onChange={(e) => setVoltageAmt(Number(e.target.value))}
                sx={{
                  fontWeight: 'bold',
                  color: 'var(--text)',
                  paddingLeft: '1.75rem',
                  '& .MuiSelect-icon': { color: 'var(--text)' }
                }}
              >
                {[50, 100, 150, 200].map(v => ( <MenuItem key={v} value={v}>{v}V</MenuItem> ))}
              </Select>
            </foreignObject>
          </g>

          <rect
            ry={5} rx={5}
            x={-20} width={slabW + 40} height={wellH * 2}
            fill='var(--highlight)'
            stroke='var(--accent)'
            strokeWidth='0.25rem'
          />

          <image href={blackWire} x={slabW + wireO} y={wellH - wireH / 2} height={wireH} width={wireW} preserveAspectRatio='xMidYMid meet' />

          <rect
            ry={5} rx={5} x={-20}
            y={anodeT} width={slabW + 40} height={wellH * 2}
            fill='var(--highlight)'
            stroke='var(--accent)'
            strokeWidth='0.25rem'
          />

          <foreignObject x={0} y={anodeT + wellH - 12} width={160} height={24}>
            <Select
              variant='standard'
              value={acrylamidePct}
              onChange={(e) => setAcrylamidePct(Number(e.target.value))}
              sx={{
                fontWeight: 'bold',
                color: 'var(--sub-text)',
                '& .MuiSelect-icon': { color: 'var(--sub-text)' },
              }}
            >
              {[7.5,10,12,15].map(a => ( <MenuItem key={a} value={a}>Acrylamide {a}%</MenuItem> ))}
            </Select>
          </foreignObject>

          <image href={redWire} x={slabW + wireO} y={anodeT + wellH - wireH / 2} height={wireH} width={wireW} preserveAspectRatio='xMidYMid meet' />

          <g className='acrylamide-slab'>
            <path d={pathFill} fill='var(--sub-background)' />
            <defs><clipPath id='gel-clip'><path d={pathFill} /></clipPath></defs>

            <g opacity='0.6' clipPath='url(#gel-clip)'>{dots}</g>
            <g className='axis'>{axisTicks}</g>

            <path d={pathSides} className='gel-border' />
            <path d={pathTop} className='gel-border' />
          </g>

          <g className='well-btn' style={{cursor:'pointer'}} transform={`translate(${wellW/2},${wellH*1.5})`} onClick={onRemoveWell}>
            <circle r={12} />
            <line x1={-4} y1={0} x2={4} y2={0} strokeLinecap='round' stroke='var(--text)' strokeWidth={2} />
            <title>Remove well</title>
          </g>

          <g className='well-btn' style={{cursor:'pointer'}} transform={`translate(${slabW-wellW/2},${wellH*1.5})`} onClick={onAddWell}>
            <circle r={12} />
            <line x1={-4} y1={0} x2={4} y2={0} strokeLinecap='round' stroke='var(--text)' strokeWidth={2} />
            <line x1={0} y1={-4} x2={0} y2={4} strokeLinecap='round' stroke='var(--text)' strokeWidth={2} />
            <title>Add well</title>
          </g>

          <g className='standards-well'>
            {selectedStandards.map((protein, i) => {
              return (
                <rect
                  x={wellW + ((wellW - bandW) / 2)} y={valueToY(positions[0]?.[protein.id_num] ?? 0) - (bandH * 1.5)}
                  width={bandW} height={bandH} rx={3} ry={3}
                  key={protein.id_num}
                  fill={protein.color}
                  stroke='var(--background)'
                  strokeWidth={0.5}
                >
                  <title>{protein.name + ' [Rf = ' + (positions[0]?.[protein.id_num] ?? 0).toFixed(2) + ']'}</title>
                </rect>
              )
            })}
          </g>
        </svg>
      </div>

      {/* Proteins */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        paddingLeft: '3.75rem',
        gap: '0.5rem',
        width: slabW
      }}>
        {standards.map(protein => {
          const isSelected = selectedStandards.some(p => p.id_num === protein.id_num)
          return (
            <Chip
              key={protein.id_num}
              label={protein.name}
              onClick={() => onToggleProtein(protein)}
              sx={{
                backgroundColor: isSelected ? protein.color : 'var(--highlight)',
                color: 'var(--text)',
                fontWeight: 'bold'
              }}
            />
          )
        })}
      </div>

      {/* Chart */}
      <GoogleScatterModal
        onClose={() => setShowChart(false)}
        open={showChart}
        selectedStandards={selectedStandards}
        positions={positions}
        ticks={ticks}
      />
    </div>
  )
}

export default OneDESim;
