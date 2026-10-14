// npm run dev: restarts the server when files change. Polls modification times instead of using fs events,
// because `node --watch` does not see changes on /mnt/* drives inside WSL. Client files (public/) need no restart.
import { spawn } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WATCHED = ['server', 'shared', 'content'];
const POLL_MS = 700;

function snapshot() {
  let newest = 0;
  const walk = (dir) => {
    for (const ent of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else newest = Math.max(newest, statSync(full).mtimeMs);
    }
  };
  for (const d of WATCHED) walk(path.join(root, d));
  return newest;
}

let child = null;
const start = () => {
  // `npm run dev` is the local-development entry point, so plain-http cookies are allowed here (and only here by default)
  child = spawn(process.execPath, [path.join(root, 'server', 'index.js')], { stdio: 'inherit', env: { ARCH69_DEV: '1', ...process.env } });
  child.on('exit', (code) => { if (code) console.log(`[dev] server exited (${code}), waiting for changes...`); });
};

let stamp = snapshot();
start();
setInterval(() => {
  const now = snapshot();
  if (now === stamp) return;
  stamp = now;
  console.log('[dev] change detected, restarting');
  if (child && child.exitCode === null) {
    child.once('exit', start);
    child.kill();
  } else start();
}, POLL_MS);

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { child?.kill(); process.exit(0); });
