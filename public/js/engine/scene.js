import { state } from '../state.js';
import { proj } from './camera.js';
import { ctx, canvas, poly, shade, drawPrism, onPlaneY } from './gfx.js';
import { drawFigure, drawMarker, drawLabel } from './figures.js';
import { drawDeco } from './deco.js';
import { drawDesk } from './desk.js';
import { MODELS } from './furniture.js';
import { doorOpen, hasPendingTask } from '../game/tasks.js';

function drawFloor(now) {
  const { w, h, floor, indoor, wall } = state.world;
  for (let i = 0; i < w; i++) for (let j = 0; j < h; j++)
    poly([proj(i, j), proj(i + 1, j), proj(i + 1, j + 1), proj(i, j + 1)], floor[(i + j) % 2], 'rgba(255,255,255,.04)');
  if (indoor) { // the two back walls
    const WH = 2.6;
    poly([proj(0, 0, 0), proj(w, 0, 0), proj(w, 0, WH), proj(0, 0, WH)], shade(wall, -0.1));
    poly([proj(0, 0, 0), proj(0, h, 0), proj(0, h, WH), proj(0, 0, WH)], shade(wall, -0.3));
    poly([proj(0, 0, WH), proj(w, 0, WH), proj(w, 0, WH + 0.08), proj(0, 0, WH + 0.08)], shade(wall, 0.2));
    poly([proj(0, 0, WH), proj(0, h, WH), proj(0, h, WH + 0.08), proj(0, 0, WH + 0.08)], shade(wall, 0.1));
  }
  for (const d of state.world.deco) drawDeco(d, now);
}

/** Soft shadow under every piece of furniture: its footprint plus a copy shifted away from the (top-left) light, filled once. */
function drawShadows() {
  ctx.fillStyle = 'rgba(0,0,0,.26)';
  ctx.beginPath();
  for (const o of state.world.objs) {
    if (['prop', 'door', 'portal', 'npc'].includes(o.type)) continue;
    const shift = Math.min(0.4, 0.08 + o.z * 0.14);
    for (const [d, grow] of [[0, 0.04], [shift, 0]]) {
      const x = o.x + d - grow, y = o.y + d - grow, w = o.w + 2 * grow, h = o.h + 2 * grow;
      const [a, b, c, e] = [proj(x, y), proj(x + w, y), proj(x + w, y + h), proj(x, y + h)];
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(e.x, e.y); ctx.closePath();
    }
  }
  ctx.fill();
}

/** Sign on the wall above a corridor door with the owner's nickname, in the door's color. */
function drawNameplate(o) {
  const pad = 0.3;
  const dim = o.id.startsWith('soon');
  onPlaneY(o.x - pad, o.x + o.w + pad, 0.02, o.z + 0.72, o.z + 0.06, 220, 66, () => {
    ctx.fillStyle = '#14172a'; ctx.beginPath(); ctx.roundRect(0, 0, 220, 66, 12); ctx.fill();
    ctx.strokeStyle = o.color; ctx.lineWidth = 5; ctx.stroke();
    ctx.fillStyle = dim ? '#6b7192' : '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    let size = 40;
    ctx.font = `800 ${size}px system-ui`;
    while (ctx.measureText(o.nick).width > 196 && size > 12) { size -= 2; ctx.font = `800 ${size}px system-ui`; }
    ctx.fillText(o.nick, 110, 36);
  });
}

