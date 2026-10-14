import { state } from '../state.js';
import { proj } from './camera.js';
import { ctx, drawPrism, shadeHex, onPlaneX, onPlaneY } from './gfx.js';

// Furniture models: an object with "model": "bed" is drawn from a few prisms and a painted front face instead of a plain
// box. Every model stays inside the object's footprint (x, y, w, h) and height z, so collision and clicking are unchanged.
// "facing": "x" puts the painted front on the +x side (things against the left wall); the default front is +y.

const WOOD = '#4a3626';

/** Paints the object's front face. Local space is 120 x 100 px, y runs down from the top of the object. */
function face(o, fn, top = o.z, bottom = 0) {
  if (o.facing === 'x') onPlaneX(o.x + o.w, o.y, o.y + o.h, top, bottom, 120, 100, fn);
  else onPlaneY(o.x, o.x + o.w, o.y + o.h, top, bottom, 120, 100, fn);
}

// deterministic pseudo-random per object, so books keep their colors between frames
const rng = (o) => (i) => { const v = Math.sin(i * 127.1 + o.x * 31.7 + o.y * 17.3) * 43758.5453; return v - Math.floor(v); };
const BOOKS = ['#c0504d', '#4f81bd', '#9bbb59', '#8064a2', '#f79646', '#4bacc6', '#e8d9a0'];

function shelves(o, rows, paintRow) {
  const r = rng(o);
  face(o, () => {
    ctx.fillStyle = shadeHex(o.color, -0.6); ctx.fillRect(4, 4, 112, 92);
    for (let row = 0; row < rows; row++) {
      const top = 6 + row * (90 / rows), h = 90 / rows - 5;
      paintRow(top, h, r, row);
      ctx.fillStyle = shadeHex(o.color, 0.15); ctx.fillRect(4, top + h, 112, 4); // shelf board
    }
    ctx.strokeStyle = shadeHex(o.color, -0.2); ctx.lineWidth = 3; ctx.strokeRect(2, 2, 116, 96);
  });
}

