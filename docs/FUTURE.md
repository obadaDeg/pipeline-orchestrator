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
