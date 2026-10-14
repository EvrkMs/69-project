import { state, $ } from '../state.js';

/** Escapes text that goes into overlay HTML (content is authored, but never trust a string in innerHTML). */
export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Shows a full-screen menu; `wire(el)` attaches the button handlers. Input is locked while it is open. */
export function overlay(html, wire) {
  const el = $('overlay');
  el.innerHTML = html;
  el.hidden = false;
  state.locked = true;
  wire?.(el);
}

export function closeOverlay() {
  $('overlay').hidden = true;
  state.locked = false;
  state.idleAt = performance.now();
}
