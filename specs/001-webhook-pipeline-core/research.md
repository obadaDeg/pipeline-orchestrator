# Research: Webhook-Driven Task Processing Pipeline

**Branch**: `001-webhook-pipeline-core`
**Date**: 2026-03-14
**Status**: Complete — all decisions resolved from existing package.json commitments

---

## Decision 1: Job Queue / Message Broker

**Decision**: BullMQ 5.x + ioredis 5.x (Redis-backed)

**Rationale**: Already installed in `package.json`. BullMQ provides a TypeScript-native
API, reliable distributed job locking (prevents duplicate processing under concurrent
workers), configurable worker concurrency, and a custom backoff strategy hook used by
the delivery engine. Redis is a proven, low-latency message broker well-suited to the
sub-second acknowledgment requirement.

**Alternatives considered**:
- *pg-boss*: PostgreSQL-native, would eliminate Redis as a dependency. Not chosen
  because the project already has Redis + BullMQ committed. Could be substituted in a
  future amendment without changing the architecture.
- *Raw PostgreSQL polling*: Simplest option, zero extra infrastructure. Rejected because
  polling latency conflicts with the 200ms ingestion SLA and the implementation effort
  matches pg-boss without the library support.

---

## Decision 2: HTTP Framework

**Decision**: Express 4.x

**Rationale**: Already installed. Sufficient for ~10 endpoints, massive ecosystem, and
well-understood middleware model. ESLint + TypeScript types cover the type-safety gap
versus more opinionated frameworks.

**Alternatives considered**:
- *Fastify*: Better TypeScript-native schema validation; faster. Not chosen because
  Express is already committed and migration would provide no material benefit for this
  project scope.
- *Hapi*: Rich plugin system. Over-engineered for this use case.

---

## Decision 3: ORM / Query Builder

**Decision**: Drizzle ORM 0.30 + drizzle-kit

**Rationale**: Already installed. Drizzle is fully type-safe at the query level
(column types flow through to query results), lightweight with no runtime code
generation, and drizzle-kit handles schema migrations. The schema-as-code approach
means DB types stay in sync with TypeScript types without a separate code generation
step in CI.

**Alternatives considered**:
- *Prisma*: More mature migration tooling, larger ecosystem. Adds a code-gen step and
  heavier runtime. Not chosen; Drizzle is already committed.
- *Knex*: Flexible but weakly typed return types. Rejected in favour of Drizzle's
  stronger type inference.
- *Raw `pg`*: Maximum control, zero overhead, but no migration support. Rejected.

---

## Decision 4: Testing Framework

**Decision**: Vitest

**Rationale**: Already installed. Faster than Jest due to Vite's native ESM handling
and parallel test execution. API surface is identical to Jest so there is no learning
curve. TypeScript support is first-class with no `ts-jest` transform step needed.

**Alternatives considered**:
- *Jest*: Battle-tested, broad ecosystem. Requires `ts-jest` for TypeScript; slower cold
  start. Not chosen; Vitest is already committed.
- *Mocha + Chai*: Maximum flexibility. More setup overhead than needed.

---

## Decision 5: Delivery Retry Design

**Decision**: Single queue (`webhook-jobs`) with inline retry loop in the BullMQ
processor function.

**Rationale**: The job processor executes each subscriber delivery in a loop, sleeping
between attempts using the backoff calculation (`await sleep(backoffMs)`). When all
subscribers succeed the processor returns normally and BullMQ marks the job complete.
When a subscriber exhausts all retries the processor updates the Job record to FAILED
and returns. This directly satisfies:
- **FR-016**: job → FAILED only after MaxRetriesExceeded is confirmed
- **FR-017**: job → COMPLETED only after all deliveries succeed

The worker concurrency slot remains occupied during backoff delays. At
`WORKER_CONCURRENCY=5` and `DELIVERY_MAX_RETRIES=5` with `DELIVERY_BACKOFF_MS=1000`,
worst-case slot occupation per job is ~31 seconds (sum of backoff delays for 5 retries).
This is acceptable for the single-instance, single-developer project scope.

**Alternatives considered**:
- *Two queues* (`webhook-jobs` + `webhook-deliveries`): Frees the processor slot during
  delivery retry delays. However, it requires the job to be marked COMPLETED optimistically
  before all deliveries are confirmed, violating FR-016 and FR-017. Rejected.
- *BullMQ native `attempts` + `backoff`*: Retries the entire processor (re-runs the
  action transformer on each retry). Wasteful and potentially side-effectful for the
  HTTP Enricher action. Rejected.

---

## Decision 6: HTTP Client for Delivery

**Decision**: Node.js 20 native `fetch` with `AbortController` timeout

**Rationale**: Node 20 ships with a stable, spec-compliant `fetch` implementation.
No additional dependency is required. `AbortSignal.timeout(ms)` provides clean timeout
handling, and the response body is readable as text for the `response_snippet` capture.

**Alternatives considered**:
- *axios*: Richer API, interceptors, automatic JSON parsing. Adds a dependency for
  functionality already available natively. Rejected.
- *node-fetch*: Polyfill for older Node versions. Unnecessary on Node 20. Rejected.
- *got*: Feature-rich with retry built-in. Retry logic is implemented explicitly in
  `delivery-engine.ts`; using got's retry would bypass `DeliveryAttempt` persistence.
  Rejected.

---

## Config Variables Added

Three environment variables not present in the original `config.ts` are required:

| Variable | Default | Purpose |
|----------|---------|---------|
| `MAX_PAYLOAD_BYTES` | `1048576` (1 MB) | Ingestion body size limit (FR-006, clarification Q1) |
| `STALLED_JOB_TIMEOUT_MS` | `300000` (5 min) | PROCESSING job recovery threshold (FR-019, clarification Q3) |
| `DELIVERY_TIMEOUT_MS` | `10000` (10 s) | Per-subscriber HTTP POST timeout (spec assumption 4) |

These are added to `src/config.ts`'s `envSchema` and to `.env.example` and
`docker-compose.yml`.
