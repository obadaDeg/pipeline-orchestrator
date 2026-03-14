import Redis from 'ioredis';
import { config } from '../config.js';

// BullMQ bundles its own ioredis, so pass plain options (not an instance)
// to avoid type conflicts between the two ioredis versions.
export const redisConnectionOptions = {
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  maxRetriesPerRequest: null as null, // required by BullMQ
};

// Standalone ioredis client for non-BullMQ use (stalled job recovery, etc.)
export const redis = new Redis(redisConnectionOptions);

export async function closeRedis(): Promise<void> {
  await redis.quit();
}
