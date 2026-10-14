import { state, $ } from '../state.js';
import { proj, HU } from './camera.js';

export const canvas = $('c');
export const ctx = canvas.getContext('2d');

export function resize() {
  const dpr = window.devicePixelRatio || 1;
  state.W = innerWidth; state.H = innerHeight;
  canvas.width = state.W * dpr; canvas.height = state.H * dpr;
  canvas.style.width = state.W + 'px'; canvas.style.height = state.H + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  state.baseZ = Math.max(0.6, Math.min(1.25, state.W / 1150));
  state.Z = state.baseZ * state.zoomNow;
}

/** Lightens (f > 0) or darkens (f < 0) a #rrggbb color. */
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return f >= 0
    ? `rgb(${c(r + (255 - r) * f)},${c(g + (255 - g) * f)},${c(b + (255 - b) * f)})`
    : `rgb(${c(r * (1 + f))},${c(g * (1 + f))},${c(b * (1 + f))})`;
}

/** Like shade() but returns #rrggbb, so the result can be shaded again (drawPrism needs a hex color). */
export function shadeHex(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const mix = f >= 0 ? (v) => v + (255 - v) * f : (v) => v * (1 + f);
  return `#${[mix(r), mix(g), mix(b)].map((v) => c(v).toString(16).padStart(2, '0')).join('')}`;
}

export function poly(pts, fill, stroke) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
}

/** Box between two heights; three visible faces shaded like a lit cube. */
export function drawPrism(x, y, w, h, zb, zt, color) {
  poly([proj(x, y, zt), proj(x + w, y, zt), proj(x + w, y + h, zt), proj(x, y + h, zt)], shade(color, 0.22), 'rgba(0,0,0,.25)');
  poly([proj(x, y + h, zt), proj(x + w, y + h, zt), proj(x + w, y + h, zb), proj(x, y + h, zb)], color, 'rgba(0,0,0,.25)');
  poly([proj(x + w, y, zt), proj(x + w, y + h, zt), proj(x + w, y + h, zb), proj(x + w, y, zb)], shade(color, -0.25), 'rgba(0,0,0,.25)');
}

/** Maps a local (wc x hc) pixel space onto the plane spanned by two projected top corners and a height in px. */
function onPlane(p0, p1, hPx, wc, hc, fn) {
  ctx.save();
  ctx.transform((p1.x - p0.x) / wc, (p1.y - p0.y) / wc, 0, hPx / hc, p0.x, p0.y);
  fn();
  ctx.restore();
}
/** Draw into a plane of constant y (back wall, monitor face); local x runs along world x. */
export const onPlaneY = (xL, xR, y, zTop, zBot, wc, hc, fn) => onPlane(proj(xL, y, zTop), proj(xR, y, zTop), (zTop - zBot) * HU * state.Z, wc, hc, fn);
/** Draw into a plane of constant x (left wall); local x runs along world y. */
export const onPlaneX = (x, yL, yR, zTop, zBot, wc, hc, fn) => onPlane(proj(x, yL, zTop), proj(x, yR, zTop), (zTop - zBot) * HU * state.Z, wc, hc, fn);
