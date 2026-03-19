import React, { useState } from 'react'
import { API_URL } from '../config';
import { standards } from './1DE-alt/standards';
import GoogleScatterModal from '../components/1DE-alt/GoogleScatterModal';
import Toolbar from './1DE-alt/Toolbar';
import WellsUI from './1DE-alt/WellsUI';
import GelBackground from './1DE-alt/GelBackground';
import BandsLayer from './1DE-alt/BandsLayer';
import ProteinTooltip from './1DE-alt/ProteinTooltip';
import type { ElectrophoresisProps, UploadedProteinsMap, PositionsMap } from './1DE-alt/types';
import './1DESimulation.css'

import blackWire from '../assets/electrophoresis/blackwire.png'
import redWire from '../assets/electrophoresis/redwire.png'

import { Select, MenuItem, Button, Chip, Tooltip } from '@mui/material'

// const standards = [
//   { name: 'B-Galactosidase',    molecularWeight: 116250,  migrationDistance: 0, color: '#4dd0e1',   id_num: '6X1Q', id_str: 'pdb' },
//   { name: 'Phosphorylase B',    molecularWeight: 97400,   migrationDistance: 0, color: '#d3e24aff', id_num: '3LQ8', id_str: 'pdb' },
//   { name: 'Serum Albumin',      molecularWeight: 66200,   migrationDistance: 0, color: '#3d98c1ff', id_num: '1AO6', id_str: 'pdb' },
//   { name: 'Ovalbumin',          molecularWeight: 45000,   migrationDistance: 0, color: '#f06292',   id_num: '1OVA', id_str: 'pdb' },
//   { name: 'Carbonic Anhydrase', molecularWeight: 29000,   migrationDistance: 0, color: '#b8de7cff', id_num: '1CA2', id_str: 'pdb' },
//   { name: 'Trypsin Inhibitor',  molecularWeight: 20100,   migrationDistance: 0, color: '#5c6bc0',   id_num: '2PTC', id_str: 'pdb' },
//   { name: 'Lysozyme',           molecularWeight: 14400,   migrationDistance: 0, color: '#81c784',   id_num: '6LYZ', id_str: 'pdb' },
//   { name: 'Aprotinin',          molecularWeight: 6500,    migrationDistance: 0, color: '#e57373',   id_num: '1AAP', id_str: 'pdb' }
// ];


// interface ElectrophoresisProps {
//   ticks?: number
//   wells?: number
//   voltage?: number
//   acrylamide?: number
// }


