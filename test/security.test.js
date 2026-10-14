import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, symlinkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../server/app.js';
import { loadConfig } from '../server/config.js';
import { loadContent } from '../server/content/loader.js';
import { staticHandler } from '../server/http/static.js';
import { CSP } from '../server/http/security.js';
import { hmac } from '../server/auth/crypto.js';
import { issueSession, verifySession, _cacheSize, _CACHE_MAX } from '../server/auth/session.js';
import { signCheckpoint, readCheckpoint, doneChapters } from '../server/auth/checkpoint.js';

process.env.ARCH69_SECRET ||= 'test-secret-'.padEnd(48, 'x'); // keep tests from touching the real .secret

const registry = loadContent();
const chapterUrl = '/api/streamers/derzko/chapters/c1/complete';

/** Real HTTP with nothing normalised on the way: paths and headers go out exactly as written. */
function raw(port, { method = 'GET', path: p = '/', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, method, path: p, agent: false, headers: { host: `localhost:${port}`, ...headers } }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    if (body !== undefined) req.write(body);
    req.end();
  });
}

async function withServer(overrides, fn) {
  const base = loadConfig({});
  const config = { ...base, ...overrides, rate: { ...base.rate, ...(overrides.rate || {}) } };
  const server = createApp({ registry, config });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  try { await fn(server.address().port, config); } finally {
    server.closeAllConnections?.();
    await new Promise((r) => server.close(r));
  }
}

const post = (port, headers = {}, body = '{"tasks":[]}') =>
  raw(port, { method: 'POST', path: chapterUrl, headers: { 'content-type': 'application/json', ...headers }, body });

// ---------------------------------------------------------------- headers

test('every response carries the browser protections, errors included', async () => {
  await withServer({}, async (port) => {
    for (const p of ['/', '/api/streamers', '/nope.js', '/api/streamers/nobody']) {
      const r = await raw(port, { path: p });
      assert.equal(r.headers['x-content-type-options'], 'nosniff', p);
      assert.equal(r.headers['x-frame-options'], 'DENY', p);
      assert.equal(r.headers['referrer-policy'], 'strict-origin-when-cross-origin', p);
      assert.equal(r.headers['cross-origin-opener-policy'], 'same-origin', p);
      assert.equal(r.headers['cross-origin-resource-policy'], 'same-origin', p);
      assert.match(r.headers['permissions-policy'], /camera=\(\)/, p);
      assert.equal(r.headers['content-security-policy'], CSP, p);
      assert.equal(r.headers['x-powered-by'], undefined, p);
    }
  });
});

test('the CSP allows no inline code, no wildcards, and framing only by YouTube and Twitch players', () => {
  assert.doesNotMatch(CSP, /unsafe-inline|unsafe-eval|\*/);
  assert.match(CSP, /default-src 'none'/);
  assert.match(CSP, /script-src 'self'(;|$)/);
  assert.match(CSP, /frame-ancestors 'none'/);
  assert.match(CSP, /object-src 'none'/);
  assert.match(CSP, /base-uri 'none'/);
  assert.match(CSP, /frame-src https:\/\/www\.youtube-nocookie\.com https:\/\/clips\.twitch\.tv(;|$)/);
});

test('cookies are HttpOnly and SameSite; Secure and HSTS appear when the deployment is HTTPS', async () => {
  await withServer({}, async (port) => {
    const r = await raw(port, { path: '/api/streamers' });
    const cookies = [].concat(r.headers['set-cookie']);
    assert.equal(cookies.length, 2, 'session + checkpoint');
    for (const c of cookies) {
      assert.match(c, /; HttpOnly/);
      assert.match(c, /; SameSite=Lax/);
      assert.doesNotMatch(c, /; Secure/, 'plain-http development must still work');
    }
    assert.equal(r.headers['strict-transport-security'], undefined);
  });
  await withServer({ secureCookies: true }, async (port) => {
    const r = await raw(port, { path: '/api/streamers' });
    for (const c of [].concat(r.headers['set-cookie'])) assert.match(c, /; Secure/);
    assert.match(r.headers['strict-transport-security'], /max-age=31536000/);
    assert.match(r.headers['content-security-policy'], /upgrade-insecure-requests/);
  });
  await withServer({ trustProxy: true }, async (port) => {
    const behindProxy = await raw(port, { path: '/api/streamers', headers: { 'x-forwarded-proto': 'https' } });
    assert.match([].concat(behindProxy.headers['set-cookie'])[0], /; Secure/, 'proxy says https and is trusted');
  });
  await withServer({}, async (port) => {
    const spoofed = await raw(port, { path: '/api/streamers', headers: { 'x-forwarded-proto': 'https' } });
    assert.doesNotMatch([].concat(spoofed.headers['set-cookie'])[0], /; Secure/, 'forwarded headers are ignored unless TRUST_PROXY is set');
  });
});

