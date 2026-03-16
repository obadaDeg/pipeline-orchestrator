import { and, eq, lt } from 'drizzle-orm';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { jobs } from '../db/schema.js';
import { logger } from '../lib/logger.js';
import { webhookQueue } from '../queue/queue.js';

export async function recoverStalledJobs(): Promise<void> {
  const threshold = new Date(Date.now() - config.STALLED_JOB_TIMEOUT_MS);

  const stalledJobs = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.status, 'PROCESSING'), lt(jobs.updatedAt, threshold)));

  for (const job of stalledJobs) {
    if (job.pipelineId) {
      // Reset to PENDING and re-enqueue for the worker to pick up
      await db
        .update(jobs)
        .set({ status: 'PENDING', updatedAt: new Date() })
        .where(eq(jobs.id, job.id));

      await webhookQueue.add('process-webhook', {
        jobId: job.id,
        pipelineId: job.pipelineId,
      });
    } else {
      // Pipeline was deleted — no point re-enqueuing, mark as FAILED
      await db
        .update(jobs)
        .set({
          status: 'FAILED',
          errorMessage: 'Stalled job recovery: pipeline no longer exists',
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, job.id));
    }
  }

  if (stalledJobs.length > 0) {
    logger.info(`Stalled job recovery: processed ${stalledJobs.length} stalled jobs`);
  }
}

export function startStalledJobRecovery(): void {
  // Run immediately on startup, then on a recurring interval
  recoverStalledJobs().catch((err) => logger.error('Stalled job recovery failed', err));
  setInterval(() => {
    recoverStalledJobs().catch((err) => logger.error('Stalled job recovery failed', err));
  }, config.STALLED_JOB_TIMEOUT_MS);
}
