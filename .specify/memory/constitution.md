<!--
SYNC IMPACT REPORT
==================
Version change: 1.1.0 → 1.2.0 (MINOR — four new principles added)

Modified principles:
  - None renamed or redefined

Added principles:
  - VI. Code Quality Standards (new)
  - VII. Testing Standards (new)
  - VIII. API Consistency (new)
  - IX. Performance Requirements (new)

Added sections: None

Removed sections: None

Governance: updated "five core principles" reference to "nine core principles"

Templates reviewed:
  - .specify/templates/plan-template.md       ✅ aligned (Constitution Check gate covers new principles)
  - .specify/templates/spec-template.md       ✅ aligned (SC/FR structure supports performance + API rules)
  - .specify/templates/tasks-template.md      ✅ aligned (Polish phase covers testing + code quality tasks)
  - .specify/templates/agent-file-template.md ✅ aligned (no conflicting references)

Deferred TODOs: None
-->

# Webhook Pipeline Constitution

## Core Principles

### I. Asynchronous Processing (NON-NEGOTIABLE)

Every webhook received at a pipeline source URL MUST follow this exact ingestion sequence:

1. Persist a Job record to the database with status `PENDING`.
2. Enqueue a task on the Message Broker.
3. Return `202 Accepted` to the sender immediately.

Synchronous processing of webhook payloads within the HTTP request lifecycle is
PROHIBITED. Workers MUST consume tasks from the broker independently of the ingestion
layer. At least three distinct processing action types MUST be implemented.

**Rationale**: Decoupling ingestion from processing ensures fast, reliable webhook
reception regardless of downstream processing latency or failures.

### II. Reliability & Retry

All delivery of processed results to subscriber URLs MUST implement exponential backoff
retry logic with a defined maximum retry count. Every delivery attempt — success or
failure — MUST be persisted as a `DeliveryAttempt` record.

The Job state machine MUST be implemented exactly as follows:

```
PENDING → PROCESSING → COMPLETED
                     ↘ FAILED
```

Within `PROCESSING`, delivery sub-states MUST be tracked:
`Attempting → AllDelivered` (success path) or
`Attempting → DeliveryFailed → ScheduledForRetry` (retry path) or
`DeliveryFailed → MaxRetriesExceeded → FAILED` (terminal failure path).

A Job MUST transition to `FAILED` when either the processing action itself errors or
when `MaxRetriesExceeded` is reached for any subscriber. Failure states MUST NOT be
silently dropped. The system MUST expose an API for querying job status, execution
history, and all delivery attempt records.

**Rationale**: The system is an event-forwarding pipeline; unobservable or unrecoverable
failures undermine the entire value proposition.

### III. Clean Separation of Concerns

The codebase MUST be organized around five named architectural components, each with a
single responsibility:

- **Webhook Receiver** (`POST /webhook/:id`) — validates the source, persists the Job
  (`PENDING`), enqueues the task, returns 202.
- **REST API** (CRUD + status endpoints) — manages pipeline configuration and exposes
  job/delivery history. MUST NOT process webhook payloads directly.
- **Job Consumer** — polls the Message Broker, claims tasks, and orchestrates the
  worker pipeline. Updates Job status to `PROCESSING`.
- **Action Transformer** — executes the pipeline's configured processing action against
  the raw payload and produces the transformed result.
- **Delivery Engine** — iterates over subscribers, POSTs the transformed result, records
  each `DeliveryAttempt`, and re-enqueues retries with exponential backoff.

No component MUST invoke the internal logic of another component in a way that bypasses
the broker or delivery contract. Schema design MUST reflect these boundaries.

**Rationale**: Independent testability, debuggability, and scalability of each component.
Evaluators assess architecture explicitly; unclear boundaries are a disqualifying signal.

### IV. TypeScript Type Safety

All source code MUST be written in TypeScript with explicit, non-trivial types. Use of
`any` is PROHIBITED without a documented justification comment at the usage site.
Consistent patterns (naming, error handling, module structure) MUST be applied
throughout the codebase.

**Rationale**: Type safety prevents entire classes of runtime errors and signals code
quality to evaluators reviewing the submission.

### V. Infrastructure Reproducibility

The complete service (API, worker, database, message broker) MUST start successfully
with a single `docker compose up` command on a clean machine with no additional manual
setup steps. The GitHub Actions CI pipeline MUST run meaningful checks (at minimum:
build and lint; ideally: automated tests). CI MUST pass on the `main` branch.

**Rationale**: Evaluators will run the project from scratch. A broken Docker setup or
failing CI is an automatic negative signal regardless of code quality.

### VI. Code Quality Standards

The following rules MUST be applied throughout the codebase:

- Functions and methods MUST have a single, clearly identifiable responsibility.
  Functions exceeding ~40 lines MUST be decomposed unless the size is explicitly
  justified by a comment.
- Magic numbers and magic strings MUST be extracted as named constants or configuration
  values. Inline literals are PROHIBITED except for trivially obvious values (e.g., `0`,
  `1`, empty string `""`).
- Dead code (unreachable branches, unused imports, unused variables) MUST NOT be
  committed. Linting MUST be configured to enforce this.
- Exceptions and rejected Promises MUST NOT be swallowed silently. Every `catch` block
  MUST either re-throw, log with context, or handle the error explicitly.
