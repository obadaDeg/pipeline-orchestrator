# Future Improvements & Architectural Decisions

This document captures architectural ideas, potential improvements, and technical decisions I want to revisit as the project matures. These are not immediate priorities — they are forward-looking notes on where the system could grow and why.

---

## 1. Split Processor and Delivery Workers

**Current state**: A single BullMQ worker handles both job processing (running the pipeline action) and delivery (fanning out to subscribers).

**Why I want to change this**: Processing is CPU-bound work — running actions against payloads. Delivery is I/O-bound work — making HTTP requests and handling retries. Mixing them in a single worker means they compete for the same resources and can't scale independently.

**Future direction**: Split into two separate worker services:
- `worker-processor` — consumes jobs off the queue, applies the pipeline action, writes the result
- `worker-delivery` — fans out to subscribers, handles per-subscriber retries

This would allow scaling them independently based on load shape:
```bash
docker compose up --scale worker-processor=2 --scale worker-delivery=8
```
Useful when there are many subscribers and delivery is the bottleneck, without over-provisioning the processor tier.

---

## 2. Per-Subscriber Delivery Retries

**Current state**: When delivery fails, the entire job is retried — meaning all subscribers are re-targeted even if most already received the payload successfully.

**Why I want to change this**: Retrying the whole job on a single subscriber failure causes duplicate deliveries to subscribers that already succeeded. This is a correctness issue for idempotency-sensitive consumers.

**Future direction**: Enqueue one BullMQ task per subscriber at fan-out time. Each task retries independently. A failing subscriber doesn't affect others. This also enables tracking `subscriber_count` (how many were targeted) and `total_deliveries` (how many attempts were made) to surface delivery anomalies.

---

## 3. Richer Job Status Model

**Current state**: Jobs have four statuses: `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`.

**Why I want to change this**: `FAILED` is ambiguous — it doesn't tell you whether the job failed during processing (bad action config, runtime error) or during delivery (subscriber returned 5xx, network timeout). Diagnosing failures requires querying delivery attempts, which adds unnecessary friction.

