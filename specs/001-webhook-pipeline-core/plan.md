# Implementation Plan: Webhook-Driven Task Processing Pipeline

**Branch**: `001-webhook-pipeline-core` | **Date**: 2026-03-14 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-webhook-pipeline-core/spec.md`

## Summary

Build a webhook-driven task processing pipeline service: a REST API accepts pipeline
configuration and incoming webhooks, a BullMQ-backed background worker processes jobs
through configurable action transformers, and a delivery engine forwards results to
subscriber URLs with exponential-backoff retry. The full service runs via
`docker compose up` on Node.js 20 + PostgreSQL 16 + Redis 7.

## Technical Context

**Language/Version**: TypeScript 5.x strict mode, Node.js 20 LTS
**Primary Dependencies**: Express 4.x, BullMQ 5.x + ioredis 5.x, Drizzle ORM 0.30 + pg 8.x, Zod 3.x
**Storage**: PostgreSQL 16 (state + config DB), Redis 7 (BullMQ message broker)
**Testing**: Vitest (unit + integration)
**Target Platform**: Linux server (Docker container, Node.js 20)
**Project Type**: Web service — REST API + background worker process
**Performance Goals**: Ingestion <200ms p95; ≥5 concurrent worker jobs (configurable via `WORKER_CONCURRENCY`)
**Constraints**: `docker compose up` starts everything; CI lint + typecheck + build must pass on `main`
**Scale/Scope**: Single-instance, single developer, 1–2 week delivery

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | Gate Condition | Status |
|-----------|---------------|--------|
| I. Async Processing | Ingestion returns 202 before any processing; jobs enqueued to BullMQ | ✅ PASS |
| II. Reliability & Retry | Exponential backoff + jitter; full state machine; DeliveryAttempt persisted | ✅ PASS |
| III. Separation of Concerns | 5 named components in distinct `src/` directories | ✅ PASS |
| IV. TypeScript Safety | `tsconfig strict: true`; ESLint `no-explicit-any` configured | ✅ PASS |
| V. Infrastructure | `docker-compose.yml` to be created; CI workflow already exists | ✅ PASS |
| VI. Code Quality | ESLint + Prettier configured; single-responsibility enforced by structure | ✅ PASS |
| VII. Testing | Vitest in devDeps; unit tests for all 3 actions + retry; integration E2E planned | ✅ PASS |
| VIII. API Consistency | JSON envelope via `lib/response.ts`; standard HTTP codes; paginated lists | ✅ PASS |
| IX. Performance | 200ms ingestion target; DB indexes on `status`/`pipeline_id`/`created_at`; configurable concurrency | ✅ PASS |

No constitution violations. Complexity Tracking table omitted (no justified violations).

## Project Structure

### Documentation (this feature)

```text
specs/001-webhook-pipeline-core/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api.md           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── config.ts                         # EXTEND: add MAX_PAYLOAD_BYTES, STALLED_JOB_TIMEOUT_MS, DELIVERY_TIMEOUT_MS
├── db/
│   ├── index.ts                      # Drizzle + pg Pool client
│   ├── migrate.ts                    # Migration runner (called by npm run db:migrate)
│   └── schema.ts                     # All 4 tables + enums + indexes
├── api/
│   ├── server.ts                     # Express bootstrap: middleware, routers, listen
│   ├── middleware/
│   │   ├── error-handler.ts          # Maps AppError subclasses → {error:{code,message}} envelope
│   │   ├── body-size-limit.ts        # Returns 413 if body > MAX_PAYLOAD_BYTES
│   │   └── validate-request.ts       # Zod schema factory → 422 on parse failure
│   ├── routes/
│   │   ├── pipelines.router.ts       # /pipelines and /pipelines/:id/jobs
│   │   ├── webhooks.router.ts        # POST /webhooks/:sourceId
│   │   └── jobs.router.ts            # GET /jobs/:id and /jobs/:id/delivery-attempts
│   ├── controllers/
│   │   ├── pipelines.controller.ts   # Request/response for pipeline CRUD
│   │   ├── webhooks.controller.ts    # Request/response for webhook ingestion
│   │   └── jobs.controller.ts        # Request/response for job status + history
│   └── schemas/
│       ├── pipeline.schema.ts        # Zod: CreatePipelineBody, UpdatePipelineBody, PaginationQuery
│       └── job.schema.ts             # Zod: job params + pagination
├── services/
│   ├── pipeline.service.ts           # Pipeline CRUD + subscriber management
│   ├── job.service.ts                # Job queries: get by id, list for pipeline, delivery attempts
│   └── ingestion.service.ts          # Validate sourceId → insert Job (PENDING) → enqueue BullMQ task
├── queue/
│   ├── redis.ts                      # Shared ioredis connection instance
│   ├── queue.ts                      # BullMQ Queue('webhook-jobs')
│   └── job-data.types.ts             # interface JobQueueData { jobId: string; pipelineId: string }
├── worker/
│   ├── index.ts                      # Entry point: register Worker, stalled-recovery, graceful shutdown
│   ├── job-consumer.ts               # BullMQ processor: PENDING→PROCESSING→action→delivery→COMPLETED/FAILED
│   ├── stalled-job-recovery.ts       # Periodic scan: PROCESSING jobs > threshold → requeue as PENDING
│   └── shutdown.ts                   # SIGTERM/SIGINT → drain Worker, close Redis + DB pool
├── actions/
│   ├── types.ts                      # ActionTransformer interface + config union types + ActionType enum
│   ├── field-extractor.action.ts     # Extract/rename fields per mapping config
│   ├── payload-filter.action.ts      # Condition check; returns null on no-match (no delivery)
│   ├── http-enricher.action.ts       # Fetch external URL + merge; throws EnricherError on any failure
│   └── action-registry.ts            # Record<ActionType, ActionTransformer> lookup map
├── delivery/
│   ├── delivery-engine.ts            # Per-subscriber inline retry loop + DeliveryAttempt persistence
│   ├── http-client.ts                # Node 20 native fetch wrapper with AbortSignal timeout
│   └── backoff.ts                    # base * 2^(attempt-1) + up to 25% jitter
└── lib/
    ├── errors.ts                     # AppError, NotFoundError, ValidationError, PayloadTooLargeError
    ├── response.ts                   # successResponse({data}), errorResponse({error:{code,message}})
    ├── pagination.ts                 # Parse page/limit params, compute offset, shape paginated response
    └── logger.ts                     # Structured console logger: info/warn/error + ISO timestamp

tests/
├── unit/
│   ├── actions/
│   │   ├── field-extractor.test.ts   # All mapping + dot-notation + non-JSON cases
│   │   ├── payload-filter.test.ts    # eq/ne/contains operators + no-match null return
│   │   └── http-enricher.test.ts     # Merge logic + failure → EnricherError (fetch mocked)
│   └── delivery/
│       └── backoff.test.ts           # Exponential growth + jitter bounds per attempt number
├── integration/
│   └── pipeline-e2e.test.ts          # Real DB + real worker in-process + mock subscriber server
└── helpers/
    ├── db-test-client.ts             # Test DB connection + migration runner + table truncation
    └── mock-subscriber-server.ts     # Local Express server on random port for delivery assertions
```

**Structure Decision**: Option 1 (single project). The API and worker share one TypeScript
project and build output but run as separate processes (`npm run dev` vs `npm run worker`).
Directory boundaries map directly to the five constitutional components:
`api/` (Webhook Receiver + REST API), `worker/` (Job Consumer), `actions/` (Action
Transformer), `delivery/` (Delivery Engine).

## Complexity Tracking

> No constitution violations requiring justification.
