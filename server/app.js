import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContent } from './content/loader.js';
import { loadConfig } from './config.js';
import { requestContext } from './http/context.js';
import { staticHandler } from './http/static.js';
import { json, HttpError } from './http/respond.js';
import { applySecurityHeaders, hostAllowed, isSecure, clientAddress, sameOrigin } from './http/security.js';
import { createLimiter } from './http/ratelimit.js';
import { streamerRoutes } from './routes/streamers.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const METHODS = new Set(['GET', 'HEAD', 'POST']);

/**
 * Builds the HTTP server. Content is validated here, so bad content stops the server from starting.
 * Every request passes the same gate, in this order: URL sanity, Host allow-list, method, rate limit, CSRF (POST only).
 */
export function createApp({ registry = loadContent(), config = loadConfig() } = {}) {
  const api = streamerRoutes(registry, config);
  const limiter = createLimiter(config.rate.windowMs);
  const statics = [
    staticHandler(path.join(root, 'shared'), '/shared'), // ES modules used by both server and browser
    staticHandler(path.join(root, 'public')),
  ];

  async function handle(req, res) {
    if (!req.url || req.url.length > config.maxUrlLength) throw new HttpError(414, 'uri_too_long');
    if (!req.url.startsWith('/')) throw new HttpError(400, 'bad_request');
    if (!hostAllowed(req, config.allowedHosts)) throw new HttpError(421, 'bad_host');
    if (!METHODS.has(req.method)) throw new HttpError(405, 'method_not_allowed', { Allow: 'GET, HEAD, POST' });

    let url;
    try { url = new URL(req.url, 'http://localhost'); } catch { throw new HttpError(400, 'bad_request'); }
    const isApi = url.pathname.startsWith('/api/');
    if (req.method === 'POST' && !isApi) throw new HttpError(405, 'method_not_allowed', { Allow: 'GET, HEAD' });

    const kind = req.method === 'POST' ? 'post' : isApi ? 'api' : 'static';
    const verdict = limiter.hit(`${kind}:${clientAddress(req, config)}`, config.rate[kind]);
    if (!verdict.ok) throw new HttpError(429, 'rate_limited', { 'Retry-After': String(verdict.retryAfter) });
    if (req.method === 'POST' && !sameOrigin(req)) throw new HttpError(403, 'cross_origin');

    if (isApi) {
      const ctx = requestContext(req, config);
      if (!(await api(req, res, url, ctx))) json(res, 404, { error: 'not_found' }, ctx.headers());
      return;
    }
    for (const serve of statics) if (await serve(req, res, url)) return;
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('not found');
  }

  const server = http.createServer(async (req, res) => {
    applySecurityHeaders(res, { secure: isSecure(req, config) });
    try {
      await handle(req, res);
    } catch (err) {
      if (err instanceof HttpError) return json(res, err.status, { error: err.code }, err.headers);
      console.error(err); // details stay in the server log; the client only learns that something failed
      if (!res.headersSent) json(res, 500, { error: 'internal' });
      else res.destroy();
    }
  });

  // Slow-client protection (slowloris and friends) and bounded header handling.
  server.headersTimeout = 10_000;
  server.requestTimeout = 15_000;
  server.keepAliveTimeout = 5_000;
  server.maxHeadersCount = 50;
  server.on('clientError', (_err, socket) => { if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); });
  server.on('close', () => limiter.stop());
  return server;
}
