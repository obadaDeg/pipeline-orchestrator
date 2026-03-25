# Implementation Plan: Job Retry & Dashboard Metrics

**Branch**: `012-job-retry-metrics` | **Date**: 2026-03-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/012-job-retry-metrics/spec.md`

## Summary

Add two capabilities to the Pipeline Orchestrator: (1) a manual retry mechanism for failed webhook processing jobs — accessible via a "Retry" button in the dashboard Jobs tab and a `POST /jobs/:id/retry` API endpoint, reusing the original `raw_payload` and incrementing a `retry_count` counter; and (2) a dashboard Stats page at `/stats` showing five computed metrics (total pipelines, jobs today, success rate, average delivery time, top failing pipelines) from existing PostgreSQL data via a new `GET /stats` API endpoint. The feature requires one Drizzle migration (add `retry_count` to `jobs`, add `JOB_RETRIED` to `audit_event_type` enum) with no other schema changes.

## Technical Context

**Language/Version**: TypeScript 5.4, Node.js 20 LTS (backend + dashboard)
**Primary Dependencies**: Express 4.x, Drizzle ORM 0.30, BullMQ 5.x + ioredis (backend); React 18.3, React Router v6, TailwindCSS 3.4, Lucide React (dashboard) — no new packages required
**Storage**: PostgreSQL — two additive changes: `retry_count` column on `jobs` table; `JOB_RETRIED` value on `audit_event_type` enum
**Testing**: Vitest (dashboard unit tests); existing `npm test` suite (backend integration tests via Docker Compose)
**Target Platform**: Linux server (Docker), modern browser (dashboard SPA)
**Project Type**: Web service + SPA dashboard
**Performance Goals**: Retry endpoint p95 < 200ms (Constitution IX); stats endpoint ≤ 5s for 100 pipelines / 10,000 jobs (spec SC-003)
**Constraints**: No external metrics system; no caching layer; stats computed fresh on each request; retry uses BullMQ `webhookQueue.add()` (not BullMQ built-in `job.retry()`)
**Scale/Scope**: Same as existing system; queries scoped to user's accessible pipelines

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked post-design.*

| Principle | Status | Evidence |
|-----------|--------|----------|
| I. Asynchronous Processing | ✅ COMPLIANT | `retryJob()` resets status to PENDING and calls `webhookQueue.add()` — identical pattern to `ingestWebhook()`; no synchronous payload processing in HTTP lifecycle |
| II. Reliability & Retry | ✅ COMPLIANT | Manual retry preserves existing delivery retry logic; all delivery attempts continue to be persisted; job state machine unchanged; `retryCount` tracks operator retries separately |
| III. Clean Separation of Concerns | ✅ COMPLIANT | `retryJob()` isolated in `job.service.ts`; `getStats()` in new `stats.service.ts`; new controllers and routers each with single responsibility |
| IV. TypeScript Type Safety | ✅ COMPLIANT | Strict TypeScript throughout all new and modified files; no `any` usage; all service functions fully typed |
| V. Infrastructure Reproducibility | ✅ COMPLIANT | Single Drizzle migration file; no new Docker services; `docker compose up` workflow unchanged |
| VI. Code Quality Standards | ✅ COMPLIANT | All functions ≤ 40 lines; named constants for SQL aggregates and status values; no dead code; all errors re-thrown |
| VII. Testing Standards | ✅ COMPLIANT | Existing backend tests unaffected; new Vitest tests for Retry button and StatsPage dashboard components |
| VIII. API Consistency | ✅ COMPLIANT | `POST /jobs/:id/retry` returns 200 with `{ data: job }`; `GET /stats` returns 200 with `{ data: metrics }`; 409 Conflict for wrong-status retry; all follow existing envelope pattern |
| IX. Performance Requirements | ✅ COMPLIANT | `jobs` already indexed on `status`, `pipeline_id`, `created_at`; stats queries leverage existing indexes; no additional indexes needed |

## Project Structure

### Documentation (this feature)

```text
specs/012-job-retry-metrics/
├── plan.md              # This file
├── research.md          # Phase 0: research decisions
├── data-model.md        # Phase 1: schema changes + computed aggregates
├── quickstart.md        # Phase 1: integration scenarios
├── contracts/           # Phase 1: API interface contracts
│   ├── retry-job.md     # POST /jobs/:id/retry
│   └── get-stats.md     # GET /stats
└── tasks.md             # Phase 2 output (via /speckit.tasks — not created here)
```

### Source Code (repository root)

```text
src/
├── db/
│   └── schema.ts                              (extend: retryCount on jobs, JOB_RETRIED enum)
├── api/
│   ├── controllers/
│   │   ├── jobs.controller.ts                 (extend: add retryJob handler)
│   │   └── stats.controller.ts                (new)
│   ├── routes/
│   │   ├── jobs.router.ts                     (extend: POST /:id/retry)
│   │   └── stats.router.ts                    (new)
│   └── server.ts                              (extend: mount statsRouter)
├── services/
│   ├── job.service.ts                         (extend: retryJob(), retryCount in list queries)
│   └── stats.service.ts                       (new)

