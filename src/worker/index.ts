import { Worker } from 'bullmq';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import { redisConnectionOptions } from '../queue/redis.js';
import { jobConsumer } from './job-consumer.js';
import { registerShutdownHandlers } from './shutdown.js';
import { startStalledJobRecovery } from './stalled-job-recovery.js';

const worker = new Worker('webhook-jobs', jobConsumer, {
  connection: redisConnectionOptions,
  concurrency: config.WORKER_CONCURRENCY,
});

worker.on('failed', (job, err) => {
  logger.error('BullMQ job failed unexpectedly', { bullJobId: job?.id, error: err.message });
});

startStalledJobRecovery();
registerShutdownHandlers(worker);

logger.info(`Worker started`, { concurrency: config.WORKER_CONCURRENCY });
