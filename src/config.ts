import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),

  DATABASE_URL: z.string(),

  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  WORKER_CONCURRENCY: z.coerce.number().default(5),
  DELIVERY_MAX_RETRIES: z.coerce.number().default(3),
  DELIVERY_BACKOFF_MS: z.coerce.number().default(1000),

  MAX_PAYLOAD_BYTES: z.coerce.number().default(1_048_576),
  STALLED_JOB_TIMEOUT_MS: z.coerce.number().default(300_000),
  DELIVERY_TIMEOUT_MS: z.coerce.number().default(10_000),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
