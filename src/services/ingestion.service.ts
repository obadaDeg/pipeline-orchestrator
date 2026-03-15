import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { jobs, pipelines } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';
import { webhookQueue } from '../queue/queue.js';

export async function ingestWebhook(
  sourceId: string,
  rawBody: string,
): Promise<{ jobId: string }> {
  // Resolve the pipeline from its public source ID
  const [pipeline] = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.sourceId, sourceId));

  if (!pipeline) {
    throw new NotFoundError('PIPELINE_NOT_FOUND', 'No pipeline found for this source URL');
  }

  // Persist a PENDING job before enqueuing — the queue entry references this row
  const [job] = await db
    .insert(jobs)
    .values({
      pipelineId: pipeline.id,
      rawPayload: rawBody,
      status: 'PENDING',
    })
    .returning();

  // Enqueue for async processing; job row already exists so the worker can
  // update it immediately without a race condition
  await webhookQueue.add('process-webhook', {
    jobId: job.id,
    pipelineId: pipeline.id,
  });

  return { jobId: job.id };
}
