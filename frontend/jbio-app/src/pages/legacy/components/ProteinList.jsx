import { red } from '@mui/material/colors';
import React from 'react';

const ChevronIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const WaveSpinner = () => (
  <svg width="60" height="30" viewBox="0 0 100 50">
    {[10, 30, 50, 70, 90].map((x, i) => (
      <line key={x} x1={x} y1="25" x2={x} y2="25" stroke="#00d4aa" strokeWidth="4" strokeLinecap="round">
        <animate attributeName="y1" values="25;10;25" dur="1s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
        <animate attributeName="y2" values="25;40;25" dur="1s" begin={`${i * 0.2}s`} repeatCount="indefinite" />
      </line>
    ))}
  </svg>
);

export const ProteinList = ({
  dots,
  selectedDot,
  isCollapsed,
  isUploading,
  onToggleCollapse,
  onProteinClick,
}) => {
  return (
    <div
      id="protein-list"
      className="twoDE-panel"
      style={{ width: isCollapsed ? '60px' : '220px', height: '600px' }}
    >
      {/* Header */}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', cursor: 'pointer', userSelect: 'none' }}
        onClick={onToggleCollapse}
      >
        <h3>Proteins ({dots.length})</h3>
        <div style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.2s', color: 'var(--text-dim)' }}>
          <ChevronIcon />
        </div>
      </div>

      {/* Resize handle */}
      <div
        className="twoDE-resize-handle"
        onMouseDown={e => {
          const panel = e.currentTarget.parentElement; // capture before event is recycled
          const startWidth = panel.offsetWidth;
          const startX = e.clientX;
          const onMove = me => {
            if (!isCollapsed) panel.style.width = `${Math.max(150, startWidth + me.clientX - startX)}px`;
          };
          const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
          document.addEventListener('mousemove', onMove);
          document.addEventListener('mouseup', onUp);
        }}
      />

      {/* List */}
      <div
        className="twoDE-protein-list"
        style={{ opacity: isCollapsed ? 0 : 1, transition: 'opacity 0.2s', pointerEvents: isCollapsed ? 'none' : 'auto' }}
      >
        {!isCollapsed && dots.map(dot => (
          <div
            key={dot.name}
            onClick={() => onProteinClick(dot)}
            className={"twoDE-protein-item" + (selectedDot?.name === dot.name ? ' selected' : '')}
          >
            <div className="twoDE-protein-color" style={{ backgroundColor: dot.color }} />
            <span className="twoDE-protein-name">{dot.display_name}</span>
          </div>
        ))}
      </div>

      {/* Upload progress */}
      {isUploading && (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
          <div style={{ fontFamily: 'var(--mono)', fontSize: '10px', color: 'var(--text-dim)', letterSpacing: '0.08em' }}>UPLOADING</div>
          <WaveSpinner />
        </div>
      )}
    </div>
  );
};