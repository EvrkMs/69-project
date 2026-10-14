import { createHmac, createHash, randomBytes, timingSafeEqual, scryptSync } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const secretFile = path.join(root, '.secret');

function loadSecret() {
  if (process.env.ARCH69_SECRET) return Buffer.from(process.env.ARCH69_SECRET);
  if (existsSync(secretFile)) return Buffer.from(readFileSync(secretFile, 'utf8').trim(), 'hex');
  const s = randomBytes(32);
  writeFileSync(secretFile, s.toString('hex'));
  return s;
}

const SECRET = loadSecret();

export const b64u = (buf) => Buffer.from(buf).toString('base64url');
export const fromB64u = (s) => Buffer.from(s, 'base64url');

export const hmac = (...parts) => createHmac('sha256', SECRET).update(parts.join('.')).digest('base64url');

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

export const sha256hex = (s) => createHash('sha256').update(s).digest('hex');

// Hash algorithms per epoch: the newer the year, the harder the hash.
export const ALGOS = {
  md5: (pw) => createHash('md5').update(pw).digest('hex'),
  sha256: (pw, salt) => createHash('sha256').update(salt + pw).digest('hex'),
  scrypt: (pw, salt) => scryptSync(pw, salt, 32, { N: 4096, r: 8, p: 1 }).toString('hex'),
};
