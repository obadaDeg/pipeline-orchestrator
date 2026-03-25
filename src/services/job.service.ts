import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { auditEvents, deliveryAttempts, jobs, pipelines } from '../db/schema.js';
import { AppError, NotFoundError } from '../lib/errors.js';
import { webhookQueue } from '../queue/queue.js';
import { getUserTeamIds } from './team.service.js';

export async function getJobById(id: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  if (!job) throw new NotFoundError('JOB_NOT_FOUND', 'Job not found');
  return job;
}

export async function listJobs(
  userId: string,
  params: { page: number; limit: number; offset: number; pipelineId?: string },
) {
  const { limit, offset, pipelineId } = params;

  const teamIds = await getUserTeamIds(userId);

  // Collect all pipeline IDs accessible to the user
  const ownedByUser = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(eq(pipelines.ownerUserId, userId));

  const ownedByTeam =
    teamIds.length > 0
      ? await db
          .select({ id: pipelines.id })
          .from(pipelines)
          .where(inArray(pipelines.ownerTeamId, teamIds))
      : [];

  const accessibleIds = [
    ...new Set([...ownedByUser.map((p) => p.id), ...ownedByTeam.map((p) => p.id)]),
  ];

  if (accessibleIds.length === 0) {
    return { items: [], total: 0 };
  }

  // If caller wants a specific pipeline, verify access and filter to it
  const targetIds =
    pipelineId !== undefined
      ? accessibleIds.includes(pipelineId)
        ? [pipelineId]
        : []
      : accessibleIds;

  if (targetIds.length === 0) {
    return { items: [], total: 0 };
  }

  const whereClause = inArray(jobs.pipelineId, targetIds);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(jobs)
    .where(whereClause);

  const rows = await db
    .select({
      id: jobs.id,
      pipelineId: jobs.pipelineId,
      status: jobs.status,
      retryCount: jobs.retryCount,
      errorMessage: jobs.errorMessage,
      createdAt: jobs.createdAt,
      updatedAt: jobs.updatedAt,
    })
    .from(jobs)
    .where(whereClause)
    .orderBy(desc(jobs.createdAt))
    .limit(limit)
    .offset(offset);

  return { items: rows, total };
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
      retryCount: jobs.retryCount,
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

export async function retryJob(jobId: string, userId: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) throw new NotFoundError('JOB_NOT_FOUND', 'Job not found');

  // Job must belong to an accessible pipeline
  if (!job.pipelineId) throw new NotFoundError('JOB_NOT_FOUND', 'Job not found');

  const teamIds = await getUserTeamIds(userId);
  const personalFilter = eq(pipelines.ownerUserId, userId);
  const visibilityFilter =
    teamIds.length > 0
      ? or(personalFilter, inArray(pipelines.ownerTeamId, teamIds))!
      : personalFilter;

  const [pipeline] = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.id, job.pipelineId), visibilityFilter));

  if (!pipeline) throw new NotFoundError('JOB_NOT_FOUND', 'Job not found');

  if (job.status !== 'FAILED') {
    throw new AppError(409, 'JOB_NOT_RETRYABLE', 'Only jobs with status FAILED can be retried');
  }

  const [updated] = await db.transaction(async (tx) => {
    const rows = await tx
      .update(jobs)
      .set({ status: 'PENDING', retryCount: job.retryCount + 1, errorMessage: null, updatedAt: new Date() })
      .where(eq(jobs.id, jobId))
      .returning();

    await tx.insert(auditEvents).values({
      userId,
      eventType: 'JOB_RETRIED',
      metadata: { jobId, pipelineId: job.pipelineId, retryCount: job.retryCount + 1 },
    });

    return rows;
  });

  await webhookQueue.add('process-webhook', { jobId, pipelineId: job.pipelineId });

  return updated;
}

export async function getDeliveryAttempts(
  jobId: string,
  params: { limit: number; offset: number },
) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
  if (!job) throw new NotFoundError('JOB_NOT_FOUND', 'Job not found');

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(deliveryAttempts)
    .where(eq(deliveryAttempts.jobId, jobId));

  const items = await db
    .select()
    .from(deliveryAttempts)
    .where(eq(deliveryAttempts.jobId, jobId))
    .orderBy(asc(deliveryAttempts.attemptNumber))
    .limit(params.limit)
    .offset(params.offset);

  return { items, total };
}