// ---------------------------------------------------------------- request gate

test('unexpected Host headers are refused (DNS rebinding, host tricks)', async () => {
  await withServer({}, async (port) => {
    for (const host of ['evil.example', 'localhost.evil.example', '127.0.0.1.evil.example:80', 'localhost@evil.example', 'evil.example:80@localhost']) {
      assert.equal((await raw(port, { path: '/', headers: { host } })).status, 421, `host "${host}"`);
      assert.equal((await raw(port, { path: '/api/streamers', headers: { host } })).status, 421);
    }
    assert.equal((await raw(port, { path: '/', headers: { host: 'LOCALHOST:1234' } })).status, 200, 'case and port do not matter');
  });
  await withServer({ allowedHosts: ['game.example'] }, async (port) => {
    assert.equal((await raw(port, { path: '/', headers: { host: 'game.example' } })).status, 200);
    assert.equal((await raw(port, { path: '/', headers: { host: 'localhost' } })).status, 421);
  });
});

test('an HTTP/1.1 request with no Host header at all is refused', async () => {
  await withServer({}, async (port) => {
    const answer = await new Promise((resolve) => {
      const socket = net.connect(port, '127.0.0.1', () => socket.write('GET /api/streamers HTTP/1.1\r\nConnection: close\r\n\r\n'));
      let data = '';
      socket.on('data', (c) => { data += c; });
      socket.on('close', () => resolve(data));
      socket.on('error', () => resolve(data));
    });
    assert.match(answer, /^HTTP\/1\.1 4\d\d /, 'refused with a 4xx, never served');
    assert.doesNotMatch(answer, /derzko/i);
  });
});

