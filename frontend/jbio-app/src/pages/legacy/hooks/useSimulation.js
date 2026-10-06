import { useRef, useState } from 'react';
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
  const runIdRef = useRef(0);
  const intervalRef = useRef(null);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  /** Plays back a pre-computed array of frame snapshots from the backend. */
  const playFrames = (frames, { onFrame, onComplete, interval = 20 }, runId) => {
    let step = 0;
    const id = setInterval(() => {
      if (runId !== runIdRef.current) {
        clearInterval(id);
        return;
      }
      if (step >= frames.length) {
        clearInterval(id);
        intervalRef.current = null;
        onComplete();
        return;
      }
      onFrame(frames[step], step, frames.length);
      step++;
    }, interval);
    intervalRef.current = id;
  };

  // ── Public actions ────────────────────────────────────────────────────────────

  const startIEF = ({ dots, phRange }) => {
    if (simulationState !== 'ready') return;
    const runId = ++runIdRef.current;
    setSimulationState('ief-running');
    setSimulationProgress(0);

    axios.post(`${API_URL}/2d/simulate-ief`, {
      proteins: dots.map(serializeDot),
      phRange, canvasWidth: CANVAS_WIDTH, canvasHeight: CANVAS_HEIGHT,
    })
      .then(({ data }) => {
        if (runId !== runIdRef.current) return;
        playFrames(data, {
        onFrame: (frame, step, total) => {
          setDots(frame);
          setSimulationProgress(step / (total - 1));
        },
        onComplete: () => setSimulationState('ief-complete'),
        }, runId);
      })
      .catch(() => {
        if (runId === runIdRef.current) setSimulationState('ready');
      });
  };

  const startSDS = ({ dots, yAxisMode, acrylamidePercentage }) => {
    if (simulationState !== 'ief-complete') return;
    const runId = ++runIdRef.current;
    setSimulationState('sds-running');

    axios.post(`${API_URL}/2d/simulate-sds`, {
      proteins: dots.map(serializeDot),
      yAxisMode, acrylamidePercentage, canvasHeight: CANVAS_HEIGHT,
    })
      .then(({ data }) => {
        if (runId !== runIdRef.current) return;
        playFrames(data, {
        onFrame: (frame) => setDots(frame),
        onComplete: () => setSimulationState('complete'),
        }, runId);
      })
      .catch(() => {
        if (runId === runIdRef.current) setSimulationState('ief-complete');
      });
  };

  const uploadFASTA = async (files) => {
    const runId = runIdRef.current;
    setIsUploading(true);
    const formData = new FormData();
    Array.from(files).forEach(f => formData.append('files', f));
    try {
      const { data } = await axios.post(`${API_URL}/2d/parse-fasta`, formData);
      if (runId === runIdRef.current) setDots(prev => [...prev, ...data]);
    } catch {
      alert('Error uploading FASTA file. Please ensure it is correctly formatted.');
    } finally {
      setIsUploading(false);
    }
  };

  const reset = () => {
    runIdRef.current += 1;
    if (intervalRef.current !== null) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setDots([]);
    setSimulationState('ready');
    setSimulationProgress(0);
    setIsUploading(false);
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