function drawBox(o, now) {
  const { x, y, w, h, z, color } = o;
  const top = [proj(x, y, z), proj(x + w, y, z), proj(x + w, y + h, z), proj(x, y + h, z)];
  const model = MODELS[o.model];
  if (model) model(o, now);
  else { // plain box
    poly(top, shade(color, 0.22), 'rgba(0,0,0,.25)');
    poly([proj(x, y + h, z), proj(x + w, y + h, z), proj(x + w, y + h, 0), proj(x, y + h, 0)], color, 'rgba(0,0,0,.25)');
    poly([proj(x + w, y, z), proj(x + w, y + h, z), proj(x + w, y + h, 0), proj(x + w, y, 0)], shade(color, -0.25), 'rgba(0,0,0,.25)');
  }
  if (o.type === 'door' || o.type === 'portal') {
    const inset = 0.15 * w;
    const quad = (width) => [proj(x + inset, y + h, z - 0.15), proj(x + inset + width, y + h, z - 0.15), proj(x + inset + width, y + h, 0), proj(x + inset, y + h, 0)];
    const doorway = quad(w - 2 * inset);
    // while the player walks out, light floods the doorway and the leaf swings towards its hinge
    const k = o.openedAt ? Math.min(1, (now - o.openedAt) / 650) : 0;
    if (k) poly(doorway, `rgba(255,236,170,${0.95 * k})`);
    poly(quad((w - 2 * inset) * (1 - 0.88 * k)), shade(color, -0.45));
    if (!k && doorOpen(o)) poly(doorway, `rgba(255,220,140,${0.4 + 0.3 * Math.sin(now / 250)})`); // pulses when the door is usable
  }
  if (o.type === 'portal' && o.nick) drawNameplate(o);
  if (o.glow && !o.sitAt) {
    const Z = state.Z;
    const c = proj(x + w / 2, y + h / 2, z);
    const g = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 70 * Z);
    g.addColorStop(0, o.glow + 'aa'); g.addColorStop(1, o.glow + '00');
    ctx.fillStyle = g; ctx.fillRect(c.x - 80 * Z, c.y - 80 * Z, 160 * Z, 160 * Z);
    poly(top.map((p) => ({ x: c.x + (p.x - c.x) * 0.6, y: c.y + (p.y - c.y) * 0.6 })), o.glow + 'cc');
  }
}

/** Green "ВЫХОД" sign with a pointing arrow above an open door, plus a pulsing light on the floor in front of it. */
function drawExitSign(o, now) {
  const Z = state.Z;
  const pulse = 0.5 + 0.5 * Math.sin(now / 280);
  const floor = proj(o.x + o.w / 2, o.y + o.h + 0.9, 0);
  const g = ctx.createRadialGradient(floor.x, floor.y, 2, floor.x, floor.y, 90 * Z);
  g.addColorStop(0, `rgba(123,216,143,${0.18 + 0.22 * pulse})`); g.addColorStop(1, 'rgba(123,216,143,0)');
  ctx.fillStyle = g; ctx.fillRect(floor.x - 100 * Z, floor.y - 60 * Z, 200 * Z, 120 * Z);

  const top = proj(o.x + o.w / 2, o.y + o.h, o.z + 0.15);
  const x = top.x, y = top.y - 34 * Z + Math.sin(now / 260) * 4 * Z;
  ctx.fillStyle = '#7bd88f';
  ctx.beginPath(); ctx.roundRect(x - 42 * Z, y - 14 * Z, 84 * Z, 28 * Z, 8 * Z); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - 9 * Z, y + 13 * Z); ctx.lineTo(x + 9 * Z, y + 13 * Z); ctx.lineTo(x, y + 25 * Z); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#10261a'; ctx.font = `800 ${14 * Z}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('ВЫХОД', x, y + 1 * Z);
}

function drawParticles() {
  const Z = state.Z;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (const p of state.particles) {
    const q = proj(p.x, p.y, p.z + p.t * 0.7);
    ctx.globalAlpha = Math.max(0, 1 - p.t / 2.2);
    ctx.fillStyle = p.col; ctx.font = `${16 * Z}px system-ui`;
    ctx.fillText(p.txt, q.x + Math.sin(p.t * 3 + p.x) * 8 * Z, q.y);
  }
  ctx.globalAlpha = 1;
}

/**
 * A keepsake on a pedestal in the hero's room. Locked ones are dim with a lock, the next playable one pulses with a "!",
 * finished ones glow softly with a check mark.
 */
