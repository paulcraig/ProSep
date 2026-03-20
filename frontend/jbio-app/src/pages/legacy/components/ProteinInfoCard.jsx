import React from 'react';
import { Button } from '@mui/material';

export const ProteinInfoCard = ({ dot, mousePos, onDigestClick }) => {
  if (!dot) return null;

  return (
    <div
      id="protein-info-card"
      className="twoDE-card"
      style={{ left: mousePos.x + 10, top: mousePos.y + 10 }}
    >
      <h4>{dot.display_name}</h4>
      <div className="meta">
        <div>
          {dot.Link && dot.Link !== 'N/A'
            ? <><span style={{ color: 'var(--text-dim)' }}>Link: </span><a href={dot.Link}>{dot.Link}</a></>
            : <span style={{ color: 'var(--text-dim)' }}>No link available</span>}
        </div>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>MW: </span>
          {dot.mw != null ? dot.mw.toLocaleString() : 'N/A'} Da
        </div>
        <div>
          <span style={{ color: 'var(--text-dim)' }}>pI: </span>
          {dot.pH != null ? dot.pH.toFixed(2) : 'N/A'}
        </div>
        {dot.sequence && (
          <div style={{ marginTop: '6px' }}>
            <div style={{ color: 'var(--text-dim)', marginBottom: '4px', fontSize: '10px', letterSpacing: '0.08em' }}>
              SEQUENCE PREVIEW
            </div>
            <div className="sequence-preview">{dot.sequence.substring(0, 50)}…</div>
          </div>
        )}
        <Button
          onClick={onDigestClick}
          size="small"
          style={{ marginTop: '10px', width: '100%' }}
        >
          Digest Protein
        </Button>
      </div>
    </div>
  );
};