test('only GET, HEAD and (on the API) POST exist', async () => {
  await withServer({}, async (port) => {
    for (const method of ['PUT', 'DELETE', 'PATCH', 'OPTIONS', 'TRACE']) {
      const r = await raw(port, { method, path: '/api/streamers' });
      assert.equal(r.status, 405, method);
      assert.equal(r.headers.allow, 'GET, HEAD, POST');
    }
    const staticPost = await raw(port, { method: 'POST', path: '/', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(staticPost.status, 405);
    assert.equal(staticPost.headers.allow, 'GET, HEAD');
    assert.equal((await raw(port, { path: '/api/streamers', headers: { origin: 'https://evil.example' } })).headers['access-control-allow-origin'], undefined, 'no CORS: other sites cannot read the API');
  });
});

test('oversized URLs and malformed request targets are refused', async () => {
  await withServer({}, async (port) => {
    assert.equal((await raw(port, { path: '/' + 'a'.repeat(3000) })).status, 414);
    assert.equal((await raw(port, { path: '*' })).status, 400);
  });
});

test('rate limits answer 429 with Retry-After, per kind of request', async () => {
  await withServer({ rate: { api: 3, post: 2, static: 4 } }, async (port) => {
    const codes = [];
    for (let i = 0; i < 5; i++) codes.push((await raw(port, { path: '/api/streamers' })).status);
    assert.deepEqual(codes, [200, 200, 200, 429, 429]);
    const limited = await raw(port, { path: '/api/streamers' });
    assert.ok(Number(limited.headers['retry-after']) >= 1);
    assert.deepEqual(JSON.parse(limited.body), { error: 'rate_limited' });

    assert.equal((await raw(port, { path: '/' })).status, 200, 'static has its own budget');
    assert.equal((await post(port)).status, 400, 'first POST passes the gate (and fails on missing tasks)');
    assert.equal((await post(port)).status, 400);
    assert.equal((await post(port)).status, 429);
  });
});

// ---------------------------------------------------------------- CSRF and body handling

test('POST: cross-origin requests are rejected, same-origin ones pass the gate', async () => {
  await withServer({}, async (port) => {
    const own = `http://localhost:${port}`;
    assert.equal((await post(port, { origin: 'https://evil.example' })).status, 403);
    assert.equal((await post(port, { origin: 'null' })).status, 403, 'sandboxed-iframe style origin');
    assert.equal((await post(port, { origin: `${own}.evil.example` })).status, 403);
    assert.equal((await post(port, { 'sec-fetch-site': 'cross-site' })).status, 403, 'no Origin, but the browser says cross-site');
    assert.equal((await post(port, { origin: own })).status, 400, 'passes the gate, then fails on missing tasks');
    assert.equal((await post(port, { 'sec-fetch-site': 'same-origin' })).status, 400);
  });
});

test('POST body rules: JSON object only, correct media type, size capped by bytes', async () => {
  await withServer({}, async (port) => {
    const send = (headers, body) => raw(port, { method: 'POST', path: chapterUrl, headers, body });
    assert.equal((await send({ 'content-type': 'text/plain' }, '{}')).status, 415, 'what a cross-site form can send');
    assert.equal((await send({ 'content-type': 'application/x-www-form-urlencoded' }, 'tasks=1')).status, 415);
    assert.equal((await send({}, '{}')).status, 415);
    assert.equal((await send({ 'content-type': 'application/json' }, '{not json')).status, 400);
    assert.equal((await send({ 'content-type': 'application/json' }, '[1,2]')).status, 400, 'arrays are not objects');
    assert.equal((await send({ 'content-type': 'application/json' }, 'null')).status, 400);
    const big = await send({ 'content-type': 'application/json' }, JSON.stringify({ tasks: Array(1000).fill('pc1') }));
    assert.equal(big.status, 413);
    assert.deepEqual(JSON.parse(big.body), { error: 'too_large' });
    assert.equal((await send({ 'content-type': 'application/json; charset=utf-8' }, '{"tasks":[]}')).status, 400, 'charset parameter is fine');
  });
});

test('task lists with junk are treated as empty instead of being trusted', async () => {
  await withServer({}, async (port) => {
    for (const tasks of [{ pc1: true }, 'pc1', 7, [{ id: 'pc1' }], [null, 1, {}], ['x'.repeat(41)]]) {
      const r = await post(port, {}, JSON.stringify({ tasks }));
      assert.equal(r.status, 400, JSON.stringify(tasks));
      assert.equal(JSON.parse(r.body).error, 'tasks_incomplete');
    }
  });
});

// ---------------------------------------------------------------- static files

test('static serving refuses traversal in every spelling and never leaks project files', async () => {
  await withServer({}, async (port) => {
    const attacks = [
      '/..%2fserver%2findex.js', '/%2e%2e/server/index.js', '/%2E%2E%2Fserver%2Findex.js', '/js/..%2f..%2fserver%2findex.js',
      '/js/../../server/index.js', '/shared/..%5cserver%5cindex.js', '/shared/%2e%2e/server/app.js', '/%00', '/js/main.js%00.png',
      '/.gitignore', '/.secret', '/js/.hidden.js', '/shared/.env', '//etc/passwd', '/package.json', '/server/index.js',
      '/content/streamers/derzko/streamer.json', '/content/presets.json', '/test/api.test.js', '/README.md', '/node_modules/x.js', '/%',
    ];
    for (const p of attacks) {
      const r = await raw(port, { path: p });
      assert.ok([400, 404].includes(r.status), `${p} -> ${r.status}`);
      assert.doesNotMatch(r.body, /createApp|ARCH69_SECRET|streamer\.json|"chapters"/, `${p} leaked something`);
    }
    const ok = await raw(port, { path: '/js/main.js' });
    assert.equal(ok.status, 200);
    assert.match(ok.headers['content-type'], /text\/javascript/);
    assert.equal(ok.headers['x-content-type-options'], 'nosniff');
    const head = await raw(port, { method: 'HEAD', path: '/js/main.js' });
    assert.equal(head.status, 200);
    assert.equal(head.body, '');
    assert.ok(Number(head.headers['content-length']) > 0);
  });
});

test('a symlink inside the web root cannot reach outside it', async (t) => {
  const dir = mkdtempSync(path.join(tmpdir(), 'arch69-static-'));
  const web = path.join(dir, 'web');
  mkdirSync(web);
  writeFileSync(path.join(web, 'ok.json'), '{"fine":true}');
  writeFileSync(path.join(dir, 'outside.json'), '{"secret":true}');
  try { symlinkSync(path.join(dir, 'outside.json'), path.join(web, 'link.json')); } catch { return t.skip('symlinks are not available here'); }

  const serve = staticHandler(web);
  const call = async (p) => {
    const out = { status: 0, body: '' };
    const res = { writeHead: (s) => { out.status = s; }, end: (b) => { out.body = String(b ?? ''); } };
    await serve({ method: 'GET' }, res, new URL(p, 'http://localhost'));
    return out;
  };
  assert.equal((await call('/ok.json')).status, 200);
  const link = await call('/link.json');
  assert.equal(link.status, 404);
  assert.doesNotMatch(link.body, /secret/);
});

// ---------------------------------------------------------------- sessions, tokens, secrets

test('junk and oversized cookies never reach the HMAC or the cache, and never break the request', async () => {
  const ua = 'Mozilla/5.0 (Windows NT 10.0) Chrome/120.0';
  const before = _cacheSize();
  const good = issueSession(ua);
  const [, sid, mac] = good.raw.split('.');
  const junk = [
    'x'.repeat(5000), `session.${sid}`, `session.${sid}.${mac}.extra`, `session.${'a'.repeat(21)}.${mac}`, `session.${sid}.${mac.slice(1)}`,
    `other.${sid}.${mac}`, `session.${sid}.${'A'.repeat(43)}`, '', null, undefined, 42,
  ];
  for (const raw of junk) assert.equal(verifySession(raw, ua), null, String(raw).slice(0, 30));
  assert.equal(_cacheSize(), before, 'nothing junk was cached');

  await withServer({}, async (port) => {
    const r = await raw(port, { path: '/api/streamers', headers: { cookie: `session=${'x'.repeat(8000)}; cp=${'y'.repeat(8000)}` } });
    assert.equal(r.status, 200, 'a hostile cookie just means "new visitor"');
    assert.match([].concat(r.headers['set-cookie']).join(' '), /session=session\./);
  });
});

test('the session cache is bounded', () => {
  const ua = 'Mozilla/5.0 (X11; Linux x86_64) Firefox/120.0';
  for (let i = 0; i < _CACHE_MAX + 50; i++) verifySession(issueSession(ua).raw, ua);
  assert.ok(_cacheSize() <= _CACHE_MAX);
});

test('tokens signed for one purpose are worthless for another', () => {
  assert.notEqual(hmac('session', 'x'), hmac('checkpoint', 'x'));
  assert.notEqual(hmac('l', 'a', 'bc'), hmac('l', 'ab', 'c'), 'part boundaries are part of the message');
  const s = issueSession('Mozilla/5.0 Chrome/120.0');
  const mac = s.raw.split('.')[2];
  const asCheckpoint = `${Buffer.from(JSON.stringify({ v: 3, p: { derzko: ['c1', 'c2'] } })).toString('base64url')}.${mac}`;
  assert.deepEqual(doneChapters(readCheckpoint(s.sid, asCheckpoint), 'derzko'), [], 'a session signature does not unlock chapters');
});

test('a signed checkpoint is still parsed defensively', () => {
  const state = { v: 3, p: { ['__proto__']: ['c1'], derzko: ['c1', 5, 'x'.repeat(100), 'c2', null], 'bad id!': ['c1'], constructor: 'nope' } };
  const read = readCheckpoint('sid', signCheckpoint('sid', state));
  assert.equal(Object.getPrototypeOf(read.p), Object.prototype, 'prototype untouched');
  assert.deepEqual(Object.keys(read.p), ['derzko']);
  assert.deepEqual(read.p.derzko, ['c1', 'c2']);
  assert.deepEqual(doneChapters(read, 'constructor'), [], 'inherited names are not progress');
  assert.deepEqual(doneChapters(read, 'toString'), []);
  assert.deepEqual(readCheckpoint('sid', 'a.b.c'), { v: 3, p: {} });
  assert.deepEqual(readCheckpoint('sid', 'x'.repeat(10_000)), { v: 3, p: {} });
});

test('the signing key must be strong, and a short one stops the server instead of weakening it', () => {
  const run = (secret) => execFileSync(process.execPath, ['--input-type=module', '-e', "import('./server/auth/crypto.js').then((m) => console.log(m.hmac('t', 'x')))"], {
    cwd: path.resolve(import.meta.dirname, '..'), env: { ...process.env, ARCH69_SECRET: secret }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  assert.match(run('k'.repeat(40)).trim(), /^[A-Za-z0-9_-]{43}$/);
  assert.throws(() => run('too-short'), (e) => /at least 32 bytes/.test(e.stderr));
});
