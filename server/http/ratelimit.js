/**
 * Fixed-window request counter per key (client address + request class). In memory, per process: enough to blunt
 * floods and brute-force on a single instance; put a real limiter in front when running several instances.
 */
export function createLimiter(windowMs, maxKeys = 50_000) {
  const hits = new Map();
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs);
  sweep.unref();

  return {
    /** @returns {{ ok: boolean, retryAfter: number }} retryAfter in whole seconds */
    hit(key, limit, now = Date.now()) {
      let e = hits.get(key);
      if (!e || e.reset <= now) {
        if (!e && hits.size >= maxKeys) hits.delete(hits.keys().next().value); // bounded memory: drop the oldest key
        e = { n: 0, reset: now + windowMs };
        hits.set(key, e);
      }
      e.n++;
      return { ok: e.n <= limit, retryAfter: Math.max(1, Math.ceil((e.reset - now) / 1000)) };
    },
    size: () => hits.size,
    stop: () => clearInterval(sweep),
  };
}
