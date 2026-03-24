import { redis } from '../queue/redis.js';

export const DEFAULT_RATE_LIMIT_PER_MINUTE = 60;

export async function checkRateLimit(
  sourceId: string,
  limitPerMinute: number,
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const nowSec = Date.now() / 1000;
  const windowStartSec = Math.floor(nowSec / 60) * 60;
  const key = `ratelimit:${sourceId}:${windowStartSec}`;

  const count = await redis.incr(key);
  if (count === 1) {
    // Set TTL on first request in this window (+1 second for clock skew)
    await redis.expire(key, 61);
  }

  const retryAfterSec = Math.max(1, Math.ceil(windowStartSec + 60 - nowSec));
  return { allowed: count <= limitPerMinute, retryAfterSec };
}
