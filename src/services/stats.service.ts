import { and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { deliveryAttempts, jobs, pipelines } from '../db/schema.js';
import { getUserTeamIds } from './team.service.js';

export interface PipelineFailureStat {
  id: string;
  name: string;
  failureCount: number;
}

export interface StatsResult {
  totalPipelines: number;
  jobsToday: number;
  successRate: number | null;
  avgDeliveryMs: number | null;
  topFailingPipelines: PipelineFailureStat[];
}

const TOP_FAILING_LIMIT = 5;

export async function getStats(userId: string): Promise<StatsResult> {
  const teamIds = await getUserTeamIds(userId);
  const personalFilter = eq(pipelines.ownerUserId, userId);
  const visibilityFilter =
    teamIds.length > 0
      ? or(personalFilter, inArray(pipelines.ownerTeamId, teamIds))!
      : personalFilter;

  const accessiblePipelines = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(visibilityFilter);

  const totalPipelines = accessiblePipelines.length;

  if (totalPipelines === 0) {
    return { totalPipelines: 0, jobsToday: 0, successRate: null, avgDeliveryMs: null, topFailingPipelines: [] };
  }

  const pipelineIds = accessiblePipelines.map((p) => p.id);
  const jobsFilter = inArray(jobs.pipelineId, pipelineIds);

  const [jobsTodayResult, successRateResult, avgDeliveryResult, topFailingResult] =
    await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(jobs)
        .where(and(jobsFilter, sql`${jobs.createdAt} >= CURRENT_DATE::timestamptz`)),

      db
        .select({
          completed: sql<number>`count(*) filter (where ${jobs.status} = 'COMPLETED')::int`,
          terminal: sql<number>`count(*) filter (where ${jobs.status} in ('COMPLETED', 'FAILED'))::int`,
        })
        .from(jobs)
        .where(and(jobsFilter, sql`${jobs.createdAt} >= CURRENT_DATE::timestamptz`)),

      db
        .select({ avg: sql<number | null>`avg(${deliveryAttempts.responseTimeMs})::float` })
        .from(deliveryAttempts)
        .innerJoin(jobs, eq(deliveryAttempts.jobId, jobs.id))
        .where(
          and(
            inArray(jobs.pipelineId, pipelineIds),
            eq(deliveryAttempts.outcome, 'SUCCESS'),
            sql`${deliveryAttempts.responseTimeMs} is not null`,
          ),
        ),

      db
        .select({
          id: pipelines.id,
          name: pipelines.name,
          failureCount: sql<number>`count(${jobs.id})::int`,
        })
        .from(pipelines)
        .innerJoin(jobs, and(eq(jobs.pipelineId, pipelines.id), eq(jobs.status, 'FAILED')))
        .where(inArray(pipelines.id, pipelineIds))
        .groupBy(pipelines.id, pipelines.name)
        .orderBy(desc(sql`count(${jobs.id})`))
        .limit(TOP_FAILING_LIMIT),
    ]);

  const { completed, terminal } = successRateResult[0];
  const successRate = terminal > 0 ? Math.round((completed / terminal) * 1000) / 10 : null;

  return {
    totalPipelines,
    jobsToday: jobsTodayResult[0].count,
    successRate,
    avgDeliveryMs: avgDeliveryResult[0].avg ?? null,
    topFailingPipelines: topFailingResult,
  };
}
