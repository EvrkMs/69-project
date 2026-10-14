// Content validation. Everything here runs at server start and in `npm run validate`, so a typo in
// content/ fails loudly instead of showing up as a stuck door in the game.
import { buildGrid, isBlockedTile, findPath, spotGoal } from '../../shared/grid.js';
import { MODEL_NAMES, DECO_KINDS, LIGHTING_MODES } from '../../shared/models.js';

const SPEAKERS = new Set(['hero', 'npc', 'fact', 'clip']);
const EPS = 1e-6;
const MEDIA_TOKEN = /^[\w-]{6,64}$/;
const MAX_TEXT = 1200;

function validateSteps(steps, where, sources, produced, errors) {
  if (!Array.isArray(steps) || !steps.length) { errors.push(`${where}: no steps`); return; }
  steps.forEach((s, i) => {
    const at = `${where}[${i}]`;
    if (s.who === 'action') {
      if (!s.label) errors.push(`${at}: action without a label`);
      if (!(s.hold >= 200 && s.hold <= 10000)) errors.push(`${at}: hold must be 200..10000 ms`);
      return;
    }
    if (s.who === 'task') {
      if (!s.task) errors.push(`${at}: task step without an id`); else produced.add(s.task);
      return;
    }
    if (!SPEAKERS.has(s.who)) errors.push(`${at}: unknown speaker "${s.who}"`);
    if (typeof s.text !== 'string' || !s.text.trim()) errors.push(`${at}: empty text`);
    if (s.who === 'npc' && !s.name) errors.push(`${at}: npc line without a name`);
    if (s.who === 'fact' && !sources[s.src]) errors.push(`${at}: fact has unknown source "${s.src}"`);
    if (s.who === 'clip') {
      const m = s.media;
      if (!m || !m.title) errors.push(`${at}: clip without media/title`);
      // ids go into iframe URLs: only the plain id alphabet is accepted, so nothing can break out of the URL
      else if (!['youtube', 'twitchclip'].includes(m.type) || !MEDIA_TOKEN.test(m.type === 'youtube' ? m.id : m.slug)) errors.push(`${at}: bad clip media ${JSON.stringify(m)}`);
    }
    if (typeof s.text === 'string' && s.text.length > MAX_TEXT) errors.push(`${at}: text is longer than ${MAX_TEXT} characters`);
  });
}

/** Geometry shared by chapters and the hero's room: bounds, overlaps, free start tile, everything reachable. */
function validateScene(sc, p, errors) {
  if (!(sc.w > 0 && sc.h > 0)) { errors.push(`${p}: scene needs w and h`); return false; }
  if (!Array.isArray(sc.floor) || sc.floor.length < 2) errors.push(`${p}: scene.floor needs two colors`);
  for (const d of sc.deco || []) if (!DECO_KINDS.includes(d.kind)) errors.push(`${p}: unknown deco kind "${d.kind}" (known: ${DECO_KINDS.join(', ')})`);
  if (sc.lighting) {
    if (!LIGHTING_MODES.includes(sc.lighting.mode)) errors.push(`${p}: unknown lighting mode "${sc.lighting.mode}"`);
    else if (!(sc.lighting.radius >= 1 && sc.lighting.radius <= 8)) errors.push(`${p}: lighting.radius must be 1..8 tiles`);
  }
  const ids = new Set();
  for (const o of sc.objects) {
    const w = `${p} object "${o.id}"`;
    if (o.type !== 'prop') {
      if (ids.has(o.id)) errors.push(`${w}: duplicate id`);
      ids.add(o.id);
    }
    if (!(o.x >= 0 && o.y >= 0 && o.x + o.w <= sc.w + EPS && o.y + o.h <= sc.h + EPS)) errors.push(`${w}: outside the ${sc.w}x${sc.h} scene`);
    if (o.model && !MODEL_NAMES.includes(o.model)) errors.push(`${w}: unknown model "${o.model}" (known: ${MODEL_NAMES.join(', ')})`);
    if (o.facing && !['x', 'y'].includes(o.facing)) errors.push(`${w}: facing must be "x" or "y"`);
  }
  const grid = buildGrid(sc);
  const claimed = new Map();
  for (const o of grid.objs) {
    for (const [i, j] of o.tiles) {
      const key = `${i},${j}`;
      if (claimed.has(key)) errors.push(`${p}: "${o.id}" overlaps "${claimed.get(key)}" at tile ${key}`);
      else claimed.set(key, o.id);
    }
  }
  const [si, sj] = [Math.floor(sc.start.x), Math.floor(sc.start.y)];
  if (isBlockedTile(grid, si, sj)) { errors.push(`${p}: start tile ${si},${sj} is blocked`); return false; }
  for (const o of grid.objs) {
    if (o.type === 'prop') continue;
    if (o.sitAt && isBlockedTile(grid, Math.floor(o.sitAt.x), Math.floor(o.sitAt.y))) { errors.push(`${p}: seat of "${o.id}" is blocked`); continue; }
    const goal = spotGoal(o);
    if (!goal(si, sj) && !findPath(grid, si, sj, goal)) errors.push(`${p}: "${o.id}" is unreachable from the start`);
  }
  return true;
}

