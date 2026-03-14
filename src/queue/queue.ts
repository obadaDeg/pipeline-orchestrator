import { Queue } from 'bullmq';
import { redisConnectionOptions } from './redis.js';
import type { JobQueueData } from './job-data.types.js';

export const webhookQueue = new Queue<JobQueueData>('webhook-jobs', {
  connection: redisConnectionOptions,
});