export const MODELS = {
  /** Writing desk: top, four legs, a drawer unit with handles. The monitor and keyboard are added by drawDesk. */
  desk(o) {
    const { x, y, w, h, z, color } = o;
    const t = 0.08, dark = shadeHex(color, -0.35);
    for (const cx of [x + 0.05, x + w - 0.15]) for (const cy of [y + 0.05, y + h - 0.15]) drawPrism(cx, cy, 0.1, 0.1, 0, z - t, dark);
    drawPrism(x + w - 0.62, y + 0.08, 0.57, h - 0.16, 0.14, z - t, shadeHex(color, -0.15));
    onPlaneY(x + w - 0.62, x + w - 0.05, y + h - 0.08, z - t, 0.14, 100, 60, () => {
      for (const top of [3, 32]) {
        ctx.fillStyle = shadeHex(color, -0.05); ctx.fillRect(4, top, 92, 25);
        ctx.fillStyle = '#d7dcf5'; ctx.fillRect(36, top + 9, 28, 5);
      }
    });
    drawPrism(x, y, w, h, z - t, z, color);
  },

  /** Bed: frame, headboard against the wall, mattress, pillow, blanket in the object's color. */
  bed(o) {
    const { x, y, w, h, color } = o;
    drawPrism(x, y, w, h, 0.08, 0.26, WOOD);
    drawPrism(x, y, w, 0.12, 0.08, 0.9, WOOD);
    drawPrism(x + 0.06, y + 0.12, w - 0.12, h - 0.18, 0.26, 0.42, '#d9dcef');
    drawPrism(x + 0.2, y + 0.2, w - 0.4, 0.55, 0.42, 0.53, '#f3f4ff');
    drawPrism(x + 0.06, y + 1.05, w - 0.12, h - 1.11, 0.42, 0.5, color);
    drawPrism(x + 0.06, y + 1.05, w - 0.12, 0.1, 0.5, 0.52, shadeHex(color, 0.25)); // folded edge
  },

  /** Bookcase full of books. */
  bookcase(o) {
    drawPrism(o.x, o.y, o.w, o.h, 0, o.z, o.color);
    shelves(o, 4, (top, h, r, row) => {
      let x = 9;
      for (let i = 0; x < 108; i++) {
        const bw = 6 + r(row * 20 + i) * 6, bh = h * (0.65 + r(row * 31 + i) * 0.35);
        ctx.fillStyle = BOOKS[Math.floor(r(row * 7 + i * 3) * BOOKS.length)];
        ctx.fillRect(x, top + h - bh, bw, bh);
        x += bw + 1;
      }
    });
  },

  /** Display case with gold cups. */
  trophycase(o) {
    drawPrism(o.x, o.y, o.w, o.h, 0, o.z, o.color);
    shelves(o, 3, (top, h) => {
      for (const cx of [26, 60, 94]) {
        ctx.fillStyle = '#ffd166';
        ctx.beginPath(); ctx.moveTo(cx - 9, top + 2); ctx.lineTo(cx + 9, top + 2); ctx.lineTo(cx + 5, top + h * 0.55); ctx.lineTo(cx - 5, top + h * 0.55); ctx.closePath(); ctx.fill();
        ctx.fillRect(cx - 1.5, top + h * 0.55, 3, h * 0.25); ctx.fillRect(cx - 7, top + h * 0.8, 14, h * 0.2);
      }
    });
  },

  /** Wardrobe with two doors and handles. */
  wardrobe(o) {
    drawPrism(o.x, o.y, o.w, o.h, 0, o.z, o.color);
    face(o, () => {
      ctx.fillStyle = shadeHex(o.color, -0.25); ctx.fillRect(2, 2, 116, 96);
      for (const x0 of [6, 62]) {
        ctx.fillStyle = shadeHex(o.color, -0.05); ctx.fillRect(x0, 8, 52, 84);
        ctx.strokeStyle = shadeHex(o.color, -0.35); ctx.lineWidth = 2; ctx.strokeRect(x0 + 6, 14, 40, 72);
      }
      ctx.fillStyle = '#d7dcf5'; ctx.fillRect(52, 44, 4, 14); ctx.fillRect(64, 44, 4, 14);
      ctx.fillStyle = shadeHex(o.color, 0.2); ctx.fillRect(0, 0, 120, 6); // cornice
    });
  },

  /** Sofa: base, backrest against the wall, two armrests, three seat cushions. */
  sofa(o) {
    const { x, y, w, h, color } = o;
    const base = shadeHex(color, -0.28), arm = shadeHex(color, -0.15), back = shadeHex(color, -0.08), arm2 = 0.26;
    drawPrism(x, y, w, h, 0.05, 0.3, base);
    drawPrism(x, y, w, 0.3, 0.3, 0.82, back);
    drawPrism(x, y, arm2, h, 0.3, 0.6, arm);
    const cw = (w - arm2 * 2) / 3;
    for (let i = 0; i < 3; i++) drawPrism(x + arm2 + i * cw, y + 0.3, cw - 0.02, h - 0.3, 0.3, 0.47, color);
    drawPrism(x + w - arm2, y, arm2, h, 0.3, 0.6, arm);
  },

  /** Potted plant: terracotta pot and a bush of overlapping leaves. */
  plant(o) {
    const { x, y, w, h } = o;
    drawPrism(x + 0.28, y + 0.28, w - 0.56, h - 0.56, 0, 0.34, '#a0522d');
    drawPrism(x + 0.24, y + 0.24, w - 0.48, h - 0.48, 0.3, 0.38, '#b8683d');
    const cx = x + w / 2, cy = y + h / 2, greens = ['#2f6b3f', '#3c7a4b', '#4a9a5b'], Z = state.Z;
    for (let k = 0; k < 9; k++) {
      const a = k * 2.4, p = proj(cx + Math.cos(a) * 0.2, cy + Math.sin(a) * 0.2, 0.55 + (k % 3) * 0.14);
      ctx.fillStyle = greens[k % 3];
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 12 * Z, 8 * Z, a % 1.2 - 0.6, 0, Math.PI * 2); ctx.fill();
    }
  },

  /** Park bench: three seat slats, backrest, four legs. */
  bench(o) {
    const { x, y, w, h, color } = o;
    const dark = shadeHex(color, -0.4);
    for (const cx of [x + 0.1, x + w - 0.2]) for (const cy of [y + 0.05, y + h - 0.15]) drawPrism(cx, cy, 0.1, 0.1, 0, 0.32, dark);
    drawPrism(x + 0.1, y, 0.1, 0.1, 0.32, 0.8, dark);
    drawPrism(x + w - 0.2, y, 0.1, 0.1, 0.32, 0.8, dark);
    drawPrism(x, y, w, 0.08, 0.5, 0.78, color);
    for (let i = 0; i < 3; i++) drawPrism(x, y + 0.08 + i * ((h - 0.08) / 3), w, (h - 0.08) / 3 - 0.03, 0.32, 0.4, color);
  },

  /** Street lamp: base, pole, lamp head. The glow around it comes from the object's "glow" color. */
  streetlamp(o) {
    drawPrism(o.x + 0.08, o.y + 0.08, o.w - 0.16, o.h - 0.16, 0, 0.25, '#3a3f55');
    drawPrism(o.x + o.w / 2 - 0.05, o.y + o.h / 2 - 0.05, 0.1, 0.1, 0.25, o.z - 0.3, '#555b6e');
    drawPrism(o.x, o.y, o.w, o.h, o.z - 0.3, o.z, '#2a2f45');
  },

  /** Billboard on two posts. Works along x (default) or along y (use "facing": "x"). */
  billboard(o) {
    const { x, y, w, h, z, color } = o;
    const zb = Math.max(0.6, z - 1);
    const alongX = w >= h;
    const post = (px, py) => drawPrism(px, py, 0.14, 0.14, 0, zb, '#3a3f55');
    if (alongX) { post(x + 0.15, y + h / 2 - 0.07); post(x + w - 0.29, y + h / 2 - 0.07); }
    else { post(x + w / 2 - 0.07, y + 0.15); post(x + w / 2 - 0.07, y + h - 0.29); }
    drawPrism(x, y, w, h, zb, z, '#1d2230');
    face(o, () => {
      const g = ctx.createLinearGradient(0, 0, 120, 100);
      g.addColorStop(0, shadeHex(color, 0.15)); g.addColorStop(1, shadeHex(color, -0.45));
      ctx.fillStyle = g; ctx.fillRect(5, 5, 110, 90);
      ctx.fillStyle = 'rgba(255,255,255,.85)'; // abstract "ad": a headline bar and bars of text
      ctx.fillRect(14, 16, 70, 12);
      ctx.fillStyle = 'rgba(255,255,255,.45)';
      for (let i = 0; i < 4; i++) ctx.fillRect(14, 40 + i * 12, 92 - i * 14, 6);
      ctx.strokeStyle = '#d7dcf5'; ctx.lineWidth = 3; ctx.strokeRect(3, 3, 114, 94);
    }, z, zb);
  },

  /** Cork notice board on two legs, covered with pinned papers. */
  noticeboard(o) {
    const { x, y, w, h, z } = o;
    const depth = 0.12, py = y + h - depth, zb = 0.9;
    drawPrism(x + 0.12, py, 0.12, depth, 0, zb, '#3a3f55');
    drawPrism(x + w - 0.24, py, 0.12, depth, 0, zb, '#3a3f55');
    drawPrism(x, py, w, depth, zb, z, '#5a4630');
    const r = rng(o);
    face({ ...o, facing: 'y', y: py, h: depth }, () => {
      ctx.fillStyle = '#b88a4a'; ctx.fillRect(5, 5, 110, 90);
      for (let i = 0; i < 7; i++) {
        const px = 10 + (i % 4) * 27 + r(i) * 4, py2 = 10 + Math.floor(i / 4) * 44 + r(i + 9) * 6;
        ctx.fillStyle = i % 3 === 0 ? '#fff6c8' : '#f4f6ff'; ctx.fillRect(px, py2, 22, 34);
        ctx.fillStyle = '#c0504d'; ctx.fillRect(px + 9, py2 - 2, 4, 4); // pin
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(px + 3, py2 + 8, 16, 2); ctx.fillRect(px + 3, py2 + 14, 12, 2); ctx.fillRect(px + 3, py2 + 20, 14, 2);
      }
    }, z, zb);
  },

  /** Speaker stack with two cones. */
  speaker(o) {
    drawPrism(o.x, o.y, o.w, o.h, 0, o.z, '#23262f');
    face(o, () => {
      ctx.fillStyle = '#14161c'; ctx.fillRect(4, 4, 112, 92);
      for (const cy of [26, 70]) {
        ctx.fillStyle = '#2b2f3b'; ctx.beginPath(); ctx.ellipse(60, cy, 34, 20, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0c0d11'; ctx.beginPath(); ctx.ellipse(60, cy, 16, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = shadeHex(o.color, 0.1); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(60, cy, 34, 20, 0, 0, Math.PI * 2); ctx.stroke();
      }
    });
  },
};
