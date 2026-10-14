import { state } from '../state.js';
import { proj } from './camera.js';
import { ctx, poly, shade, onPlaneY, onPlaneX } from './gfx.js';

// Static room decoration declared in scene.deco: rugs on the floor, posters on the back wall, windows on the left wall.
const painters = {
  rug(d) {
    poly([proj(d.x, d.y), proj(d.x + d.w, d.y), proj(d.x + d.w, d.y + d.h), proj(d.x, d.y + d.h)], shade(d.color, -0.1));
    const m = 0.2;
    poly([proj(d.x + m, d.y + m), proj(d.x + d.w - m, d.y + m), proj(d.x + d.w - m, d.y + d.h - m), proj(d.x + m, d.y + d.h - m)], d.color);
  },

  poster(d) {
    onPlaneY(d.from, d.to, 0.02, d.z1, d.z0, 60, 90, () => {
      ctx.fillStyle = d.color; ctx.fillRect(0, 0, 60, 90);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 62, 60, 28);
      ctx.fillStyle = '#fff'; ctx.font = '700 34px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.glyph || '★', 30, 34);
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, 57, 87);
    });
  },

  /** Wall banner with a short text (party signs, "100K"). */
  banner(d) {
    onPlaneY(d.from, d.to, 0.02, d.z1, d.z0, 160, 50, () => {
      ctx.fillStyle = d.color; ctx.beginPath(); ctx.roundRect(0, 0, 160, 50, 8); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.strokeRect(5, 5, 150, 40); ctx.setLineDash([]);
      ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let size = 28;
      ctx.font = `800 ${size}px system-ui`;
      while (ctx.measureText(d.text).width > 138 && size > 10) { size -= 2; ctx.font = `800 ${size}px system-ui`; }
      ctx.fillText(d.text, 80, 27);
    });
  },

  /** A string of bunting flags along the back wall that sways a little. */
  garland(d, now) {
    const colors = d.colors || ['#ff6b9d', '#ffd166', '#7fd0ff', '#9bff9b'];
    onPlaneY(d.from, d.to, 0.02, d.z + 0.3, d.z - 0.1, 240, 40, () => {
      ctx.strokeStyle = '#d7dcf5'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(120, 22, 240, 4); ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const t = (i + 0.5) / 12, x = t * 240, y = 4 + 18 * 2 * t * (1 - t) + 2;
        const sway = Math.sin(now / 600 + i) * 1.5;
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x + 7, y); ctx.lineTo(x + sway, y + 17); ctx.closePath(); ctx.fill();
      }
    });
  },

  /** Balloons tied to the floor at the given positions, bobbing slightly. */
  balloons(d, now) {
    const Z = state.Z;
    for (const [i, b] of (d.items || []).entries()) {
      const bob = Math.sin(now / 700 + i * 1.3) * 0.06;
      const foot = proj(b.x, b.y, 0), top = proj(b.x, b.y, 1.15 + bob);
      ctx.strokeStyle = 'rgba(230,235,255,.6)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(foot.x, foot.y); ctx.lineTo(top.x, top.y + 12 * Z); ctx.stroke();
      ctx.fillStyle = b.color;
      ctx.beginPath(); ctx.ellipse(top.x, top.y, 11 * Z, 14 * Z, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.ellipse(top.x - 4 * Z, top.y - 5 * Z, 3 * Z, 5 * Z, 0.5, 0, Math.PI * 2); ctx.fill();
    }
  },

  /** A cone of coloured light from the ceiling onto a spot of the floor (stage, wedding table). */
  spotlight(d, now) {
    const Z = state.Z, pulse = 0.85 + 0.15 * Math.sin(now / 500);
    const floor = proj(d.x, d.y, 0), top = proj(d.x, d.y, 2.8);
    const rx = d.r * 36 * Z, ry = d.r * 18 * Z;
    const beam = ctx.createLinearGradient(top.x, top.y, floor.x, floor.y);
    beam.addColorStop(0, `${d.color}00`); beam.addColorStop(1, `${d.color}33`);
    ctx.fillStyle = beam;
    ctx.beginPath(); ctx.moveTo(top.x - 6 * Z, top.y); ctx.lineTo(top.x + 6 * Z, top.y); ctx.lineTo(floor.x + rx, floor.y); ctx.lineTo(floor.x - rx, floor.y); ctx.closePath(); ctx.fill();
    const g = ctx.createRadialGradient(floor.x, floor.y, 2, floor.x, floor.y, rx);
    g.addColorStop(0, `${d.color}${Math.round(110 * pulse).toString(16).padStart(2, '0')}`); g.addColorStop(1, `${d.color}00`);
    ctx.save(); ctx.translate(floor.x, floor.y); ctx.scale(1, ry / rx); ctx.translate(-floor.x, -floor.y);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(floor.x, floor.y, rx, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  },

  window(d, now) {
    onPlaneX(0.02, d.from, d.to, d.z1, d.z0, 100, 80, () => {
      const g = ctx.createLinearGradient(0, 0, 0, 80);
      g.addColorStop(0, d.sky ? d.sky[0] : '#0b1030'); g.addColorStop(1, d.sky ? d.sky[1] : '#27306b');
      ctx.fillStyle = g; ctx.fillRect(0, 0, 100, 80);
      for (let i = 0; i < 9; i++) { // twinkling stars
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(now / 700 + i * 1.7));
        ctx.fillStyle = '#fff'; ctx.fillRect((i * 37) % 96, (i * 23) % 40, 2, 2);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(8,10,22,.8)'; // skyline
      for (let i = 0; i < 8; i++) ctx.fillRect(i * 13, 80 - 16 - ((i * 29) % 24), 11, 60);
      ctx.fillStyle = '#ffd166';
      for (let i = 0; i < 8; i++) if (Math.sin(now / 1500 + i * 3) > 0) ctx.fillRect(i * 13 + 3, 80 - 12 - ((i * 29) % 24), 3, 3);
      ctx.strokeStyle = '#d7dcf5'; ctx.lineWidth = 5; ctx.strokeRect(2, 2, 96, 76);
      ctx.beginPath(); ctx.moveTo(50, 0); ctx.lineTo(50, 80); ctx.moveTo(0, 40); ctx.lineTo(100, 40); ctx.lineWidth = 3; ctx.stroke();
    });
  },
};

export function drawDeco(d, now) {
  const paint = painters[d.kind];
  if (paint) paint(d, now);
}
