import { state } from '../state.js';
import { proj } from './camera.js';

export const USE_RANGE = 1.9; // tiles; how close counts as "near" for the E prompt

// Clickable objects are everything except decorative props.
const clickable = () => state.world.objs.filter((o) => o.type !== 'prop');

function objBounds(o) {
  const xs = [], ys = [];
  const top = o.z + (o.sitAt || o.type === 'memento' ? 1 : 0); // desks carry a monitor, keepsakes float a glyph
  for (const [cx, cy] of [[o.x, o.y], [o.x + o.w, o.y], [o.x + o.w, o.y + o.h], [o.x, o.y + o.h]]) {
    for (const z of [0, top]) { const p = proj(cx, cy, z); xs.push(p.x); ys.push(p.y); }
  }
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
}

/** Topmost object under a screen point (null when the point is on bare floor). */
export function pickObject(sx, sy) {
  let best = null;
  for (const o of clickable()) {
    const b = objBounds(o);
    if (sx >= b.x0 && sx <= b.x1 && sy >= b.y0 && sy <= b.y1 && (!best || o.x + o.y + o.w + o.h > best.x + best.y + best.w + best.h)) best = o;
  }
  return best;
}

/** Closest object within `maxDist` tiles of the hero (for the E key and the prompt). */
export function nearestObject(maxDist) {
  const { hero } = state;
  let best = null, bd = maxDist;
  for (const o of clickable()) {
    const dx = Math.max(o.x - hero.x, 0, hero.x - (o.x + o.w));
    const dy = Math.max(o.y - hero.y, 0, hero.y - (o.y + o.h));
    const d = Math.hypot(dx, dy);
    if (d < bd) { bd = d; best = o; }
  }
  return best;
}