function drawMemento(o, now) {
  const { Z, streamer } = state;
  const c = streamer.chapters.find((x) => x.id === o.chapter);
  const st = !c || !c.unlocked ? 'locked' : streamer.done.includes(c.id) ? 'done' : 'open';
  drawPrism(o.x + 0.1, o.y + 0.1, o.w - 0.2, o.h - 0.2, 0, o.z, '#2f3350');
  const cx = o.x + o.w / 2, cy = o.y + o.h / 2;
  poly([proj(o.x + 0.1, o.y + 0.1, o.z), proj(o.x + o.w - 0.1, o.y + 0.1, o.z), proj(o.x + o.w - 0.1, o.y + o.h - 0.1, o.z), proj(o.x + 0.1, o.y + o.h - 0.1, o.z)], st === 'locked' ? '#3a3f55' : o.color);

  if (c) { // museum plaque with the year, on the pedestal's front
    onPlaneY(o.x + 0.1, o.x + o.w - 0.1, o.y + o.h - 0.1, o.z - 0.05, 0.12, 100, 56, () => {
      ctx.fillStyle = '#10132a'; ctx.fillRect(0, 0, 100, 56);
      ctx.fillStyle = st === 'locked' ? '#6b7192' : '#ffd166'; ctx.font = '800 34px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(c.year), 50, 30);
    });
  }
  const top = proj(cx, cy, o.z);
  if (st !== 'locked') {
    const a = st === 'open' ? 0.5 + 0.2 * Math.sin(now / 300) : 0.22;
    const g = ctx.createRadialGradient(top.x, top.y - 24 * Z, 2, top.x, top.y - 24 * Z, 62 * Z);
    g.addColorStop(0, `${o.color}${Math.round(a * 255).toString(16).padStart(2, '0')}`); g.addColorStop(1, `${o.color}00`);
    ctx.fillStyle = g; ctx.fillRect(top.x - 70 * Z, top.y - 90 * Z, 140 * Z, 140 * Z);
  }
  const bob = Math.sin(now / 500 + o.x) * 4 * Z;
  ctx.globalAlpha = st === 'locked' ? 0.3 : 1;
  ctx.font = `${34 * Z}px system-ui`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(o.glyph, top.x, top.y - 30 * Z + bob);
  ctx.globalAlpha = 1;
  if (st === 'locked') { ctx.font = `${16 * Z}px system-ui`; ctx.fillText('🔒', top.x, top.y - 28 * Z); }
  if (st === 'done') {
    ctx.fillStyle = '#7bd88f'; ctx.beginPath(); ctx.arc(top.x + 18 * Z, top.y - 48 * Z, 9 * Z, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#10261a'; ctx.font = `700 ${12 * Z}px system-ui`; ctx.fillText('✓', top.x + 18 * Z, top.y - 47 * Z);
  }
  if (st === 'open') drawMarker(top.x, top.y - 66 * Z, now);
}

/** A prop is drawn in two parts so a seated hero sits between the seat and the backrest. */
function drawProp(o, part) {
  if (part === 'seat') {
    drawPrism(o.x + 0.3, o.y + 0.3, 0.2, 0.2, 0, 0.35, shade(o.color, -0.2));
    drawPrism(o.x, o.y, o.w, o.h, 0.35, o.z, o.color);
  } else drawPrism(o.x, o.y + o.h - 0.12, o.w, 0.12, o.z, 1.25, shade(o.color, -0.1));
}

export function render(now) {
  const { W, H, Z, world, hero, pings, look, dlg, hover } = state;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#0c0e18'); g.addColorStop(1, '#151a30');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  if (!world) return;

  drawFloor(now);
  drawShadows();
  for (const p of pings) {
    const c = proj(p.x, p.y);
    ctx.strokeStyle = `rgba(127,208,255,${1 - p.t / 0.7})`; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(c.x, c.y, (10 + p.t * 40) * Z, (5 + p.t * 20) * Z, 0, 0, Math.PI * 2); ctx.stroke();
  }

  // painter's algorithm: far to near by x + y
  const items = [];
  for (const o of world.objs) {
    const key = o.x + o.w / 2 + o.y + o.h / 2;
    if (o.type === 'prop') items.push({ key: key - 0.2, o, part: 'seat' }, { key: key + 0.5, o, part: 'back' });
    else items.push({ key, o });
  }
  items.push({ key: hero.x + hero.y + 0.01, hero: true });
  items.sort((a, b) => a.key - b.key);

  for (const it of items) {
    if (it.hero) {
      drawFigure(hero.x, hero.y, { ...look, face: hero.face, moving: hero.moving, t: hero.t, seated: hero.seated, typing: hero.seated && !!dlg, now });
      continue;
    }
    const o = it.o;
    if (o.type === 'prop') { drawProp(o, it.part); continue; }
    if (o.type === 'memento') { drawMemento(o, now); continue; }
    if (o.type === 'npc') {
      const f = drawFigure(o.x + 0.5, o.y + 0.5, { body: o.color, hair: o.hair, face: -1 });
      if (hasPendingTask(o)) drawMarker(f.x, f.top, now);
      continue;
    }
    drawBox(o, now);
    if (o.type === 'door' && state.mode === 'chapter' && doorOpen(o)) drawExitSign(o, now);
    if (o.sitAt) drawDesk(o, now);
    if (hasPendingTask(o)) { const c = proj(o.x + o.w / 2, o.y + o.h / 2, o.z + 0.2); drawMarker(c.x, c.y - 14 * Z, now); }
  }
  drawParticles();
  if (world.lighting && world.lighting.mode === 'dark') drawDarkness(now);
  if (hover) drawLabel(hover);
}

// ---- darkness ("dark" lighting): everything is dim except what the hero's flashlight and light sources reach ----
let darkLayer = null;
function drawDarkness(now) {
  const { world, W, H, Z, hero } = state;
  const dpr = canvas.width / W;
  if (!darkLayer) darkLayer = document.createElement('canvas');
  if (darkLayer.width !== canvas.width || darkLayer.height !== canvas.height) { darkLayer.width = canvas.width; darkLayer.height = canvas.height; }
  const d = darkLayer.getContext('2d');
  d.setTransform(dpr, 0, 0, dpr, 0, 0);
  d.globalCompositeOperation = 'source-over';
  d.fillStyle = 'rgb(9,9,16)'; d.fillRect(0, 0, W, H);
  d.globalCompositeOperation = 'lighter';
  const light = (p, radius, strength) => {
    const g = d.createRadialGradient(p.x, p.y, radius * 0.08, p.x, p.y, radius);
    g.addColorStop(0, `rgba(255,248,230,${strength})`); g.addColorStop(0.55, `rgba(255,248,230,${strength * 0.45})`); g.addColorStop(1, 'rgba(255,248,230,0)');
    d.fillStyle = g; d.fillRect(p.x - radius, p.y - radius, radius * 2, radius * 2);
  };
  const flicker = 1 + 0.03 * Math.sin(now / 90);
  light(proj(hero.x, hero.y, 0.7), world.lighting.radius * 36 * Z * flicker, 1); // the flashlight
  for (const o of world.objs) { // monitors and glowing objects stay visible from afar, like beacons
    if (o.sitAt) light(proj(o.x + o.w / 2, o.y + 0.5, o.z + 0.5), 1.5 * 36 * Z, 0.9);
    else if (o.glow) light(proj(o.x + o.w / 2, o.y + o.h / 2, o.z), 1.6 * 36 * Z, 0.8);
    if (o.type === 'door' && doorOpen(o) && state.mode === 'chapter') light(proj(o.x + o.w / 2, o.y + o.h, 1), 2 * 36 * Z, 0.9);
  }
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(darkLayer, 0, 0);
  ctx.restore();
}
