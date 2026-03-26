import { createHmac } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pipelineSigningSecrets, pipelines } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';
import { ingestWebhook } from './ingestion.service.js';

export async function simulateWebhook(
  pipelineId: string,
  payload: Record<string, unknown>,
): Promise<{ jobId: string }> {
  // Resolve sourceId — needed by ingestWebhook to identify the pipeline
  const [pipeline] = await db
    .select({ sourceId: pipelines.sourceId })
    .from(pipelines)
    .where(eq(pipelines.id, pipelineId))
    .limit(1);

  if (!pipeline) {
    throw new NotFoundError('PIPELINE_NOT_FOUND', 'Pipeline not found');
  }

  // Serialize the payload exactly as an external sender would
  const rawBody = JSON.stringify(payload);

  // One row = signing secret active; no row = unsigned pipeline (no-op on verify)
  const [secret] = await db
    .select({ secretValue: pipelineSigningSecrets.secretValue })
    .from(pipelineSigningSecrets)
    .where(eq(pipelineSigningSecrets.pipelineId, pipelineId))
    .limit(1);

  let signatureHeader: string | undefined;
  let timestampHeader: string | undefined;

  if (secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const hmac = createHmac('sha256', secret.secretValue)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    signatureHeader = `sha256=${hmac}`;
    timestampHeader = timestamp;
  }

  return ingestWebhook(pipeline.sourceId, rawBody, signatureHeader, timestampHeader);
}
