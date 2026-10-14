import { state, $ } from '../state.js';
import { nearestObject, USE_RANGE } from '../engine/picking.js';
import { goInteract } from '../game/navigation.js';

// On-screen controls for touch devices: a d-pad (same keys as WASD) and an action button (same as E).
// Tapping the floor or an object already works through ordinary click events. Add ?touch=1 to the URL to test on a desktop.
const enabled = matchMedia('(pointer: coarse)').matches || location.search.includes('touch=1');

export function initTouch() {
  if (!enabled) return;
  for (const b of document.querySelectorAll('#dpad button')) {
    const key = b.dataset.k;
    const set = (down) => (e) => { e.preventDefault(); if (down) state.keys.add(key); else state.keys.delete(key); state.idleAt = performance.now(); };
    b.addEventListener('pointerdown', set(true));
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, set(false));
  }
  $('ebtn').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const o = nearestObject(USE_RANGE);
    if (o && !state.dlg && !state.locked) goInteract(o);
  });
}

/** Shows the controls only while the hero can actually move (no menu, no dialogue). */
export function updateTouch() {
  $('touch').hidden = !enabled || state.locked || !!state.dlg;
}
