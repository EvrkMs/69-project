import { hmac, safeEqual, b64u, fromB64u } from './crypto.js';

// Checkpoint = signed progress bound to a session id. The server stores nothing per player.
// v3: { v: 3, p: { <streamerId>: [<completed chapter ids>] } }

export const freshState = () => ({ v: 3, p: {} });

export const doneChapters = (state, streamerId) => state.p[streamerId] || [];

export function markDone(state, streamerId, chapterId) {
  const list = state.p[streamerId] || (state.p[streamerId] = []);
  if (!list.includes(chapterId)) list.push(chapterId);
}

export function signCheckpoint(sid, state) {
  const payload = b64u(JSON.stringify(state));
  return `${payload}.${hmac('cp', sid, payload)}`;
}

function normalize(raw) {
  // v2 (single streamer) progress belongs to Derzko, the only hero that existed then.
  if (raw && raw.v === 2 && Array.isArray(raw.ch)) return { v: 3, p: { derzko: raw.ch.filter((c) => typeof c === 'string') } };
  if (raw && raw.v === 3 && raw.p && typeof raw.p === 'object') {
    const p = {};
    for (const [id, list] of Object.entries(raw.p)) if (Array.isArray(list)) p[id] = list.filter((c) => typeof c === 'string');
    return { v: 3, p };
  }
  return freshState();
}

export function readCheckpoint(sid, token) {
  if (!token) return freshState();
  const [payload, mac] = token.split('.');
  if (!payload || !mac || !safeEqual(mac, hmac('cp', sid, payload))) return freshState();
  try {
    return normalize(JSON.parse(fromB64u(payload).toString('utf8')));
  } catch {
    return freshState();
  }
}
