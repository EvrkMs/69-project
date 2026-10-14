import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent } from './content/loader.js';
import { requestContext } from './http/context.js';
import { staticHandler } from './http/static.js';
import { json } from './http/respond.js';
import { streamerRoutes } from './routes/streamers.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Builds the HTTP server. Content is validated here, so bad content stops the server from starting. */
export function createApp({ registry = loadContent() } = {}) {
  const api = streamerRoutes(registry);
  const statics = [
    staticHandler(path.join(root, 'shared'), '/shared'), // ES modules used by both server and browser
    staticHandler(path.join(root, 'public')),
  ];

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) {
        const ctx = requestContext(req);
        if (!(await api(req, res, url, ctx))) json(res, 404, { error: 'not_found' }, ctx.headers());
        return;
      }
      for (const handle of statics) if (await handle(req, res, url)) return;
    } catch (err) {
      console.error(err);
      if (!res.headersSent) json(res, 500, { error: 'internal' });
    }
  });
}
