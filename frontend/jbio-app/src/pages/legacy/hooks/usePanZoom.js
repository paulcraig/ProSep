import { useRef, useState } from 'react';
import { MIN_ZOOM, MAX_ZOOM } from '../constants/canvas';

/**
 * Manages zoom state and canvas panning via mousedown/mousemove.
 * Returns zoomRef (for use inside rAF loops) and setZoomSafe.
 */
export function usePanZoom(canvasRef) {
  const [zoom, setZoom]  = useState(1);
  const zoomRef          = useRef(1);
  const offsetRef        = useRef({ x: 0, y: 0 });
  const isPanning        = useRef(false);
  const panStart         = useRef({ x: 0, y: 0 });

  const setZoomSafe = (newZoom) => {
    const clamped   = Math.max(MIN_ZOOM, Math.min(newZoom, MAX_ZOOM));
    zoomRef.current = clamped;
    setZoom(clamped);
  };

  const resetPanZoom = () => {
    setZoomSafe(1);
    offsetRef.current = { x: 0, y: 0 };
  };

  // Attach listeners imperatively so they run inside rAF without stale closures
  const attachPanListeners = (canvas) => {
    const onMouseDown = e => { isPanning.current = true; panStart.current = { x: e.clientX, y: e.clientY }; };
    const onMouseUp   = ()  => { isPanning.current = false; };
    const onMouseMove = e => {
      if (!isPanning.current) return;
      offsetRef.current.x += e.clientX - panStart.current.x;
      offsetRef.current.y += e.clientY - panStart.current.y;
      panStart.current = { x: e.clientX, y: e.clientY };
    };
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup',   onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    return () => {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup',   onMouseUp);
      canvas.removeEventListener('mousemove', onMouseMove);
    };
  };

  return { zoom, zoomRef, offsetRef, setZoomSafe, resetPanZoom, attachPanListeners };
}
