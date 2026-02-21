import {
  LEFT_MARGIN, RIGHT_MARGIN,
  SDS_TOP_MARGIN, SDS_BOTTOM_MARGIN,
  TOP_MARGIN_IEF, IEF_BAND_HEIGHT,
  PH_GRADIENT_Y, PH_GRADIENT_HEIGHT,
  LOADING_ZONE_X, LOADING_ZONE_Y, LOADING_ZONE_SIZE,
  CANVAS_WIDTH, CANVAS_HEIGHT,
  DOT_RADIUS, DOT_HOVER_RADIUS, PULSE_RADIUS, BAND_HEIGHT,
  HIGHLIGHT_STROKE, HIGHLIGHT_LINEWIDTH, PULSE_STROKE,
  CANVAS_BG_COLOR, LOADING_ZONE_COLOR, GRID_STROKE,
  ACID_COLOR, NEUTRAL_COLOR, BASIC_COLOR,
  PROGRESS_BG, PROGRESS_FILL,
  PROGRESS_Y_OFFSET, PROGRESS_HEIGHT,
  MAIN_FONT, SMALL_FONT, FONT_COLOR,
  MAX_DISTANCE_TRAVELED,
} from '../constants/canvas';
import { computeSDSPosition } from '../utils/coordinates';

export function drawBackground(ctx) {
  ctx.fillStyle = CANVAS_BG_COLOR;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
}

export function drawLoadingZone(ctx) {
  ctx.fillStyle = LOADING_ZONE_COLOR;
  ctx.fillRect(LOADING_ZONE_X, LOADING_ZONE_Y, LOADING_ZONE_SIZE, LOADING_ZONE_SIZE);
  ctx.font = SMALL_FONT;
  ctx.fillStyle = '#565870';
  ctx.fillText('LOAD', LOADING_ZONE_X + 4, LOADING_ZONE_Y - 6);
}

export function drawLoadingSpinner(ctx, label = 'RUNNING SECOND DIMENSION') {
  const cx = CANVAS_WIDTH / 2;
  const cy = CANVAS_HEIGHT / 2;
  const rot = (Date.now() % 2000) / 2000 * Math.PI * 2;
  ctx.strokeStyle = '#00d4aa';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(cx, cy, 28, rot, rot + Math.PI * 1.5);
  ctx.stroke();
  ctx.fillStyle = '#c8cce0';
  ctx.font = '14px "DM Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy + 52);
  ctx.font = '11px "DM Mono", monospace';
  ctx.fillStyle = '#565870';
  ctx.fillText('computing protein positions...', cx, cy + 72);
  ctx.textAlign = 'left';
}

export function drawIEFBandAndGradient(ctx, MIN_PH, MAX_PH) {
  ctx.fillStyle = '#16182a';
  ctx.fillRect(LEFT_MARGIN, TOP_MARGIN_IEF, CANVAS_WIDTH - LEFT_MARGIN - RIGHT_MARGIN, IEF_BAND_HEIGHT);

  const gradient = ctx.createLinearGradient(LEFT_MARGIN, 0, CANVAS_WIDTH - RIGHT_MARGIN, 0);
  gradient.addColorStop(0, ACID_COLOR);
  gradient.addColorStop(0.5, NEUTRAL_COLOR);
  gradient.addColorStop(1, BASIC_COLOR);
  ctx.fillStyle = gradient;
  ctx.fillRect(LEFT_MARGIN, PH_GRADIENT_Y, CANVAS_WIDTH - LEFT_MARGIN - RIGHT_MARGIN, PH_GRADIENT_HEIGHT);

  ctx.fillStyle = '#565870';
  ctx.font = SMALL_FONT;
  ctx.fillText(`pH ${MIN_PH.toFixed(1)}`, LEFT_MARGIN, PH_GRADIENT_Y - 6);
  ctx.fillText(`pH ${MAX_PH.toFixed(1)}`, CANVAS_WIDTH - RIGHT_MARGIN - 32, PH_GRADIENT_Y - 6);
}

export function drawSDSBackground(ctx) {
  ctx.fillStyle = '#0d0e18';
  ctx.fillRect(
    LEFT_MARGIN, SDS_TOP_MARGIN,
    CANVAS_WIDTH - LEFT_MARGIN - RIGHT_MARGIN,
    CANVAS_HEIGHT - SDS_TOP_MARGIN - SDS_BOTTOM_MARGIN
  );
}

