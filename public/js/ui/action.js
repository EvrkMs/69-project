import { $ } from '../state.js';
import { holdTone, stopHold, sfx } from '../audio/sound.js';

// "Hold to confirm" button used by ["action", label, {hold}] steps: press and hold the round button (mouse, touch,
// or Space / Enter) until the ring fills. Releasing early drains the ring.
let cur = null;

export const isActionActive = () => !!cur;

export function showAction(label, hold, onDone) {
  const el = $('action');
  $('alabel').textContent = label;
  $('abtn').style.setProperty('--p', 0);
  el.hidden = false;
  cur = { hold, t: 0, held: false, last: performance.now(), onDone };
  requestAnimationFrame(tick);
}

function tick(now) {
  if (!cur) return;
  const dt = now - cur.last;
  cur.last = now;
  cur.t = cur.held ? cur.t + dt : Math.max(0, cur.t - dt * 1.5);
  $('abtn').style.setProperty('--p', Math.min(1, cur.t / cur.hold));
  holdTone(Math.min(1, cur.t / cur.hold), cur.held);
  if (cur.t >= cur.hold) {
    const done = cur.onDone;
    cur = null;
    stopHold(); sfx('announce');
    $('action').hidden = true;
    done();
    return;
  }
  requestAnimationFrame(tick);
}

/** Space / Enter held down or released (called from the keyboard handler). */
export function holdKey(down) { if (cur) cur.held = down; }

export function cancelAction() {
  cur = null;
  stopHold();
  $('action').hidden = true;
}

export function initAction() {
  const btn = $('abtn');
  const set = (v) => (e) => { if (cur) { cur.held = v; e.preventDefault(); } };
  btn.addEventListener('pointerdown', set(true));
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, set(false));
}
