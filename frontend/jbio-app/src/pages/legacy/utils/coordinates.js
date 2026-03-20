import {
  LEFT_MARGIN, RIGHT_MARGIN,
  SDS_TOP_MARGIN, SDS_BOTTOM_MARGIN,
  CANVAS_WIDTH, CANVAS_HEIGHT,
} from '../constants/canvas';

/**
 * Maps a dot's pH and MW to its pixel position in the SDS view.
 * Used by both the canvas renderer and mouse hit detection — keeping
 * them in sync is the whole point of this function existing.
 */
export function computeSDSPosition(dot, { zoom, offset, minMW, maxMW, MIN_PH, MAX_PH }) {
  const usableWidth  = CANVAS_WIDTH  - LEFT_MARGIN - RIGHT_MARGIN;
  const usableHeight = CANVAS_HEIGHT - SDS_TOP_MARGIN - SDS_BOTTOM_MARGIN;
  const centerY      = CANVAS_HEIGHT / 2;

  // X axis (pH → pI)
  const pixelsPerPH  = (usableWidth / (MAX_PH - MIN_PH)) * zoom;
  const visibleMinPH = MIN_PH - (offset.x - LEFT_MARGIN) / pixelsPerPH;
  const x            = LEFT_MARGIN + (dot.pH - visibleMinPH) * pixelsPerPH;

  // Y axis (MW)
  const mwRange      = maxMW - minMW;
  const baseY        = SDS_TOP_MARGIN + (1 - (dot.mw - minMW) / mwRange) * usableHeight;
  const y            = (baseY - centerY) * zoom + centerY + offset.y;

  const withinX = x >= LEFT_MARGIN && x <= CANVAS_WIDTH  - RIGHT_MARGIN;
  const withinY = y >= SDS_TOP_MARGIN && y <= CANVAS_HEIGHT - SDS_BOTTOM_MARGIN;

  return { x, y, withinX, withinY };
}

/**
 * Checks if a mouse position hits a dot, handling all three simulation states.
 */
export function hitTestDot(dot, mouseX, mouseY, {
  simulationState, zoom, offset,
  minMW, maxMW, MIN_PH, MAX_PH,
  DOT_RADIUS, DOT_HOVER_RADIUS, BAND_HEIGHT,
}) {
  if (simulationState === 'ready') {
    const screenX = dot.x * zoom + offset.x;
    const screenY = dot.y * zoom + offset.y;
    return Math.hypot(mouseX - screenX, mouseY - screenY) <= DOT_RADIUS * zoom + 4;
  }

  if (simulationState === 'ief-running' || simulationState === 'ief-complete') {
    if (dot.condensing) {
      return Math.hypot(mouseX - dot.x, mouseY - dot.y) <= DOT_RADIUS + 4;
    }
    const half = dot.bandWidth / 2;
    return (
      mouseX >= dot.x - half - 4 && mouseX <= dot.x + half + 4 &&
      mouseY >= dot.y - BAND_HEIGHT / 2 - 4 && mouseY <= dot.y + BAND_HEIGHT / 2 + 4
    );
  }

  if (['sds-running', 'complete'].includes(simulationState)) {
    const { x, y, withinX, withinY } = computeSDSPosition(dot, { zoom, offset, minMW, maxMW, MIN_PH, MAX_PH });
    if (!withinX || !withinY) return false;
    return Math.hypot(mouseX - x, mouseY - y) <= DOT_HOVER_RADIUS * zoom + 4;
  }

  return false;
}
