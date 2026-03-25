# Research: Job Retry & Dashboard Metrics

## Decision 1: Retry Re-enqueue Strategy

**Decision**: Use `webhookQueue.add('process-webhook', { jobId, pipelineId })` to re-enqueue retried jobs — the same pattern as the ingestion service.

**Rationale**: BullMQ's built-in `job.retry()` operates on a BullMQ Job object and is designed for automatic framework-level retries, not operator-initiated actions on database records. The simplest and proven approach reuses the ingestion path: reset the DB row status to `PENDING`, increment `retryCount`, clear `errorMessage`, then enqueue a new BullMQ task. The worker already handles the `PENDING → PROCESSING` transition identically regardless of how the task was enqueued.

**Alternatives considered**:
- BullMQ `job.retry()`: Rejected — requires a reference to the BullMQ job object (not stored in the database), and is semantically for automatic retries, not manual operator actions.
- Separate retry queue: Rejected — unnecessary complexity; the same worker handles all job types.

---

## Decision 2: Drizzle Enum Extension for JOB_RETRIED

**Decision**: Add `'JOB_RETRIED'` to the `auditEventTypeEnum` in `schema.ts`, generating migration SQL with `ALTER TYPE "public"."audit_event_type" ADD VALUE 'JOB_RETRIED'`.

**Rationale**: This follows the exact same pattern used in migration `0002_blue_war_machine.sql` for `SIGNATURE_FAILED`. PostgreSQL 16 supports `ALTER TYPE ... ADD VALUE` inside transactions. The Drizzle migration runner applies this safely. The existing `emitAuditEvent(userId, eventType, metadata)` helper in `auth.service.ts` is reused directly — no new infrastructure needed.

**Alternatives considered**:
- Separate freeform job audit table: Rejected — breaks existing audit system consistency.
- Storing audit in a new `job_retry_history` table: Rejected — over-engineering; spec requires only a count in the `jobs` table, and audit events handle the history.

---

## Decision 3: Stats Query Approach

**Decision**: Compute all five stats metrics in a single service function using parallel Drizzle `Promise.all` queries (one query per metric), scoped to user-accessible pipeline IDs via the existing `getUserTeamIds` helper pattern.

**Rationale**: Running queries in parallel via `Promise.all` minimises latency compared to sequential execution. Drizzle's `sql<T>` template literals support direct aggregate expressions (`count(*)::int`, `avg(response_time_ms)::float`) without losing type safety. The `getUserTeamIds` + visibility filter pattern is already proven in `pipeline.service.ts` and `job.service.ts`.

**Alternatives considered**:
- Single combined SQL JOIN: Considered, but the metrics span different base tables (pipelines, jobs, delivery_attempts) making one query complex and hard to maintain.
- PostgreSQL materialized views: Rejected — spec explicitly prohibits caching and external systems; materialized views require refresh logic.
- Sequential queries: Valid but slower; parallel is strictly better here.

---

## Decision 4: retryCount Column Placement

**Decision**: Add `retry_count` as a column directly on the `jobs` table (`integer NOT NULL DEFAULT 0`).

**Rationale**: The retry count is an intrinsic property of the job record. Placing it on `jobs` keeps the data co-located with `status`, making both readable in a single query with no join. The `audit_events` table (`JOB_RETRIED`) provides a timestamped history trail if ever needed.

**Alternatives considered**:
- Derive from audit_events COUNT: Rejected — requires a join on every job list query; adds latency.
- Separate `job_retry_history` table: Rejected — over-engineering for a simple count requirement.

---

## Decision 5: Stats "Today" Time Boundary

**Decision**: "Today" = `CURRENT_DATE::timestamptz` (midnight UTC), expressed in Drizzle as `sql\`${jobs.createdAt} >= CURRENT_DATE::timestamptz\``.

**Rationale**: UTC midnight is a stable, predictable boundary that avoids DST ambiguity. This matches the Assumptions section of the spec. `CURRENT_DATE` in PostgreSQL returns the current date in the server time zone (set to UTC in Docker), cast to `timestamptz` it represents midnight UTC.

**Alternatives considered**:
- User timezone: Not stored; UTC is the system standard.
- Rolling 24-hour window: Rejected — spec says "jobs processed today", implying a calendar boundary, not a rolling window.

---

## Decision 6: retryJob Ownership/Visibility Check

**Decision**: Resolve the pipeline from the job's `pipelineId`, then check visibility using the existing `buildVisibilityFilter` pattern from `pipeline.service.ts` (personal + team access).

**Rationale**: Jobs inherit their access control from their pipeline. The pipeline visibility check pattern is already implemented and tested. Reusing it in `retryJob()` avoids duplicating access control logic.

**Note**: If `pipelineId` is null (pipeline deleted), the retry MUST be rejected with 404 / `JOB_NOT_FOUND` — the job cannot be re-queued without a valid pipeline.