drizzle/
└── 0004_add-retry-count-and-job-retried-event.sql  (new migration)

dashboard/src/
├── pages/
│   ├── PipelineDetailPage.tsx                 (extend: Retry button on FAILED job rows in Jobs tab)
│   └── StatsPage.tsx                          (new)
├── components/
│   └── Sidebar.tsx                            (extend: add Stats nav item at /stats)
└── App.tsx                                    (extend: add /stats route)
```

**Structure Decision**: Web application layout (existing). All changes are additive to the current directory structure. No new top-level directories.

## Key Implementation Notes

### Backend: retryJob() in job.service.ts

```
retryJob(jobId: string, userId: string):
  1. Fetch job by ID (full row including pipelineId)
  2. If not found → throw NotFoundError
  3. If pipelineId is null (pipeline deleted) → throw NotFoundError
  4. Verify pipeline visibility (user owns or is team member)
  5. If job.status !== 'FAILED' → throw AppError(409, 'JOB_NOT_RETRYABLE')
  6. Begin DB transaction:
     a. UPDATE jobs SET status='PENDING', retry_count=retry_count+1, error_message=null WHERE id=jobId
     b. INSERT audit_events (userId, 'JOB_RETRIED', { jobId, pipelineId, retryCount })
  7. After transaction: webhookQueue.add('process-webhook', { jobId, pipelineId })
  8. Return updated job row
```

### Backend: getStats() in stats.service.ts

```
getStats(userId: string):
  1. Get accessible pipeline IDs (getUserTeamIds + visibility filter)
  2. If no pipelines: return zero/null stats immediately
  3. Run in parallel via Promise.all:
     a. COUNT(*) from pipelines (accessible)
     b. COUNT(*) from jobs WHERE pipeline_id IN (...) AND created_at >= CURRENT_DATE::timestamptz
     c. Success rate: COMPLETED / (COMPLETED + FAILED) today × 100
     d. AVG(response_time_ms) from delivery_attempts WHERE outcome='SUCCESS' AND job accessible
     e. Top 5 pipelines by FAILED job count (all time)
  4. Return structured stats object
```

### Dashboard: Retry Button in PipelineDetailPage.tsx

- In the Jobs tab, for each job row where `job.status === 'FAILED'`:
  - Render a `<Button>` with loading state
  - On click: call `apiFetch('/jobs/:id/retry', { method: 'POST' })`
  - On success: update the job row in local state (set status to PENDING, hide Retry button)
  - On error: `addToast(errorMessage, 'error')`
- `retryCount` shown in each job row (always, even when 0)

### Dashboard: StatsPage.tsx

- Fetch `GET /stats` on mount
- Display 5 metric cards: Total Pipelines, Jobs Today, Success Rate, Avg Delivery Time, Top Failing Pipelines table
- Loading skeleton while fetching; error state with retry; zero/null states per card

## Complexity Tracking

No constitution violations. No complexity justification required.
