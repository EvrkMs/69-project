import { state, $ } from '../state.js';
import { canvas } from './gfx.js';
import { blockedAt } from './world.js';
import { pickObject, nearestObject, USE_RANGE } from './picking.js';
import { updateTouch } from '../ui/touch.js';
import { updateStream, syncStream } from '../game/stream.js';
import { interact } from '../game/interact.js';
import { doorOpen } from '../game/tasks.js';
import { whisper } from '../ui/whisper.js';
import { sfx } from '../audio/sound.js';

const SPEED = 3.4;        // tiles per second
const IDLE_MS = 12000;    // idle chatter after this long without input

function keyboardDirection() {
  const { keys } = state;
  let dx = 0, dy = 0;
  if (state.stick) { const { x, y } = state.stick; return [x + y, y - x]; } // screen right/down -> iso world axes
  if (keys.has('w') || keys.has('arrowup')) { dx -= 1; dy -= 1; }
  if (keys.has('s') || keys.has('arrowdown')) { dx += 1; dy += 1; }
  if (keys.has('a') || keys.has('arrowleft')) { dx -= 1; dy += 1; }
  if (keys.has('d') || keys.has('arrowright')) { dx += 1; dy -= 1; }
  return [dx, dy];
}

function slide(mx, my) {
  const { hero } = state;
  if (!blockedAt(hero.x + mx, hero.y)) hero.x += mx;
  if (!blockedAt(hero.x, hero.y + my)) hero.y += my;
  hero.moving = true;
  if (mx - my) hero.face = (mx - my) >= 0 ? 1 : -1;
}

function followPath(dt) {
  const { hero } = state;
  const [ti, tj] = state.path[0];
  const tx = ti + 0.5, ty = tj + 0.5;
  const vx = tx - hero.x, vy = ty - hero.y;
  const d = Math.hypot(vx, vy);
  const s = SPEED * dt;
  hero.moving = true;
  if (d > s) {
    hero.x += vx / d * s; hero.y += vy / d * s;
    hero.face = (vx - vy) >= 0 ? 1 : -1;
    return;
  }
  hero.x = tx; hero.y = ty;
  state.path.shift();
  if (!state.path.length && state.pending) { const o = state.pending; state.pending = null; interact(o); }
}

/**
 * The moment a door's requirements are met (and no dialogue is running) the camera briefly looks at it and the hero says so;
 * the door itself keeps its green EXIT sign and glow (see scene.js) until the player walks through.
 */
function announceDoors(now) {
  if (state.mode !== 'chapter' || state.dlg || state.locked || !state.done.size) return;
  for (const o of state.world.objs) {
    if (o.type !== 'door' || o.announced || !doorOpen(o)) continue;
    o.announced = true;
    state.focus = { x: o.x + o.w / 2, y: o.y + 1.5, until: now + 1800 };
    whisper('Дверь открыта. Пора выходить.');
    sfx('announce');
  }
}

function idleChatter(now) {
  if (state.mode !== 'chapter' || now - state.idleAt <= IDLE_MS || state.path.length) return;
  state.idleAt = now;
  const lines = [...(state.chapter.idle || []), ...(state.streamer.idle || [])];
  if (lines.length) whisper(lines[Math.floor(Math.random() * lines.length)]);
}

/** Advances the simulation by one frame. */
export function update(dt, now) {
  const { hero, cam, pings, particles } = state;
  hero.moving = false;

  if (!state.locked && !state.dlg) {
    const [dx, dy] = keyboardDirection();
    if (dx || dy) {
      state.path = []; state.pending = null;
      const len = Math.hypot(dx, dy);
      slide(dx / len * SPEED * dt, dy / len * SPEED * dt);
    } else if (state.path.length) followPath(dt);
    idleChatter(now);
  }

  if (state.zoomNow !== state.zoom) { // ease towards the wheel / pinch target
    state.zoomNow += (state.zoom - state.zoomNow) * Math.min(1, dt * 12);
    if (Math.abs(state.zoom - state.zoomNow) < 0.002) state.zoomNow = state.zoom;
    state.Z = state.baseZ * state.zoomNow;
  }

  announceDoors(now);
  if (state.focus && now > state.focus.until) state.focus = null;
  const look = state.focus || hero;
  if (hero.moving) {
    const before = Math.floor(hero.t / Math.PI);
    hero.t += dt * 9;
    if (Math.floor(hero.t / Math.PI) !== before) sfx('step'); // one footstep per half stride
  }
  cam.x += (look.x - cam.x) * Math.min(1, dt * (state.focus ? 3 : 6));
  cam.y += (look.y - cam.y) * Math.min(1, dt * (state.focus ? 3 : 6));

  for (let i = pings.length - 1; i >= 0; i--) { pings[i].t += dt; if (pings[i].t > 0.7) pings.splice(i, 1); }
  syncStream();
  updateStream(dt, now);
  for (let i = particles.length - 1; i >= 0; i--) { particles[i].t += dt; if (particles[i].t > 2.2) particles.splice(i, 1); }

  updateTouch();
  const interactive = !state.locked && !state.dlg;
  state.hover = interactive && state.mouse.x >= 0 ? pickObject(state.mouse.x, state.mouse.y) : null;
  canvas.style.cursor = state.hover ? 'pointer' : 'default';
  const near = interactive ? nearestObject(USE_RANGE) : null;
  const prompt = $('prompt');
  if (near) {
    prompt.hidden = false;
    prompt.textContent = near.type === 'door' && doorOpen(near) ? 'E · Выйти' : `E · ${near.name}`;
  } else prompt.hidden = true;
}

