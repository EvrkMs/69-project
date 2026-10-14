export const parseCookies = (header = '') =>
  Object.fromEntries(header.split(/;\s*/).filter(Boolean).map((c) => { const i = c.indexOf('='); return [c.slice(0, i), c.slice(i + 1)]; }));

export const COOKIE_ATTRS = '; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000';
