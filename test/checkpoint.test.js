process.env.ARCH69_SECRET ||= 'test-secret-'.padEnd(48, 'x'); // keep tests from touching the real .secret
import test from 'node:test';
import assert from 'node:assert/strict';
import { signCheckpoint, readCheckpoint, freshState, markDone, doneChapters } from '../server/auth/checkpoint.js';
import { b64u } from '../server/auth/crypto.js';
import { hmac } from '../server/auth/crypto.js';
import { uaHash, issueSession, verifySession } from '../server/auth/session.js';

test('progress survives a sign / read round trip and is per streamer', () => {
  const state = freshState();
  markDone(state, 'derzko', 'c1');
  markDone(state, 'derzko', 'c1'); // idempotent
  markDone(state, 'other', 'c1');
  const back = readCheckpoint('sid-1', signCheckpoint('sid-1', state));
  assert.deepEqual(doneChapters(back, 'derzko'), ['c1']);
  assert.deepEqual(doneChapters(back, 'other'), ['c1']);
  assert.deepEqual(doneChapters(back, 'nobody'), []);
});

test('a checkpoint from another session or with a tampered payload is ignored', () => {
  const state = freshState();
  markDone(state, 'derzko', 'c1');
  const token = signCheckpoint('sid-1', state);
  assert.deepEqual(readCheckpoint('sid-2', token), freshState(), 'bound to its session');
  const [, mac] = token.split('.');
  const forged = `${b64u(JSON.stringify({ v: 3, p: { derzko: ['c1', 'c2', 'c3'] } }))}.${mac}`;
  assert.deepEqual(readCheckpoint('sid-1', forged), freshState(), 'signature must match the payload');
  assert.deepEqual(readCheckpoint('sid-1', 'garbage'), freshState());
  assert.deepEqual(readCheckpoint('sid-1', undefined), freshState());
});

test('legacy v2 progress migrates to Derzko, the only hero at that time', () => {
  const payload = b64u(JSON.stringify({ v: 2, ch: ['c1', 'c2'] }));
  const migrated = readCheckpoint('sid-1', `${payload}.${hmac('checkpoint', 'sid-1', payload)}`);
  assert.deepEqual(doneChapters(migrated, 'derzko'), ['c1', 'c2']);
});

test('session cookies bind to a browser family, not to an IP or a version', () => {
  const chrome120 = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36';
  const chrome121 = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/121.0 Safari/537.36';
  const firefox = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0';
  assert.equal(uaHash(chrome120), uaHash(chrome121), 'a browser update keeps the session');
  assert.notEqual(uaHash(chrome120), uaHash(firefox));

  const { raw, sid } = issueSession(chrome120);
  assert.equal(verifySession(raw, chrome121)?.sid, sid);
  assert.equal(verifySession(raw, firefox), null, 'same cookie in another browser is rejected');
  assert.equal(verifySession(raw.replace(/.$/, 'x'), chrome120), null, 'tampered signature is rejected');
});
