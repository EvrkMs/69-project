export const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.mp4': 'video/mp4', '.woff2': 'font/woff2',
};

export function json(res, code, body, headers = {}) {
  res.writeHead(code, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(body));
}

export async function readJsonBody(req, limit = 4096) {
  let data = '';
  for await (const chunk of req) { data += chunk; if (data.length > limit) break; }
  try { return JSON.parse(data || '{}'); } catch { return {}; }
}
