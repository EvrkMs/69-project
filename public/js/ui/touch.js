import { state, $ } from '../state.js';
import { nearestObject, USE_RANGE } from '../engine/picking.js';
import { goInteract } from '../game/navigation.js';

// On-screen controls for touch devices: a round analog stick (walks like WASD) and an action button (same as E).
// Tapping the floor or an object already works through ordinary click events. Add ?touch=1 to the URL to test on a desktop.
const enabled = matchMedia('(pointer: coarse)').matches || location.search.includes('touch=1');

export function initTouch() {
  if (!enabled) return;
  initStick();
  $('ebtn').addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const o = nearestObject(USE_RANGE);
    if (o && !state.dlg && !state.locked) goInteract(o);
  });
}

const RADIUS = 52;   // how far the knob travels from the centre, px
const DEAD = 0.25;   // fraction of the radius where the stick does nothing

function initStick() {
  const base = $('stick'), knob = $('knob');
  let id = null;
  const move = (e) => {
    const r = base.getBoundingClientRect();
    let x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
    const len = Math.hypot(x, y);
    if (len > RADIUS) { x = x / len * RADIUS; y = y / len * RADIUS; }
    knob.style.transform = `translate(${x}px, ${y}px)`;
    state.stick = Math.hypot(x, y) > DEAD * RADIUS ? { x: x / RADIUS, y: y / RADIUS } : null; // screen directions, y grows downwards
    state.idleAt = performance.now();
  };
  const release = () => { id = null; state.stick = null; knob.style.transform = ''; };
  base.addEventListener('pointerdown', (e) => { e.preventDefault(); id = e.pointerId; base.setPointerCapture(id); move(e); });
  base.addEventListener('pointermove', (e) => { if (e.pointerId === id) move(e); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) base.addEventListener(ev, (e) => { if (e.pointerId === id) release(); });
}

/** Shows the controls only while the hero can actually move (no menu, no dialogue). */
export function updateTouch() {
  $('touch').hidden = !enabled || state.locked || !!state.dlg;
}
