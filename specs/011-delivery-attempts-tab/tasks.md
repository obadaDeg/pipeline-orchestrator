# Tasks: Delivery Attempts Tab & Per-Pipeline Rate Limiting

**Input**: Design documents from `/specs/011-delivery-attempts-tab/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/api.md ✓, quickstart.md ✓

**Organization**: Four user stories. US1 and US3 are both P1 — US1 first (smaller, zero new services). US2 is a verification task (mostly already implemented). US3 is the main new backend feature. US4 is the dashboard wiring for US3.

**Key finding from planning**: The delivery attempts UI (`JobDetailPage.tsx`), API endpoint (`GET /jobs/:id/delivery-attempts`), and service function (`getDeliveryAttempts()`) already exist. US1 only adds `responseTimeMs` tracking. US3 + US4 are entirely new.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup

**Purpose**: Add both new schema columns in a single migration so all downstream tasks can import from the updated schema.

- [X] T001 Add `responseTimeMs: integer('response_time_ms')` nullable column to the `deliveryAttempts` table definition in `src/db/schema.ts`
- [X] T002 Add `rateLimitPerMinute: integer('rate_limit_per_minute')` nullable column to the `pipelines` table definition in `src/db/schema.ts` — add a Drizzle `.check()` constraint enforcing value is between 1 and 1000 when not null
- [X] T003 Generate and apply the Drizzle migration: run `npm run db:generate` then `npm run db:migrate` from the project root — confirm the new migration file appears in `src/db/migrations/` and both columns exist in the running database

**Checkpoint**: `src/db/schema.ts` compiles without TypeScript errors (`npx tsc --noEmit`). Both columns visible in DB.

---

## Phase 2: Foundational

**Purpose**: Shared infrastructure required by US3 and US4. Can begin immediately after T001 but must complete before US3 work starts.

- [X] T004 Add `RateLimitError` class to `src/lib/errors.ts` — extend `AppError` with HTTP status 429, machine-readable code `'RATE_LIMIT_EXCEEDED'`, and a `retryAfterSec: number` constructor parameter stored as a public property; follow the existing `AppError` subclass pattern in that file
- [X] T005 [P] Add `rateLimitPerMinute` field to the pipeline Zod schemas in `src/api/schemas/pipeline.schema.ts` — add `rateLimitPerMinute: z.number().int().min(1).max(1000).nullable().optional()` to both the create schema and the update/patch schema

**Checkpoint**: `npx tsc --noEmit` passes. `RateLimitError` can be imported and instantiated.

---

## Phase 3: User Story 1 — Response Time in Delivery Attempts (Priority: P1) 🎯

**Goal**: Each delivery attempt row records how long the HTTP call took, and `JobDetailPage` displays it.

**Independent Test**: Trigger a job → wait for delivery → open the job in the dashboard → the delivery attempts section shows a response time (e.g. `142ms`) for successful deliveries and `—` for timed-out ones. Quickstart Scenario 1.

### Implementation for User Story 1

- [X] T006 [US1] Update `src/delivery/http-client.ts` — add `responseTimeMs: number | null` to the `DeliveryResult` interface; in `deliverPayload()`, record `const start = Date.now()` before the `fetch` call and set `responseTimeMs = Date.now() - start` after a response is received; set `responseTimeMs = null` in the `catch` block (timeout / network error)
- [X] T007 [US1] Update `src/delivery/delivery-engine.ts` — add `responseTimeMs: result.responseTimeMs` to the `db.insert(deliveryAttempts).values({...})` call (depends on T001 schema + T006 interface)
- [X] T008 [P] [US1] Update `dashboard/src/pages/JobDetailPage.tsx` — add a "Response time" cell to each delivery attempt row: display `${ms}ms` for values < 1000, `${(ms/1000).toFixed(1)}s` for ≥ 1000, and `—` when the value is `null`; add the column header to the table or card header

**Checkpoint**: Trigger a test delivery → delivery attempt row shows a non-null response time in milliseconds. Null shows as dash.

---

## Phase 4: User Story 2 — Empty and Pending States (Priority: P2)

**Goal**: `JobDetailPage` renders a clear message instead of a blank section for jobs with no delivery attempts.

**Independent Test**: Open a QUEUED or filtered-out COMPLETED job → Delivery Attempts section shows a contextual message. Quickstart Scenario 1 (empty variant).

### Implementation for User Story 2

- [X] T009 [US2] Verify `dashboard/src/pages/JobDetailPage.tsx` — check the existing empty state for the delivery attempts section: if it already shows a helpful message for both QUEUED/PROCESSING jobs and COMPLETED jobs with no deliveries, mark complete; if only one case is handled, add a status-aware message (`"Delivery has not started yet"` for QUEUED/PROCESSING, `"No deliveries were made for this job"` for COMPLETED/FAILED with zero attempts)

**Checkpoint**: JobDetailPage renders cleanly for all four job statuses with no blank content areas.

---

## Phase 5: User Story 3 — Webhook Ingest Rate Limiting (Priority: P1)

**Goal**: Each pipeline's source URL enforces its per-minute request cap, returning 429 + `Retry-After` when exceeded.

**Independent Test**: Create a pipeline with `rateLimitPerMinute: 3` → send 4 requests within one minute → 4th returns 429 with `Retry-After` header → wait for window reset → next request returns 202. Quickstart Scenario 2.

### Implementation for User Story 3

- [X] T010 [US3] Create `src/services/rate-limit.service.ts` — export `const DEFAULT_RATE_LIMIT_PER_MINUTE = 60` as a named constant; export `async function checkRateLimit(sourceId: string, limitPerMinute: number): Promise<{ allowed: boolean; retryAfterSec: number }>` — import the existing Redis client from `src/queue/redis.ts`; compute `windowStartSec = Math.floor(Date.now() / 1000 / 60) * 60`; key is `ratelimit:${sourceId}:${windowStartSec}`; call `redis.incr(key)` and on first increment (`count === 1`) call `redis.expire(key, 61)`; return `{ allowed: count <= limitPerMinute, retryAfterSec: Math.max(1, Math.ceil(windowStartSec + 60 - Date.now() / 1000)) }` (depends on T004)
- [X] T011 [US3] Update `src/services/ingestion.service.ts` — after the pipeline is loaded by `sourceId` and before the job is created, call `const rl = await checkRateLimit(pipeline.sourceId, pipeline.rateLimitPerMinute ?? DEFAULT_RATE_LIMIT_PER_MINUTE)`; if `!rl.allowed`, throw `new RateLimitError(rl.retryAfterSec)` — import `checkRateLimit` and `DEFAULT_RATE_LIMIT_PER_MINUTE` from `rate-limit.service.ts` and `RateLimitError` from `errors.ts` (depends on T002, T010)
- [X] T012 [US3] Update `src/api/controllers/webhooks.controller.ts` — in `receiveWebhook`, catch errors from `ingestWebhook`; if the error is an instance of `RateLimitError`, return `res.status(429).set('Retry-After', String(err.retryAfterSec)).json({ error: { code: err.code, message: err.message } })` before passing other errors to `next(err)` (depends on T004, T011)
- [X] T013 [P] [US3] Update `src/services/pipeline.service.ts` (or the equivalent create/update/get service) — include `rateLimitPerMinute` in the `INSERT` when creating a pipeline, in the `SET` clause when patching, and in the `SELECT` result returned to callers; ensure `null` values are preserved (uses system default) (depends on T002, T005)

**Checkpoint**: Sending requests above the configured limit returns 429 with a `Retry-After` integer header. Requests under the limit return 202. Other pipelines are unaffected.

---

## Phase 6: User Story 4 — Configure Rate Limit in Dashboard (Priority: P2)

**Goal**: Pipeline create and edit forms expose a rate limit field; the pipeline overview shows the current value.

**Independent Test**: Create pipeline with rate limit 200 → overview shows `200 req/min` → edit to 100 → value updates immediately. Quickstart Scenarios 3 and 4.

### Implementation for User Story 4

- [X] T014 [P] [US4] Update `dashboard/src/pages/PipelineListPage.tsx` — add a "Rate limit (req/min)" number input to the Create Pipeline slide-over; initialize state to `60`; include `rateLimitPerMinute: Number(value)` in the POST request body; add a small helper text below the field: `"Default: 60. Max: 1000."` (depends on T013)
- [X] T015 [P] [US4] Update `dashboard/src/pages/PipelineDetailPage.tsx` — add the rate limit field to the edit form (pre-fill from `pipeline.rateLimitPerMinute ?? 60`); include `rateLimitPerMinute` in the PATCH body on save; display the current rate limit in the overview section (e.g., a `"Rate limit"` row showing `60 req/min` or `"60 req/min (default)"` when null) (depends on T013)

**Checkpoint**: A pipeline created with a custom limit shows that limit in the overview and enforces it on ingest (US3 + US4 together). Quickstart Scenarios 3–5 pass.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [X] T016 [P] Run `cd d:/Projects/Webhook/dashboard && npx tsc --noEmit` and `npx eslint src/` — fix any TypeScript or lint errors in dashboard changes
- [X] T017 [P] Run `cd d:/Projects/Webhook && npx tsc --noEmit` and `npm run lint` — fix any TypeScript or lint errors in backend changes
- [X] T018 Run `cd d:/Projects/Webhook && npm test` — confirm all existing tests pass with zero regressions
- [X] T019 Validate quickstart scenarios 1–5 manually against the running dev server (`npm run dev` + `npm run dev:dashboard`) — confirm all pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — run T001 → T002 → T003 sequentially (same file for T001/T002)
- **Foundational (Phase 2)**: T004 and T005 can start after T001; they are independent of each other [P]
- **US1 (Phase 3)**: T006 → T007 sequentially (same file chain); T008 can run in parallel with T007 (different file)
- **US2 (Phase 4)**: T009 independent of all US1 tasks (different concern, same file but read-only verification)
- **US3 (Phase 5)**: T010 depends on T004; T011 depends on T002+T010; T012 depends on T004+T011; T013 [P] depends on T002+T005 — can run alongside T010-T012
- **US4 (Phase 6)**: T014 [P] and T015 [P] both depend on T013; they are independent of each other
- **Polish (Phase 7)**: Depends on all stories complete; T016 and T017 can run in parallel

### User Story Dependencies

- **US1 (P1)**: Depends only on T001 (schema). Independent of US3/US4.
- **US2 (P2)**: Independent of all other stories (verification task).
- **US3 (P1)**: Depends on T002 (schema), T004 (RateLimitError), T005 (Zod). Independent of US1/US2.
- **US4 (P2)**: Depends on T013 (pipeline service). Independent of US1/US2.

### Parallel Opportunities

```
Phase 1 (sequential — same file):
  T001 → T002 → T003

