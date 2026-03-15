import { desc, eq, sql } from 'drizzle-orm';
import { config } from '../config.js';
import { db } from '../db/index.js';
import { pipelines, subscribers } from '../db/schema.js';
import { NotFoundError } from '../lib/errors.js';

type ActionType = 'field_extractor' | 'payload_filter' | 'http_enricher';

export interface CreatePipelineInput {
  name: string;
  actionType: ActionType;
  actionConfig: Record<string, unknown>;
  subscriberUrls: string[];
}

export interface UpdatePipelineInput {
  name?: string;
  actionConfig?: Record<string, unknown>;
  subscriberUrls?: string[];
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

// ─── Service Functions ────────────────────────────────────────────────────────

export async function createPipeline(input: CreatePipelineInput) {
  return db.transaction(async (tx) => {
    const [pipeline] = await tx
      .insert(pipelines)
      .values({
        name: input.name,
        actionType: input.actionType,
        actionConfig: input.actionConfig,
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

export async function getPipelineById(id: string) {
  const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.id, id));
  if (!pipeline) throw new NotFoundError('PIPELINE_NOT_FOUND', 'Pipeline not found');

  const subs = await db.select().from(subscribers).where(eq(subscribers.pipelineId, id));
  return formatPipeline(pipeline, subs);
}

export async function listPipelines(page: number, limit: number) {
  const offset = (page - 1) * limit;

  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(pipelines);
  const rows = await db
    .select()
    .from(pipelines)
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

export async function updatePipeline(id: string, input: UpdatePipelineInput) {
  const [existing] = await db.select().from(pipelines).where(eq(pipelines.id, id));
  if (!existing) throw new NotFoundError('PIPELINE_NOT_FOUND', 'Pipeline not found');

  return db.transaction(async (tx) => {
    const updates: { name?: string; actionConfig?: unknown; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (input.name !== undefined) updates.name = input.name;
    if (input.actionConfig !== undefined) updates.actionConfig = input.actionConfig;

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

export async function deletePipeline(id: string): Promise<void> {
  const [existing] = await db.select().from(pipelines).where(eq(pipelines.id, id));
  if (!existing) throw new NotFoundError('PIPELINE_NOT_FOUND', 'Pipeline not found');
  await db.delete(pipelines).where(eq(pipelines.id, id));
}
