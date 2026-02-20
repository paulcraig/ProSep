import { useEffect } from 'react';
import {
  drawBackground, drawLoadingZone, drawLoadingSpinner,
  drawIEFBandAndGradient, drawSDSBackground,
  drawGrid, drawAxisLabels, drawProgressBar,
  drawDotReady, drawDotIEF, drawDotSDS,
} from '../utils/draw';

/**
 * Owns the requestAnimationFrame loop and all canvas rendering.
 * The parent component just passes state; this hook handles drawing.
 */
export function useCanvasRenderer({
  canvasRef, zoomRef, offsetRef,
  dots, selectedDot, hoveredDot,
  simulationState, simulationProgress,
  phRange, yAxisMode, minMW, maxMW,
}) {
  const MIN_PH = phRange.min;
  const MAX_PH = phRange.max;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    // Attach panning listeners once
    const onMouseDown = e => { /* handled in usePan */ };
    canvas.addEventListener('mousedown', onMouseDown);

    let animId;

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBackground(ctx);

      // Loading spinner replaces everything during SDS computation
      if (simulationState === 'sds-running') {
        drawLoadingSpinner(ctx);
        animId = requestAnimationFrame(draw);
        return;
      }

      ctx.textAlign = 'left';

      if (simulationState === 'ready') {
        drawLoadingZone(ctx);
      }

      if (simulationState !== 'ready') {
        drawIEFBandAndGradient(ctx, MIN_PH, MAX_PH);
      }

      if (['ief-complete', 'sds-running', 'complete'].includes(simulationState)) {
        drawSDSBackground(ctx);
      }

      if (['sds-running', 'complete'].includes(simulationState)) {
        drawGrid(ctx, {
          zoom: zoomRef.current,
          offsetX: offsetRef.current.x,
          offsetY: offsetRef.current.y,
          yAxisMode, minMW, maxMW, MIN_PH, MAX_PH,
        });
        drawAxisLabels(ctx, yAxisMode);
      }

      if (simulationState === 'ief-running') {
        drawProgressBar(ctx, simulationProgress);
      }

      // Build shared SDS context once per frame (avoids per-dot reconstruction)
      const sdsContext = {
        zoom: zoomRef.current,
        offset: offsetRef.current,
        minMW, maxMW, MIN_PH, MAX_PH,
      };

      dots.forEach(dot => {
        const isHighlighted = dot === selectedDot;
        const isHovered     = dot === hoveredDot;
        ctx.fillStyle = dot.color;

        if (simulationState === 'ready') {
          drawDotReady(ctx, dot, isHighlighted, isHovered, zoomRef.current, offsetRef.current);
        } else if (simulationState === 'ief-running' || simulationState === 'ief-complete') {
          drawDotIEF(ctx, dot, isHighlighted, isHovered);
        } else {
          drawDotSDS(ctx, dot, isHighlighted, isHovered, sdsContext);
        }
      });

      animId = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      cancelAnimationFrame(animId);
      canvas.removeEventListener('mousedown', onMouseDown);
    };
  }, [dots, hoveredDot, selectedDot, simulationState, simulationProgress, phRange, yAxisMode, minMW, maxMW]);
}
