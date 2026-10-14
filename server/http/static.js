import { readFile, realpath } from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { MIME } from './respond.js';

/**
 * Serves files from `dir` under an optional URL prefix (GET and HEAD only). Returns false when the path is not ours.
 * Hardened against traversal in every spelling: dotfiles and ".." segments are refused, the resolved path must stay inside
 * the root, and the real path (after symlinks) must too. Only known file types are served.
 */
export function staticHandler(dir, prefix = '') {
  const root = realpathSync(dir);
  return async (req, res, url) => {
    if (prefix && !url.pathname.startsWith(prefix + '/')) return false;
    let p = prefix ? url.pathname.slice(prefix.length) : url.pathname;
    if (p === '/') p = '/index.html';

    const notFound = () => { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('not found'); return true; };
    let decoded;
    try { decoded = decodeURIComponent(p); } catch { res.writeHead(400); res.end(); return true; }
    if (decoded.includes('\0') || decoded.includes('\\') || decoded.split('/').some((seg) => seg.startsWith('.'))) return notFound();

    const ext = path.extname(decoded).toLowerCase();
    const type = MIME[ext];
    if (!type) return notFound();

    const abs = path.resolve(root, '.' + decoded);
    if (!abs.startsWith(root + path.sep)) return notFound();
    try {
      const real = await realpath(abs);
      if (!real.startsWith(root + path.sep)) return notFound(); // a symlink pointing outside
      const data = await readFile(real);
      res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache', 'Content-Length': data.length });
      res.end(req.method === 'HEAD' ? undefined : data);
    } catch {
      return notFound();
    }
    return true;
  };
}
