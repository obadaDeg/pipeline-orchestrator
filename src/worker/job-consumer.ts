import { Processor } from 'bullmq';
import { eq } from 'drizzle-orm';
import { getAction } from '../actions/action-registry.js';
import { ActionConfig, ActionType } from '../actions/types.js';
import { db } from '../db/index.js';
import { jobs, pipelines, subscribers } from '../db/schema.js';
import { runDelivery } from '../delivery/delivery-engine.js';
import { logger } from '../lib/logger.js';
import type { JobQueueData } from '../queue/job-data.types.js';

export const jobConsumer: Processor<JobQueueData> = async (bullJob) => {
  const { jobId, pipelineId } = bullJob.data;

  // Transition to PROCESSING before any work begins
  await db
    .update(jobs)
    .set({ status: 'PROCESSING', updatedAt: new Date() })
    .where(eq(jobs.id, jobId));

  try {
    // Fetch all data needed for this job
    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.id, pipelineId));
    const subs = await db.select().from(subscribers).where(eq(subscribers.pipelineId, pipelineId));

    if (!pipeline) {
      logger.warn('Job failed: pipeline deleted before processing', { jobId, pipelineId });
      await db
        .update(jobs)
        .set({
          status: 'FAILED',
          errorMessage: 'Pipeline was deleted before job could be processed',
          updatedAt: new Date(),
        })
        .where(eq(jobs.id, jobId));
      return;
    }

    logger.info('Job picked up', {
      jobId,
      pipeline: pipeline.name,
      action: pipeline.actionType,
      subscribers: subs.length,
    });

    // Parse raw payload — action receives an object when possible, string otherwise
    let payload: unknown;
    try {
      payload = JSON.parse(job.rawPayload);
    } catch {
      payload = job.rawPayload;
    }

    // Run the configured action transformer
    const action = getAction(pipeline.actionType as ActionType);
    const processedPayload = await action.execute(payload, pipeline.actionConfig as ActionConfig);

    // null = payload filter no-match — COMPLETED with no delivery
    if (processedPayload === null) {
      logger.info('Job completed: payload filtered (no-match)', { jobId });
      await db
        .update(jobs)
        .set({ status: 'COMPLETED', updatedAt: new Date() })
        .where(eq(jobs.id, jobId));
      return;
    }

    logger.info('Action completed, starting delivery', { jobId, subscribers: subs.length });

    // Persist processed payload before delivery
    await db
      .update(jobs)
      .set({ processedPayload, updatedAt: new Date() })
      .where(eq(jobs.id, jobId));

    // Deliver to all subscribers with per-subscriber retry
    const { allSucceeded } = await runDelivery(jobId, subs, processedPayload);

    const finalStatus = allSucceeded ? 'COMPLETED' : 'FAILED';
    logger.info(`Job ${finalStatus.toLowerCase()}`, { jobId, allSucceeded });

    await db
      .update(jobs)
      .set({ status: finalStatus, updatedAt: new Date() })
      .where(eq(jobs.id, jobId));
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : 'Unexpected error during job processing';
    logger.error('Job failed with unexpected error', { jobId, error: errorMessage });
    await db
      .update(jobs)
      .set({ status: 'FAILED', errorMessage, updatedAt: new Date() })
      .where(eq(jobs.id, jobId));
  }
};
