# Tasks: Job Retry & Dashboard Metrics

**Input**: Design documents from `/specs/012-job-retry-metrics/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Organization**: Tasks grouped by user story. US1 (Retry Failed Jobs) and US3 (Dashboard Stats) are both P1 and can be developed in parallel after the Foundational phase. US2 (Retry Count Visibility) is P2 and depends on US1 backend completion.

**Tests**: Not explicitly requested — no test tasks generated.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in all descriptions

---

## Phase 1: Setup

**No new project initialization required.** Existing directory structure, installed packages, and Docker Compose configuration accommodate all changes additively. No new npm dependencies needed.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema changes that ALL three user stories depend on. Must be complete before any story work begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 Update `src/db/schema.ts` — add `'JOB_RETRIED'` to `auditEventTypeEnum` values array and add `retryCount: integer('retry_count').notNull().default(0)` column to the `jobs` table definition
- [X] T002 Create `drizzle/0004_add-retry-count-and-job-retried-event.sql` migration file with two statements: `ALTER TABLE "jobs" ADD COLUMN "retry_count" integer NOT NULL DEFAULT 0;` and `ALTER TYPE "public"."audit_event_type" ADD VALUE 'JOB_RETRIED';`

**Checkpoint**: Schema types updated and migration SQL ready — all user story work can begin.

---

## Phase 3: User Story 1 — Retry Failed Jobs (Priority: P1) 🎯 MVP

**Goal**: Expose `POST /jobs/:id/retry` API endpoint and add a server-confirmed Retry button to FAILED job rows in the pipeline Jobs tab.

**Independent Test**: Create a pipeline with an unreachable subscriber, trigger a webhook, wait for FAILED status, call `POST /jobs/:id/retry`, verify 200 response with `status: "PENDING"` and `retryCount: 1`, verify job is re-processed by the worker.

- [X] T003 [US1] Implement `retryJob(jobId: string, userId: string)` in `src/services/job.service.ts` — fetch job + resolve pipeline via pipelineId (throw 404 if null/not found), enforce pipeline visibility (same `buildVisibilityFilter` pattern from pipeline.service.ts), throw `AppError(409, 'JOB_NOT_RETRYABLE', ...)` if `status !== 'FAILED'`, run DB transaction: UPDATE jobs SET status='PENDING' + retry_count=retry_count+1 + error_message=null, INSERT audit event 'JOB_RETRIED' with metadata `{ jobId, pipelineId, retryCount }` via `emitAuditEvent`; after transaction commit call `webhookQueue.add('process-webhook', { jobId, pipelineId })`; return updated job row
- [X] T004 [US1] Update `listJobsForPipeline()` and `listJobs()` in `src/services/job.service.ts` to include `retryCount: jobs.retryCount` in their explicit SELECT column lists (currently these omit rawPayload/processedPayload for bandwidth; retryCount must be added)
- [X] T005 [US1] Add `retryJob` controller handler to `src/api/controllers/jobs.controller.ts` — extract `req.params.id`, call `retryJob(id, req.user!.id)`, return `res.status(200).json(successResponse(job))`; let `next(err)` handle 404 and 409 errors via the existing error handler
- [X] T006 [US1] Add `POST /:id/retry` route in `src/api/routes/jobs.router.ts` — `jobsRouter.post('/:id/retry', retryJob)` (authentication middleware already applied at router level)
- [X] T007 [P] [US1] Add Retry button to FAILED job rows in the Jobs tab of `dashboard/src/pages/PipelineDetailPage.tsx` — add `retryingJobId: string | null` state; for each job where `job.status === 'FAILED'` render a small "Retry" Button with `loading={retryingJobId === job.id}`; on click call `apiFetch('/jobs/' + job.id + '/retry', { method: 'POST' })`, on success update the local jobs list item to `{ ...job, status: 'PENDING', retryCount: (job.retryCount ?? 0) + 1 }` and clear retryingJobId; on error call `addToast(errorMessage, 'error')`

**Checkpoint**: `POST /jobs/:id/retry` fully functional and integrated in dashboard. Retry button appears only on FAILED jobs, shows loading state, updates row on success.

---

## Phase 4: User Story 3 — Dashboard Stats Overview (Priority: P1)

**Goal**: Expose `GET /stats` API endpoint returning 5 computed metrics and create a `StatsPage` accessible via `/stats` sidebar nav item.

**Independent Test**: Call `GET /stats` with a valid API key; verify all 5 fields present with correct types. Navigate to `/dashboard/stats`; verify all 5 metric cards render without errors. Test empty state with a fresh user (0 pipelines).

- [X] T008 [P] [US3] Create `src/services/stats.service.ts` — export `getStats(userId: string)` that: (1) resolves accessible pipeline IDs via `getUserTeamIds` + visibility filter (return zero stats immediately if none); (2) runs 5 queries in `Promise.all`: COUNT pipelines, COUNT jobs today (`created_at >= CURRENT_DATE::timestamptz`), success rate (`COUNT(*) FILTER (WHERE status='COMPLETED')::float / NULLIF(COUNT(*) FILTER (WHERE status IN ('COMPLETED','FAILED')), 0) * 100`), AVG delivery time (`AVG(response_time_ms)::float` from delivery_attempts WHERE outcome='SUCCESS' AND response_time_ms IS NOT NULL), top 5 pipelines by FAILED job count; (3) return typed object `{ totalPipelines, jobsToday, successRate: number|null, avgDeliveryMs: number|null, topFailingPipelines: { id, name, failureCount }[] }`
- [X] T009 [P] [US3] Create `src/api/controllers/stats.controller.ts` — export `getStats` handler that calls `statsService.getStats(req.user!.id)` and returns `res.status(200).json(successResponse(stats))`
- [X] T010 [P] [US3] Create `src/api/routes/stats.router.ts` — `export const statsRouter = Router(); statsRouter.use(authenticate); statsRouter.get('/', getStats);`
- [X] T011 [US3] Mount `statsRouter` in `src/api/server.ts` — add `import { statsRouter } from './routes/stats.router.js'` and `app.use('/stats', statsRouter)` after existing router mounts and before the dashboard static serve
- [X] T012 [P] [US3] Create `dashboard/src/pages/StatsPage.tsx` — on mount fetch `GET /stats` via `apiFetch`; show `SkeletonCard` while loading; show `ErrorState` with retry on error; on success render 5 sections: (a) 3 summary stat cards in a row (Total Pipelines, Jobs Today, Success Rate — show "N/A" if null), (b) Avg Delivery Time card (show "N/A" if null), (c) Top Failing Pipelines table with pipeline name and failure count columns (show empty state if array is empty)
- [X] T013 [P] [US3] Add Stats nav item to `dashboard/src/components/Sidebar.tsx` — import `BarChart2` from `lucide-react`; add `{ to: '/stats', label: 'Stats', icon: BarChart2, end: false }` to `navItems` array (insert after Jobs, before Teams)
- [X] T014 [US3] Add `/stats` route in `dashboard/src/App.tsx` — import `StatsPage`, add `<Route path="/stats" element={<StatsPage />} />` inside the `ProtectedRoutes` block

**Checkpoint**: `GET /stats` returns correct metrics, Stats page visible in sidebar and renders all 5 metric sections with proper empty/null states.

---

## Phase 5: User Story 2 — Retry Count Visibility (Priority: P2)

**Goal**: Display retryCount in the Jobs tab list and Job Detail page so operators can identify repeatedly-failing jobs.

**Independent Test**: Retry a failed job N times; confirm retryCount = N in the Jobs tab row and on the Job Detail page; confirm count survives page refresh.

- [X] T015 [P] [US2] Display `retryCount` in job rows in the Jobs tab of `dashboard/src/pages/PipelineDetailPage.tsx` — add `retryCount` to the `Job` interface; in each job row render a count indicator (e.g., `{job.retryCount > 0 && <span className="text-xs text-gray-400">{job.retryCount} {job.retryCount === 1 ? 'retry' : 'retries'}</span>}`) alongside the status badge
- [X] T016 [P] [US2] Display `retryCount` in `dashboard/src/pages/JobDetailPage.tsx` — add `retryCount` to the `Job` interface in that file; add a "Retries" field to the job metadata detail section showing the count (show `0` rather than hiding when count is 0, per Assumptions)

**Checkpoint**: Retry count accurately visible in both the Jobs list and Job Detail page; increments on each retry action.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T017 Run `npm test && npm run lint` from repository root; fix any TypeScript errors, ESLint warnings, or test regressions introduced by the new code
- [X] T018 [P] Verify all four quickstart.md scenarios against the running Docker Compose stack: (1) retry a failed job via API, (2) retry count increments, (3) stats with seeded data, (4) stats empty state for fresh user

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately. **BLOCKS all user stories.**
- **US1 (Phase 3)**: Depends on Phase 2 completion
- **US3 (Phase 4)**: Depends on Phase 2 completion — **can run in parallel with US1**
- **US2 (Phase 5)**: Depends on Phase 3 (T003, T004 must be done so retryCount is in API responses) and Phase 2 (schema must have retryCount column)
- **Polish (Phase 6)**: Depends on all desired stories complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependency on US2 or US3
- **US3 (P1)**: Can start after Phase 2 — no dependency on US1 or US2 (completely separate service, route, and page)
- **US2 (P2)**: Depends on Phase 2 (retryCount in schema) and US1 backend tasks T003+T004 (retryCount in API responses); dashboard tasks T015/T016 are purely additive display changes

### Within Each User Story

- **US1**: T003 → T004 (same file) → T005 (needs retryJob) → T006 (needs controller); T007 [P] can be done after T006 (needs route to exist) or developed against mocked API
- **US3**: T008, T009, T010 [P] — all different files, run in parallel; T011 depends on T010; T012, T013 [P] — different files, run in parallel; T014 depends on T012
- **US2**: T015 [P] T016 — different files, run in parallel

---

## Parallel Opportunities

### After Phase 2 completes:

```
US1 backend: T003 → T004 → T005 → T006     US3 backend: T008, T009, T010 (parallel)
US1 frontend: T007 (after T006)              → T011 (after T010)
                                             US3 frontend: T012, T013 (parallel)
                                             → T014 (after T012)
