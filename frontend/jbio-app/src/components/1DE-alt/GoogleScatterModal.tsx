import React from "react";
import { Dialog, DialogTitle, DialogContent, IconButton } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

import type { PositionsMap } from "./types";
import type { StandardProtein } from "./standards";

type Props = {
    open: boolean;
    onClose: () => void;
    positions: PositionsMap;
    selectedStandards: StandardProtein[];
    ticks: number;
};

const GoogleScatterModal: React.FC<Props> = ({
    open,
    onClose,
    positions,
    selectedStandards,
    ticks,
}) => {
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
        <DialogTitle 
            sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                alignItems: 'center' 
            }}
        >
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
                gap: '2rem',
              }}
            >
              <div 
                style={{ 
                    background: accentColor, 
                    padding: '8px 12px', 
                    borderRadius: '4px' 
                }}
             >
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

export default GoogleScatterModal;