import { randomBytes } from 'node:crypto';
import { hmac, safeEqual, sha256hex, b64u } from './crypto.js';

const CACHE_TTL_MS = 5 * 60 * 1000;

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

// raw cookie + uaHash -> { sid, expires }
const cache = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of cache) if (v.expires < now) cache.delete(k);
}, 60_000).unref();

export function issueSession(ua) {
  const sid = b64u(randomBytes(16));
  const raw = `session.${sid}.${hmac(sid, uaHash(ua))}`;
  return { sid, raw };
}

/** Returns { sid } for a valid cookie, otherwise null. Cache hit skips HMAC entirely. */
export function verifySession(raw, ua) {
  if (!raw) return null;
  const uh = uaHash(ua);
  const key = `${raw}|${uh}`;
  const hit = cache.get(key);
  const now = Date.now();
  if (hit && hit.expires > now) {
    hit.expires = now + CACHE_TTL_MS;
    return { sid: hit.sid };
  }
  const parts = raw.split('.');
  if (parts.length !== 3 || parts[0] !== 'session') return null;
  const [, sid, mac] = parts;
  if (!safeEqual(mac, hmac(sid, uh))) return null;
  cache.set(key, { sid, expires: now + CACHE_TTL_MS });
  return { sid };
}

export const _cacheSize = () => cache.size;
