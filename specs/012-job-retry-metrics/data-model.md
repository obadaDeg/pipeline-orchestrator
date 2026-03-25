# Data Model: Job Retry & Dashboard Metrics

## Changed Entities

### jobs (existing table, modified)

One new column added: `retry_count` (integer, NOT NULL, DEFAULT 0).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | uuid | PK | Job identifier |
| pipeline_id | uuid | FK → pipelines.id, SET NULL on delete | Owning pipeline |
| raw_payload | text | NOT NULL | Original webhook body — source of truth for retries |
| processed_payload | jsonb | nullable | Result after action transformer |
| status | job_status enum | NOT NULL, DEFAULT 'PENDING' | Job lifecycle state |
| **retry_count** | **integer** | **NOT NULL, DEFAULT 0** | **Count of manual operator retries** |
| error_message | text | nullable | Error detail on FAILED |
| created_at | timestamptz | NOT NULL, DEFAULT NOW() | Ingestion time |
| updated_at | timestamptz | NOT NULL, DEFAULT NOW() | Last state change |

**Indexes** (existing, no changes needed):
- `idx_jobs_status` on `status`
- `idx_jobs_pipeline_id` on `pipeline_id`
- `idx_jobs_created_at` on `created_at`
- `idx_jobs_pipeline_created` on `(pipeline_id, created_at)` — used by stats query

**State machine (existing, unchanged)**:
```
PENDING → PROCESSING → COMPLETED
                     ↘ FAILED
```

**New operator-initiated transition**:
```
FAILED ──[POST /jobs/:id/retry]──▶ PENDING   (retry_count++)
```

Side effects of transition:
- `status` set to `'PENDING'`
- `retry_count` incremented by 1
- `error_message` set to `null`
- New BullMQ task enqueued
- `JOB_RETRIED` audit event inserted

---

### audit_event_type (existing enum, extended)

New value added: `'JOB_RETRIED'`

Full enum after change:

| Value | Meaning |
|-------|---------|
| KEY_CREATED | API key created |
| KEY_REVOKED | API key revoked |
| AUTH_FAILED | Authentication attempt failed |
| TEAM_CREATED | Team created |
| TEAM_DELETED | Team deleted |
| TEAM_MEMBER_ADDED | Member added to team |
| TEAM_MEMBER_REMOVED | Member removed from team |
| USER_REGISTERED | New user registered |
| SIGNATURE_FAILED | Webhook signature verification failed |
| **JOB_RETRIED** | **Operator manually retried a failed job** |

**JOB_RETRIED audit event metadata shape**:
```json
{
  "jobId": "<uuid>",
  "pipelineId": "<uuid>",
  "retryCount": 1
}
```

---

## Computed Aggregates (no new tables)

All stats metrics are derived on request from existing tables. No new table is required.

### Stats Summary shape

| Field | Source Table(s) | SQL Pattern |
|-------|-----------------|-------------|
| totalPipelines | pipelines | `COUNT(*)::int` with visibility filter |
| jobsToday | jobs | `COUNT(*)::int WHERE created_at >= CURRENT_DATE::timestamptz` |
| successRate | jobs | `COUNT(*) FILTER (WHERE status='COMPLETED') / NULLIF(COUNT(*) FILTER (WHERE status IN ('COMPLETED','FAILED')),0) * 100` |
| avgDeliveryMs | delivery_attempts | `AVG(response_time_ms)::float WHERE outcome='SUCCESS' AND response_time_ms IS NOT NULL` |
| topFailingPipelines | jobs + pipelines | `GROUP BY pipeline_id ORDER BY COUNT(*) FILTER (WHERE status='FAILED') DESC LIMIT 5` |

All queries scoped to pipeline IDs accessible to the authenticated user (personal + team via `getUserTeamIds`).

---

## Migration

**File**: `drizzle/0004_add-retry-count-and-job-retried-event.sql`

```sql
ALTER TABLE "jobs" ADD COLUMN "retry_count" integer NOT NULL DEFAULT 0;
ALTER TYPE "public"."audit_event_type" ADD VALUE 'JOB_RETRIED';
```

Note: `ALTER TYPE ... ADD VALUE` must be manually appended to the generated migration file if `db:generate` does not produce it (known Drizzle behaviour for enum additions). The constraint-free nature of `ADD VALUE` makes it safe to apply without data migration.