- Naming conventions MUST be consistent: `camelCase` for variables and functions,
  `PascalCase` for types, classes, and interfaces, `SCREAMING_SNAKE_CASE` for
  module-level constants.

**Rationale**: Readable, well-structured code is a primary evaluation criterion.
Inconsistent or tangled code signals low craftsmanship regardless of functionality.

### VII. Testing Standards

- All three (or more) processing action types MUST have unit tests covering both the
  success path and at least one error/edge-case path.
- The end-to-end flow (webhook ingestion → job processing → subscriber delivery) MUST
  be covered by at least one integration test.
- Retry logic in the Delivery Engine MUST be covered by a test that simulates subscriber
  failure and asserts that retry scheduling occurs correctly.
- All tests MUST be runnable via a single command (e.g., `npm test`) without any
  additional manual setup beyond `docker compose up`.
- Tests MUST be deterministic — no reliance on wall-clock timing, external services, or
  random state that is not explicitly seeded.

**Rationale**: Tests are the primary mechanism for demonstrating correctness and enabling
safe iteration. Evaluators may ask to run or extend tests live during the demo.

### VIII. API Consistency

All REST API responses MUST conform to a consistent JSON envelope:

- **Success**: `{ data: <payload>, meta?: <pagination|metadata> }`
- **Error**: `{ error: { code: "<MACHINE_READABLE_CODE>", message: "<human readable>" } }`

HTTP status codes MUST follow REST conventions:

- `201 Created` for successful resource creation
- `202 Accepted` for async webhook ingestion
- `400 Bad Request` for malformed input
- `404 Not Found` for missing resources
- `422 Unprocessable Entity` for semantic validation failures
- `500 Internal Server Error` for unexpected server failures

List endpoints MUST support pagination. Endpoint paths MUST use lowercase, hyphen-
separated, noun-based resource names (e.g., `/pipelines`, `/jobs/:id/delivery-attempts`).

**Rationale**: A consistent API surface reduces integration friction and demonstrates
disciplined design — a key evaluation signal under "Architecture" and "Code Quality".

### IX. Performance Requirements

The following performance constraints MUST be met under normal single-instance load:

- The webhook ingestion endpoint (`POST /webhook/:id`) MUST respond within **200ms**
  (p95) — this is achievable because all heavy work is deferred to the worker.
- Exponential backoff retry delays MUST include jitter to avoid thundering-herd retry
  storms when multiple subscribers fail simultaneously.
- Database tables for `jobs` and `delivery_attempts` MUST have indexes on columns used
  in frequent query patterns: at minimum, `status`, `pipeline_id`, and `created_at`.
- Worker concurrency MUST be configurable via environment variable; the default MUST
  process at least 5 jobs concurrently.

**Rationale**: Performance characteristics directly affect reliability under real load.
Indexing and concurrency configuration demonstrate systems-design maturity.

## Technology Stack

- **Language**: TypeScript (strict mode recommended)
- **Database**: PostgreSQL — serves as both the state/config store and MAY also serve
  as the Message Broker (e.g., via polling or pg-based queue). A dedicated broker
  (Redis + BullMQ) is equally valid; the choice MUST be documented.
- **Message Broker**: PostgreSQL-backed queue (e.g., pg-boss, polling) OR a dedicated
  broker (e.g., Redis + BullMQ). Both are acceptable; the choice MUST be justified in
  the README under "Design Decisions".
- **Containerisation**: Docker + Docker Compose
- **CI/CD**: GitHub Actions
- **Runtime**: Node.js (version pinned in Dockerfile)

All technology choices outside this stack MUST be documented with rationale in the
project README under a "Design Decisions" section.

## Architecture Reference

The canonical architecture is captured in the following design artifacts:

- **High-Level Architecture diagram**: `docs/High-Level Architecture/High-Level Architecture.png`
  (source: `.drawio`)
- **Sequence Diagram**: `docs/High-Level Architecture/SequenceDiagram.mmd` /
  `SequenceDiagram.svg`
- **Job State Diagram**: `docs/High-Level Architecture/State Diagram.mmd` /
  `State Diagram.svg`

These diagrams are authoritative. Any implementation that deviates from the component
interactions shown MUST document the deviation and its rationale in the plan's
Complexity Tracking table.

## Development & Documentation Standards

- The project README MUST cover: setup instructions, API documentation, architecture
  overview, and key design decisions.
- Commit history MUST show incremental, logical progress — not a single bulk commit.
- All processing action types MUST be documented (what they do, example input/output).
- Stretch goals (auth, signature verification, rate limiting, dashboard, metrics, etc.)
  are encouraged but MUST NOT be pursued at the cost of a solid, reliable core.

## Governance

This constitution supersedes all other practices and conventions for this project.
Any amendment requires:

1. A clear description of the change and its rationale.
2. A version bump following semantic versioning:
   - **MAJOR**: Principle removal or backward-incompatible redefinition.
   - **MINOR**: New principle or materially expanded guidance added.
   - **PATCH**: Clarification, wording improvement, or non-semantic refinement.
3. `LAST_AMENDED_DATE` updated to the amendment date.
4. Propagation check across all `.specify/templates/` files.

All feature plans MUST include a Constitution Check section verifying compliance with
all nine core principles before implementation begins. Non-compliance MUST be justified
in the plan's Complexity Tracking table.

**Version**: 1.2.0 | **Ratified**: 2026-03-11 | **Last Amended**: 2026-03-14
