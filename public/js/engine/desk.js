import { state } from '../state.js';
import { proj } from './camera.js';
import { ctx, poly, drawPrism, onPlaneY } from './gfx.js';
import { screenMode } from '../game/stream.js';

// Local monitor space is 150 x 84.
function drawScreen(mode, isLive, now) {
  if (mode === 'youtube') {
    ctx.fillStyle = '#1b1b1f'; ctx.fillRect(0, 0, 150, 84);
    ctx.fillStyle = '#ff2d2d'; ctx.beginPath(); ctx.roundRect(52, 22, 46, 32, 8); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(69, 30); ctx.lineTo(69, 46); ctx.lineTo(83, 38); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#9aa0b5'; ctx.font = '600 11px system-ui'; ctx.textAlign = 'center'; ctx.fillText('0 просмотров', 75, 70);
    return;
  }
  if (!isLive && mode !== 'watch') {
    ctx.fillStyle = '#070912'; ctx.fillRect(0, 0, 150, 84);
    ctx.fillStyle = '#3b4268'; ctx.font = '700 12px system-ui'; ctx.textAlign = 'center'; ctx.fillText('OFFLINE', 75, 44);
    if (Math.floor(now / 600) % 2) ctx.fillRect(100, 36, 6, 10);
    return;
  }
  // "game" area with moving shapes
  const g = ctx.createLinearGradient(0, 0, 0, 84);
  g.addColorStop(0, '#1d2f66'); g.addColorStop(1, '#4a1f63');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 150, 84);
  ctx.fillStyle = '#ffd166'; ctx.fillRect(18 + 38 + 38 * Math.sin(now / 420), 44 + 14 * Math.cos(now / 310), 12, 12);
  ctx.fillStyle = '#7fd0ff'; ctx.fillRect(110 - 30 * Math.abs(Math.sin(now / 520)), 24 + 10 * Math.sin(now / 260), 9, 9);
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, 70, 150, 14);
  // chat column on the right
  ctx.fillStyle = 'rgba(8,10,22,.82)'; ctx.fillRect(104, 0, 46, 84);
  const chat = state.live ? state.live.chat : [];
  chat.forEach((c, i) => { ctx.fillStyle = c.color; ctx.fillRect(108, 12 + i * 10, 6, 3); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillRect(117, 12 + i * 10, c.w, 3); });
  // top bar: blinking LIVE dot
  ctx.fillStyle = 'rgba(8,10,22,.7)'; ctx.fillRect(0, 0, 104, 11);
  if (mode === 'stream' && Math.floor(now / 500) % 2) { ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(8, 5.5, 3, 0, Math.PI * 2); ctx.fill(); }
  ctx.fillStyle = '#fff'; ctx.font = '700 7px system-ui'; ctx.textAlign = 'left'; ctx.fillText(mode === 'stream' ? 'LIVE' : 'WATCH', 15, 8);
}

/** Everything standing on a desk with a seat: ON AIR sign, monitor, keyboard, mouse, microphone. */
export function drawDesk(o, now) {
  const Z = state.Z;
  const mode = screenMode(o);
  const isLive = !!state.live && state.live.o === o;
  const cx = o.x + o.w / 2, mw = 1.5;
  const xL = cx - mw / 2, xR = cx + mw / 2, zb = o.z + 0.12, zt = o.z + 0.92;

  if (state.world.indoor) { // wall sign above the desk
    onPlaneY(o.x + 0.4, o.x + o.w - 0.4, 0.02, 2.4, 2.0, 120, 40, () => {
      ctx.fillStyle = isLive ? '#ff3b3b' : '#2a1d24'; ctx.beginPath(); ctx.roundRect(0, 0, 120, 40, 8); ctx.fill();
      ctx.fillStyle = isLive ? '#fff' : '#5a3f4a'; ctx.font = '800 22px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('ON AIR', 60, 21);
    });
    if (isLive) {
      const c = proj(o.x + o.w / 2, 0.1, 2.2);
      const gg = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 60 * Z);
      gg.addColorStop(0, 'rgba(255,59,59,.35)'); gg.addColorStop(1, 'rgba(255,59,59,0)');
      ctx.fillStyle = gg; ctx.fillRect(c.x - 70 * Z, c.y - 70 * Z, 140 * Z, 140 * Z);
    }
  }

  drawPrism(cx - 0.08, o.y + 0.15, 0.16, 0.12, o.z, zb, '#1a1c28'); // stand
  drawPrism(xL, o.y + 0.2, mw, 0.12, zb, zt, '#14161f');            // monitor body
  onPlaneY(xL + 0.06, xR - 0.06, o.y + 0.32, zt - 0.06, zb + 0.06, 150, 84, () => drawScreen(mode, isLive, now));
  if (isLive || mode === 'watch') { // screen light on the desk
    const c = proj(cx, o.y + 0.8, o.z);
    const gg = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 55 * Z);
    gg.addColorStop(0, 'rgba(160,140,255,.28)'); gg.addColorStop(1, 'rgba(160,140,255,0)');
    ctx.fillStyle = gg; ctx.fillRect(c.x - 60 * Z, c.y - 40 * Z, 120 * Z, 80 * Z);
  }

  drawPrism(o.x + 0.45, o.y + 0.55, 1.1, 0.28, o.z, o.z + 0.05, '#20222c'); // keyboard with an RGB strip while live
  poly([proj(o.x + 0.45, o.y + 0.83, o.z + 0.052), proj(o.x + 1.55, o.y + 0.83, o.z + 0.052), proj(o.x + 1.55, o.y + 0.86, o.z + 0.052), proj(o.x + 0.45, o.y + 0.86, o.z + 0.052)],
    isLive ? `hsl(${(now / 8) % 360},85%,60%)` : '#2d3040');
  drawPrism(o.x + o.w - 0.3, o.y + 0.6, 0.1, 0.14, o.z, o.z + 0.04, '#2a2a33'); // mouse
  drawPrism(o.x + 0.18, o.y + 0.5, 0.06, 0.06, o.z, o.z + 0.45, '#2b2b33');     // microphone stand
  drawPrism(o.x + 0.14, o.y + 0.46, 0.14, 0.14, o.z + 0.45, o.z + 0.58, isLive ? '#ff6b9d' : '#444455');
}
