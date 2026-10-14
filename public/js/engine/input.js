import { state } from '../state.js';
import { canvas } from './gfx.js';
import { unproj } from './camera.js';
import { pickObject, nearestObject, USE_RANGE } from './picking.js';
import { advance } from '../ui/dialog.js';
import { isActionActive, holdKey } from '../ui/action.js';
import { walkTo, goInteract } from '../game/navigation.js';

const ZOOM_MIN = 0.4, ZOOM_MAX = 1.9;
const zoomBy = (f) => { state.zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.zoom * f)); };

const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright']);

export function initInput() {
  canvas.addEventListener('mousemove', (e) => { state.mouse = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('mouseleave', () => { state.mouse = { x: -1, y: -1 }; });

  // Mouse wheel zooms the camera, like in most games; two fingers pinch on touch screens.
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); zoomBy(Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
  const touches = new Map();
  let pinch = 0;
  canvas.addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') { touches.set(e.pointerId, e); pinch = 0; } });
  canvas.addEventListener('pointermove', (e) => {
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, e);
    if (touches.size !== 2) return;
    const [a, b] = [...touches.values()];
    const d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
    if (pinch) zoomBy(d / pinch);
    pinch = d;
  });
  for (const ev of ['pointerup', 'pointercancel']) canvas.addEventListener(ev, (e) => { touches.delete(e.pointerId); pinch = 0; });

  canvas.addEventListener('click', (e) => {
    if (state.locked) return;
    state.idleAt = performance.now();
    if (state.dlg) return advance();
    const o = pickObject(e.clientX, e.clientY);
    if (o) return goInteract(o);
    const p = unproj(e.clientX, e.clientY);
    const i = Math.floor(p.x), j = Math.floor(p.y);
    state.pending = null;
    if (walkTo(i, j)) state.pings.push({ x: i + 0.5, y: j + 0.5, t: 0 });
  });

  addEventListener('keydown', (e) => {
    if (state.locked) return;
    const k = e.key.toLowerCase();
    if (e.key === ' ' || e.key === 'Enter') {
      if (isActionActive()) { holdKey(true); e.preventDefault(); } // hold to confirm
      else if (state.dlg && !e.repeat) { advance(); e.preventDefault(); }
      return;
    }
    if (MOVE_KEYS.has(k)) { state.keys.add(k); state.idleAt = performance.now(); e.preventDefault(); }
    if (k === 'e' && !state.dlg) { const o = nearestObject(USE_RANGE); if (o) goInteract(o); }
  });
  addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') holdKey(false);
    state.keys.delete(e.key.toLowerCase());
  });
}
