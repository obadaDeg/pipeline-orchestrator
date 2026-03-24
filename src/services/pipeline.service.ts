import { SQL, and, desc, eq, inArray, or, sql } from 'drizzle-orm';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { pipelines, subscribers } from '../db/schema.js';
import { AppError, NotFoundError } from '../lib/errors.js';
import { getUserTeamIds } from './team.service.js';

type ActionType = 'field_extractor' | 'payload_filter' | 'http_enricher';

export interface CreatePipelineInput {
  name: string;
  actionType: ActionType;
  actionConfig: Record<string, unknown>;
  subscriberUrls: string[];
  ownerUserId: string;
  ownerTeamId?: string;
  rateLimitPerMinute?: number | null;
}

export interface UpdatePipelineInput {
  name?: string;
  actionConfig?: Record<string, unknown>;
  subscriberUrls?: string[];
  rateLimitPerMinute?: number | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildSourceUrl(sourceId: string): string {
  return `http://localhost:${config.PORT}/webhooks/${sourceId}`;
}

type PipelineRow = typeof pipelines.$inferSelect;
type SubscriberRow = typeof subscribers.$inferSelect;

function formatPipeline(pipeline: PipelineRow, subs: SubscriberRow[]) {
  return {
    id: pipeline.id,
    name: pipeline.name,
    sourceUrl: buildSourceUrl(pipeline.sourceId),
    actionType: pipeline.actionType,
    actionConfig: pipeline.actionConfig,
    rateLimitPerMinute: pipeline.rateLimitPerMinute ?? null,
    subscribers: subs.map((s) => ({ id: s.id, url: s.url, createdAt: s.createdAt })),
    createdAt: pipeline.createdAt,
    updatedAt: pipeline.updatedAt,
  };
}

function formatPipelineListItem(pipeline: PipelineRow) {
  return {
    id: pipeline.id,
    name: pipeline.name,
    sourceUrl: buildSourceUrl(pipeline.sourceId),
    actionType: pipeline.actionType,
    actionConfig: pipeline.actionConfig,
    createdAt: pipeline.createdAt,
    updatedAt: pipeline.updatedAt,
  };
}

/**
 * Builds a WHERE clause that matches pipelines the user can access:
 *   - personal: owner_user_id = userId
 *   - team: owner_team_id IN (teams user owns or is a member of)
 */
async function buildVisibilityFilter(userId: string): Promise<SQL> {
  const teamIds = await getUserTeamIds(userId);
  const personalFilter = eq(pipelines.ownerUserId, userId);
  if (teamIds.length === 0) return personalFilter;
  return or(personalFilter, inArray(pipelines.ownerTeamId, teamIds))!;
}

// ─── Service Functions ────────────────────────────────────────────────────────

export async function createPipeline(input: CreatePipelineInput) {
  // If a teamId is provided, verify the user belongs to that team
  if (input.ownerTeamId) {
    const teamIds = await getUserTeamIds(input.ownerUserId);
    if (!teamIds.includes(input.ownerTeamId)) {
      throw new AppError(403, 'FORBIDDEN', 'You are not a member of that team');
    }
  }

  return db.transaction(async (tx) => {
    const [pipeline] = await tx
      .insert(pipelines)
      .values({
        name: input.name,
        actionType: input.actionType,
        actionConfig: input.actionConfig,
        // Team pipeline: ownerTeamId set, ownerUserId null. Personal: vice versa.
        ownerUserId: input.ownerTeamId ? null : input.ownerUserId,
        ownerTeamId: input.ownerTeamId ?? null,
        rateLimitPerMinute: input.rateLimitPerMinute ?? null,
      })
      .returning();

    const insertedSubscribers =
      input.subscriberUrls.length > 0
        ? await tx
            .insert(subscribers)
            .values(input.subscriberUrls.map((url) => ({ pipelineId: pipeline.id, url })))
            .returning()
        : [];

    return formatPipeline(pipeline, insertedSubscribers);
  });
}

export async function getPipelineById(id: string, userId: string) {
  const visibilityFilter = await buildVisibilityFilter(userId);
  const [pipeline] = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.id, id), visibilityFilter));
  if (!pipeline) throw new NotFoundError('PIPELINE_NOT_FOUND', 'Pipeline not found');

  const subs = await db.select().from(subscribers).where(eq(subscribers.pipelineId, id));
  return formatPipeline(pipeline, subs);
}

export async function listPipelines(page: number, limit: number, userId: string) {
  const offset = (page - 1) * limit;
  const visibilityFilter = await buildVisibilityFilter(userId);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(pipelines)
    .where(visibilityFilter);
  const rows = await db
    .select()
    .from(pipelines)
    .where(visibilityFilter)
    .orderBy(desc(pipelines.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    items: rows.map(formatPipelineListItem),
    total,
    page,
    limit,
  };
}

export async function updatePipeline(id: string, input: UpdatePipelineInput, userId: string) {
  const visibilityFilter = await buildVisibilityFilter(userId);
  const [existing] = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.id, id), visibilityFilter));
  if (!existing) throw new NotFoundError('PIPELINE_NOT_FOUND', 'Pipeline not found');

  return db.transaction(async (tx) => {
    const updates: { name?: string; actionConfig?: unknown; rateLimitPerMinute?: number | null; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (input.name !== undefined) updates.name = input.name;
    if (input.actionConfig !== undefined) updates.actionConfig = input.actionConfig;
    if (input.rateLimitPerMinute !== undefined) updates.rateLimitPerMinute = input.rateLimitPerMinute;

    const [updated] = await tx
      .update(pipelines)
      .set(updates)
      .where(eq(pipelines.id, id))
      .returning();

    let subs: SubscriberRow[];
    if (input.subscriberUrls !== undefined) {
      await tx.delete(subscribers).where(eq(subscribers.pipelineId, id));
      subs =
        input.subscriberUrls.length > 0
          ? await tx
              .insert(subscribers)
              .values(input.subscriberUrls.map((url) => ({ pipelineId: id, url })))
              .returning()
          : [];
    } else {
      subs = await tx.select().from(subscribers).where(eq(subscribers.pipelineId, id));
    }

    return formatPipeline(updated, subs);
  });
}

export async function deletePipeline(id: string, userId: string): Promise<void> {
  const visibilityFilter = await buildVisibilityFilter(userId);
  const [existing] = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.id, id), visibilityFilter));
  if (!existing) throw new NotFoundError('PIPELINE_NOT_FOUND', 'Pipeline not found');
  await db.delete(pipelines).where(eq(pipelines.id, id));
}
