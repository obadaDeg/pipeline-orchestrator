import { Worker } from 'bullmq';
import { pool } from '../db/index.js';
import { logger } from '../lib/logger.js';
import { webhookQueue } from '../queue/queue.js';
import { closeRedis } from '../queue/redis.js';

export function registerShutdownHandlers(worker: Worker): void {
  async function shutdown(): Promise<void> {
    logger.info('Shutdown signal received — draining worker...');
    try {
      await worker.close(); // waits for in-flight jobs to complete
      await webhookQueue.close();
      await closeRedis();
      await pool.end();
      logger.info('Worker shutdown complete');
      process.exit(0);
    } catch (err) {
      logger.error('Error during worker shutdown', err);
      process.exit(1);
    }
  }

  process.on('SIGTERM', () => void shutdown());
  process.on('SIGINT', () => void shutdown());
}
