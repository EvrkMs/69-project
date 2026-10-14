import { randomBytes } from 'node:crypto';
import { hmac, safeEqual, sha256hex, b64u } from './crypto.js';

const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX = 20_000;             // hard cap: a flood of fake sessions cannot grow memory without bound
const SID_RE = /^[A-Za-z0-9_-]{22}$/; // 16 random bytes, base64url
const MAC_RE = /^[A-Za-z0-9_-]{43}$/; // HMAC-SHA256, base64url
const COOKIE_MAX = 128;               // a valid cookie is "session." + 22 + "." + 43 = 74 chars; anything longer is junk

// Session identity is a random sid. IP is deliberately NOT part of it (VPNs, mobile networks).
// UA is only a weak binding, normalized to browser family + OS so auto-updates don't kill sessions.
export function uaHash(ua = '') {
  const browser =
    /edg\//i.test(ua) ? 'edge' :
    /opr\/|opera/i.test(ua) ? 'opera' :
    /firefox\//i.test(ua) ? 'firefox' :
    /chrome\//i.test(ua) ? 'chrome' :
    /safari\//i.test(ua) ? 'safari' : 'other';
  const os =
    /android/i.test(ua) ? 'android' :
    /iphone|ipad/i.test(ua) ? 'ios' :
    /windows/i.test(ua) ? 'windows' :
    /mac os/i.test(ua) ? 'mac' :
    /linux/i.test(ua) ? 'linux' : 'other';
  return sha256hex(`${browser}/${os}`).slice(0, 16);
}

// raw cookie + uaHash -> { sid, expires }. Insertion order doubles as eviction order (oldest first).
const cache = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) if (v.expires < now) cache.delete(k);
}, 60_000).unref();

function remember(key, sid, now) {
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { sid, expires: now + CACHE_TTL_MS });
}

export function issueSession(ua) {
  const sid = b64u(randomBytes(16));
  const raw = `session.${sid}.${hmac('session', sid, uaHash(ua))}`;
  return { sid, raw };
}

/** Returns { sid } for a valid cookie, otherwise null. Cheap shape checks run before any HMAC; a cache hit skips the HMAC. */
export function verifySession(raw, ua) {
  if (typeof raw !== 'string' || raw.length > COOKIE_MAX) return null;
  const parts = raw.split('.');
  if (parts.length !== 3 || parts[0] !== 'session' || !SID_RE.test(parts[1]) || !MAC_RE.test(parts[2])) return null;
  const uh = uaHash(ua);
  const key = `${raw}|${uh}`;
  const now = Date.now();
  const hit = cache.get(key);
  if (hit && hit.expires > now) {
    hit.expires = now + CACHE_TTL_MS;
    return { sid: hit.sid };
  }
  const [, sid, mac] = parts;
  if (!safeEqual(mac, hmac('session', sid, uh))) return null;
  remember(key, sid, now);
  return { sid };
}

export const _cacheSize = () => cache.size;
export const _CACHE_MAX = CACHE_MAX;
