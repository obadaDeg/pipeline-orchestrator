# Data Model: Webhook-Driven Task Processing Pipeline

**Branch**: `001-webhook-pipeline-core`
**Date**: 2026-03-14
**Implementation**: Drizzle ORM — `src/db/schema.ts`

---

## Enums

| Enum | Values |
|------|--------|
| `action_type` | `field_extractor`, `payload_filter`, `http_enricher` |
| `job_status` | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED` |
| `delivery_outcome` | `SUCCESS`, `FAILED` |

---

## Table: `pipelines`

Stores pipeline configuration. Each pipeline has a unique source URL (derived from
`source_id`) and a single configured processing action.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, `defaultRandom()` | Internal identifier |
| `name` | `text` | NOT NULL | Human-readable label |
| `source_id` | `uuid` | NOT NULL, UNIQUE, `defaultRandom()` | Used in ingestion URL `/webhooks/:source_id`. Immutable after creation. |
| `action_type` | `action_type` enum | NOT NULL | Determines which transformer is invoked |
| `action_config` | `jsonb` | NOT NULL | Action-specific configuration (see Action Config Shapes) |
| `created_at` | `timestamptz` | NOT NULL, `defaultNow()` | |
| `updated_at` | `timestamptz` | NOT NULL, `defaultNow()` | Updated by service layer on PATCH |

**Indexes**: PK on `id`; unique index on `source_id` (hot path: ingestion lookup).

**Action Config Shapes** (validated by Zod at API layer):
- `field_extractor`: `{ "mapping": { "outputKey": "input.path", ... } }`
- `payload_filter`: `{ "field": "string", "operator": "eq"|"ne"|"contains", "value": any }`
- `http_enricher`: `{ "url": "string", "mergeKey"?: "string" }`

---

## Table: `subscribers`

Each subscriber is a destination URL associated with a pipeline. A pipeline may have
zero or more subscribers.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, `defaultRandom()` | |
| `pipeline_id` | `uuid` | NOT NULL, FK → `pipelines.id` ON DELETE CASCADE | Subscribers are subordinate to pipelines |
| `url` | `text` | NOT NULL | Destination for HTTP POST delivery |
| `created_at` | `timestamptz` | NOT NULL, `defaultNow()` | |

**Indexes**: `idx_subscribers_pipeline_id` on `(pipeline_id)` — supports efficient
subscriber list fetch per pipeline.

**FK semantics**: `ON DELETE CASCADE` — deleting a pipeline removes its subscribers.
This is correct because subscribers have no independent lifecycle. Job history is
preserved separately via `ON DELETE SET NULL` on `jobs.pipeline_id`.

---

## Table: `jobs`

One job is created per incoming webhook. Records the full lifecycle from ingestion
to final delivery outcome.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, `defaultRandom()` | Returned in 202 response as `jobId` |
| `pipeline_id` | `uuid` | NULLABLE, FK → `pipelines.id` ON DELETE SET NULL | Nullable to preserve history after pipeline deletion (FR-005) |
| `raw_payload` | `text` | NOT NULL | Raw request body; stored as text regardless of content-type |
| `processed_payload` | `jsonb` | NULLABLE | Set after successful action execution |
| `status` | `job_status` enum | NOT NULL, default `'PENDING'` | State machine: PENDING → PROCESSING → COMPLETED/FAILED |
| `error_message` | `text` | NULLABLE | Populated when status = FAILED |
| `created_at` | `timestamptz` | NOT NULL, `defaultNow()` | |
| `updated_at` | `timestamptz` | NOT NULL, `defaultNow()` | Updated on every status transition |

**Indexes**:
- `idx_jobs_status` on `(status)` — stalled-job recovery scanner (FR-019)
- `idx_jobs_pipeline_id` on `(pipeline_id)` — paginated job list per pipeline (FR-021)
- `idx_jobs_created_at` on `(created_at DESC)` — default sort for listing
- `idx_jobs_pipeline_created` on `(pipeline_id, created_at DESC)` — covers the common
  query "list jobs for pipeline ordered newest first" in a single index scan

**FK semantics**: `pipeline_id` uses `ON DELETE SET NULL` (not CASCADE). This preserves
all job and delivery history even when the originating pipeline is deleted, satisfying
FR-005. The column is therefore nullable.

---

## Table: `delivery_attempts`

One record per subscriber per delivery attempt. Provides the full audit trail required
by FR-014, FR-020, and SC-006.

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | `uuid` | PK, `defaultRandom()` | |
| `job_id` | `uuid` | NOT NULL, FK → `jobs.id` ON DELETE CASCADE | |
| `subscriber_id` | `uuid` | NULLABLE, FK → `subscribers.id` ON DELETE SET NULL | Nullable: subscriber may be deleted after delivery was recorded |
| `subscriber_url` | `text` | NOT NULL | **Denormalized snapshot** of the URL at delivery time. Ensures history is intact even if the subscriber row is later deleted or its URL changed. |
| `http_status` | `integer` | NULLABLE | HTTP response status code. NULL if no response was received (network error, timeout). |
| `response_snippet` | `text` | NULLABLE | First 500 characters of the response body |
| `attempt_number` | `integer` | NOT NULL | 1-indexed; increments with each retry |
| `outcome` | `delivery_outcome` enum | NOT NULL | `SUCCESS` or `FAILED` |
| `attempted_at` | `timestamptz` | NOT NULL, `defaultNow()` | |

**Indexes**:
- `idx_delivery_attempts_job_id` on `(job_id)` — required by spec; supports listing
  all attempts for a job (FR-022)
- `idx_delivery_attempts_job_subscriber` on `(job_id, subscriber_id, attempt_number)`
  — supports counting attempts per subscriber for retry logic

**FK semantics**:
- `job_id`: `ON DELETE CASCADE` — delivery attempts are meaningless without their job;
  cascade delete is appropriate. (No job deletion API exists, so this is a safety net.)
- `subscriber_id`: `ON DELETE SET NULL` — combined with the denormalized `subscriber_url`,
  delivery history remains fully readable after a subscriber is removed.

---

## Entity Relationships

```
pipelines (1) ──── (0..*) subscribers
     │
     └── (0..*) jobs  [pipeline_id nullable — SET NULL on pipeline delete]
                  │
                  └── (0..*) delivery_attempts
                               │
                               └── subscriber_id nullable — SET NULL on subscriber delete
                                   subscriber_url always populated (denormalized)
```

---

## State Machine: Job Status

```
[Created] ──► PENDING ──► PROCESSING ──► COMPLETED
                                    └──► FAILED
```

Transitions:
- `PENDING → PROCESSING`: Worker picks up job from BullMQ queue
- `PROCESSING → COMPLETED`: All subscriber deliveries succeeded, OR Payload Filter
  returned no-match (no delivery needed)
- `PROCESSING → FAILED`: Action threw unrecoverable error, OR any subscriber reached
  `MaxRetriesExceeded`
- Stalled recovery: `PROCESSING → PENDING` if `updated_at < now() - STALLED_JOB_TIMEOUT_MS`

---

## Migration Strategy

Drizzle Kit manages migrations:
1. Edit `src/db/schema.ts`
2. Run `npm run db:generate` → generates SQL migration file in `src/db/migrations/`
3. Run `npm run db:migrate` → applies pending migrations
4. In Docker Compose, a `migrator` service runs migrations before the API and worker start
