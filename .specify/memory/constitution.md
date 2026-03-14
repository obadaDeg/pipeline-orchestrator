<!--
SYNC IMPACT REPORT
==================
Version change: 1.0.0 → 1.1.0 (MINOR — expanded guidance on existing principles + new section)

Modified principles:
  - I. Asynchronous Processing: added explicit ingestion sequence and Message Broker component
  - II. Reliability & Retry: upgraded to exponential backoff, added job state machine,
    DeliveryAttempt entity, and MaxRetriesExceeded rule
  - III. Clean Separation of Concerns: expanded with named architectural components
    (Webhook Receiver, REST API, Job Consumer, Action Transformer, Delivery Engine)

Added sections:
  - Architecture Reference (links to canonical diagrams)

Removed sections: None

Technology Stack: added Message Broker entry (PostgreSQL-backed or Redis)

Templates reviewed:
  - .specify/templates/plan-template.md       ✅ aligned (Constitution Check + Complexity Tracking present)
  - .specify/templates/spec-template.md       ✅ aligned (Key Entities section supports new component names)
  - .specify/templates/tasks-template.md      ✅ aligned (phased structure supports all five principles)
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
the five core principles before implementation begins. Non-compliance MUST be justified
in the plan's Complexity Tracking table.

**Version**: 1.1.0 | **Ratified**: 2026-03-11 | **Last Amended**: 2026-03-14
