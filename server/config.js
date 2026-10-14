// All runtime settings come from environment variables, are validated here once, and have safe defaults:
// loopback only, loopback Host headers only, cookies without Secure (plain-http development).

const intIn = (v, fallback, min, max) => {
  const n = Number(v);
  return v !== undefined && Number.isInteger(n) && n >= min && n <= max ? n : fallback;
};
const list = (v, fallback) => (v ? v.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean) : fallback);

export function loadConfig(env = process.env) {
  return {
    port: intIn(env.PORT, 3069, 0, 65535),
    // Bind to loopback unless told otherwise; exposing the dev server to the network must be a conscious choice.
    host: env.HOST || '127.0.0.1',
    // Accepted values of the Host header (blocks DNS-rebinding and host-header tricks). Add your domain in production.
    allowedHosts: list(env.ALLOWED_HOSTS, ['localhost', '127.0.0.1', '[::1]']),
    // Set when running behind a reverse proxy that terminates TLS and sets X-Forwarded-* (never otherwise: they are spoofable).
    trustProxy: env.TRUST_PROXY === '1',
    // Force the Secure cookie flag (and HSTS) even if the request looks like plain http.
    secureCookies: env.COOKIE_SECURE === '1',
    maxBodyBytes: 2048,
    maxUrlLength: 2048,
    // Requests per window and client address.
    rate: {
      windowMs: 60_000,
      api: intIn(env.RATE_API, 240, 1, 1_000_000),
      post: intIn(env.RATE_POST, 30, 1, 1_000_000),
      static: intIn(env.RATE_STATIC, 900, 1, 1_000_000),
    },
  };
}
