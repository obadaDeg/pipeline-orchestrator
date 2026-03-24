import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { jobs, pipelines } from '../db/schema.js';
import { NotFoundError, RateLimitError } from '../lib/errors.js';
import { webhookQueue } from '../queue/queue.js';
import { checkRateLimit, DEFAULT_RATE_LIMIT_PER_MINUTE } from './rate-limit.service.js';
import { verifyWebhookSignature } from './signing.service.js';

export async function ingestWebhook(
  sourceId: string,
  rawBody: string,
  signatureHeader?: string,
  timestampHeader?: string,
): Promise<{ jobId: string }> {
  // Resolve the pipeline from its public source ID
  const [pipeline] = await db
    .select()
    .from(pipelines)
    .where(eq(pipelines.sourceId, sourceId));

  if (!pipeline) {
    throw new NotFoundError('PIPELINE_NOT_FOUND', 'No pipeline found for this source URL');
  }

  // Enforce per-pipeline rate limit before any DB write
  const rl = await checkRateLimit(
    pipeline.sourceId,
    pipeline.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE,
  );
  if (!rl.allowed) {
    throw new RateLimitError(rl.retryAfterSec);
  }

  // Verify signature before any DB write — rejects unsigned/invalid requests early
  await verifyWebhookSignature(pipeline.id, signatureHeader, timestampHeader, rawBody);

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
