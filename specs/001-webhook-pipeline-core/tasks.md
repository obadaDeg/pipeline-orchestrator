# Tasks: Webhook-Driven Task Processing Pipeline

**Input**: Design documents from `/specs/001-webhook-pipeline-core/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths included in every description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend config and create shared library utilities used by all user stories.

- [x] T001 Extend `src/config.ts` envSchema with `MAX_PAYLOAD_BYTES` (default 1048576), `STALLED_JOB_TIMEOUT_MS` (default 300000), and `DELIVERY_TIMEOUT_MS` (default 10000) using `z.coerce.number().default(...)`
- [x] T002 [P] Create `src/lib/errors.ts` — define `AppError` base class and subclasses: `NotFoundError` (404), `ValidationError` (422), `PayloadTooLargeError` (413), `MethodNotAllowedError` (405), `InternalError` (500) — each carrying a `code` (SCREAMING_SNAKE) and `statusCode`
- [x] T003 [P] Create `src/lib/response.ts` — export `successResponse(data)` returning `{ data }` and `errorResponse(code, message)` returning `{ error: { code, message } }` typed with generics
- [x] T004 [P] Create `src/lib/pagination.ts` — export `parsePagination(query)` that reads `page`/`limit` query params (defaults: page=1, limit=20, max limit=100) and returns `{ page, limit, offset }`, plus `paginatedResponse(items, total, page, limit)` returning the standard paginated envelope
- [x] T005 [P] Create `src/lib/logger.ts` — export structured console logger with `info`, `warn`, `error` methods that prefix output with ISO timestamp and severity level

**Checkpoint**: Shared utilities complete — all subsequent tasks can import from `src/lib/`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, Drizzle client, queue infrastructure, and Docker configuration. No user story can be implemented until this phase is complete.

**⚠️ CRITICAL**: All Phase 3–6 tasks depend on Phase 2 completion.

- [x] T006 Create `src/db/schema.ts` — define Drizzle enums (`actionType`: field_extractor/payload_filter/http_enricher; `jobStatus`: PENDING/PROCESSING/COMPLETED/FAILED; `deliveryOutcome`: SUCCESS/FAILED) and all 4 tables (`pipelines`, `subscribers`, `jobs`, `delivery_attempts`) with columns, FK constraints, and indexes exactly as specified in `data-model.md`
- [x] T007 Create `src/db/index.ts` — export a Drizzle `db` instance backed by a `pg.Pool` using `config.DATABASE_URL`; export the pool for graceful shutdown
- [x] T008 Create `src/db/migrate.ts` — export a `runMigrations()` function using `drizzle-kit`'s migrate API pointing to `src/db/migrations/`; this is the entry point for `npm run db:migrate` and the Docker `migrator` service
- [x] T009 [P] Create `src/queue/redis.ts` — export a shared `ioredis` connection instance configured from `config.REDIS_HOST`, `config.REDIS_PORT`, and optional `config.REDIS_PASSWORD`; export `closeRedis()` for graceful shutdown
- [x] T010 [P] Create `src/queue/queue.ts` — export a BullMQ `Queue` instance named `'webhook-jobs'` using the shared Redis connection from `src/queue/redis.ts`
- [x] T011 [P] Create `src/queue/job-data.types.ts` — export `interface JobQueueData { jobId: string; pipelineId: string }`
- [x] T012 Create `Dockerfile` — multi-stage build: stage 1 (`builder`) installs all deps and compiles TypeScript to `dist/`; stage 2 (`runtime`) copies `dist/` + `package.json`, installs production deps only, runs as non-root user
- [x] T013 Create `docker-compose.yml` — define services: `postgres` (port 5432 with `postgres_data` volume), `redis` (port 6379), `migrator` (runs `npm run db:migrate`, exits on success, depends_on postgres healthy), `api` (port 3000, depends_on postgres + redis healthy + migrator completed), `worker` (depends_on same); include health checks for postgres and redis
- [x] T014 Update `.env.example` — add `MAX_PAYLOAD_BYTES=1048576`, `STALLED_JOB_TIMEOUT_MS=300000`, `DELIVERY_TIMEOUT_MS=10000`, `WORKER_CONCURRENCY=5`, `DELIVERY_MAX_RETRIES=3`, `DELIVERY_BACKOFF_MS=1000` alongside existing vars; ensure all vars from `quickstart.md` env reference table are present

**Checkpoint**: Foundation ready — DB schema, queue, and Docker all configured. User story phases can now begin.

---

## Phase 3: User Story 1 — Pipeline Management (Priority: P1) 🎯 MVP

**Goal**: A developer can create, read, update, and delete pipelines with subscriber URLs via the REST API.

**Independent Test**: Using only pipeline endpoints (POST/GET/PATCH/DELETE /pipelines), a developer can manage the full pipeline lifecycle. No webhooks need to be sent to verify this story.

- [x] T015 [P] [US1] Create `src/api/schemas/pipeline.schema.ts` — Zod schemas: `ActionConfigSchema` (discriminated union on `actionType` for field_extractor/payload_filter/http_enricher shapes per `contracts/api.md`), `CreatePipelineBodySchema` (name, actionType, actionConfig, subscriberUrls array min 0), `UpdatePipelineBodySchema` (all optional), `PaginationQuerySchema` (page, limit coerced integers)
- [x] T016 [US1] Create `src/services/pipeline.service.ts` — implement `createPipeline(data)` (insert pipeline + subscribers in transaction, return with sourceUrl assembled from `source_id`), `getPipelineById(id)` (join subscribers, throw NotFoundError if missing), `listPipelines(page, limit)` (paginated select), `updatePipeline(id, data)` (update fields; if `subscriberUrls` provided, delete all existing and insert new ones in transaction), `deletePipeline(id)` (delete pipeline; FK CASCADE removes subscribers); depends on T006, T007
- [x] T017 [P] [US1] Create `src/api/middleware/validate-request.ts` — export `validateBody(schema: ZodSchema)` factory returning an Express middleware that calls `schema.safeParse(req.body)`, sets `req.body` to parsed data on success, or calls `next(new ValidationError(...))` with Zod error message on failure
- [x] T018 [US1] Create `src/api/controllers/pipelines.controller.ts` — implement Express handlers for all 5 pipeline operations: `createPipeline`, `getPipeline`, `listPipelines`, `updatePipeline`, `deletePipeline`; each calls the corresponding service method and returns the correct HTTP status + `successResponse` envelope; pipeline 404s propagate as `NotFoundError`; depends on T015, T016, T017
- [x] T019 [US1] Create `src/api/routes/pipelines.router.ts` — wire `POST /pipelines` (validateBody + createPipeline), `GET /pipelines` (listPipelines), `GET /pipelines/:id` (getPipeline), `PATCH /pipelines/:id` (validateBody + updatePipeline), `DELETE /pipelines/:id` (deletePipeline); leave `GET /pipelines/:id/jobs` as a stub to be connected in T040; depends on T018

**Checkpoint**: User Story 1 fully functional — pipeline CRUD works end-to-end with a running DB.

---

## Phase 4: User Story 2 — Webhook Ingestion (Priority: P1)

**Goal**: An external caller POSTs to a pipeline's source URL, receives 202 within 200ms, and a PENDING job is created and enqueued.

**Independent Test**: POST to `/webhooks/<sourceId>` returns 202 with a `jobId`. A Job row with status PENDING appears in the DB. No processing has started yet.

- [x] T020 [P] [US2] Create `src/api/middleware/body-size-limit.ts` — Express middleware that checks `Content-Length` header first for early rejection, then buffers the raw body and rejects with `PayloadTooLargeError` if byte length exceeds `config.MAX_PAYLOAD_BYTES`; stores raw body string on `req.rawBody` for the ingestion controller; depends on T001, T002
- [x] T021 [US2] Create `src/services/ingestion.service.ts` — implement `ingestWebhook(sourceId, rawBody)`: look up pipeline by `source_id` (throw `NotFoundError` if not found), insert a Job row with `status=PENDING` and `raw_payload=rawBody`, enqueue a BullMQ job with `JobQueueData { jobId, pipelineId }`, return `{ jobId }`; depends on T006, T007, T010, T011
- [x] T022 [US2] Create `src/api/controllers/webhooks.controller.ts` — single handler for `POST /webhooks/:sourceId`: read `req.rawBody` (set by body-size-limit middleware), call `ingestion.service.ingestWebhook`, return `successResponse({ jobId })` with status 202; handler for non-POST methods returns `MethodNotAllowedError`; depends on T020, T021
- [x] T023 [US2] Create `src/api/routes/webhooks.router.ts` — mount `body-size-limit` middleware then `webhooks.controller` handler on `POST /webhooks/:sourceId`; also wire a catch-all for other methods on the same path to return 405; depends on T022

**Checkpoint**: User Story 2 complete — external callers can POST webhooks and receive immediate 202 responses.

---

## Phase 5: User Story 3 — Job Processing & Subscriber Delivery (Priority: P1)

**Goal**: The background worker picks up PENDING jobs, runs the configured action transformer, delivers results to subscribers with exponential-backoff retry, and transitions jobs to COMPLETED or FAILED.

**Independent Test**: Given a PENDING job in the DB, starting the worker causes it to transition through PROCESSING to COMPLETED (or FAILED). DeliveryAttempt records exist for each subscriber attempt.

- [x] T024 [P] [US3] Create `src/actions/types.ts` — export `ActionType` enum matching the DB enum values, `ActionConfig` discriminated union type for all 3 action shapes (identical to Zod schemas in T015 but as TypeScript types), and `ActionTransformer` interface: `execute(payload: unknown, config: ActionConfig): Promise<unknown | null>` (null = filter no-match, throw = unrecoverable error)
- [x] T025 [P] [US3] Create `src/actions/field-extractor.action.ts` — implements `ActionTransformer`; uses `mapping` config (`{ outputKey: "source.path" }`) to extract nested fields from parsed JSON payload using dot-notation path resolution; returns new object with only mapped keys; returns empty object for non-JSON payloads
- [x] T026 [P] [US3] Create `src/actions/payload-filter.action.ts` — implements `ActionTransformer`; evaluates payload against `{ field, operator, value }` config supporting `eq`, `ne`, `contains` operators; returns payload unchanged if condition passes, returns `null` if condition fails (signals no delivery needed); returns `null` for non-JSON payloads
- [x] T027 [P] [US3] Create `src/delivery/http-client.ts` — export `deliverPayload(url, body)` that POSTs JSON to a URL using Node 20 native `fetch` with `AbortSignal.timeout(config.DELIVERY_TIMEOUT_MS)`; returns `{ httpStatus: number | null, responseSnippet: string | null, success: boolean }`; catches network errors and timeouts, returning `{ httpStatus: null, responseSnippet: null, success: false }`
- [x] T028 [P] [US3] Create `src/delivery/backoff.ts` — export `calculateBackoff(attemptNumber: number, baseMs: number): number` implementing `base * 2^(attemptNumber - 1)` plus up to 25% random jitter; export `sleep(ms: number): Promise<void>` helper
- [x] T029 [US3] Create `src/actions/http-enricher.action.ts` — implements `ActionTransformer`; POSTs to (or GETs from) configured `url` using `http-client.ts`, merges response JSON into payload at optional `mergeKey` (or root-level merge if not set); throws `EnricherError` (subclass of `AppError`) on any failure: non-2xx, timeout, network error, or unparseable response; depends on T024, T027
- [x] T030 [US3] Create `src/actions/action-registry.ts` — export `ACTION_REGISTRY: Record<ActionType, ActionTransformer>` mapping each `ActionType` to its implementation; export `getAction(type: ActionType): ActionTransformer` helper that throws on unknown type; depends on T024, T025, T026, T029
- [x] T031 [US3] Create `src/delivery/delivery-engine.ts` — export `runDelivery(jobId, subscribers, processedPayload)`: for each subscriber, loop up to `config.DELIVERY_MAX_RETRIES` times; on each attempt, call `http-client.deliverPayload`, insert a `delivery_attempts` row with result; if success break subscriber loop; if all retries exhausted mark subscriber as failed; sleep `calculateBackoff(attempt, config.DELIVERY_BACKOFF_MS)` between retries; return `{ allSucceeded: boolean }`; depends on T006, T007, T027, T028
- [x] T032 [US3] Create `src/worker/job-consumer.ts` — export BullMQ `Processor<JobQueueData>`: (1) update job status to PROCESSING, (2) fetch pipeline + subscribers from DB, (3) parse raw_payload, (4) run `getAction(actionType).execute(payload, config)`, (5) if null (filter no-match) → set COMPLETED with no delivery; (6) save processedPayload to job, (7) call `delivery-engine.runDelivery`, (8) set COMPLETED if allSucceeded else FAILED; catch any thrown error → set job FAILED with error_message; depends on T006, T007, T030, T031
- [x] T033 [US3] Create `src/worker/stalled-job-recovery.ts` — export `recoverStalledJobs()`: query all jobs WHERE `status='PROCESSING'` AND `updated_at < NOW() - STALLED_JOB_TIMEOUT_MS`; for each, reset status to PENDING and re-enqueue via BullMQ queue; export `startStalledJobRecovery()` that calls `recoverStalledJobs()` immediately then schedules it with `setInterval(recoverStalledJobs, config.STALLED_JOB_TIMEOUT_MS)`; depends on T006, T007, T010
- [x] T034 [US3] Create `src/worker/shutdown.ts` — export `registerShutdownHandlers(worker: Worker)` that registers `SIGTERM` and `SIGINT` handlers: close the BullMQ Worker (drain in-flight jobs), close the BullMQ Queue, close Redis connection, close DB pool, exit process; depends on T007, T009, T010
- [x] T035 [US3] Create `src/worker/index.ts` — entry point: import job-consumer, create `new Worker('webhook-jobs', jobConsumer, { concurrency: config.WORKER_CONCURRENCY })`, call `startStalledJobRecovery()`, call `registerShutdownHandlers(worker)`, log startup message; depends on T032, T033, T034

**Checkpoint**: User Story 3 complete — full pipeline flow works: webhook → queue → action → delivery with retry.

---

## Phase 6: User Story 4 — Job Status & History (Priority: P2)

**Goal**: A developer can query any job's status, browse a pipeline's job history, and inspect every delivery attempt — all via the REST API.

**Independent Test**: Using only status endpoints (GET /jobs/:id, GET /pipelines/:id/jobs, GET /jobs/:id/delivery-attempts), a developer can trace a webhook from ingestion to final delivery outcome.

- [x] T036 [P] [US4] Create `src/api/schemas/job.schema.ts` — Zod schemas: `JobIdParamSchema` (`{ id: z.string().uuid() }`), `PipelineJobsQuerySchema` (extends `PaginationQuerySchema` from pipeline.schema.ts)
- [x] T037 [US4] Create `src/services/job.service.ts` — implement `getJobById(id)` (full job row including all columns, throw NotFoundError if missing), `listJobsForPipeline(pipelineId, page, limit)` (verify pipeline exists first, then paginated query ordered by `created_at DESC`, omit `raw_payload` and `processed_payload` from list items), `getDeliveryAttempts(jobId)` (verify job exists, return all attempts ordered by `attempt_number ASC`, no pagination); depends on T006, T007
- [x] T038 [US4] Create `src/api/controllers/jobs.controller.ts` — implement handlers: `getJob` (returns full job record), `listPipelineJobs` (returns paginated job list without payloads), `getDeliveryAttempts` (returns unpaginated delivery attempts list); each uses `successResponse` envelope; depends on T036, T037
- [x] T039 [US4] Create `src/api/routes/jobs.router.ts` — wire `GET /jobs/:id` and `GET /jobs/:id/delivery-attempts` using jobs.controller handlers; depends on T038
- [x] T040 [US4] Update `src/api/routes/pipelines.router.ts` to connect the `GET /pipelines/:id/jobs` route stub (added in T019) to `jobs.controller.listPipelineJobs`; depends on T038, T039

**Checkpoint**: User Story 4 complete — all observability endpoints functional; full lifecycle traceable via API.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Wire the full application, add error handling middleware, unit tests, integration tests, and validate end-to-end flow via quickstart.md.

- [x] T041 Create `src/api/middleware/error-handler.ts` — Express 4-argument error middleware: catches `AppError` subclasses and returns `errorResponse(error.code, error.message)` with `error.statusCode`; catches all other errors as 500 `INTERNAL_ERROR`; logs all errors using `src/lib/logger.ts`; depends on T002, T003, T005
- [x] T042 Create `src/api/server.ts` — bootstrap Express app: apply `express.json()`, `express.text({ type: '*/*' })` (raw body capture), register pipelines router (T019), webhooks router (T023), jobs router (T039), finally register error-handler middleware (T041); export `app` and `startServer()` that calls `app.listen(config.PORT)`; depends on T019, T023, T039, T041
- [x] T043 Create `src/api/index.ts` — API entry point: import `startServer` from `server.ts` and call it; this is the file referenced by `npm run dev` and the Docker `api` service `CMD`; depends on T042
- [x] T044 [P] Create `tests/helpers/db-test-client.ts` — export `getTestDb()` returning a Drizzle test DB client using `TEST_DATABASE_URL` or `DATABASE_URL` with `_test` suffix; export `runTestMigrations()` and `truncateAllTables()` (truncate in reverse FK order: delivery_attempts → jobs → subscribers → pipelines); depends on T006, T007, T008
- [x] T045 [P] Create `tests/helpers/mock-subscriber-server.ts` — export `createMockServer()` that starts a local Express server on a random available port; records all received POST requests; exposes `getReceivedRequests()`, `setResponseStatus(code)` (for simulating failures), and `stop()` for cleanup; used by integration tests to assert delivery
- [x] T046 [P] Create `tests/unit/actions/field-extractor.test.ts` — Vitest unit tests covering: basic field extraction, nested dot-notation paths, missing source path returns undefined key, mapping multiple fields, non-JSON input returns empty object; depends on T025
- [x] T047 [P] Create `tests/unit/actions/payload-filter.test.ts` — Vitest unit tests covering: `eq` match returns payload, `eq` no-match returns null, `ne` operator, `contains` string operator, non-JSON returns null; depends on T026
- [x] T048 [P] Create `tests/unit/actions/http-enricher.test.ts` — Vitest unit tests with `vi.mock('../../../src/delivery/http-client')`: merge at root level, merge at `mergeKey`, non-2xx response throws `EnricherError`, network error throws `EnricherError`; depends on T029
- [x] T049 [P] Create `tests/unit/delivery/backoff.test.ts` — Vitest unit tests: attempt 1 returns approximately `baseMs`, attempt 2 ≈ `2 * baseMs`, each value is within 25% jitter of the base exponential value, `sleep(0)` resolves immediately; depends on T028
- [x] T050 Create `tests/integration/pipeline-e2e.test.ts` — Vitest integration test using real DB (`TEST_DATABASE_URL`) + real worker running in-process + mock subscriber server: create pipeline → POST to source URL → assert 202 + jobId → poll job until COMPLETED → assert delivery attempt SUCCESS → assert subscriber received correct payload; also test FAILED path (mock server returns 500 until retries exhausted); depends on T044, T045, T035

**Checkpoint**: All phases complete. Validate with `docker compose up --build` and run through `quickstart.md` verification steps.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately
- **Phase 2 (Foundation)**: Depends on Phase 1 completion — **BLOCKS all user story phases**
- **Phase 3 (US1 — Pipeline Management)**: Depends on Phase 2 completion
- **Phase 4 (US2 — Webhook Ingestion)**: Depends on Phase 2 completion; integrates with US1 (pipeline lookup)
- **Phase 5 (US3 — Processing & Delivery)**: Depends on Phase 2 completion; requires US1 + US2 data to exist
- **Phase 6 (US4 — Job Status)**: Depends on Phase 2; integrates with US1 (pipeline check) + US3 (job data)
- **Phase 7 (Polish)**: Depends on all user story phases

### User Story Dependencies

- **US1 (Pipeline Management)**: No dependency on other user stories — start first
- **US2 (Webhook Ingestion)**: Depends on pipeline records existing (US1 data model), but can be coded in parallel
- **US3 (Processing & Delivery)**: Depends on US1 pipelines + US2 jobs existing; action files are independently testable
- **US4 (Job Status)**: Reads data produced by US1–US3; service layer is independent

### Within Each Phase

- Tasks marked [P] can be implemented in parallel (different files, no shared state)
- Within US3: T024–T028 (types + 3 actions + http-client + backoff) are all parallelizable before T029–T035
- T040 depends on both T019 (pipelines router) and T038 (jobs controller)

### Critical Path

`T001 → T006 → T007 → T016 → T018 → T019 → T042 → T043` (minimum viable pipeline API)

`T010 → T021 → T022 → T023` (ingestion path, must follow T007 + T009)

`T032 → T035` (worker entry point, must follow entire actions + delivery chain)

---

## Parallel Opportunities

### Phase 1 (run all together)
```
T002 (errors.ts) + T003 (response.ts) + T004 (pagination.ts) + T005 (logger.ts)
```

### Phase 2 (partial parallelism)
```
T009 (redis.ts) + T010 (queue.ts) + T011 (job-data.types.ts) run in parallel
T012 (Dockerfile) + T013 (docker-compose.yml) + T014 (.env.example) run in parallel
T006 (schema.ts) must complete before T007 (index.ts) and T008 (migrate.ts)
```

### Phase 5 (US3 — run first 5 in parallel)
```
T024 (actions/types.ts)
T025 (field-extractor.action.ts)
T026 (payload-filter.action.ts)
T027 (delivery/http-client.ts)
T028 (delivery/backoff.ts)
```
Then T029 (http-enricher) → T030 (registry) → T031 (delivery-engine) → T032 (job-consumer) → T033+T034 → T035

### Phase 7 tests (run all unit tests in parallel)
```
T046 (field-extractor.test.ts)
T047 (payload-filter.test.ts)
T048 (http-enricher.test.ts)
T049 (backoff.test.ts)
T044 (db-test-client.ts)
T045 (mock-subscriber-server.ts)
```

---

## Implementation Strategy

### MVP First (US1 Only — Pipeline API)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundation (T006–T014) — **critical blocker**
3. Complete Phase 3: US1 Pipeline Management (T015–T019)
4. Wire error-handler and server: T041, T042, T043
5. **STOP and VALIDATE**: `npm run dev` → create pipeline via curl → verify 201 response

### Full MVP (US1 + US2 + US3 — Core Pipeline Flow)

1. Setup + Foundation (Phases 1–2)
2. US1 (Phase 3) → US2 (Phase 4) → US3 (Phase 5)
3. Wire server (T041–T043)
4. **VALIDATE**: `docker compose up` → follow quickstart.md steps 1–4 (create pipeline, send webhook, poll status)

### Incremental Delivery

1. Phases 1–2: Foundation ready
2. Phase 3 + T041–T043: REST API for pipeline management only
3. Phase 4: Webhook ingestion endpoint added
4. Phase 5: Worker + processing + delivery added — pipeline is end-to-end functional
5. Phase 6: Job status endpoints added — full observability
6. Phase 7: Tests + polish — production ready

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in the same phase
- [US?] label maps every implementation task to a specific user story for traceability
- Each user story phase should be independently verifiable before proceeding
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
- `src/config.ts` is extended (T001), not replaced — read it before editing
- `src/api/routes/pipelines.router.ts` is touched twice: T019 (initial) + T040 (add jobs route)
- Integration test (T050) requires a running PostgreSQL and Redis — use `docker compose up postgres redis -d` for local test runs