**Future direction**: Expand to six granular statuses:
- `pending` → `processing` → `processing-failed` (action failed)
- `processing` → `processed` → `delivery-failed` (action succeeded, delivery didn't)
- `processed` → `completed` (all subscribers delivered)

This makes the status field self-documenting and allows filtering at the query layer without joins.

---

## 4. Delivery Mismatch Metrics

**Current state**: The stats page shows aggregate success rate and top failing pipelines, but doesn't surface partial delivery failures — cases where a job completed but not all subscribers were actually reached.

**Why I want to add this**: A job marked `completed` may have had 3 out of 5 subscribers fail silently if retry logic isn't tight. Surfacing `subscriber_count` vs `total_deliveries` mismatches would catch these anomalies before they become customer complaints.

**Future direction**: Add a metrics query that identifies jobs where `total_deliveries != subscriber_count` and expose them in the stats page as a "Delivery anomalies" card or alert.

---

## 5. Outbound Delivery Signing

**Current state**: Inbound webhooks are verified using `X-Webhook-Signature` (HMAC-SHA256). Outbound deliveries to subscribers are not signed.

**Why I want to add this**: Subscribers have no way to verify that a delivery request came from this system and not a third party. Adding a per-subscriber signing secret and an `X-Delivery-Signature` header on outbound requests gives subscribers a way to authenticate the source — the same model I already use for inbound.

**Future direction**: Generate a signing secret per subscriber (alongside the existing subscriber URL). Sign each delivery request body with HMAC-SHA256 and include the signature in `X-Delivery-Signature`. Document the verification algorithm for subscriber developers.

---

## 6. Pipeline Chaining

**Current state**: Each pipeline is independent. The output of one pipeline cannot feed into another without external orchestration.

**Why I want to add this**: Some workflows are naturally multi-step — filter first, then transform, then enrich. Currently users have to set up separate pipelines and wire them together externally, which is error-prone and adds latency.

**Future direction**: Add an optional `nextPipelineId` field to the pipeline schema. When a job completes processing, if `nextPipelineId` is set, the result payload is automatically enqueued as a new job in the next pipeline. Users can still subscribe to intermediate pipeline outputs, not just the final result. This enables building DAG-style workflows without external glue code.

---

## 7. Queue Monitoring UI (Bull Board)

**Current state**: There is no visibility into the BullMQ queue state. Debugging stuck or failed queue jobs requires querying Redis directly.

**Why I want to add this**: During incidents, knowing queue depth, failed job counts, and retry schedules is essential. Without a UI, this information is only accessible via `redis-cli`, which is not developer-friendly and completely inaccessible to non-technical operators.

**Future direction**: Mount Bull Board at `/queues` (behind authentication). This gives a real-time view of queue depth, job statuses, retry counts, and the ability to manually retry or discard stuck jobs from a browser.

---

## 8. Distributed Rate Limiting

**Current state**: Per-pipeline rate limiting uses an in-memory fixed window counter in the API process. This breaks under horizontal scaling — each API instance has its own counter, so the effective rate limit multiplies by the number of instances.

**Why I want to change this**: If the API is scaled to 3 instances and the per-pipeline limit is 60 req/min, the actual effective limit becomes 180 req/min because each instance counts independently. This makes rate limiting unreliable in any scaled deployment.

**Future direction**: Move the rate limit counter to Redis using `INCR` + `EXPIRE` with a shared key scoped to `pipeline:{id}:ratelimit:{window}`. This makes the limit consistent regardless of how many API instances are running.

---

## 9. Reusable Row Existence Middleware

**Current state**: Controllers manually fetch the target resource (pipeline, job, subscriber) and return 404 if not found. This pattern is repeated across every controller.

**Why I want to change this**: The lookup-and-404 pattern is identical across all resource types. Repeating it in every controller adds noise and creates opportunities for inconsistency (different error codes, different error messages).

**Future direction**: Extract a generic `validateRowExistence(table, paramKey)` middleware that fetches the row, attaches it to `res.locals`, and returns a consistent 404 if not found. Controllers then read from `res.locals` instead of hitting the DB again. Reduces boilerplate and centralizes the 404 contract.

---

## 10. Database-Level Check Constraints

**Current state**: Enum validation for `status`, `action_type`, etc. is enforced only at the application layer via Zod schemas. The database accepts any string value for these columns.

**Why I want to add this**: Application-level validation can be bypassed — by direct DB writes, migrations that miss a case, or bugs in the validation layer. Adding `CHECK` constraints at the schema level makes invalid states structurally impossible at the storage layer, not just the API layer.

**Future direction**: Add Drizzle `check()` constraints for all enum-typed columns. Also consider **partial indexes** on high-frequency status filters (e.g., an index only on `WHERE status = 'PENDING'`) to make status-based queue queries faster without the overhead of a full index.

---

## 11. TSConfig Path Aliases

**Current state**: Imports use relative paths (`../../lib/errors.js`, `../../../db/schema.js`), which get unwieldy as the project grows deeper.

**Why I want to change this**: Deep relative paths are fragile — moving a file breaks all its imports. Path aliases (`@db/`, `@lib/`, `@services/`) make imports location-independent and instantly readable.

**Future direction**: Add `paths` to `tsconfig.json` and the corresponding `moduleNameMapper` in Vitest config. Low-effort change with meaningful long-term maintainability impact.

---

## 12. Schema Design Decisions to Revisit

This section captures specific data model choices I made early that I'd reconsider as the system grows — and a few areas where I think my current design is already the right call long-term.

---

### 12a. Jobs — Payload Storage: `text` vs `jsonb`

**Current state**: I store the raw webhook body as `text` (`raw_payload`) and the processed result as a separate `jsonb` column (`processed_payload`).

**Why I did it this way**: Storing the raw bytes as `text` is required for HMAC signature verification — hashing the parsed JSON would not match the original signature, since key order and whitespace could differ after serialization. Preserving the exact byte sequence is a correctness requirement, not a preference.

**The tradeoff**: `text` can't be queried with JSONB operators. If I ever want to filter jobs by payload field values (e.g. `WHERE raw_payload->>'event' = 'push'`), I'd need to either cast at query time or add a separate `jsonb` column for queryable payload data.

**Future direction**: Keep `raw_payload` as `text` for signature integrity. Consider adding a parsed `payload_data jsonb` column populated on ingest for query convenience, if that need arises.

---

### 12b. Jobs — Delivery Tracking Fields

**Current state**: The `jobs` table has no visibility into delivery fan-out. There's no way to tell from the job record alone how many subscribers were targeted vs how many were actually reached.

**Why I'd add this**: Without `subscriber_count` and `total_deliveries` columns on `jobs`, detecting partial delivery failures requires querying and aggregating `delivery_attempts` — an extra join for every health check. Denormalizing these counters onto the job row makes anomaly detection cheap.

```sql
-- Future columns on jobs
subscriber_count   integer,          -- set at fan-out time
total_deliveries   integer default 0 -- incremented per attempt
```

A job where `total_deliveries < subscriber_count` after completion is a silent partial failure — something the current schema cannot surface without a full aggregation query.

---

### 12c. Jobs — Partial Indexes vs Full Status Index

**Current state**: I have a full B-tree index on `status`. Every status value shares one index.

**Why partial indexes are better at scale**: The worker primarily queries for `PENDING` jobs, and monitoring queries look for `FAILED` jobs. A full index on `status` includes all completed jobs — which will be the overwhelming majority over time and add bloat to every index scan.

**Future direction**: Replace the full `status` index with targeted partial indexes:

```sql
CREATE INDEX idx_jobs_pending ON jobs (created_at) WHERE status = 'PENDING';
CREATE INDEX idx_jobs_failed  ON jobs (updated_at) WHERE status = 'FAILED';
```

These are smaller, faster for their specific query patterns, and don't grow as completed jobs accumulate.

---

### 12d. Jobs — `completed_at` Timestamp

**Current state**: Job completion time is inferred from `updated_at`. There's no dedicated `completed_at` column.

**Why a dedicated column matters**: `updated_at` gets touched on every status transition and error update — not just completion. Inferring completion time from it is fragile if the job is ever touched after reaching a terminal state. A dedicated `completed_at` column makes end-to-end latency queries unambiguous:

```sql
SELECT AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) * 1000) AS avg_ms
FROM jobs WHERE completed_at IS NOT NULL;
```

---

### 12e. Pipelines — UUID Slug vs Human-Readable `source_path`

**Current state**: My ingest URL uses a random UUID as the webhook slug (`/webhooks/:sourceId`). The UUID is auto-generated and never user-defined.

**Why I prefer this**: A UUID is unguessable. A human-readable slug like `customer-created` is predictable — anyone who knows the naming convention can attempt to POST to pipelines they don't own. For a multi-tenant system where pipelines are scoped to users and teams, the UUID slug is a meaningful second layer of obscurity.

**The tradeoff**: UUIDs are not memorable or debuggable. When reading logs, `/webhooks/550e8400-e29b-41d4-a716-446655440000` is harder to correlate to a pipeline than `/webhooks/github-events`.

**Future direction**: Keep the UUID slug as the canonical ingest URL. Optionally add a read-only `name_slug` (derived from pipeline name, display-only) that is shown in the dashboard alongside the full UUID URL — best of both worlds.

---

### 12f. Pipelines — Signing Secret as Separate Table

**Current state**: Signing secrets live in `pipeline_signing_secrets`, a separate table with a unique FK to `pipelines`. This supports full rotation — generating a new secret doesn't touch the pipeline row itself.

**Why this is the right call**: Storing the secret directly on the pipeline row (as a `secret text` column) means rotation requires an `UPDATE` on the pipeline — touching `updated_at`, potentially invalidating caches, and conflating two different concerns (pipeline config vs credential management). A dedicated table cleanly separates the credential lifecycle from the pipeline lifecycle and will make future features like secret history or grace-period rotation (accepting both old and new secret briefly) much easier to implement.

**This design is intentionally kept as-is.**

---

### 12g. Subscribers — Missing Outbound Signing Secret

**Current state**: The `subscribers` table has only `id`, `pipeline_id`, `url`, and timestamps. There is no secret stored per subscriber.

**Why this matters**: Subscribers receive delivery payloads but have no way to verify the request came from this system. Adding a `secret text` column per subscriber enables signing each outbound delivery with `X-Delivery-Signature` — giving subscribers a verification mechanism symmetric to what this system uses for inbound webhook verification.

**Future direction**: Add `secret text` and `nickname text` to the `subscribers` table. Generate a default secret on subscriber creation (like pipeline signing secrets). Surface the secret in the dashboard subscriber management UI.

---

### 12h. Delivery Attempts — `pending` Status and Scheduling Fields

**Current state**: Delivery attempts are only recorded after the attempt executes. There is no pre-insertion for scheduled attempts.

**Why pre-inserting attempts is useful**: Recording a delivery attempt as `pending` at the moment it's enqueued — before the HTTP request fires — gives complete audit coverage. If the worker crashes between enqueue and execution, the orphaned `pending` row makes the gap visible in the audit log.

**Future direction**: Add a `scheduled_for timestamp` and `delivered_at timestamp` to `delivery_attempts`. Insert the row as `pending` when the delivery task is enqueued; update to `delivered`/`failed` when it resolves. This turns the delivery attempts table into a complete timeline, not just a success/failure log.

---

### 12i. Delivery Attempts — Subscriber URL Denormalization

**Current state**: `delivery_attempts` stores `subscriber_url text` at the time of the attempt. If a subscriber's URL is later updated or the subscriber is deleted, the historical attempt record still shows the URL that was actually used.

**Why this matters**: This is a deliberate audit decision — preserving the exact URL that was called makes the delivery history immutable and trustworthy. A FK-only approach would silently lose this context if the subscriber is deleted with CASCADE. I use `SET NULL` on `subscriber_id` so the FK becomes null on deletion while the denormalized `subscriber_url` remains intact.

**This design is intentionally kept as-is.**

---

### 12j. Schema Organization — Single File vs Per-Table Modules

**Current state**: All tables are defined in a single `src/db/schema.ts` file.

**Why splitting is better at scale**: A single schema file becomes unwieldy past ~5 tables. Splitting into `schema/pipelines.ts`, `schema/jobs.ts`, `schema/subscribers.ts`, etc. — with a `schema/relations.ts` to handle cross-table Drizzle relations (which need to be defined separately to avoid circular imports) — makes the schema easier to navigate and review.

**Future direction**: Refactor into per-table modules when the schema grows beyond its current size. Keep relations in a dedicated `relations.ts` file.

---

### 12k. Timestamps — Timezone Awareness

**Current state**: All timestamps use `{ withTimezone: true }`, storing as `timestamptz` in PostgreSQL.

**Why this is the right call**: `timestamp without time zone` stores local time with no offset context. When the server timezone changes, or when data is queried from a different locale, values become ambiguous. `timestamptz` stores UTC internally and converts on read — unambiguous regardless of where the query originates.

**This design is intentionally kept as-is.**

---

### Summary of Schema Decisions

| Area | Current design | Future change? |
|------|---------------|----------------|
| Payload storage (`text` vs `jsonb`) | `text` for signature integrity + `jsonb` for result | Keep; optionally add `payload_data jsonb` |
| Delivery tracking on jobs | Not tracked | Add `subscriber_count` + `total_deliveries` |
| Job status index | Full index on `status` | Replace with partial indexes |
| `completed_at` column | Inferred from `updated_at` | Add dedicated column |
| Ingest URL slug | UUID (unguessable) | Keep; add display slug optionally |
| Signing secret storage | Separate table (rotation-ready) | Keep |
| Subscriber outbound secret | Missing | Add `secret` + `nickname` |
| Delivery attempt pre-insertion | Not done | Add `pending` status + `scheduled_for` |
| Subscriber URL denormalization | Done (intentional) | Keep |
| Schema file organization | Single file | Split when schema grows |
| Timestamps | `timestamptz` everywhere | Keep |

---

## Summary

| Improvement | Impact | Complexity |
|-------------|--------|------------|
| Split processor/delivery workers | High | Medium |
| Per-subscriber retries | High | Medium |
| Richer job status model | High | Low |
| Delivery mismatch metrics | Medium | Low |
| Outbound delivery signing | Medium | Low |
| Pipeline chaining | Medium | High |
| Bull Board queue UI | Medium | Low |
| Distributed rate limiting | Medium | Low |
| Row existence middleware | Low | Low |
| DB check constraints | Low | Low |
| TSConfig path aliases | Low | Low |
