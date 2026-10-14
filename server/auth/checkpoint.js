import { hmac, safeEqual, b64u, fromB64u } from './crypto.js';

// Checkpoint = signed progress bound to a session id. The server stores nothing per player.
// v3: { v: 3, p: { <streamerId>: [<completed chapter ids>] } }

const TOKEN_MAX = 4096;                   // cookie size cap: anything bigger is not ours
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;
const MAX_STREAMERS = 32, MAX_CHAPTERS = 64;

export const freshState = () => ({ v: 3, p: {} });

export const doneChapters = (state, streamerId) => (Object.hasOwn(state.p, streamerId) ? state.p[streamerId] : []);

export function markDone(state, streamerId, chapterId) {
  if (!Object.hasOwn(state.p, streamerId)) state.p[streamerId] = [];
  if (!state.p[streamerId].includes(chapterId)) state.p[streamerId].push(chapterId);
}

export function signCheckpoint(sid, state) {
  const payload = b64u(JSON.stringify(state));
  return `${payload}.${hmac('checkpoint', sid, payload)}`;
}

// The payload is signed, but it is still parsed defensively: bounded sizes, plain ids, no prototype keys.
function cleanProgress(map) {
  const p = {};
  for (const [id, list] of Object.entries(map).slice(0, MAX_STREAMERS)) {
    if (id === '__proto__' || !ID_RE.test(id) || !Array.isArray(list)) continue;
    p[id] = list.slice(0, MAX_CHAPTERS).filter((c) => typeof c === 'string' && ID_RE.test(c));
  }
  return p;
}

function normalize(raw) {
  if (!raw || typeof raw !== 'object') return freshState();
  // v2 (single streamer) progress belongs to Derzko, the only hero that existed then.
  if (raw.v === 2 && Array.isArray(raw.ch)) return { v: 3, p: cleanProgress({ derzko: raw.ch }) };
  if (raw.v === 3 && raw.p && typeof raw.p === 'object' && !Array.isArray(raw.p)) return { v: 3, p: cleanProgress(raw.p) };
  return freshState();
}

export function readCheckpoint(sid, token) {
  if (typeof token !== 'string' || token.length > TOKEN_MAX) return freshState();
  const [payload, mac, extra] = token.split('.');
  if (!payload || !mac || extra !== undefined || !safeEqual(mac, hmac('checkpoint', sid, payload))) return freshState();
  try {
    return normalize(JSON.parse(fromB64u(payload).toString('utf8')));
  } catch {
    return freshState();
  }
}
