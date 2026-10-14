// Browser-facing protections: response headers (CSP and friends), Host / Origin checks, client address.

// Everything is served from our own origin. The only outside content is the video players of YouTube and Twitch,
// allowed as frames and nothing else. No inline scripts or styles exist, so none are allowed.
export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  'frame-src https://www.youtube-nocookie.com https://clips.twitch.tv',
  "media-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "manifest-src 'none'",
  "worker-src 'none'",
].join('; ');

const PERMISSIONS = [
  'camera=()', 'microphone=()', 'geolocation=()', 'payment=()', 'usb=()', 'accelerometer=()', 'gyroscope=()',
  'fullscreen=(self "https://www.youtube-nocookie.com" "https://clips.twitch.tv")',
].join(', ');

export function applySecurityHeaders(res, { secure }) {
  res.setHeader('Content-Security-Policy', secure ? `${CSP}; upgrade-insecure-requests` : CSP);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY'); // older browsers that ignore frame-ancestors
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', PERMISSIONS);
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  if (secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
}

/** Host header without the port; IPv6 literals keep their brackets. */
function hostname(host = '') {
  const h = host.toLowerCase();
  return h.startsWith('[') ? h.slice(0, h.indexOf(']') + 1) : h.split(':')[0];
}

export const hostAllowed = (req, allowed) => allowed.includes(hostname(req.headers.host));

/** Is this particular request arriving over HTTPS (directly, or via a trusted TLS-terminating proxy)? Drives HSTS only. */
export const isSecure = (req, config) =>
  !!req.socket.encrypted || (config.trustProxy && req.headers['x-forwarded-proto'] === 'https');

export function clientAddress(req, config) {
  if (config.trustProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return String(forwarded).split(',')[0].trim().slice(0, 64);
  }
  return req.socket.remoteAddress || 'unknown';
}

/**
 * CSRF guard for state-changing requests. Browsers always send Origin on POST: it must be this very host.
 * Without Origin (curl, tests) Sec-Fetch-Site is consulted if present. The JSON-only body and SameSite cookies are
 * further layers, see SECURITY.md.
 */
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (origin) {
    try { return new URL(origin).host === req.headers.host; } catch { return false; }
  }
  const site = req.headers['sec-fetch-site'];
  return !site || site === 'same-origin' || site === 'none';
}
