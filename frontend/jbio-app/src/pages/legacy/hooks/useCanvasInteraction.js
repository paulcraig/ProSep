import { useState, useEffect } from 'react';
import { hitTestDot } from '../utils/coordinates';
import {
  DOT_RADIUS, DOT_HOVER_RADIUS, BAND_HEIGHT,
  CANVAS_WIDTH, CANVAS_HEIGHT,
} from '../constants/canvas';

/**
 * Handles all mouse interactions with the canvas:
 * - hover detection
 * - click to select
 * - click outside to deselect
 */
export function useCanvasInteraction({
  canvasRef, zoomRef, offsetRef,
  dots, simulationState,
  minMW, maxMW, phRange,
}) {
  const [selectedDot, setSelectedDot] = useState(null);
  const [hoveredDot,  setHoveredDot]  = useState(null);
  const [mousePos,    setMousePos]    = useState({ x: 0, y: 0 });

  const MIN_PH = phRange.min;
  const MAX_PH = phRange.max;

  const hitCtx = () => ({
    simulationState,
    zoom:   zoomRef.current,
    offset: offsetRef.current,
    minMW, maxMW, MIN_PH, MAX_PH,
    DOT_RADIUS, DOT_HOVER_RADIUS, BAND_HEIGHT,
  });

  const toCanvasCoords = (event) => {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) * (CANVAS_WIDTH  / rect.width),
      y: (event.clientY - rect.top)  * (CANVAS_HEIGHT / rect.height),
    };
  };

  const handleCanvasClick = (event) => {
    const { x, y } = toCanvasCoords(event);
    setMousePos({ x: event.clientX, y: event.clientY });
    const hit = dots.find(dot => hitTestDot(dot, x, y, hitCtx()));
    if (hit) { setSelectedDot(hit); setHoveredDot(hit); }
    else      { setHoveredDot(null); }
  };

  const handleCanvasMouseMove = (event) => {
    const { x, y } = toCanvasCoords(event);
    setMousePos({ x: event.clientX, y: event.clientY });
    const hovered = dots.find(dot => hitTestDot(dot, x, y, hitCtx())) || null;
    setHoveredDot(hovered);
  };

  const handleCanvasMouseLeave = () => {
    if (!selectedDot) setHoveredDot(null);
  };

  // Click outside canvas/card/list → deselect
  useEffect(() => {
    const handleDocumentClick = (event) => {
      const canvas     = canvasRef.current;
      const infoCard   = document.getElementById('protein-info-card');
      const proteinList = document.getElementById('protein-list');
      if (
        selectedDot &&
        !canvas?.contains(event.target) &&
        !infoCard?.contains(event.target) &&
        !proteinList?.contains(event.target)
      ) {
        setSelectedDot(null);
      }
    };
    document.addEventListener('click', handleDocumentClick);
    return () => document.removeEventListener('click', handleDocumentClick);
  }, [selectedDot]);

  // Click from protein list panel
  const selectFromList = (dot) => {
    setSelectedDot(dot);
    setHoveredDot(null);
    const list = document.querySelector('#protein-list');
    if (list) {
      const rect = list.getBoundingClientRect();
      setMousePos({ x: rect.right + 10, y: rect.top + 100 });
    }
    canvasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  return {
    selectedDot, setSelectedDot,
    hoveredDot,
    mousePos,
    handleCanvasClick,
    handleCanvasMouseMove,
    handleCanvasMouseLeave,
    selectFromList,
  };
}
