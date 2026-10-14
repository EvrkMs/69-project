import { state, $ } from '../state.js';
import { proj, HU } from '../engine/camera.js';

// Speech bubbles: lines of dialogue and idle chatter float above whoever is speaking instead of sitting in a window at the
// bottom of the screen (where thumbs cover them on a phone). The bubbles are ordinary DOM elements, moved every frame to the
// speaker's head; they stay inside the screen and flip below the speaker when there is no room above.

const MARGIN = 8;
const HEAD_PX = 80; // feet to the top of a person's head at zoom 1

/** The object whose head the current line belongs to: the hero, the NPC with that name, or whatever was clicked. */
export function speakerFor(step, spoken) {
  if (step.who === 'hero') return state.hero;
  if (step.who === 'npc') {
    return state.world.objs.find((o) => o.type === 'npc' && o.name === step.name) || (spoken && spoken.type === 'npc' ? spoken : null) || spoken || state.hero;
  }
  return state.hero;
}

function anchorOf(who) {
  const Z = state.Z;
  if (who === state.hero) return { ...proj(who.x, who.y, 0), head: (who.seated ? HEAD_PX - 10 : HEAD_PX) * Z };
  const p = proj(who.x + (who.w || 0) / 2, who.y + (who.h || 0) / 2, 0);
  return { ...p, head: (who.type === 'npc' ? HEAD_PX : (who.z || 1) * HU + 10) * Z };
}

function place(el, who) {
  const a = anchorOf(who);
  const w = el.offsetWidth, h = el.offsetHeight;
  const top = matchMedia('(max-width: 600px), (pointer: coarse), (max-height: 500px)').matches ? 52 : MARGIN; // clear of the corner buttons
  let x = Math.max(MARGIN, Math.min(state.W - w - MARGIN, a.x - w / 2));
  let y = a.y - a.head - h - 12;
  const below = y < top;
  if (below) y = a.y + 12;
  y = Math.max(top, Math.min(state.H - h - MARGIN, y));
  el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
  el.style.setProperty('--tx', `${Math.max(18, Math.min(w - 18, a.x - x))}px`);
  el.classList.toggle('below', below);
}

/** Call once per frame, after the camera has moved. */
export function positionBubbles() {
  const dlg = $('dialog');
  if (!dlg.hidden && state.dlg && state.dlg.speaker) place(dlg, state.dlg.speaker);
  const w = $('whisper');
  if (!w.hidden) place(w, state.hero);
}