export function drawGrid(ctx, { zoom, offsetX, offsetY, yAxisMode, minMW, maxMW, MIN_PH, MAX_PH }) {
  ctx.strokeStyle = GRID_STROKE;
  ctx.fillStyle = FONT_COLOR; 
  ctx.font = MAIN_FONT;

  const usableHeight = CANVAS_HEIGHT - SDS_TOP_MARGIN - SDS_BOTTOM_MARGIN;
  const centerY      = CANVAS_HEIGHT / 2;

  // ── Y axis ──
  if (yAxisMode === 'mw') {
    const mwRange    = maxMW - minMW;
    const pixelPerMW = (usableHeight / mwRange) * zoom;
    const mag        = Math.pow(10, Math.floor(Math.log10(50 / pixelPerMW)));
    const stepMW     = Math.ceil((50 / pixelPerMW) / mag) * mag;

    for (let mw = Math.floor((minMW - stepMW * 3) / stepMW) * stepMW; mw <= maxMW + stepMW * 3; mw += stepMW) {
      const t     = (mw - minMW) / (maxMW - minMW);
      const baseY = SDS_TOP_MARGIN + (1 - t) * usableHeight;
      const y     = (baseY - centerY) * zoom + centerY + offsetY;
      if (y < SDS_TOP_MARGIN || y > CANVAS_HEIGHT - SDS_BOTTOM_MARGIN) continue;

      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(LEFT_MARGIN, y); ctx.lineTo(CANVAS_WIDTH - RIGHT_MARGIN, y); ctx.stroke();

      if (mw >= 1000) {
        ctx.fillText(`${(mw)}`, 4, y + 4);
      } else {
        ctx.fillText(`${Math.round(mw)}`, 4, y + 4);
      }
    }
  } else {
    const pixelPerUnit = (usableHeight / MAX_DISTANCE_TRAVELED) * zoom;
    const mag          = Math.pow(10, Math.floor(Math.log10(50 / pixelPerUnit)));
    const stepUnit     = Math.ceil((50 / pixelPerUnit) / mag) * mag;

    for (let i = 0; i <= MAX_DISTANCE_TRAVELED; i += stepUnit) {
      const baseY = SDS_TOP_MARGIN + (i / MAX_DISTANCE_TRAVELED) * usableHeight;
      const y     = (baseY - centerY) * zoom + centerY + offsetY;
      if (y < SDS_TOP_MARGIN || y > CANVAS_HEIGHT - SDS_BOTTOM_MARGIN) continue;

      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(LEFT_MARGIN, y); ctx.lineTo(CANVAS_WIDTH - RIGHT_MARGIN, y); ctx.stroke();
      ctx.fillText(`${Math.round(i)}cm`, 4, y + 4);
    }
  }

  // ── pH / pI vertical lines ──
  const usableWidth  = CANVAS_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
  const pixelsPerPH  = (usableWidth / (MAX_PH - MIN_PH)) * zoom;
  const visibleMinPH = MIN_PH - (offsetX - LEFT_MARGIN) / pixelsPerPH;
  const visibleMaxPH = visibleMinPH + usableWidth / pixelsPerPH;
  const phMag        = Math.pow(10, Math.floor(Math.log10(100 / pixelsPerPH)));
  const stepPH       = ([1, 2, 5, 7.5, 10].find(s => s * phMag >= 100 / pixelsPerPH) || 10) * phMag;

  for (let pH = Math.floor(visibleMinPH / stepPH) * stepPH; pH <= visibleMaxPH; pH += stepPH) {
    const x = LEFT_MARGIN + (pH - visibleMinPH) * pixelsPerPH;
    if (x < LEFT_MARGIN || x > CANVAS_WIDTH - RIGHT_MARGIN) continue;

    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(x, SDS_TOP_MARGIN); ctx.lineTo(x, CANVAS_HEIGHT - SDS_BOTTOM_MARGIN); ctx.stroke();
    ctx.fillText(pH.toFixed(1), x - 8, CANVAS_HEIGHT - 32);
  }
}

