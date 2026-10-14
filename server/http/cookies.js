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

/**
 * Cookie policy. Production: HTTPS only. `Secure` makes browsers refuse to send them over plain http, and the `__Host-`
 * prefix makes browsers refuse any cookie of that name that is not Secure, has a Domain, or a Path other than "/"
 * (so a sibling subdomain cannot plant a session cookie). Dev mode (ARCH69_DEV=1) drops both so plain http works.
 */
export function cookiePolicy(config) {
  const prefix = config.dev ? '' : '__Host-';
  return {
    names: { session: `${prefix}session`, cp: `${prefix}cp` },
    attrs: `; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${config.dev ? '' : '; Secure'}`,
  };
}
