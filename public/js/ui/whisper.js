import { state, $ } from '../state.js';

let timer = null;

/** Short line from the hero, shown for a few seconds (idle chatter, error hints). */
export function whisper(text) {
  const el = $('whisper');
  el.querySelector('b').textContent = `${state.streamer.hero.name}:`;
  el.querySelector('span').textContent = text;
  el.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => { el.hidden = true; }, 4200);
}