export function drawAxisLabels(ctx, yAxisMode) {
  ctx.fillStyle = FONT_COLOR;
  ctx.font = '10px "DM Mono", monospace';
  ctx.textAlign = 'center';
  ctx.fillText('pI', CANVAS_WIDTH / 2, CANVAS_HEIGHT - 12);
  ctx.save();
  ctx.translate(12, CANVAS_HEIGHT / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText(yAxisMode === 'mw' ? 'MW (Da)' : 'Distance (cm)', 0, 0);
  ctx.restore();
  ctx.textAlign = 'left';
}

export function drawProgressBar(ctx, progress) {
  const barWidth = CANVAS_WIDTH - LEFT_MARGIN - RIGHT_MARGIN;
  ctx.fillStyle = PROGRESS_BG;
  ctx.fillRect(LEFT_MARGIN, CANVAS_HEIGHT - PROGRESS_Y_OFFSET, barWidth, PROGRESS_HEIGHT);
  ctx.fillStyle = PROGRESS_FILL;
  ctx.fillRect(LEFT_MARGIN, CANVAS_HEIGHT - PROGRESS_Y_OFFSET, barWidth * progress, PROGRESS_HEIGHT);
}

// ─── Per-dot drawers ──────────────────────────────────────────────────────────

export function drawDotReady(ctx, dot, isHighlighted, isHovered, zoom, offset) {
  if (!dot) return;
  const screenX = dot.x * zoom + offset.x;
  const screenY = dot.y * zoom + offset.y;

  ctx.beginPath();
  ctx.arc(screenX, screenY, DOT_RADIUS * zoom, 0, Math.PI * 2);
  ctx.fill();

  if (isHighlighted) {
    ctx.strokeStyle = HIGHLIGHT_STROKE; ctx.lineWidth = HIGHLIGHT_LINEWIDTH; ctx.stroke();
    ctx.beginPath(); ctx.arc(screenX, screenY, PULSE_RADIUS * zoom, 0, Math.PI * 2);
    ctx.strokeStyle = PULSE_STROKE; ctx.stroke();
  } else if (isHovered) {
    ctx.strokeStyle = HIGHLIGHT_STROKE; ctx.lineWidth = 1; ctx.stroke();
  }
}

export function drawDotIEF(ctx, dot, isHighlighted, isHovered) {
  if (dot.condensing) {
    ctx.beginPath(); ctx.arc(dot.x, dot.y, DOT_RADIUS, 0, Math.PI * 2); ctx.fill();
    if (isHighlighted) { ctx.strokeStyle = HIGHLIGHT_STROKE; ctx.lineWidth = HIGHLIGHT_LINEWIDTH; ctx.stroke(); }
  } else {
    ctx.fillRect(dot.x - dot.bandWidth / 2, dot.y - BAND_HEIGHT / 2, dot.bandWidth, BAND_HEIGHT);
    if (isHighlighted || isHovered) {
      ctx.strokeStyle = HIGHLIGHT_STROKE;
      ctx.lineWidth = isHighlighted ? HIGHLIGHT_LINEWIDTH : 1;
      ctx.strokeRect(dot.x - dot.bandWidth / 2, dot.y - BAND_HEIGHT / 2, dot.bandWidth, BAND_HEIGHT);
      if (isHighlighted) {
        ctx.strokeStyle = PULSE_STROKE; ctx.lineWidth = 1;
        ctx.strokeRect(dot.x - dot.bandWidth / 2 - 3, dot.y - BAND_HEIGHT / 2 - 3, dot.bandWidth + 6, BAND_HEIGHT + 6);
      }
    }
  }
}

export function drawDotSDS(ctx, dot, isHighlighted, isHovered, sdsContext) {
  const pos = computeSDSPosition(dot, sdsContext);
  if (!pos.withinX || !pos.withinY) return;

  ctx.beginPath();
  ctx.arc(pos.x, pos.y, (isHighlighted || isHovered) ? DOT_HOVER_RADIUS : DOT_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = dot.color;
  ctx.fill();

  if (isHighlighted || isHovered) {
    ctx.strokeStyle = HIGHLIGHT_STROKE;
    ctx.lineWidth = isHighlighted ? HIGHLIGHT_LINEWIDTH : 1;
    ctx.stroke();
    if (isHighlighted) {
      ctx.beginPath(); ctx.arc(pos.x, pos.y, PULSE_RADIUS, 0, Math.PI * 2);
      ctx.strokeStyle = PULSE_STROKE; ctx.stroke();
    }
  }
}
