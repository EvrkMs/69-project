import test from 'node:test';
import assert from 'node:assert/strict';
import { loadContent } from '../server/content/loader.js';
import { expandStep, expandObject, expandScene, ContentError } from '../server/content/expand.js';
import { validateStreamer } from '../server/content/validate.js';

test('all shipped content (including the template) is valid', () => {
  const registry = loadContent({ includeTemplates: true });
  assert.ok(registry.get('derzko'));
  assert.ok(registry.get('_template'));
  assert.equal(registry.get('derzko').chapters.length, 12);
});

test('step shorthand expands to speaker objects', () => {
  assert.deepEqual(expandStep(['h', 'hi']), { who: 'hero', text: 'hi' });
  assert.deepEqual(expandStep(['n', 'hey'], { npcName: 'Bob' }), { who: 'npc', name: 'Bob', text: 'hey' });
  assert.deepEqual(expandStep(['n', 'Ann', 'hey']), { who: 'npc', name: 'Ann', text: 'hey' });
  assert.deepEqual(expandStep(['fact', 'f', 'src']), { who: 'fact', text: 'f', src: 'src' });
  assert.throws(() => expandStep(['zzz', 'x']), /unknown step kind/);
});

test('npc references and prop kinds pull defaults from shared definitions', () => {
  const ctx = {
    npcs: { bob: { name: 'Bob', color: '#111111', hair: '#222222', interactions: [{ task: 'npc_bob', steps: [['n', 'yo']] }] } },
    props: { chair: { id: 'chair', name: 'Chair', w: 1, h: 1, z: 0.5, color: '#333333', type: 'prop' } },
    scenes: { room: { w: 4, h: 4, indoor: true, floor: ['#000000', '#111111'], start: { x: 1, y: 1 } } },
  };
  const bob = expandObject({ npc: 'bob', x: 2, y: 2 }, ctx);
  assert.equal(bob.type, 'npc');
  assert.equal(bob.interactions[0].steps[0].name, 'Bob');
  assert.deepEqual(expandObject({ type: 'prop', kind: 'chair', x: 1, y: 1 }, ctx), { id: 'chair', name: 'Chair', w: 1, h: 1, z: 0.5, color: '#333333', type: 'prop', x: 1, y: 1 });
  assert.equal(expandScene({ preset: 'room', floor: ['#abcdef', '#fedcba'], objects: [] }, ctx).floor[0], '#abcdef', 'chapter overrides win over the preset');
  assert.throws(() => expandObject({ npc: 'nobody', x: 0, y: 0 }, ctx), /unknown npc/);
});

// A tiny valid streamer to mutate in the negative tests below.
const make = () => ({
  meta: { id: 's', name: 'S', tagline: 't', disclaimer: 'd', hero: { name: 'S', look: {} }, sources: { a: { label: 'A', url: 'https://a.example' } } },
  chapters: [{
    id: 'c1', year: 2000, title: 'T', intro: 'I', memento: { name: 'Thing', glyph: '*', text: 'A keepsake.' }, tasks: [{ id: 'go', text: 'Go' }],
    scene: {
      w: 5, h: 5, floor: ['#000000', '#111111'], start: { x: 1.5, y: 3.5 },
      objects: [
        { id: 'box', name: 'Box', type: 'box', x: 1, y: 1, w: 1, h: 1, z: 1, interactions: [{ task: 'go', steps: [{ who: 'fact', text: 'f', src: 'a' }] }] },
        { id: 'door', name: 'Door', type: 'door', x: 3, y: 0, w: 1, h: 0.3, z: 2, requires: ['go'], locked: [{ who: 'hero', text: 'no' }], steps: [{ who: 'hero', text: 'ok' }] },
      ],
    },
  }],
});

test('the baseline test streamer is valid', () => assert.deepEqual(validateStreamer(make()), []));

const problems = (mutate) => { const s = make(); mutate(s); return validateStreamer(s).join('\n'); };

test('validator catches broken content', () => {
  assert.match(problems((s) => { s.chapters[0].scene.objects[0].interactions[0].steps[0].src = 'nope'; }), /unknown source "nope"/);
  assert.match(problems((s) => { s.chapters[0].tasks.push({ id: 'ghost', text: 'x' }); }), /task "ghost" can never be completed/);
  assert.match(problems((s) => { s.chapters[0].scene.objects[1].requires = ['typo']; }), /requires unknown task "typo"/);
  assert.match(problems((s) => { s.chapters[0].scene.objects[0].x = 4.5; }), /outside the 5x5 scene/);
  assert.match(problems((s) => { s.chapters[0].scene.objects.push({ id: 'dup', type: 'box', x: 1, y: 1, w: 1, h: 1, z: 1, interactions: [] }); }), /overlaps "box"/);
  assert.match(problems((s) => { s.chapters[0].scene.start = { x: 1.5, y: 1.5 }; }), /start tile 1,1 is blocked/);
  assert.match(problems((s) => { s.chapters[0].scene.objects.splice(1, 1); }), /no door/);
  assert.match(problems((s) => { s.chapters[0].scene.objects[0].interactions[0].steps[0].text = ' '; }), /empty text/);
  assert.match(problems((s) => { s.meta.sources.a.url = 'ftp://x'; }), /needs label and http/);
});

