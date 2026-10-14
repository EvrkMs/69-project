import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MIME } from './respond.js';

/** Serves files from `dir` under an optional URL prefix. Returns false when the path is not ours. */
export function staticHandler(dir, prefix = '') {
  const root = path.resolve(dir);
  return async (req, res, url) => {
    if (prefix && !url.pathname.startsWith(prefix + '/')) return false;
    let p = prefix ? url.pathname.slice(prefix.length) : url.pathname;
    if (p === '/') p = '/index.html';
    let abs;
    try {
      abs = path.resolve(root, '.' + decodeURIComponent(p));
    } catch {
      res.writeHead(400); res.end(); return true;
    }
    if (!abs.startsWith(root + path.sep)) { res.writeHead(404); res.end(); return true; }
    try {
      const data = await readFile(abs);
      res.writeHead(200, { 'Content-Type': MIME[path.extname(abs)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(data);
    } catch {
      res.writeHead(404); res.end('not found');
    }
    return true;
  };
}
