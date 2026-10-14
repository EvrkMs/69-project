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