function validateChapter(ch, sources, errors) {
  const p = `chapter ${ch.id}`;
  for (const k of ['id', 'title', 'intro']) if (!ch[k]) errors.push(`${p}: missing ${k}`);
  if (!Number.isFinite(ch.year)) errors.push(`${p}: year must be a number`);
  if (!ch.memento || !ch.memento.name || !ch.memento.glyph || !ch.memento.text) errors.push(`${p}: memento needs name, glyph and text`);
  if (!Array.isArray(ch.tasks) || !ch.tasks.length) { errors.push(`${p}: no tasks`); return; }

  const sc = ch.scene;
  const produced = new Set();
  let doors = 0;
  for (const o of sc.objects) {
    const w = `${p} object "${o.id}"`;
    if (o.type === 'door') {
      doors++;
      validateSteps(o.steps, `${w}.steps`, sources, produced, errors);
      validateSteps(o.locked, `${w}.locked`, sources, produced, errors);
      if (o.task) produced.add(o.task);
    }
    for (const [n, it] of (o.interactions || []).entries()) {
      validateSteps(it.steps, `${w}.interactions[${n}]`, sources, produced, errors);
      if (it.task) produced.add(it.task);
    }
  }
  if (!doors) errors.push(`${p}: no door to finish the chapter`);

  // task bookkeeping: counters count their prefixed sub-tasks
  for (const t of ch.tasks) {
    if (t.needs) {
      const have = [...produced].filter((id) => id.startsWith(t.needs.prefix)).length;
      if (have < t.needs.count) errors.push(`${p}: task "${t.id}" needs ${t.needs.count} "${t.needs.prefix}*" tasks but content has ${have}`);
      produced.add(t.id);
    }
  }
  const known = new Set([...produced, ...ch.tasks.map((t) => t.id)]);
  for (const t of ch.tasks) if (!produced.has(t.id)) errors.push(`${p}: task "${t.id}" can never be completed`);
  for (const o of sc.objects) {
    for (const r of o.requires || []) if (!known.has(r)) errors.push(`${p}: door "${o.id}" requires unknown task "${r}"`);
    for (const ph of (o.screen && o.screen.phases) || []) {
      if (!known.has(ph.until)) errors.push(`${p}: screen of "${o.id}" waits for unknown task "${ph.until}"`);
      if (!['youtube', 'watch', 'offline'].includes(ph.mode)) errors.push(`${p}: screen of "${o.id}" has unknown mode "${ph.mode}"`);
    }
  }
  validateScene(sc, p, errors);
}

/** @returns string[] of problems (empty when the streamer content is fine) */
export function validateStreamer({ meta, chapters, home }) {
  const errors = [];
  const p = `streamer ${meta.id}`;
  for (const k of ['id', 'name', 'tagline', 'disclaimer']) if (!meta[k]) errors.push(`${p}: missing ${k}`);
  if (!meta.hero || !meta.hero.name || !meta.hero.look) errors.push(`${p}: hero needs name and look`);
  if (meta.unlock !== undefined && !['free', 'sequential'].includes(meta.unlock)) errors.push(`${p}: unlock must be "free" or "sequential"`);
  const sources = meta.sources || {};
  for (const [key, s] of Object.entries(sources)) {
    if (!s.label || !/^https?:\/\//.test(s.url || '')) errors.push(`${p}: source "${key}" needs label and http(s) url`);
  }
  if (!chapters.length) errors.push(`${p}: no chapters`);
  const seen = new Set();
  for (const ch of chapters) {
    if (seen.has(ch.id)) errors.push(`${p}: duplicate chapter id "${ch.id}"`);
    seen.add(ch.id);
    validateChapter(ch, sources, errors);
  }
  if (home) {
    const mementos = home.objects.filter((o) => o.type === 'memento').length;
    if (mementos < chapters.length) errors.push(`${p}: the room has ${mementos} pedestals for ${chapters.length} chapters (add homeSlots in presets.json)`);
    validateScene(home, `${p} room`, errors);
  }
  return errors;
}
