import React, { useState } from 'react'
import { API_URL } from '../config';
import './1DESimulation.css'

import blackWire from '../assets/electrophoresis/blackwire.png'
import redWire from '../assets/electrophoresis/redwire.png'

import { Select, MenuItem, Button, Chip, Tooltip } from '@mui/material'
import { Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material'

import StopIcon from '@mui/icons-material/Stop';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import InsertChartIcon from '@mui/icons-material/InsertChart';
import UploadIcon from '@mui/icons-material/Upload';
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
  const [tooltipData, setTooltipData] = useState<{
    protein: typeof standards[number];
    x: number;
    y: number;
  } | null>(null);

  const [isDraggingTooltip, setIsDraggingTooltip] = useState(false);
  const [tooltipDragStart, setTooltipDragStart] = useState<{ x: number; y: number } | null>(null);

  const [draggedWell, setDraggedWell] = useState<number | null>(null);
  const [dragOverWell, setDragOverWell] = useState<number | null>(null);

  const [selectedStandards, setSelectedStandards] = useState<typeof standards[number][]>(standards);
  const [uploadedProteins, setUploadedProteins] = useState<Record<number, { name: string; proteins: typeof standards }>>({});
  const [positions, setPositions] = useState<Record<number, Record<string, number>>>(() =>
    Object.fromEntries(
      Array.from({ length: wellsCount }).map((_, wi) => [
        wi, wi === 0 ? Object.fromEntries(standards.map(p => [p.id_num, 0])) : {}
      ])
    )
  );

  const [totalH, setTotalH] = useState(700);

  React.useEffect(() => {
    const updateHeight = () => {
      const reservedSpace = 270;
      const availableHeight = window.innerHeight - reservedSpace;
      setTotalH(Math.max(500, availableHeight));
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);
  
  const slabW = 600;
  const wellH = 45;
  const wireH = 25;
  const wireW = 75;
  const wireO = 10;

  const minTickH = 20;
  const subTicks = 3;

  const buffH = totalH * 0.15;
  const anodeT = totalH - buffH;

  const slabH = totalH - wellH - buffH;
  const wellW = slabW / (2 * wellsCount + 1);

  const bandW = wellW * 0.8;
  const bandH = wellH * 0.2;
  
  const simDelay = 250; // ms
  const maxWells = 6;


  const getRelativeMobility = (pct: number, MW: number) => {
    // Ferguson relation: u = u0 * exp( -Kr * %T ):

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
  const bandMin = valueToY(0) + (bandH * 0.25)

  
  const GoogleScatterModal: React.FC<{
    open: boolean;
    onClose: () => void;
    positions: Record<number, Record<string, number>>;
    selectedStandards: any[];
    ticks: number;

  }> = ({ open, onClose, positions, selectedStandards, ticks }) => {
    const divRef = React.useRef<HTMLDivElement>(null);

    const [intercept, setIntercept] = React.useState(0);
    const [slope, setSlope] = React.useState(0);
    const [guideX, setGuideX] = React.useState(0.5);
    const [guideY, setGuideY] = React.useState(0);

    const [hoveringGuide, setHoveringGuide] = React.useState(false);
    const [isDragging, setIsDragging] = React.useState(false);
    const [ready, setReady] = React.useState(false);
    const [editingX, setEditingX] = React.useState(false);
    const [inputValue, setInputValue] = React.useState('0.5');

    const accentColor = '#e9edff';
    
    React.useEffect(() => {
      const g = (window as any).google;
      const script = document.createElement('script');

      if (g?.visualization) return setReady(true);

      script.src = 'https://www.gstatic.com/charts/loader.js';
      script.onload = () => {
        (window as any).google.charts.load('current', { packages: ['corechart'] });
        (window as any).google.charts.setOnLoadCallback(() => setReady(true));
      };
      document.head.appendChild(script);
    }, []);

    const [rows, trend] = React.useMemo(() => {
      const rows: [number, number, string, string][] = [];
      const wellProteins = positions[0] || {};

      for (const protein of selectedStandards) {
        const v = wellProteins[protein.id_num];
        if (v === undefined || v <= 0) continue;

        const rf = Number(v) / ticks;
        const logMW = Math.log10(protein.molecularWeight);

        rows.push([rf, logMW, `point { fill-color: ${protein.color.slice(0, 7)}; }`,
          `
          <div style='padding:10px; line-height:1.5; min-width:240px;'>
            <strong>${protein.name}</strong><br/>
            <strong>Relative Migration:</strong> ${rf.toFixed(3)}<br/>
            <strong>Log Molecular Weight:</strong> ${logMW.toFixed(2)}<br/>
            <strong>Molecular Weight:</strong> ${protein.molecularWeight
              .toString()
              .replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          </div>
          `
        ]);
      }

      rows.sort((a, b) => a[0] - b[0]);

      if (!rows.length) return [rows, { m: 0, b: 0 }] as const;

      const n = rows.length;
      const meanX = rows.reduce((s, r) => s + r[0], 0) / n;
      const meanY = rows.reduce((s, r) => s + r[1], 0) / n;
      const m = rows.reduce((s, r) => s + (r[0] - meanX) * (r[1] - meanY), 0) /
                rows.reduce((s, r) => s + (r[0] - meanX) ** 2, 0);

      const b = meanY - m * meanX;
      return [rows, { m, b }] as const;

    }, [open, positions, selectedStandards, ticks]);

    React.useEffect(() => {
      setSlope(trend.m);
      setIntercept(trend.b);
      setGuideY(trend.m * guideX + trend.b);
      setInputValue(guideX.toFixed(3));
    }, [trend, guideX]);

    React.useEffect(() => {
      if (!open || !ready || !divRef.current) return;

      const g = (window as any).google;
      const data = new g.visualization.DataTable();
      const chart = new g.visualization.ScatterChart(divRef.current);

      data.addColumn('number', 'Relative Migration');
      data.addColumn('number', 'Log MW');
      data.addColumn({ type: 'string', role: 'style' });
      data.addColumn({ type: 'string', role: 'tooltip', p: { html: true } });

      if (rows.length) data.addRows(rows);

      chart.draw(data, {
        legend: 'none',
        tooltip: { isHtml: true },
        pointSize: 7,
        hAxis: { title: 'Relative Migration', minValue: 0, maxValue: 1, ticks: Array.from({ length: 21 }, (_, i) => i * 0.05) },
        vAxis: { title: 'Log Molecular Weight', minValue: 0, maxValue: 6 },
        chartArea: { left: 80, top: 50, width: '85%', height: '70%' },
        trendlines: rows.length ? { 0: { type: 'linear', color: 'gray', opacity: 0.4 } } : {}
      });

      const overlay = divRef.current.querySelector('#guide-overlay') as HTMLCanvasElement ||
                      Object.assign(document.createElement('canvas'), { id: 'guide-overlay' });
      const ctx = overlay.getContext('2d');

      if (!overlay.parentElement) {
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.pointerEvents = rows.length ? 'none' : 'auto';
        divRef.current.appendChild(overlay);
      }
      if (!ctx) return;

      overlay.width = divRef.current.offsetWidth;
      overlay.height = divRef.current.offsetHeight;
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      if (!rows.length) return;

      const chartLeft = 80;
      const chartTop = 50;
      const chartW = overlay.width * 0.85;
      const chartH = overlay.height * 0.7;
      const xPx = chartLeft + guideX * chartW;
      const yPx = chartTop + (1 - guideY / 6) * chartH;

      ctx.strokeStyle = 'gray';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(xPx, chartTop);
      ctx.lineTo(xPx, chartTop + chartH);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(chartLeft, yPx);
      ctx.lineTo(chartLeft + chartW, yPx);
      ctx.stroke();
      ctx.fillStyle = 'gray';
      ctx.beginPath();
      ctx.arc(xPx, yPx, 5, 0, 2 * Math.PI);
      ctx.fill();

    }, [open, ready, guideX, guideY, rows, trend]);

    const onMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!rows.length) return;

      const ref = divRef.current;
      if (!ref) return;

      const rect = ref.getBoundingClientRect();
      const chartLeft = 80;
      const chartW = rect.width * 0.85;
      const xPx = chartLeft + guideX * chartW;
      const nearGuide = Math.abs(e.clientX - rect.left - xPx) < 8;

      setHoveringGuide(nearGuide || isDragging);
      if (!isDragging) return;

      const mouseX = e.clientX - rect.left;
      const newX = Math.max(0, Math.min(1, (mouseX - chartLeft) / chartW));
      let newY = slope * newX + intercept;
      newY = Math.max(0, Math.min(6, newY));
      setGuideX(newX);
      setGuideY(newY);
    };

    const onMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!rows.length) return;

      const ref = divRef.current;
      if (!ref) return;

      const rect = ref.getBoundingClientRect();
      const chartLeft = 80;
      const chartW = rect.width * 0.85;
      const xPx = chartLeft + guideX * chartW;

      if (Math.abs(e.clientX - rect.left - xPx) < 8) setIsDragging(true);
    };

    const onMouseUp = () => setIsDragging(false);

    const onXInputChange = (value: string) => {
      setInputValue(value);
    };

    const onXInputBlur = () => {
      setEditingX(false);
      const num = parseFloat(inputValue);
      if (!isNaN(num)) {
        const clamped = Math.max(0, Math.min(1, num));
        setGuideX(clamped);
        setGuideY(slope * clamped + intercept);
        setInputValue(clamped.toFixed(3));
      } else {
        setInputValue(guideX.toFixed(3));
      }
    };

    return (
      <Dialog open={open} onClose={onClose} maxWidth='lg' fullWidth>
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          Log MW vs. Relative Migration
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <div
            ref={divRef}
            style={{
              width: '100%',
              height: 420,
              position: 'relative',
              cursor: hoveringGuide ? 'ew-resize' : 'default',
            }}
            onMouseMove={onMouseMove}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseLeave={() => {
              onMouseUp();
              setHoveringGuide(false);
            }}
          />
          {rows.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                marginTop: '1rem',
                fontSize: '14px',
                gap: '2rem',
              }}
            >
              <div style={{ background: accentColor, padding: '8px 12px', borderRadius: '4px' }}>
                <strong>Relative Migration:</strong>{' '}
                {editingX ? (
                  <input
                    autoFocus
                    type='number' min='0' max='1' step='0.001'
                    value={inputValue}
                    onBlur={onXInputBlur}
                    onChange={(e) => onXInputChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && onXInputBlur()}
                    style={{
                      width: '60px',
                      padding: '2px 4px',
                      borderRadius: '2px',
                      font: 'inherit',
                    }}
                  />
                ) : (
                  <span
                    onClick={() => setEditingX(true)}
                    style={{ cursor: 'pointer', textDecoration: 'underline' }}
                  >
                    {guideX.toFixed(3)}
                  </span>
                )}
              </div>
              <div style={{ background: accentColor, padding: '8px 12px', borderRadius: '4px' }}>
                <strong>Log MW:</strong> {guideY.toFixed(2)}
              </div>
            </div>
          )}
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
      let startTime = performance.now();

      setIsRunning(true);
      setHasStarted(true);

      timerRef.current = window.setInterval(() => {
        const elapsed = performance.now() - startTime;
        if (elapsed < (simDelay * 1.25)) return;

        setPositions(prev => {
          const updated: typeof prev = { ...prev }

          for (const [wi, wellProteins] of Object.entries(prev)) {
            const idx = Number(wi);
            updated[idx] = { ...wellProteins };

            const proteinsToAnimate = idx === 0
              ? selectedStandards
              : uploadedProteins[idx]?.proteins || [];

            for (const protein of proteinsToAnimate) {
              const current = wellProteins[protein.id_num];
              if (current === undefined) continue;

              const rf = getRelativeMobility(acrylamidePct, protein.molecularWeight);
              const target = Math.min(rf * ticks * ticks, ticks);
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
      const next: typeof prev = {};
      for (const [wi, wellProteins] of Object.entries(prev)) {
        next[Number(wi)] = Object.fromEntries(
          Object.keys(wellProteins).map(id => [id, 0])
        );
      }
      return next;
    });
  };


  const onClear = () => {
    setSelectedStandards(standards);
    setUploadedProteins({});
    setTooltipData(null);
    
    setPositions(() => ({
      0: Object.fromEntries(standards.map(p => [p.id_num, 0]))
    }));

    setHasStarted(false);
    onStop();
  };


  const onFileUpload = (wellIndex: number, file: File): Promise<void> => {
    return new Promise(async (resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);

      try {
        const response = await fetch(`${API_URL}/1d/ProteinInfo/File`, {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) throw new Error('Upload failed');

        const proteins: typeof standards = await response.json();

        setUploadedProteins(prev => ({
          ...prev,
          [wellIndex]: { name: file.name, proteins },
        }));

        setPositions(prev => ({
          ...prev,
          [wellIndex]: Object.fromEntries(proteins.map(p => [p.id_num, 0])),
        }));

        resolve();
      } catch (error) {
        console.error('Error uploading file:', error);
        reject(error);
      }
    });
  };


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
    setWellsCount(w => Math.min(maxWells, w + 1));
  }


  const onRemoveWell = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (wellsCount > 2) {
      setUploadedProteins(prev => {
        const copy = { ...prev };
        delete copy[wellsCount - 1];
        return copy;
      });

      setPositions(prev => {
        const copy = { ...prev };
        delete copy[wellsCount - 1];
        return copy;
      });

      setWellsCount(w => w - 1);
    }
  };


  const onToggleProtein = (protein: typeof standards[number]) => {
    setSelectedStandards(prev =>
      prev.some(p => p.id_num === protein.id_num)
        ? prev.filter(p => p.id_num !== protein.id_num)
        : [...prev, protein]
    );
  }


  const onDragStart = (wellIndex: number) => {
    if (wellIndex === 0) return;
    setDraggedWell(wellIndex);
  };


  const onDragOver = (e: React.DragEvent, wellIndex: number) => {
    e.preventDefault();
    if (wellIndex === 0) return;
    setDragOverWell(wellIndex);
  };


  const onDragLeave = () => {
    setDragOverWell(null);
  };


  const onDrop = (e: React.DragEvent, targetWell: number) => {
    e.preventDefault();
    if (draggedWell === null || draggedWell === targetWell || targetWell === 0) {
      setDraggedWell(null);
      setDragOverWell(null);
      return;
    }

    setUploadedProteins(prev => {
      const newUploaded = { ...prev };
      const temp = newUploaded[draggedWell];
      newUploaded[draggedWell] = newUploaded[targetWell];
      if (temp) {
        newUploaded[targetWell] = temp;
      } else {
        delete newUploaded[targetWell];
      }
      return newUploaded;
    });

    setPositions(prev => {
      const newPositions = { ...prev };
      const temp = newPositions[draggedWell];
      newPositions[draggedWell] = newPositions[targetWell];
      newPositions[targetWell] = temp;
      return newPositions;
    });

    setDraggedWell(null);
    setDragOverWell(null);
  };

  
  const onDragEnd = () => {
    setDraggedWell(null);
    setDragOverWell(null);
  };


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
        const newZoom = Math.min(50, Math.max(1, z * zoomFactor));
        if (newZoom === z) return z;
        if (newZoom > z) setAnchor(a => a + (newAnchor - a) * 0.1);
        return newZoom;
      });
    })
  }


  const onMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    const currentTarget = e.currentTarget as SVGSVGElement;
    const eventTarget = e.target as Node;

    const container = currentTarget.querySelector('.acrylamide-slab');
    if (!container || !container.contains(eventTarget)) return;

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
              const subY = valueToY(i + j / subTicks)
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
  }, [ticks, zoom, anchor, totalH]);


  const dots = React.useMemo(() => {
    const pct = Math.min(15, Math.max(7.5, acrylamidePct));
    const poreSize = 40 / Math.sqrt(pct);

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
  }, [acrylamidePct, ticks, zoom, anchor, totalH]);


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

      {/* Simulation */}
      <div className='gel-container' onClick={() => setTooltipData(null)}>
        <svg
          className='gel-svg'
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseUp}
          onMouseUp={onMouseUp}

          height={totalH}
          width={slabW * 1.4}
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

          <g
            className='standards-well'
            style={{
              opacity: hasStarted ? 1 : 0,
              transition: hasStarted ? `opacity ${simDelay / 1000}s ease-in ${simDelay / 1000}s` : 'none'
            }}
          >
            {selectedStandards.map((protein, i) => {
              return (
                <rect
                  x={wellW + ((wellW - bandW) / 2)} y={Math.max(valueToY(positions[0]?.[protein.id_num] ?? 0) - (bandH * 1.25), bandMin)}
                  width={bandW} height={bandH} rx={3} ry={3}
                  key={protein.id_num}
                  fill={protein.color}
                  stroke='var(--background)'
                  strokeWidth={0.5}
                  style={{ cursor: 'pointer' }}
                  onClick={(e) => {
                    if (tooltipData?.protein != protein) {
                      e.stopPropagation();
                      const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
                      
                      setTooltipData({
                        protein,
                        x: rect.left + rect.width / 2,
                        y: rect.top
                      });
                      return;
                    }
                    setTooltipData(null);
                  }}
                />
              )
            })}
          </g>

          {/* Non-standard Bands */}
          {Array.from({ length: wellsCount }).map((_, wi) => {
            if (wi === 0 || !uploadedProteins[wi]) return null;

            return (
              <g
                key={`uploaded-well-${wi}`}
                className='uploaded-well'
                style={{
                  opacity: hasStarted ? 1 : 0,
                  transition: hasStarted ? `opacity ${simDelay / 1000}s ease-in ${simDelay / 1000}s` : 'none'
                }}
              >
                {uploadedProteins[wi].proteins.map((protein) => {
                  return (
                    <rect
                      x={(2 * wi + 1) * wellW + ((wellW - bandW) / 2)}
                      y={Math.max(valueToY(positions[wi]?.[protein.id_num] ?? 0) - (bandH * 1.25), bandMin)}
                      width={bandW} height={bandH} rx={3} ry={3}
                      key={`${wi}-${protein.id_num}`}
                      fill={protein.color || 'var(--accent)'}
                      stroke='var(--background)'
                      strokeWidth={0.5}
                      style={{ cursor: 'pointer' }}
                      onClick={(e) => {
                        if (tooltipData?.protein != protein) {
                          e.stopPropagation();
                          const rect = (e.currentTarget as SVGElement).getBoundingClientRect();
                          
                          setTooltipData({
                            protein,
                            x: rect.left + rect.width / 2,
                            y: rect.top
                          });
                          return;
                        }
                        setTooltipData(null);
                      }}
                    />
                  )
                })}
              </g>
            );
          })}

          <g className='filename-bands' style={{
            opacity: hasStarted ? 0 : 1,
            transition: 'opacity 0.25s ease-out',
            pointerEvents: hasStarted ? 'none' : 'auto'
          }}>
            {Array.from({ length: wellsCount }).map((_, wi) => {
              const hasProteins = Object.keys(positions[wi] || {}).length > 0;
              const label = wi === 0 ? 'Standard Proteins' : uploadedProteins[wi]?.name || `File ${wi}`;

              if (!hasProteins) return null;
              
              const isDragging = draggedWell === wi;
              const isDropTarget = dragOverWell === wi && draggedWell !== null && draggedWell !== wi;
              const canDrag = wi !== 0 && !!uploadedProteins[wi];
              
              return (
                <g key={`filename-band-${wi}`}>
                  <foreignObject
                    x={(2 * wi + 1) * wellW + ((wellW - bandW) / 2)} y={wellH * 1.65}
                    width={bandW} height={bandH}
                    style={{ overflow: 'visible' }}
                  >
                  <Tooltip
                    title={label}
                    slotProps={{
                      tooltip: {
                        sx: { // This needs to be fixed later (I'm crunchin to finish on time)
                          backgroundColor: '#282b30',
                          color: '#f6f6f6',
                          fontSize: '12px',
                          fontWeight: 'normal',
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)'
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
                          width: '100%', height: '100%',
                          cursor: canDrag ? 'grab' : 'default',
                          opacity: isDragging ? 0.5 : 1,
                          transition: 'opacity 0.2s'
                        }}
                        onClick={(e) => {
                          if (e.detail === 2 && wi !== 0) {
                            e.stopPropagation();
                            setUploadedProteins(prev => {
                              const next = { ...prev };
                              delete next[wi];
                              return next;
                            });
                            setPositions(prev => {
                              const next = { ...prev };
                              delete next[wi];
                              return next;
                            });
                          }
                        }}
                      />
                    </Tooltip>
                  </foreignObject>
                  <rect
                    x={(2 * wi + 1) * wellW + ((wellW - bandW) / 2)} y={wellH * 1.65}
                    width={bandW} height={bandH} rx={3} ry={3}
                    fill={isDropTarget ? 'var(--accent)' : 'var(--highlight)'}
                    stroke={isDropTarget ? 'var(--text)' : 'var(--accent)'}
                    strokeWidth={isDropTarget ? 2 : 0.5}
                    style={{ pointerEvents: 'none' }}
                  />
                </g>
              );
            })}
          </g>

          {/* Well Uploads */}
          <g className='upload-buttons' style={{
            opacity: hasStarted ? 0 : 1,
            transition: 'opacity 0.25s ease-out'
          }}>
            {Array.from({ length: wellsCount }).map((_, wi) => {
              if (wi === 0 || uploadedProteins[wi]) return null;

              const centerX = (2 * wi + 1) * wellW + wellW / 2;
              const centerY = wellH * 1.5;

              return (
                <g key={`upload-btn-${wi}`}>
                  <foreignObject
                    x={centerX - 12} y={centerY - 12}
                    width={24} height={24}
                    style={{ overflow: 'visible' }}
                  >
                    <label
                      htmlFor={`file-upload-${wi}`}
                      style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}
                    >
                      <input
                        type='file'
                        id={`file-upload-${wi}`}
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) onFileUpload(wi, file);
                        }}
                        accept='.fasta,.txt'
                      />
                      <IconButton
                        component='span'
                        sx={{
                          backgroundColor: 'var(--highlight)',
                          color: 'var(--text)',
                          width: 24, height: 24, padding: 0,
                          '&:hover': { backgroundColor: 'var(--accent)' },
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

      {/* Protein Tooltip */}
      {tooltipData && (
        <div
          className='protein-tooltip'
          style={{
            left: tooltipData.x,
            top: tooltipData.y,
            transform: 'translate(40px, -100%)',
            cursor: isDraggingTooltip ? 'grabbing' : 'grab'
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => {
            setIsDraggingTooltip(true);
            setTooltipDragStart({ x: e.clientX - tooltipData.x, y: e.clientY - tooltipData.y });
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
          <div className='protein-tooltip-title'>
            Protein Information
          </div>
          <div>Name: {tooltipData.protein.name}</div>
          <div>Molecular Weight: {tooltipData.protein.molecularWeight.toLocaleString()}</div>
          <div>
            Rm Value: {(() => {
              const wellIndex = Object.entries(positions).find(([_, proteins]) => proteins.hasOwnProperty(tooltipData.protein.id_num) )?.[0];
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
      )}

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