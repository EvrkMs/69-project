import { state } from '../state.js';
import { canvas } from './gfx.js';
import { unproj } from './camera.js';
import { pickObject, nearestObject, USE_RANGE } from './picking.js';
import { advance } from '../ui/dialog.js';
import { isActionActive, holdKey } from '../ui/action.js';
import { walkTo, goInteract } from '../game/navigation.js';

const MOVE_KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright']);

export function initInput() {
  canvas.addEventListener('mousemove', (e) => { state.mouse = { x: e.clientX, y: e.clientY }; });
  canvas.addEventListener('mouseleave', () => { state.mouse = { x: -1, y: -1 }; });

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
