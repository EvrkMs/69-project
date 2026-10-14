process.env.ARCH69_SECRET ||= 'test-secret-'.padEnd(48, 'x'); // keep tests from touching the real .secret
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../server/app.js';
import { loadContent } from '../server/content/loader.js';

// A registry with two heroes: the real one and a renamed copy, to prove progress is tracked per streamer.
function twoHeroes() {
  const base = loadContent();
  const derzko = base.get('derzko');
  const copy = { meta: { ...derzko.meta, id: 'copy', name: 'Copy', nick: undefined }, chapters: derzko.chapters, home: derzko.home };
  const streamers = new Map([['derzko', derzko], ['copy', copy]]);
  return { streamers, list: () => [...streamers.values()], get: (id) => streamers.get(id) || null };
}

let server, base;
before(async () => {
  server = createApp({ registry: twoHeroes() });
  await new Promise((r) => server.listen(0, r));
  base = `http://localhost:${server.address().port}`;
});
after(() => new Promise((r) => server.close(r)));

// Minimal browser: keeps cookies between calls.
function browser() {
  const jar = new Map();
  return async (path, body) => {
    const res = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0', Cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    for (const c of res.headers.getSetCookie()) { const [kv] = c.split(';'); const i = kv.indexOf('='); jar.set(kv.slice(0, i), kv.slice(i + 1)); }
    return { status: res.status, data: await res.json() };
  };
}

const allTasks = (chapter) => chapter.tasks.map((t) => t.id);

test('streamer list and detail', async () => {
  const get = browser();
  const list = await get('/api/streamers');
  assert.equal(list.status, 200);
  assert.deepEqual(list.data.map((s) => s.id), ['derzko', 'copy']);
  assert.equal(list.data[0].nick, 'derzko69', 'the corridor plate shows the nickname');
  assert.equal(list.data[1].nick, 'Copy', 'falls back to the name when there is no nick');
  const one = await get('/api/streamers/derzko');
  assert.equal(one.data.hero.name, 'Дерзко');
  assert.equal(one.data.chapters[0].unlocked, true);
  assert.equal(one.data.chapters[1].unlocked, false);
  assert.ok(one.data.chapters.every((c) => c.memento && c.memento.name), 'every chapter exposes its keepsake');
  assert.equal(one.data.home.objects.filter((o) => o.type === 'memento').length, one.data.chapters.length, 'the room has a pedestal per chapter');
  assert.equal((await get('/api/streamers/nobody')).status, 404);
});

test('chapters unlock in order and need all tasks', async () => {
  const get = browser();
  assert.equal((await get('/api/streamers/derzko/chapters/c2')).status, 403, 'locked chapter is not served');
  const c1 = (await get('/api/streamers/derzko/chapters/c1')).data;

  const partial = await get('/api/streamers/derzko/chapters/c1/complete', { tasks: [allTasks(c1)[0]] });
  assert.equal(partial.status, 400);
  assert.ok(partial.data.missing.length);
  assert.equal((await get('/api/streamers/derzko/chapters/c2')).status, 403, 'still locked after a failed attempt');

  const ok = await get('/api/streamers/derzko/chapters/c1/complete', { tasks: allTasks(c1) });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.data.done, ['c1']);
  assert.equal(ok.data.chapters[1].unlocked, true);
  assert.equal((await get('/api/streamers/derzko/chapters/c2')).status, 200);
  assert.equal((await get('/api/streamers/derzko/chapters/c3')).status, 403, 'only the next chapter opens');
});

test('progress is separate per streamer and per session', async () => {
  const a = browser();
  const c1 = (await a('/api/streamers/derzko/chapters/c1')).data;
  await a('/api/streamers/derzko/chapters/c1/complete', { tasks: allTasks(c1) });
  assert.equal((await a('/api/streamers/copy/chapters/c2')).status, 403, 'finishing one hero does not unlock another');
  assert.equal((await a('/api/streamers')).data.find((s) => s.id === 'derzko').done, 1);

  const stranger = browser();
  assert.equal((await stranger('/api/streamers/derzko/chapters/c2')).status, 403, 'another browser starts from scratch');
});

test('static files, shared modules and path traversal', async () => {
  assert.equal((await fetch(`${base}/`)).status, 200);
  assert.equal((await fetch(`${base}/shared/grid.js`)).status, 200);
  assert.equal((await fetch(`${base}/js/main.js`)).status, 200);
  assert.equal((await fetch(`${base}/shared/../server/index.js`)).status, 404);
  assert.equal((await fetch(`${base}/..%2Fserver%2Findex.js`)).status, 404);
  assert.equal((await fetch(`${base}/content/streamers/derzko/streamer.json`)).status, 404, 'authoring files are not public');
});
