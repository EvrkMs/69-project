const PAIR_MAX = 4200; // a bit above the biggest legitimate cookie (checkpoint 4096)

/** Parses a Cookie header into a null-prototype object, ignoring oversized or malformed pairs. */
export function parseCookies(header = '') {
  const out = Object.create(null);
  if (typeof header !== 'string' || header.length > 16_384) return out;
  for (const pair of header.split(/;\s*/)) {
    const i = pair.indexOf('=');
    if (i <= 0 || pair.length > PAIR_MAX) continue;
    const name = pair.slice(0, i);
    if (!(name in out)) out[name] = pair.slice(i + 1); // first one wins, like browsers send them
  }
  return out;
}

/** Cookie attributes: invisible to scripts, not sent cross-site on POST, HTTPS-only when the connection is secure. */
export const cookieAttrs = (secure) => `; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure ? '; Secure' : ''}`;
