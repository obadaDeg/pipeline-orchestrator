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

export const jobStatusEnum = pgEnum('job_status', ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED']);

export const deliveryOutcomeEnum = pgEnum('delivery_outcome', ['SUCCESS', 'FAILED']);

export const auditEventTypeEnum = pgEnum('audit_event_type', [
  'KEY_CREATED',
  'KEY_REVOKED',
  'AUTH_FAILED',
  'TEAM_CREATED',
  'TEAM_DELETED',
  'TEAM_MEMBER_ADDED',
  'TEAM_MEMBER_REMOVED',
  'USER_REGISTERED',
  'SIGNATURE_FAILED',
]);

// ─── users ────────────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => ({
    emailIdx: uniqueIndex('idx_users_email').on(table.email),
  }),
);

// ─── api_keys ─────────────────────────────────────────────────────────────────

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** SHA-256 hex digest of the raw key — never store the raw key. */
    keyHash: text('key_hash').notNull(),
    /** First 8 characters of the raw key — displayed to help users identify keys. */
    keyPrefix: text('key_prefix').notNull(),
    /** Updated asynchronously on each successful authentication. */
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    /** Non-null means the key is revoked. Soft-delete only. */
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    keyHashIdx: uniqueIndex('idx_api_keys_key_hash').on(table.keyHash),
    userIdIdx: index('idx_api_keys_user_id').on(table.userId),
  }),
);

// ─── teams ────────────────────────────────────────────────────────────────────

export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => ({
    ownerUserIdIdx: index('idx_teams_owner_user_id').on(table.ownerUserId),
  }),
);

// ─── team_memberships ─────────────────────────────────────────────────────────

export const teamMemberships = pgTable(
  'team_memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    teamUserIdx: uniqueIndex('idx_team_memberships_team_user').on(table.teamId, table.userId),
    userIdIdx: index('idx_team_memberships_user_id').on(table.userId),
  }),
);

// ─── audit_events ─────────────────────────────────────────────────────────────

export const auditEvents = pgTable(
  'audit_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** NULL when the user identity cannot be determined (e.g. pre-auth failures). */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    eventType: auditEventTypeEnum('event_type').notNull(),
    /** Event-specific context: key prefix, key name, team id, etc. Never store secrets. */
    metadata: jsonb('metadata').notNull().default({}),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('idx_audit_events_user_id').on(table.userId),
    createdAtIdx: index('idx_audit_events_created_at').on(table.createdAt),
    eventTypeIdx: index('idx_audit_events_event_type').on(table.eventType),
  }),
);

// ─── pipelines ────────────────────────────────────────────────────────────────

export const pipelines = pgTable(
  'pipelines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    sourceId: uuid('source_id').notNull().defaultRandom(),
    actionType: actionTypeEnum('action_type').notNull(),
    actionConfig: jsonb('action_config').notNull(),
    /** Personal ownership: set when a user creates a pipeline without a team context. */
    ownerUserId: uuid('owner_user_id').references(() => users.id, { onDelete: 'set null' }),
    /** Team ownership: set when a pipeline is created under a team workspace. */
    ownerTeamId: uuid('owner_team_id').references(() => teams.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => ({
    sourceIdIdx: uniqueIndex('idx_pipelines_source_id').on(table.sourceId),
    ownerUserIdIdx: index('idx_pipelines_owner_user_id').on(table.ownerUserId),
    ownerTeamIdIdx: index('idx_pipelines_owner_team_id').on(table.ownerTeamId),
  }),
);

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
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
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

// ─── pipeline_signing_secrets ──────────────────────────────────────────────────

export const pipelineSigningSecrets = pgTable(
  'pipeline_signing_secrets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    pipelineId: uuid('pipeline_id')
      .notNull()
      .references(() => pipelines.id, { onDelete: 'cascade' }),
    /**
     * The raw signing secret. HMAC verification requires the original key,
     * so it cannot be hashed. High-entropy (256-bit) random secrets are safe
     * to store directly — no adaptive hash needed (unlike passwords).
     */
    secretValue: text('secret_value').notNull(),
    /** First 6 characters of the raw secret — stored for display identification. */
    secretHint: text('secret_hint').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    pipelineIdIdx: uniqueIndex('idx_pipeline_signing_secrets_pipeline_id').on(table.pipelineId),
  }),
);