const OneDESim: React.FC<ElectrophoresisProps> = ({
  ticks = 6,
  wells = 5,
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

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  const [isRunning, setIsRunning] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const timerRef = React.useRef<number | null>(null);

  const [showChart, setShowChart] = useState(false);
  const [tooltipData, setTooltipData] = useState<{
    protein: (typeof standards)[number];
    x: number;
    y: number;
  } | null>(null);

  const [isDraggingTooltip, setIsDraggingTooltip] = useState(false);
  const [tooltipDragStart, setTooltipDragStart] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const [draggedWell, setDraggedWell] = useState<number | null>(null);
  const [dragOverWell, setDragOverWell] = useState<number | null>(null);

  const [selectedStandards, setSelectedStandards] =
    useState<(typeof standards)[number][]>(standards);
  const [uploadedProteins, setUploadedProteins] = useState<UploadedProteinsMap>({});
  const [positions, setPositions] = useState<
    PositionsMap
  >(() =>
    Object.fromEntries(
      Array.from({ length: wellsCount }).map((_, wi) => [
        wi,
        wi === 0 ? Object.fromEntries(standards.map((p) => [p.id_num, 0])) : {},
      ])
    )
  );

  const [totalH, setTotalH] = useState(700);
  const chipsRef = React.useRef<HTMLDivElement>(null);
  const toolbarRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const updateHeight = () => {
      const toolbarHeight = toolbarRef.current?.offsetHeight || 0; // This jank needs to be fixed...
      const chipsHeight = chipsRef.current?.offsetHeight || 0;
      const reservedSpace = toolbarHeight + chipsHeight + 200;

      const availableHeight = window.innerHeight - reservedSpace;
      setTotalH(Math.max(700, availableHeight));
    };

    updateHeight();
    window.addEventListener("resize", updateHeight);
    return () => window.removeEventListener("resize", updateHeight);
  }, []);

  React.useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isLarge = windowWidth > 1400;
  const baseW = isLarge ?  windowWidth * 0.3 : windowWidth * 0.5;
  const slabW = baseW + ((wellsCount - 3) / 7) * baseW;
  const wellH = 75;
  const wireH = 25;
  const wireW = 75;
  const wireO = 10;

  const buffH = totalH * 0.15;
  const anodeT = totalH - buffH;

  const slabH = totalH - wellH - buffH;
  const wellW = slabW / (2 * wellsCount + 1);

  const bandW = wellW * 0.8;
  const bandH = wellH * 0.2;
  
  const simDelay = 250; // ms
  const maxWells = 11;


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
    setZoom(1);

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
    setZoom(1);
    
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

  const onRemoveWellContents = (wi: number) => {
    setUploadedProteins((prev) => {
      const next = { ...prev };
      delete next[wi];
      return next;
    });

    setPositions((prev) => {
      const next = { ...prev };
      delete next[wi];
      return next;
    });
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


  return (
    <div className='gel-wrapper'>
      {/* Toolbar */}
      <Toolbar
        isRunning={isRunning}
        hasStarted={hasStarted}
        slabW={slabW}
        toolbarRef={toolbarRef}
        wellsCount={wellsCount}
        maxWells={maxWells}
        uploadedProteins={uploadedProteins}
        onFileUpload={onFileUpload}
        setWellsCount={setWellsCount}
        onToggleRun={onToggleRun}
        onPlot={onPlot}
        onReset={onReset}
        onClear={onClear}
      />

      {/* Simulation */}
      <div className='gel-container' onClick={() => setTooltipData(null)} >
        <svg
          className='gel-svg'
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseUp}
          onMouseUp={onMouseUp}

          height={totalH}
          width={slabW + 200}
          viewBox={`-60 0 ${slabW + 200} ${totalH}`}
          style={{ cursor: zoom === 1 ? 'default' : isDragging ? 'grabbing' : 'grab' }}
        >
          <line
            x1={slabW + wireW + wireO} y1={wellH}
            x2={slabW + wireW + wireO} y2={(totalH / 2.05) - 20}
            stroke='#191919'
            strokeWidth='0.75rem'
            strokeLinecap='round'
          />
          <line
            x1={slabW + wireW + wireO} y1={(totalH / 1.95) + 20}
            x2={slabW + wireW + wireO} y2={anodeT + wellH}
            stroke='#ff3636'
            strokeWidth='0.75rem'
            strokeLinecap='round'
          />
          <g>
            <line
              x1={slabW + wireW + wireO - 20} y1={(totalH / 2.05) - 20}
              x2={slabW + wireW + wireO + 20} y2={(totalH / 2.05) - 20}
              stroke='#191919'
              strokeWidth='0.75rem'
            />
            <line
              x1={slabW + wireW + wireO - 40}
              y1={(totalH / 1.95) + 20}
              x2={slabW + wireW + wireO + 40}
              y2={(totalH / 1.95) + 20}
              stroke='#ff3636'
              strokeWidth='0.75rem'
            />
            <foreignObject
              x={slabW + wireW + wireO - 24} y={totalH / 2 - 16}
              width={200} height={32}
            >
              <Select
                variant='standard'
                disableUnderline
                value={voltageAmt}
                onChange={(e) => setVoltageAmt(Number(e.target.value))}
                sx={{
                  fontWeight: 'bold',
                  color: 'var(--text)',
                  textAlign: 'center',
                  '& .MuiSelect-icon': { color: 'var(--text)' },
                  '& .MuiSelect-select': { textAlign: 'center' },
                  width: 'fit-content', minWidth: 0
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

          <foreignObject x={0} y={anodeT + wellH - 16} width={200} height={32}>
            <Select
              variant='standard'
              disableUnderline
              value={acrylamidePct}
              onChange={(e) => setAcrylamidePct(Number(e.target.value))}
              sx={{
                fontWeight: 'bold',
                color: 'var(--sub-text)',
                '& .MuiSelect-icon': { color: 'var(--sub-text)' },
                display: 'flex', alignItems: 'center', width: 'fit-content', minWidth: 0
              }}
            >
              {[7.5,10,12,15].map(a => ( <MenuItem key={a} value={a}>Acrylamide {a}%</MenuItem> ))}
            </Select>
          </foreignObject>

          <image href={redWire} x={slabW + wireO} y={anodeT + wellH - wireH / 2} height={wireH} width={wireW} preserveAspectRatio='xMidYMid meet' />

          <GelBackground
            ticks={ticks}
            wellsCount={wellsCount}
            slabW={slabW}
            slabH={slabH}
            wellW={wellW}
            wellH={wellH}
            totalH={totalH}
            anodeT={anodeT}
            zoom={zoom}
            anchor={anchor}
            acrylamidePct={acrylamidePct}
          />

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

          <BandsLayer
            wellsCount={wellsCount}
            wellW={wellW}
            bandW={bandW}
            bandH={bandH}
            wellH={wellH}
            bandMin={bandMin}
            hasStarted={hasStarted}
            simDelay={simDelay}
            ticks={ticks}
            selectedStandards={selectedStandards}
            uploadedProteins={uploadedProteins}
            positions={positions}
            valueToY={valueToY}
            tooltipData={tooltipData}
            setTooltipData={setTooltipData}
          />

          <WellsUI
            wellsCount={wellsCount}
            wellW={wellW}
            bandW={bandW}
            bandH={bandH}
            wellH={wellH}
            hasStarted={hasStarted}
            simDelay={simDelay}
            positions={positions}
            uploadedProteins={uploadedProteins}
            draggedWell={draggedWell}
            dragOverWell={dragOverWell}
            onDragStart={onDragStart}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onDragEnd={onDragEnd}
            onRemoveWellContents={onRemoveWellContents}
            onFileUpload={onFileUpload}
          />
        </svg>
      </div>

      {/* Proteins */}
      <div
        ref={chipsRef}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          paddingLeft: '3.75rem',
          gap: '0.5rem',
          width: slabW
        }}
      >
        {standards.map(protein => {
          const isSelected = selectedStandards.some(p => p.id_num === protein.id_num)
          return (
            <Chip
              key={protein.id_num}
              label={protein.name}
              onClick={() => onToggleProtein(protein)}
              sx={{
                backgroundColor: isSelected ? protein.color : 'var(--highlight)',
                color: 'white',
                fontWeight: 'bold'
              }}
            />
          )
        })}
      </div>

      {/* Protein Tooltip */}
      {tooltipData && (
        <ProteinTooltip
          tooltipData={tooltipData}
          setTooltipData={setTooltipData}
          positions={positions}
          ticks={ticks}
          isDraggingTooltip={isDraggingTooltip}
          setIsDraggingTooltip={setIsDraggingTooltip}
          tooltipDragStart={tooltipDragStart}
          setTooltipDragStart={setTooltipDragStart}
        />
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