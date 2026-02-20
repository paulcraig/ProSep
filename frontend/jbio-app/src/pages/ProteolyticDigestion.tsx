import React, { useEffect, useState, useCallback } from "react";
import "./ProteolyticDigestion.css";
import { API_URL } from "../config";
import { Link } from "react-router-dom";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Protein {
  name: string;
  sequence: string;
}

interface ProteolyticDigestionProps {
  protein?: Protein | null;
  onClose?: () => void;
}

// ─── Constants (outside component to avoid re-allocation on every render) ─────

/**
 * Maps display name → single-letter amino acid at which the protease cuts.
 * Rules fixed vs. original:
 *   - trypsin:      cuts after K or R → we send "KR" and let backend handle both
 *   - pepsin:       cuts after F, L, W, Y (aromatic / large hydrophobic)
 *   - Chymotrypsin: cuts after F, Y, W → send "FYW"
 *   - Others kept intentionally simplified for this UI.
 */
const PROTEASES: { name: string; aminoAcid: string; description: string }[] = [
  { name: "PreScission",    aminoAcid: "Q", description: "Cuts after Q (LEVLFQ↓GP motif)" },
  { name: "Thrombin",       aminoAcid: "R", description: "Cuts after R (PR↓GS motif)" },
  { name: "Enterokinase",   aminoAcid: "K", description: "Cuts after K (DDDDK↓)" },
  { name: "Chymotrypsin",   aminoAcid: "FYW", description: "Cuts after F, Y, W" },
  { name: "Trypsin",        aminoAcid: "KR", description: "Cuts after K or R" },
  { name: "Pepsin",         aminoAcid: "FLWY", description: "Cuts after F, L, W, Y" },
];

// ─── Component ────────────────────────────────────────────────────────────────

const ProteolyticDigestion: React.FC<ProteolyticDigestionProps> = ({ protein, onClose }) => {
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [selectedProtease, setSelectedProtease] = useState<typeof PROTEASES[0] | null>(null);
  const [fragments, setFragments]       = useState<string[]>([]);

  // Reset fragments when protein changes
  useEffect(() => {
    setFragments([]);
    setSelectedProtease(null);
    setError(null);
  }, [protein?.name]);

  const runDigestion = useCallback(async (sequence: string, aminoAcid: string) => {
    if (!sequence || !aminoAcid) return;

    setLoading(true);
    setError(null);
    setFragments([]);

    try {
      const response = await fetch(`${API_URL}/proteolytic_digestion/seperateProtein`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sequence, aminoAcid }),
      });

      if (!response.ok) throw new Error(`Server error: ${response.status}`);

      const result: string[] = await response.json();
      setFragments(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleProteaseSelect = (p: typeof PROTEASES[0]) => {
    setSelectedProtease(p);
    if (protein?.sequence) {
      runDigestion(protein.sequence, p.aminoAcid);
    }
  };

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && onClose) onClose();
  };

  // Standalone page mode — rendered as a nav item with no protein context
  if (!onClose) {
    return (
      <div className="pd-page">
        <div className="pd-page-empty">
          <span className="pd-label">Proteolytic Digestion</span>
          <p>Select a protein from the 2D Electrophoresis view to begin digestion.</p>
        </div>
      </div>
    );
  }

  if (!protein) return null;

  return (
    <div className="pd-backdrop" onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-label="Proteolytic Digestion">
      <div className="pd-modal" onClick={(e) => e.stopPropagation()}>

        {/* ── Header ── */}
        <div className="pd-header">
          <div className="pd-header-left">
            <span className="pd-label">Proteolytic Digestion</span>
            <h2 className="pd-protein-name">{protein.name}</h2>
          </div>
          <button className="pd-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Sequence preview ── */}
        <div className="pd-section">
          <div className="pd-section-label">Sequence</div>
          <div className="pd-sequence-box">
            {protein.sequence}
          </div>
        </div>

        {/* ── Protease selection ── */}
        <div className="pd-section">
          <div className="pd-section-label">Select Protease</div>
          <div className="pd-protease-grid">
            {PROTEASES.map((p) => (
              <button
                key={p.name}
                className={`pd-protease-btn ${selectedProtease?.name === p.name ? "active" : ""}`}
                onClick={() => handleProteaseSelect(p)}
                title={p.description}
              >
                <span className="pd-protease-name">{p.name}</span>
                <span className="pd-protease-aa">{p.aminoAcid}</span>
              </button>
            ))}
          </div>
          {selectedProtease && (
            <div className="pd-protease-desc">{selectedProtease.description}</div>
          )}
        </div>

        {/* ── Results ── */}
        <div className="pd-section pd-results-section">
          <div className="pd-results-header">
            <div className="pd-section-label">
              Fragments
              {fragments.length > 0 && (
                <span className="pd-fragment-count">{fragments.length}</span>
              )}
            </div>
            {fragments.length > 0 && (
              <Link
                className="pd-export-btn"
                to="/peptide-retention"
                state={{ aminoAcids: fragments }}
              >
                Export to Peptide Retention →
              </Link>
            )}
          </div>

          <div className="pd-results-body">
            {loading && (
              <div className="pd-status">
                <div className="pd-spinner" />
                <span>Digesting…</span>
              </div>
            )}

            {error && !loading && (
              <div className="pd-status pd-error">⚠ {error}</div>
            )}

            {!loading && !error && fragments.length === 0 && (
              <div className="pd-status pd-muted">
                {selectedProtease ? "No fragments returned." : "Choose a protease to begin."}
              </div>
            )}

            {!loading && fragments.length > 0 && (
              <ol className="pd-fragment-list">
                {fragments.map((frag, i) => (
                  <li key={i} className="pd-fragment-item">
                    <span className="pd-fragment-index">{i + 1}</span>
                    <span className="pd-fragment-seq">{frag}</span>
                    <span className="pd-fragment-len">{frag.length} aa</span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default ProteolyticDigestion;