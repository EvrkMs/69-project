import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// The signing key lives in ARCH69_SECRET or, for local development, in a generated .secret file (git-ignored).
// It is loaded lazily, so importing this module has no side effects (no files written during tests or tooling).

const MIN_SECRET_BYTES = 32;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const secretFile = path.join(root, '.secret');

function loadSecret() {
  const fromEnv = process.env.ARCH69_SECRET;
  if (fromEnv) {
    const key = Buffer.from(fromEnv, 'utf8');
    if (key.length < MIN_SECRET_BYTES) throw new Error(`ARCH69_SECRET must be at least ${MIN_SECRET_BYTES} bytes long`);
    return key;
  }
  if (existsSync(secretFile)) {
    const key = Buffer.from(readFileSync(secretFile, 'utf8').trim(), 'hex');
    if (key.length < MIN_SECRET_BYTES) throw new Error('.secret is damaged or too short: delete it to generate a new key (this signs out everyone)');
    return key;
  }
  const key = randomBytes(MIN_SECRET_BYTES);
  writeFileSync(secretFile, key.toString('hex'), { mode: 0o600 }); // owner-only where the filesystem supports it
  return key;
}

let secret = null;
const getSecret = () => (secret ??= loadSecret());

export const b64u = (buf) => Buffer.from(buf).toString('base64url');
export const fromB64u = (s) => Buffer.from(s, 'base64url');

/**
 * HMAC-SHA256 with a mandatory purpose label. Each token type (session, checkpoint, ...) signs under its own label, so a
 * signature made for one purpose can never be accepted for another. Parts are joined with NUL, which cannot occur in them.
 */
export const hmac = (label, ...parts) =>
  createHmac('sha256', getSecret()).update(`arch69/v1/${label}\0${parts.join('\0')}`).digest('base64url');

/** Constant-time string comparison. */
export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export const sha256hex = (s) => createHash('sha256').update(s).digest('hex');
