// Turns authoring shorthand (compact JSON in content/) into the runtime chapter format the client consumes.
//
// Dialogue steps are tuples:
//   ["h", text]                 hero line
//   ["n", text]                 line of the NPC that owns the interaction (name is implicit)
//   ["n", name, text]           line of a named NPC
//   ["fact", text, sourceKey]   fact card with a source link
//   ["clip", text, media]       clip card, media = {type:"youtube", id, title} | {type:"twitchclip", slug, title}
//   ["action", label, {hold}]   round button the player must hold for `hold` ms (default 1200) to continue
//   ["task", taskId]            completes a task mid-scene (the monitor / door state reacts immediately)

export class ContentError extends Error {
  constructor(errors) {
    super(`Content problems:\n - ${errors.join('\n - ')}`);
    this.errors = errors;
  }
}

export function expandStep(step, ctx = {}) {
  if (!Array.isArray(step) || typeof step[0] !== 'string') throw new Error(`bad step ${JSON.stringify(step)}`);
  const [kind, ...rest] = step;
  switch (kind) {
    case 'h': return { who: 'hero', text: rest[0] };
    case 'n': return rest.length >= 2 ? { who: 'npc', name: rest[0], text: rest[1] } : { who: 'npc', name: ctx.npcName, text: rest[0] };
    case 'fact': return { who: 'fact', text: rest[0], src: rest[1] };
    case 'clip': return { who: 'clip', text: rest[0], media: rest[1] };
    // Non-dialogue steps: the player must hold a button, or a task is completed silently mid-scene.
    case 'action': return { who: 'action', label: rest[0], hold: (rest[1] && rest[1].hold) || 1200 };
    case 'task': return { who: 'task', task: rest[0] };
    default: throw new Error(`unknown step kind "${kind}"`);
  }
}

export const expandSteps = (steps, ctx) => steps.map((s) => expandStep(s, ctx));

const expandInteractions = (list = [], ctx) => list.map((it) => ({ ...(it.task ? { task: it.task } : {}), steps: expandSteps(it.steps, ctx) }));

/** @param ctx { npcs: {id: def}, props: {kind: defaults} } */
export function expandObject(o, ctx) {
  if (o.npc) {
    const def = ctx.npcs[o.npc];
    if (!def) throw new Error(`unknown npc "${o.npc}"`);
    return {
      id: o.id || o.npc, name: def.name, type: 'npc', x: o.x, y: o.y, w: 1, h: 1, z: 1.4, color: def.color, hair: def.hair,
      interactions: expandInteractions(def.interactions, { npcName: def.name }),
    };
  }
  if (o.type === 'prop') {
    const defaults = ctx.props[o.kind];
    if (!defaults) throw new Error(`unknown prop kind "${o.kind}"`);
    const { kind, ...own } = o;
    return { ...defaults, ...own };
  }
  const out = { ...o };
  if (o.interactions) out.interactions = expandInteractions(o.interactions, { npcName: o.name });
  if (o.locked) out.locked = expandSteps(o.locked);
  if (o.type === 'door' && o.steps) out.steps = expandSteps(o.steps);
  return out;
}

export function expandScene(scene, ctx) {
  const { preset, objects, ...own } = scene;
  const base = preset ? ctx.scenes[preset] : {};
  if (preset && !base) throw new Error(`unknown scene preset "${preset}"`);
  return { ...base, ...own, objects: objects.map((o) => expandObject(o, ctx)) };
}

export function expandChapter(raw, ctx) {
  return {
    id: raw.id, year: raw.year, title: raw.title, intro: raw.intro,
    memento: raw.memento, // the keepsake that stands in the hero's room and opens this chapter
    tasks: raw.tasks, idle: raw.idle || [],
    scene: expandScene(raw.scene, ctx),
  };
}
