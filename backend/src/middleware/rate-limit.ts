import { Context, Next } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, RateLimitEntry>();

function getKey(c: Context, prefix: string): string {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown';
  return `${prefix}:${ip}`;
}

export function rateLimit(windowMs: number, limit: number) {
  const prefix = `rl:${windowMs}:${limit}`;
  return async (c: Context, next: Next) => {
    const key = getKey(c, prefix);
    const now = Date.now();
    const entry = stores.get(key);

    if (!entry || now > entry.resetAt) {
      stores.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count++;
    if (entry.count > limit) {
      return c.json({ success: false, error: 'Too many requests', code: 'RATE_LIMITED', timestamp: new Date().toISOString() }, 429);
    }

    return next();
  };
}
