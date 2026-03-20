import { useState } from 'react';
import axios from 'axios';
import { API_URL } from '../../../config';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from '../constants/canvas';

/**
 * Encapsulates all backend calls and the animation interval logic.
 * Returns simulation state, dots, and action functions.
 */
export function useSimulation() {
  const [dots, setDots]                   = useState([]);
  const [simulationState, setSimulationState] = useState('ready');
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [isUploading, setIsUploading]     = useState(false);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /** Plays back a pre-computed array of frame snapshots from the backend. */
  const playFrames = (frames, { onFrame, onComplete, interval = 20 }) => {
    let step = 0;
    const id = setInterval(() => {
      if (step >= frames.length) { clearInterval(id); onComplete(); return; }
      onFrame(frames[step], step, frames.length);
      step++;
    }, interval);
  };

  // ── Public actions ────────────────────────────────────────────────────────────

  const startIEF = ({ dots, phRange }) => {
    if (simulationState !== 'ready') return;
    setSimulationState('ief-running');
    setSimulationProgress(0);

    axios.post(`${API_URL}/2d/simulate-ief`, {
      proteins: dots.map(serializeDot),
      phRange, canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT,
    })
      .then(({ data }) => playFrames(data, {
        onFrame: (frame, step, total) => {
          setDots(frame);
          setSimulationProgress(step / (total - 1));
        },
        onComplete: () => setSimulationState('ief-complete'),
      }))
      .catch(() => setSimulationState('ready'));
  };

  const startSDS = ({ dots, yAxisMode, acrylamidePercentage }) => {
    if (simulationState !== 'ief-complete') return;
    setSimulationState('sds-running');

    axios.post(`${API_URL}/2d/simulate-sds`, {
      proteins: dots.map(serializeDot),
      yAxisMode, acrylamidePercentage, canvasHeight: CANVAS_HEIGHT,
    })
      .then(({ data }) => playFrames(data, {
        onFrame: (frame) => setDots(frame),
        onComplete: () => setSimulationState('complete'),
      }))
      .catch(() => setSimulationState('ief-complete'));
  };

  const uploadFASTA = async (files) => {
    setIsUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));
    try {
      const { data } = await axios.post(`${API_URL}/2d/parse-fasta`, formData);
      setDots(prev => [...prev, ...data]);
    } catch {
      alert('Error uploading FASTA file. Please ensure it is correctly formatted.');
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    setDots(prev => prev.map(dot => ({ ...dot, x: 50, y: 300, currentpH: 7, velocity: 0, settled: false })));
    setSimulationState('ready');
    setSimulationProgress(0);
  };

  return {
    dots, setDots, simulationState, simulationProgress, isUploading,
    startIEF, startSDS, uploadFASTA, reset,
  };
}

// Only send what the backend actually needs
function serializeDot(dot) {
  const { name, fullName, organism, ID, mw, pH, color, sequence, display_name, Link, x, y, bandWidth } = dot;
  return { name, fullName, organism, ID, mw, pH, color, sequence, display_name, Link, x, y, bandWidth };
}
