import {
  pgTable,
  pgEnum,
  uuid,
  text,
  jsonb,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ─── Enums ────────────────────────────────────────────────────────────────────

export const actionTypeEnum = pgEnum('action_type', [
  'field_extractor',
  'payload_filter',
  'http_enricher',
]);

export const jobStatusEnum = pgEnum('job_status', [
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
]);

export const deliveryOutcomeEnum = pgEnum('delivery_outcome', ['SUCCESS', 'FAILED']);

// ─── pipelines ────────────────────────────────────────────────────────────────

export const pipelines = pgTable('pipelines', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  sourceId: uuid('source_id').notNull().defaultRandom(),
  actionType: actionTypeEnum('action_type').notNull(),
  actionConfig: jsonb('action_config').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const pipelinesIndexes = {
  sourceIdIdx: uniqueIndex('idx_pipelines_source_id').on(pipelines.sourceId),
};

// ─── subscribers ──────────────────────────────────────────────────────────────

export const subscribers = pgTable(
  'subscribers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pipelineId: uuid('pipeline_id')
      .notNull()
      .references(() => pipelines.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pipelineIdIdx: index('idx_subscribers_pipeline_id').on(table.pipelineId),
  }),
);

// ─── jobs ─────────────────────────────────────────────────────────────────────

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pipelineId: uuid('pipeline_id').references(() => pipelines.id, { onDelete: 'set null' }),
    rawPayload: text('raw_payload').notNull(),
    processedPayload: jsonb('processed_payload'),
    status: jobStatusEnum('status').notNull().default('PENDING'),
    errorMessage: text('error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index('idx_jobs_status').on(table.status),
    pipelineIdIdx: index('idx_jobs_pipeline_id').on(table.pipelineId),
    createdAtIdx: index('idx_jobs_created_at').on(table.createdAt),
    pipelineCreatedIdx: index('idx_jobs_pipeline_created').on(table.pipelineId, table.createdAt),
  }),
);

// ─── delivery_attempts ────────────────────────────────────────────────────────

export const deliveryAttempts = pgTable(
  'delivery_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    subscriberId: uuid('subscriber_id').references(() => subscribers.id, {
      onDelete: 'set null',
    }),
    subscriberUrl: text('subscriber_url').notNull(),
    httpStatus: integer('http_status'),
    responseSnippet: text('response_snippet'),
    attemptNumber: integer('attempt_number').notNull(),
    outcome: deliveryOutcomeEnum('outcome').notNull(),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    jobIdIdx: index('idx_delivery_attempts_job_id').on(table.jobId),
    jobSubscriberAttemptIdx: index('idx_delivery_attempts_job_subscriber').on(
      table.jobId,
      table.subscriberId,
      table.attemptNumber,
    ),
  }),
);
