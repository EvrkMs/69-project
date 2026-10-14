import { state } from '../state.js';
import { proj } from './camera.js';
import { ctx, shade } from './gfx.js';

/**
 * People are drawn from primitives. `headset` is a color (or null for no headset); everything else is plain look data
 * (streamer.json hero.look for the hero, npc definitions for NPCs). Returns the head anchor for markers.
 */
export function drawFigure(x, y, { body = '#7b4dff', hair = '#2b1d14', skin = '#f1c9a5', headset = null, face = 1, moving = false, t = 0, seated = false, typing = false, now = 0 } = {}) {
  const p = proj(x, y, 0);
  const s = state.Z;
  const bob = moving ? Math.abs(Math.sin(t)) * 4 * s : Math.sin(performance.now() / 500) * 1.2 * s;
  ctx.fillStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.ellipse(p.x, p.y, 15 * s, 7 * s, 0, 0, Math.PI * 2); ctx.fill();

  let by;
  if (seated) {
    // thighs forward (towards the desk), shins down, body lowered onto the seat
    ctx.fillStyle = '#2a2f55';
    ctx.fillRect(p.x, p.y - 22 * s, face * 18 * s, 7 * s); // negative width draws leftwards
    ctx.fillRect(p.x + face * 14 * s - (face < 0 ? 6 * s : 0), p.y - 22 * s, 6 * s, 20 * s);
    by = p.y - 50 * s;
  } else {
    const sw = moving ? Math.sin(t) * 5 * s : 0;
    ctx.fillStyle = '#2a2f55';
    ctx.fillRect(p.x - 8 * s + sw, p.y - 16 * s, 6 * s, 16 * s);
    ctx.fillRect(p.x + 2 * s - sw, p.y - 16 * s, 6 * s, 16 * s);
    by = p.y - 44 * s - bob;
  }

  ctx.fillStyle = body;
  ctx.beginPath(); ctx.roundRect(p.x - 12 * s, by, 24 * s, 30 * s, 8 * s); ctx.fill();
  if (seated) {
    // arms reach for the keyboard; hands jitter while "typing"
    ctx.strokeStyle = shade(body, -0.15); ctx.lineWidth = 6 * s; ctx.lineCap = 'round';
    for (const k of [0, 1]) {
      const jit = typing ? Math.sin(now / 70 + k * 2) * 2.5 * s : 0;
      ctx.beginPath();
      ctx.moveTo(p.x + face * 4 * s, by + 8 * s);
      ctx.lineTo(p.x + face * (20 + k * 5) * s, by + 22 * s + jit);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
  }

  const hy = by - 12 * s + (typing ? Math.sin(now / 260) * 1.5 * s : 0);
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(p.x, hy, 11 * s, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = hair;
  ctx.beginPath(); ctx.arc(p.x, hy - 3 * s, 11 * s, Math.PI, 0); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillRect(p.x + face * 3 * s - 1.5 * s, hy - 1 * s, 3 * s, 3 * s);
  if (headset) {
    ctx.strokeStyle = headset; ctx.lineWidth = 3 * s;
    ctx.beginPath(); ctx.arc(p.x, hy - 2 * s, 12.5 * s, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke();
    ctx.fillStyle = headset;
    ctx.fillRect(p.x - 14 * s, hy - 3 * s, 4 * s, 8 * s);
    ctx.fillRect(p.x + 10 * s, hy - 3 * s, 4 * s, 8 * s);
  }
  return { x: p.x, top: hy - 14 * s };
}

/** Bouncing "!" above objects and people that still have an open task. */
export function drawMarker(px, py, now, glyph = '!') {
  const Z = state.Z;
  const y = py - 8 * Z + Math.sin(now / 250) * 4 * Z;
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.arc(px, y, 11 * Z, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#16091a'; ctx.font = `700 ${14 * Z}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(glyph, px, y + 1);
}

/** Name tag over the hovered object. */
export function drawLabel(o) {
  const Z = state.Z;
  const c = proj(o.x + o.w / 2, o.y + o.h / 2, o.z + 0.35);
  ctx.font = `600 ${13 * Z}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tw = ctx.measureText(o.name).width + 16;
  ctx.fillStyle = 'rgba(14,17,32,.92)';
  ctx.beginPath(); ctx.roundRect(c.x - tw / 2, c.y - 12 * Z, tw, 24 * Z, 8); ctx.fill();
  ctx.fillStyle = '#e8ecff'; ctx.fillText(o.name, c.x, c.y);
}