test('validator catches walled-in objects', () => {
  const msg = problems((s) => {
    const sc = s.chapters[0].scene;
    // fence the start tile (1,3) in completely
    sc.objects.push({ id: 'f1', type: 'box', x: 0, y: 2, w: 3, h: 1, z: 1, interactions: [] });
    sc.objects.push({ id: 'f2', type: 'box', x: 0, y: 3, w: 1, h: 1, z: 1, interactions: [] });
    sc.objects.push({ id: 'f3', type: 'box', x: 2, y: 3, w: 1, h: 1, z: 1, interactions: [] });
    sc.objects.push({ id: 'f4', type: 'box', x: 0, y: 4, w: 3, h: 1, z: 1, interactions: [] });
  });
  assert.match(msg, /unreachable from the start/);
});

test('hold-actions and mid-scene tasks', () => {
  assert.deepEqual(expandStep(['action', 'Create channel', { hold: 900 }]), { who: 'action', label: 'Create channel', hold: 900 });
  assert.equal(expandStep(['action', 'Go']).hold, 1200, 'default hold time');
  assert.deepEqual(expandStep(['task', 'twitch']), { who: 'task', task: 'twitch' });

  // a task completed by a step counts as completable
  const ok = problems((s) => {
    const o = s.chapters[0].scene.objects[0];
    o.interactions[0].task = undefined;
    o.interactions[0].steps.push({ who: 'task', task: 'go' });
  });
  assert.equal(ok, '');
  assert.match(problems((s) => { s.chapters[0].scene.objects[0].interactions[0].steps.push({ who: 'action', label: '', hold: 900 }); }), /action without a label/);
  assert.match(problems((s) => { s.chapters[0].scene.objects[0].interactions[0].steps.push({ who: 'action', label: 'x', hold: 5 }); }), /hold must be/);
});

test('screen phases must wait for real tasks and known modes', () => {
  assert.match(problems((s) => { s.chapters[0].scene.objects[0].screen = { phases: [{ until: 'nope', mode: 'youtube' }] }; }), /waits for unknown task "nope"/);
  assert.match(problems((s) => { s.chapters[0].scene.objects[0].screen = { phases: [{ until: 'go', mode: 'tv' }] }; }), /unknown mode "tv"/);
  assert.equal(problems((s) => { s.chapters[0].scene.objects[0].screen = { phases: [{ until: 'go', mode: 'offline' }] }; }), '');
});

test('furniture models are checked against the renderer list', async () => {
  const { readFileSync } = await import('node:fs');
  const { MODEL_NAMES } = await import('../shared/models.js');
  // every name must really exist in the renderer (the renderer needs a DOM, so we read its source instead of importing it)
  const src = readFileSync(new URL('../public/js/engine/furniture.js', import.meta.url), 'utf8');
  for (const name of MODEL_NAMES) assert.match(src, new RegExp(`\\n  ${name}\\(o\\)`), `furniture.js has no model "${name}"`);

  assert.equal(problems((s) => { s.chapters[0].scene.objects[0].model = 'bed'; s.chapters[0].scene.objects[0].facing = 'x'; }), '');
  assert.match(problems((s) => { s.chapters[0].scene.objects[0].model = 'throne'; }), /unknown model "throne"/);
  assert.match(problems((s) => { s.chapters[0].scene.objects[0].facing = 'up'; }), /facing must be/);
});

test('every chapter needs a keepsake for the hero room', () => {
  assert.match(problems((s) => { delete s.chapters[0].memento; }), /memento needs name, glyph and text/);
});

test('the hero room gets one pedestal per chapter, an exit, and enough slots', () => {
  const derzko = loadContent().get('derzko');
  const pedestals = derzko.home.objects.filter((o) => o.type === 'memento');
  assert.equal(pedestals.length, derzko.chapters.length);
  assert.deepEqual(pedestals.map((o) => o.chapter), derzko.chapters.map((c) => c.id), 'pedestals follow chapter order');
  assert.ok(derzko.home.objects.some((o) => o.type === 'portal' && o.to === 'lobby'));

  const tooFew = { ...derzko, home: { ...derzko.home, objects: derzko.home.objects.filter((o) => o.type !== 'memento').concat(pedestals.slice(0, 2)) } };
  assert.match(validateStreamer(tooFew).join('\n'), /pedestals for 12 chapters/);
});

test('counter tasks must have enough sub-tasks', () => {
  const msg = problems((s) => { s.chapters[0].tasks.push({ id: 'many', text: 'many', needs: { prefix: 'npc_', count: 2 } }); });
  assert.match(msg, /needs 2 "npc_\*" tasks but content has 0/);
});

test('ContentError lists every problem', () => {
  const e = new ContentError(['a', 'b']);
  assert.match(e.message, /- a\n - b/);
});

test('unlock must be free or sequential', () => {
  assert.match(problems((s) => { s.meta.unlock = 'maybe'; }), /unlock must be "free" or "sequential"/);
});

test('the hero must not start wedged against furniture (the body is wider than a point)', () => {
  // a block ends exactly where the hero starts: the point is on a free tile, but the body's left edge is inside the block
  const msg = problems((s) => { const sc = s.chapters[0].scene; sc.start = { x: 3, y: 2.5 }; sc.objects.push({ id: 'wall', name: 'Wall', type: 'box', x: 2, y: 2, w: 1, h: 1, z: 1, color: '#444', interactions: [{ steps: [['h', 'x']] }] }); });
  assert.match(msg, /start point 3,2.5 is wedged against furniture/);
});
