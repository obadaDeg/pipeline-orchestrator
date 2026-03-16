import { asc, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { deliveryAttempts, jobs, pipelines } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';

export async function getJobById(id: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!job) throw new NotFoundError('JOB_NOT_FOUND', 'Job not found');
  return job;
}

export async function listJobsForPipeline(pipelineId: string, page: number, limit: number) {
  // Verify pipeline exists before querying its jobs
  const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.id, pipelineId));
  if (!pipeline) throw new NotFoundError('PIPELINE_NOT_FOUND', 'Pipeline not found');

  const offset = (page - 1) * limit;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(jobs)
    .where(eq(jobs.pipelineId, pipelineId));

  // Omit rawPayload and processedPayload from list items for bandwidth efficiency
  const rows = await db
    .select({
      id: jobs.id,
      pipelineId: jobs.pipelineId,
      status: jobs.status,
      errorMessage: jobs.errorMessage,
      createdAt: jobs.createdAt,
      updatedAt: jobs.updatedAt,
    })
    .from(jobs)
    .where(eq(jobs.pipelineId, pipelineId))
    .orderBy(desc(jobs.createdAt))
    .limit(limit)
    .offset(offset);

  return { items: rows, total, page, limit };
}

export async function getDeliveryAttempts(jobId: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) throw new NotFoundError('JOB_NOT_FOUND', 'Job not found');

  const attempts = await db
    .select()
    .from(deliveryAttempts)
    .where(eq(deliveryAttempts.jobId, jobId))
    .orderBy(asc(deliveryAttempts.attemptNumber));

  return attempts;
}
