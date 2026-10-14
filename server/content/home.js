import { expandScene } from './expand.js';

/**
 * The hero's own room: one pedestal with a keepsake per chapter, plus an exit to the lobby.
 * Layout comes from presets.json (scenes.home + homeSlots); streamer.json "home" may override colors / deco.
 * Pedestals are `memento` objects the client turns into chapter entrances.
 */
export function buildHome(meta, chapters, shared) {
  const slots = shared.homeSlots || [];
  const scene = expandScene({ preset: 'home', ...(meta.home || {}), objects: [] }, { ...shared, npcs: {} });
  chapters.forEach((ch, i) => {
    const slot = slots[i];
    if (!slot) return; // validate.js reports "not enough slots"
    const m = ch.memento || {};
    scene.objects.push({
      id: `memento-${ch.id}`, type: 'memento', chapter: ch.id, name: m.name || ch.title, glyph: m.glyph || '✦',
      x: slot[0], y: slot[1], w: 1, h: 1, z: 0.7, color: m.color || '#6a3d7a',
    });
  });
  scene.objects.push({ id: 'exit', type: 'portal', to: 'lobby', name: 'Выход в коридор', x: scene.w - 3, y: 0, w: 2, h: 0.3, z: 2, color: meta.accent || '#8a5a2b' });
  return scene;
}