Phase 2 (parallel):
  T004 [P] alongside T005 [P]  (both can start after T001)

Phase 3 + Phase 4 (partially parallel):
  T006 → T007      (sequential, same file chain)
  T008 [P]         (parallel with T007, different file)
  T009 [P]         (independent verification)

Phase 5 (partial parallelism):
  T010 → T011 → T012   (sequential chain)
  T013 [P]             (parallel with T010-T012)

Phase 6 (parallel):
  T014 [P] alongside T015 [P]

Phase 7 (parallel):
  T016 [P] alongside T017 [P], then T018 → T019
```

---

## Implementation Strategy

### MVP: US1 + US3 (highest priority, independent)

1. Phase 1: T001 → T002 → T003 (schema + migration)
2. Phase 2: T004, T005 (foundational)
3. Phase 3: T006 → T007 → T008 (responseTimeMs — US1 complete)
4. Phase 5: T010 → T011 → T012, T013 (rate limiting — US3 complete)
5. **STOP and VALIDATE**: Quickstart Scenarios 1, 2, 5 pass
6. Continue with US2 (T009) and US4 (T014, T015)

### Full Feature

1. MVP (T001–T013 minus T009) → validate US1 + US3
2. US2: T009 — quick verification
3. US4: T014 + T015 (parallel)
4. Polish: T016–T019

---

## Notes

- T001 and T002 edit the same file — run sequentially
- The delivery attempts API endpoint, service, and base UI already exist — US1 is additive only
- `DEFAULT_RATE_LIMIT_PER_MINUTE = 60` defined in `rate-limit.service.ts` and imported where needed
- The Redis client is already exported from `src/queue/redis.ts` — no new connection setup
- Rate limit state is ephemeral (TTL-based Redis keys) — no migration or cleanup needed
- For US4 dashboard forms, pass `rateLimitPerMinute: null` (not omit) when the user clears the field, to reset to system default
