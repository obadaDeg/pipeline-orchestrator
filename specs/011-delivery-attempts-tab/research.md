# Research: Delivery Attempts Tab & Per-Pipeline Rate Limiting

## Finding 1: Delivery attempts are already fully implemented

**Decision**: No new delivery-attempts infrastructure to build — the API endpoint, service function, and dashboard UI all exist.

**What exists today:**
- `GET /jobs/:id/delivery-attempts` endpoint is registered and auth-protected
- `getDeliveryAttempts()` service function returns paginated attempts sorted by attempt number
- `JobDetailPage.tsx` renders a full delivery attempts section with expandable rows, outcome badges, HTTP status, response snippet, pagination, and empty state

**What is missing**: `responseTimeMs` — the spec requires response time per attempt, but it is not stored. The `http-client.ts` does not measure delivery duration and `delivery_attempts` has no such column.

**Rationale**: Adding response time is a small, valuable addition that completes the diagnostic picture without touching the existing structure.

**Alternatives considered**: Showing only the `attemptedAt` timestamp as a proxy for timing — rejected because it gives no indication of how long the HTTP call itself took.

---

## Finding 2: Rate limiting — Redis fixed-window, no new dependencies

**Decision**: Implement per-pipeline rate limiting using a manual Redis `INCR`/`EXPIRE` fixed-window algorithm, keyed on `sourceId`, using the existing `ioredis` client already exported from `src/queue/redis.ts`.

**Rationale**:
- The project already has Redis available via BullMQ; no new dependency required.
- A fixed-window with two Redis operations per request (INCR + conditional EXPIRE) adds negligible latency and keeps the webhook ingestion path well within the 200ms p95 requirement (Constitution principle IX).
- `express-rate-limit` is designed for global/per-IP limits, not per-resource limits tied to DB records. Its Redis store adapter would add a dependency and complexity without benefit here.
- `rate-limiter-flexible` is a capable library but is heavier than needed for a two-operation pattern.

**Redis key format**: `ratelimit:{sourceId}:{windowStartSec}` where `windowStartSec = Math.floor(Date.now() / 1000 / 60) * 60`. The window start in the key enables easy debugging and TTL calculation.

**`Retry-After` computation**: `Math.ceil(windowStartSec + 60 - Math.floor(Date.now() / 1000))` — seconds until the current minute window resets.

**Alternatives considered**:
- *Sliding window*: More accurate but requires a sorted set + Lua script. Unnecessary for protecting a job queue where predictable cutoffs are acceptable.
- *Token bucket*: Best UX but most complex to implement atomically in Redis. Deferred to a future enhancement.

---

## Finding 3: Rate limit check lives in the ingestion service, not a middleware

**Decision**: Call `checkRateLimit()` inside `ingestWebhook()` in `src/services/ingestion.service.ts`, immediately after the pipeline is loaded from the database. Throw a new `RateLimitError` (extending `AppError` with status 429) on rejection. The webhook controller catches and translates this into a 429 response with the `Retry-After` header.

**Rationale**: The pipeline record (including its `rateLimitPerMinute` setting) is already loaded in `ingestWebhook()` to validate the `sourceId`. Placing the check there avoids a second DB round-trip and keeps the controller thin. The existing `AppError` pattern ensures the global error handler or the controller can attach the `Retry-After` header cleanly.

**Default**: 60 requests per minute. Stored as a named constant `DEFAULT_RATE_LIMIT_PER_MINUTE = 60` in `src/lib/constants.ts` (or added to the existing constants file). Pipelines with `rateLimitPerMinute = null` use this default.

---

## Finding 4: Schema changes required — two small additions

**Decision**: Add two nullable integer columns via a Drizzle migration:
1. `delivery_attempts.response_time_ms INTEGER NULL` — populated by the HTTP client when timing is available; null on timeout/network error.
2. `pipelines.rate_limit_per_minute INTEGER NULL` — the per-pipeline cap; null means "use system default (60)".

No other schema changes are needed. Both additions are additive and non-breaking.

---

## Finding 5: Dashboard changes are minimal

**Decision**: Two small UI updates:
1. `dashboard/src/pages/JobDetailPage.tsx` — add a "Response time" column to the delivery attempts table (display `Nms` or a dash for null).
2. `dashboard/src/pages/PipelineListPage.tsx` + `PipelineDetailPage.tsx` — add an optional "Rate limit (req/min)" number input to the create and edit forms, defaulting to 60.

No new components needed. The existing `CodeEditorInput`, form patterns, and API hooks are reused.