```

### Within US3:

```
# These three backend tasks run in parallel (different files):
Task T008: Create src/services/stats.service.ts
Task T009: Create src/api/controllers/stats.controller.ts
Task T010: Create src/api/routes/stats.router.ts

# These two frontend tasks run in parallel (different files):
Task T012: Create dashboard/src/pages/StatsPage.tsx
Task T013: Update dashboard/src/components/Sidebar.tsx
```

### US2 tasks run in parallel (different files):

```
Task T015: Update dashboard/src/pages/PipelineDetailPage.tsx
Task T016: Update dashboard/src/pages/JobDetailPage.tsx
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 2: Foundational (T001, T002)
2. Complete Phase 3: US1 (T003 → T004 → T005 → T006 → T007)
3. **STOP and VALIDATE**: Retry button works, API returns 200, job re-queued
4. Demo: Failed job can be retried from the dashboard

### Incremental Delivery

1. Phase 2 → Foundation ready (schema + migration)
2. Phase 3 (US1) → Retry endpoint + button working → Deploy/Demo (MVP!)
3. Phase 4 (US3) → Stats page live → Deploy/Demo
4. Phase 5 (US2) → Retry count visible everywhere → Deploy/Demo
5. Phase 6 → Tests green, lint clean

### Parallel Team Strategy

With two developers after Phase 2 completes:
- **Developer A**: US1 (T003–T007) — retry backend + dashboard button
- **Developer B**: US3 (T008–T014) — stats service + page
- Both merge → Developer A or B: US2 (T015–T016) — retry count display

---

## Notes

- `[P]` tasks operate on different files and have no dependency on incomplete peer tasks
- T003 and T004 are sequential (same file: job.service.ts)
- T007 (Retry button) can be developed against a locally-mocked API call but must be tested against the real endpoint before marking complete
- The `emitAuditEvent` helper is already implemented in `src/services/auth.service.ts` — import and reuse in T003
- The `getUserTeamIds` helper in `src/services/team.service.ts` is already implemented — import and reuse in T008
- Drizzle migration T002: the `ALTER TYPE ... ADD VALUE` statement may need to be manually appended if `db:generate` does not produce it (see research.md Decision 2)
- Avoid modifying `dashboard/src/pages/PipelineDetailPage.tsx` in T007 and T015 simultaneously — complete T007 first, then T015 adds the retryCount display to the already-updated file
