import React from 'react';

const UploadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);
const HorizontalLinesIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
  </svg>
);
const VerticalLinesIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="3" x2="12" y2="21" /><line x1="6" y1="3" x2="6" y2="21" /><line x1="18" y1="3" x2="18" y2="21" />
  </svg>
);
const ResetIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4" />
  </svg>
);
const AxisIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M8 3v18M3 8h10M3 16h10M16 3v18M16 8h5M16 16h5" />
  </svg>
);

export const Toolbar = ({
  simulationState, yAxisMode,
  onUpload, onStartIEF, onStartSDS, onReset, onToggleYAxis,
}) => {
  const isReady      = simulationState === 'ready';
  const isIEFDone    = simulationState === 'ief-complete';

  return (
    <div className="twoDE-controls-row">
      <label className="twoDE-button icon" style={{ cursor: 'pointer' }}>
        <UploadIcon /> Upload FASTA
        <input type="file" accept=".fasta,.fa,.faa,.FAA" multiple onChange={onUpload} style={{ display: 'none' }} />
      </label>

      <button className="twoDE-button icon" onClick={onStartIEF} disabled={!isReady}>
        <HorizontalLinesIcon /> 1st Dimension
      </button>

      <button className="twoDE-button icon" onClick={onStartSDS} disabled={!isIEFDone}>
        <VerticalLinesIcon /> 2nd Dimension
      </button>

      <button className="twoDE-button icon" onClick={onReset}>
        <ResetIcon /> Reset
      </button>

      <button className="twoDE-button icon" onClick={onToggleYAxis}>
        <AxisIcon /> {yAxisMode === 'mw' ? 'Show Distance' : 'Show MW'}
      </button>
    </div>
  );
};
