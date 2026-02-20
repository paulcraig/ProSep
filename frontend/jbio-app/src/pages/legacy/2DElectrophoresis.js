import { useEffect, useRef, useState } from 'react';
import './2DElectrophoresis.extracted.css';

import { useSimulation }        from './hooks/useSimulation';
import { usePanZoom }           from './hooks/usePanZoom';
import { useCanvasInteraction } from './hooks/useCanvasInteraction';
import { useCanvasRenderer }    from './hooks/useCanvasRenderer';

import { Toolbar }         from './components/Toolbar';
import { ProteinList }     from './components/ProteinList';
import { ProteinInfoCard } from './components/ProteinInfoCard';
import ProteolyticDigestion from '../ProteolyticDigestion';

const TwoDE = () => {
  const canvasRef = useRef(null);

  // ── Controls state ───────────────────────────────────────────────────────────
  const [phRange,              setPhRange]              = useState({ min: 0, max: 14 });
  const [yAxisMode,            setYAxisMode]            = useState('mw');
  const [acrylamidePercentage, setAcrylamidePercentage] = useState(7.5);
  const [isProteinListCollapsed, setIsProteinListCollapsed] = useState(false);
  const [showDigestion,        setShowDigestion]        = useState(false);
  const [isDragging,           setIsDragging]           = useState(false);
  const [dragCounter,          setDragCounter]          = useState(0);
  const [minMW, setMinMW] = useState(0);
  const [maxMW, setMaxMW] = useState(1);

  // ── Hooks ────────────────────────────────────────────────────────────────────
  const simulation = useSimulation();

  const { zoom, zoomRef, offsetRef, setZoomSafe, resetPanZoom, attachPanListeners } = usePanZoom(canvasRef);

  const interaction = useCanvasInteraction({
    canvasRef, zoomRef, offsetRef,
    dots: simulation.dots,
    simulationState: simulation.simulationState,
    minMW, maxMW, phRange,
  });

  useCanvasRenderer({
    canvasRef, zoomRef, offsetRef,
    dots:            simulation.dots,
    selectedDot:     interaction.selectedDot,
    hoveredDot:      interaction.hoveredDot,
    simulationState: simulation.simulationState,
    simulationProgress: simulation.simulationProgress,
    phRange, yAxisMode, minMW, maxMW,
  });

  // ── Derived state ─────────────────────────────────────────────────────────────
  const activeDot = interaction.selectedDot || interaction.hoveredDot;

  // Dynamically track MW range for axis scaling
  useEffect(() => {
    const mws = simulation.dots.map(p => Number(p.mw)).filter(mw => !isNaN(mw) && mw > 0);
    if (mws.length === 0) return;
    setMinMW(mws.length > 1 ? Math.min(...mws) : 0);
    setMaxMW(Math.max(...mws));
  }, [simulation.dots]);

  // Close digestion modal when selected protein changes
  useEffect(() => { setShowDigestion(false); }, [interaction.selectedDot?.name]);

  // Attach pan listeners once canvas is mounted
  useEffect(() => {
    if (!canvasRef.current) return;
    return attachPanListeners(canvasRef.current);
  }, []);

  // ── Event handlers ───────────────────────────────────────────────────────────
  const handleReset = () => {
    simulation.reset();
    interaction.setSelectedDot(null);
    resetPanZoom();
  };

  const handlePhRangeChange = (type, value) => {
    if (simulation.simulationState !== 'ready') return;
    const parsed = parseFloat(value);
    setPhRange(prev =>
      type === 'min'
        ? { ...prev, min: Math.min(parsed, prev.max - 0.1) }
        : { ...prev, max: Math.max(parsed, prev.min + 0.1) }
    );
  };

  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setDragCounter(p => p + 1); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragCounter(p => { if (p - 1 === 0) setIsDragging(false); return p - 1; }); };
  const handleDragOver  = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop      = async (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); setDragCounter(0); await simulation.uploadFASTA(e.dataTransfer.files); };

  const isReady = simulation.simulationState === 'ready';

  return (
    <div className="simulatorBoxTwoDE">
      <div className="twoDE-controls-col">

        {/* ── Toolbar ── */}
        <Toolbar
          simulationState={simulation.simulationState}
          yAxisMode={yAxisMode}
          onUpload={e => simulation.uploadFASTA(e.target.files)}
          onStartIEF={() => simulation.startIEF({ dots: simulation.dots, phRange })}
          onStartSDS={() => simulation.startSDS({ dots: simulation.dots, yAxisMode, acrylamidePercentage })}
          onReset={handleReset}
          onToggleYAxis={() => setYAxisMode(prev => prev === 'mw' ? 'distance' : 'mw')}
        />

        {/* ── pH Range ── */}
        <div className="control-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label className="twoDE-control-label" style={{ opacity: isReady ? 1 : 0.4 }}>pH Range</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
              <input type="number" min="0" max="14" step="0.1" value={phRange.min} onChange={e => handlePhRangeChange('min', e.target.value)} className="twoDE-input" disabled={!isReady} />
              <input type="range"  id="ph-min-slider" min="0" max="14" step="0.1" value={phRange.min} onChange={e => handlePhRangeChange('min', e.target.value)} className="twoDE-range" disabled={!isReady} />
              <input type="range"  id="ph-max-slider" min="0" max="14" step="0.1" value={phRange.max} onChange={e => handlePhRangeChange('max', e.target.value)} className="twoDE-range" disabled={!isReady} />
              <input type="number" min="0" max="14" step="0.1" value={phRange.max} onChange={e => handlePhRangeChange('max', e.target.value)} className="twoDE-input" disabled={!isReady} />
            </div>
          </div>
        </div>

        {/* ── Acrylamide ── */}
        <div className="control-group">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <label className="twoDE-control-label" style={{ opacity: isReady ? 1 : 0.4 }}>Acrylamide</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <select id="acrylamide-percentage-dropdown" onChange={e => isReady && setAcrylamidePercentage(parseFloat(e.target.value))} disabled={!isReady} value={acrylamidePercentage}>
                <option value={7.5}>7.5%</option>
                <option value={10}>10%</option>
                <option value={12.5}>12.5%</option>
                <option value={15}>15%</option>
              </select>
              <div className="twoDE-acrylic-desc" style={{ opacity: isReady ? 0.8 : 0.4 }}>
                {acrylamidePercentage < 7 ? 'Resolves large proteins' : acrylamidePercentage < 12 ? 'Medium range separation' : 'Resolves small proteins'}
              </div>
            </div>
          </div>
        </div>

        {/* ── Main canvas area ── */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', maxWidth: '1100px', margin: '0 auto', padding: '20px' }}>

          <ProteinList
            dots={simulation.dots}
            selectedDot={interaction.selectedDot}
            isCollapsed={isProteinListCollapsed}
            isUploading={simulation.isUploading}
            onToggleCollapse={() => setIsProteinListCollapsed(p => !p)}
            onProteinClick={interaction.selectFromList}
          />

          <div className="twoDE-canvas-wrapper" style={{ position: 'relative' }}
            onDragEnter={handleDragEnter} onDragOver={handleDragOver}
            onDragLeave={handleDragLeave} onDrop={handleDrop}
          >
            {isDragging && (
              <div className="twoDE-drag-overlay">
                <div className="twoDE-drag-box">Drop FASTA here</div>
              </div>
            )}

            <canvas
              ref={canvasRef}
              width={800} height={600}
              className="twoDE-canvas"
              onMouseMove={interaction.handleCanvasMouseMove}
              onMouseLeave={interaction.handleCanvasMouseLeave}
              onClick={interaction.handleCanvasClick}
            />

            {['sds-running', 'complete'].includes(simulation.simulationState) && (
              <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '160px' }}>
                <button className="plus-button"  onClick={() => setZoomSafe(zoom * 1.1)}>+</button>
                <button className="minus-button" onClick={() => setZoomSafe(zoom / 1.1)}>−</button>
              </div>
            )}

            {activeDot && (
              <ProteinInfoCard
                dot={activeDot}
                mousePos={interaction.mousePos}
                onDigestClick={() => setShowDigestion(true)}
              />
            )}
          </div>
        </div>
      </div>

      {showDigestion && interaction.selectedDot && (
        <ProteolyticDigestion
          protein={interaction.selectedDot}
          onClose={() => setShowDigestion(false)}
        />
      )}
    </div>
  );
};

export default TwoDE;