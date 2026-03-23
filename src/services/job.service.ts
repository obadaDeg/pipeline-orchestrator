import { asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { deliveryAttempts, jobs, pipelines } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';
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
