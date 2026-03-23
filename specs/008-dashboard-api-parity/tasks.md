# Tasks: Dashboard API Parity & Bug Fixes

**Input**: Design documents from `/specs/008-dashboard-api-parity/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to
- Tests included per project convention (feature 007 established a testing baseline)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verify routing preconditions and establish MSW handler baseline before any story work begins.

- [x] T001 Confirm `GET /jobs` route registration order in `src/api/routes/jobs.router.ts` — the new route must be declared before `GET /jobs/:id` to prevent path shadowing
- [x] T002 Confirm teams router is mounted in `src/api/server.ts` (already exists; just verify it is registered alongside pipelines and auth routers)
- [x] T003 [P] Verify existing `GET /jobs` MSW handler in `dashboard/src/test/handlers.ts` returns the full paginated shape `{ items, total, page, limit }` — update if it returns a bare array

**Checkpoint**: Routing order confirmed, MSW baseline verified

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared pagination utility usage and service-layer patterns that US1 and US2 both depend on.

**⚠️ CRITICAL**: US1 and US2 share `src/services/job.service.ts`. Complete the service-layer changes for both stories before implementing their controllers.

- [x] T004 Read `src/lib/pagination.ts` and `src/services/job.service.ts` to understand existing `parsePagination`, `paginatedResponse`, and service patterns before any changes
- [x] T005 Read `src/api/controllers/jobs.controller.ts` and `src/api/routes/jobs.router.ts` to map the exact lines that need changes for US1 and US2

**Checkpoint**: Codebase patterns understood — US1 and US2 can now be implemented without surprises

---

## Phase 3: User Story 1 — Fix Broken Jobs Page (Priority: P1) 🎯 MVP

**Goal**: Add `GET /jobs` to the backend so `JobsPage` loads without error for all authenticated users.

**Independent Test**: Start the stack (`docker compose up -d && npm run dev`), log in, navigate to `/jobs` — the page renders a paginated job list with no error state. Verify with zero jobs (empty state) and with existing jobs (list + pagination controls).

### Implementation for User Story 1

- [x] T006 [US1] Add `listJobs(userId: string, params: PaginationParams & { pipelineId?: string })` to `src/services/job.service.ts` — query jobs joined to pipelines where `ownerUserId = userId` OR pipeline is owned by a team the user belongs to; return `{ items, total }`
- [x] T007 [US1] Add `listJobsHandler` to `src/api/controllers/jobs.controller.ts` — call `parsePagination(req.query)`, extract optional `pipelineId` from query, delegate to `jobService.listJobs`, return `successResponse(paginatedResponse(items, total, page, limit))`
- [x] T008 [US1] Add `GET /` route to `src/api/routes/jobs.router.ts` mapping to `listJobsHandler` — place this route declaration BEFORE the existing `GET /:id` route
- [x] T009 [US1] Verify `JobsPage` at `dashboard/src/pages/JobsPage.tsx` handles the response shape correctly (no code changes expected — page already expects `{ items, total, page, limit }`)

### Tests for User Story 1

- [x] T010 [P] [US1] Write unit test for `listJobsHandler` in `src/api/controllers/jobs.controller.test.ts` covering: paginated response shape, `pipelineId` filter applied, user-scoping (other user's jobs excluded)
- [x] T011 [P] [US1] Write unit test for `listJobs` service method in `src/services/job.service.test.ts` covering: returns only jobs from user's pipelines, `pipelineId` filter narrows results, empty result set returns `{ items: [], total: 0 }`

**Checkpoint**: Navigate to `/jobs` — page loads, shows jobs, pagination works. US1 complete and independently testable.

---

## Phase 4: User Story 2 — Fix Delivery Attempts Pagination (Priority: P1)

**Goal**: `GET /jobs/:id/delivery-attempts` returns `{ items, total, page, limit }` so `JobDetailPage` pagination controls work correctly.

**Independent Test**: Open any job detail page at `/jobs/:id` — the Delivery Attempts section shows the correct total count and functional page controls. Navigate between pages if there are more than 50 attempts.

### Implementation for User Story 2

- [x] T012 [US2] Update `getDeliveryAttempts(jobId: string, params?: PaginationParams)` in `src/services/job.service.ts` — add `params` argument with `{ limit, offset }`, run a parallel count query, return `{ items, total }` instead of just the array
- [x] T013 [US2] Update `getDeliveryAttempts` in `src/api/controllers/jobs.controller.ts` — add `parsePagination(req.query)` call, pass `{ limit, offset }` to the service, wrap result with `paginatedResponse(items, total, page, limit)`
- [x] T014 [US2] Verify `JobDetailPage` at `dashboard/src/pages/JobDetailPage.tsx` — no code changes needed; confirm the component already handles paginated shape. Manually test: the total count displayed matches actual attempt count.
- [x] T015 [US2] Update MSW handler for `GET /jobs/:id/delivery-attempts` in `dashboard/src/test/handlers.ts` — ensure mock response includes `total`, `page`, and `limit` fields (verify it already does per T003 audit)

### Tests for User Story 2

- [x] T016 [P] [US2] Write unit test for updated `getDeliveryAttempts` controller in `src/api/controllers/jobs.controller.test.ts` — verify pagination params are applied, response shape includes all four fields, default `limit=50` when no query params provided
- [x] T017 [P] [US2] Write unit test for updated `getDeliveryAttempts` service in `src/services/job.service.test.ts` — verify count query runs, `offset` applied correctly, `total` matches unfiltered count

**Checkpoint**: Open any `/jobs/:id` — delivery attempts show correct total, pagination controls are functional. US2 complete and independently testable.

---

## Phase 5: User Story 3 — Manage Webhook Signing Secrets (Priority: P2)

**Goal**: Users can generate, view, rotate, and revoke the HMAC signing secret for any pipeline they own, from a new Security tab on `PipelineDetailPage`.

**Independent Test**: Open any pipeline at `/pipelines/:id` — a "Security" tab is present. With no secret: "Not configured" + Generate button. After generate: secret revealed once with copy button. After navigate-away-and-return: only hint shown with Rotate and Revoke buttons. Rotate and Revoke both show confirmation dialogs.

### Implementation for User Story 3

- [x] T018 [US3] Create `dashboard/src/components/SigningSecretPanel.tsx` — manages four display states (none, generating, revealed, active); fetches `GET /pipelines/:id/signing-secret` on mount; Generate/Rotate calls `POST /pipelines/:id/signing-secret` and stores returned `secret` in local state; Revoke calls `DELETE /pipelines/:id/signing-secret`; uses `ConfirmDialog` for Rotate and Revoke; clears secret from state on unmount
- [x] T019 [US3] Add "Security" tab to `dashboard/src/pages/PipelineDetailPage.tsx` — extend the existing tab array with a `{ label: 'Security', value: 'security' }` entry and render `<SigningSecretPanel pipelineId={id} />` when the Security tab is active
- [x] T020 [P] [US3] Add MSW handlers for signing secret endpoints to `dashboard/src/test/handlers.ts`: `GET /pipelines/:id/signing-secret` → `{ active, hint, createdAt }`, `POST /pipelines/:id/signing-secret` → `{ secret, hint, createdAt }` (201), `DELETE /pipelines/:id/signing-secret` → 204

### Tests for User Story 3

- [x] T021 [US3] Write `dashboard/src/components/SigningSecretPanel.test.tsx` covering: renders "Not configured" state when `active: false`; renders hint and action buttons when `active: true`; Generate button calls POST and shows revealed secret; Rotate shows ConfirmDialog before calling POST; Revoke shows ConfirmDialog before calling DELETE; secret field not visible after navigating away (unmount + remount)

**Checkpoint**: Security tab present on pipeline detail. All four signing secret states render and transition correctly. US3 complete and independently testable.

---

## Phase 6: User Story 4 — Edit a Pipeline (Priority: P2)

**Goal**: Users can update a pipeline's name and description inline from `PipelineDetailPage` without deleting and recreating the pipeline.

**Independent Test**: Open any pipeline at `/pipelines/:id` — an "Edit" button is visible in the overview header. Click it: name and description become editable fields pre-filled with current values. Submit an empty name: inline validation error blocks save. Save valid values: page reflects updated name immediately, success toast shown.

### Implementation for User Story 4

- [x] T022 [US4] Update `dashboard/src/pages/PipelineDetailPage.tsx` — add `isEditing` boolean state; "Edit" button toggles to edit mode; in edit mode render text inputs for name (required) and description (optional) pre-filled with current pipeline values; "Save" button calls `PATCH /pipelines/:id { name, description }` via `useApi`, updates local pipeline state on success and shows toast, reverts on cancel; "Cancel" exits edit mode with original values restored; block save if name is empty (inline error message)
- [x] T023 [P] [US4] Add MSW handler for `PATCH /pipelines/:id` to `dashboard/src/test/handlers.ts` — respond 200 with updated pipeline object merging the request body into the mock pipeline

### Tests for User Story 4

- [x] T024 [US4] Update `dashboard/src/pages/PipelineDetailPage.test.tsx` — add tests: Edit button enters edit mode with pre-filled values; empty name shows validation error and blocks save; valid save calls PATCH and updates displayed name; Cancel restores original values without API call

**Checkpoint**: Pipeline name and description are editable from the detail page. Validation, save, and cancel all work correctly. US4 complete and independently testable.

---

## Phase 7: User Story 5 — Register a New Account (Priority: P3)

**Goal**: A new user can self-register at `/register` by providing email and password, and is automatically logged in and redirected to the dashboard.

**Independent Test**: Navigate to `/register` (unauthenticated) — form renders with email and password fields and a "Create account" button. Submit empty password: inline error appears before any network call. Submit valid data: user is redirected to `/pipelines` and subsequent API calls are authenticated. Submit duplicate email: server error message shown on the form.

### Implementation for User Story 5

- [x] T025 [US5] Create `dashboard/src/pages/RegisterPage.tsx` — form with email and password fields; client-side validation: password must be ≥ 8 characters (show inline error, block submit); on submit call `POST /auth/register`; on success extract `data.apiKey.key` and `data.user.email` and call `auth.login(apiKey.key, user.email)`; on 409 show "Email already registered" error; on other errors show generic error message; "Already have an account? Login" link to `/login`
- [x] T026 [US5] Add `/register` route to `dashboard/src/App.tsx` — unauthenticated-only route (redirect to `/` if already authenticated, similar to the login route guard)
- [x] T027 [US5] Add "Create account" link to `dashboard/src/pages/LoginPage.tsx` pointing to `/register`
- [x] T028 [P] [US5] Add MSW handler for `POST /auth/register` to `dashboard/src/test/handlers.ts` — return 201 with `{ user: { id, email, createdAt }, apiKey: { id, name, key, keyPrefix, createdAt } }`; add a 409 variant for duplicate email testing

### Tests for User Story 5

- [x] T029 [US5] Write `dashboard/src/pages/RegisterPage.test.tsx` — tests: form renders with email and password fields; short password shows inline error without network call; valid submission calls POST /auth/register and triggers auth.login; 409 response shows "Email already registered" error; login page link is present and navigates to /login

**Checkpoint**: `/register` page is accessible from login, validates correctly, and auto-logs-in on success. US5 complete and independently testable.

---

## Phase 8: User Story 6 — Manage Teams (Priority: P3)

**Goal**: Users can create teams, add/remove members, and assign team ownership when creating pipelines.

**Independent Test**: Log in and navigate to `/teams` (via sidebar) — Teams page shows existing teams or an empty state. Create a team: it appears in the list. Navigate to a team: member list shown, owner can add a member by email, remove a member with confirmation, delete the team. Create a new pipeline: team selector dropdown appears and saves team ownership.

### Backend (GET /teams)

- [x] T030 [US6] Add `listTeams(userId: string)` to `src/services/team.service.ts` — query all teams where `ownerUserId = userId` OR user has a row in `team_memberships`; include `memberCount` (count of membership rows) and `isOwner` boolean in each result item; return `{ items: TeamListItem[] }`
- [x] T031 [US6] Add `listTeamsHandler` to `src/api/controllers/teams.controller.ts` — delegate to `teamService.listTeams(req.user!.id)`, return `successResponse({ items })`
- [x] T032 [US6] Add `GET /` route to `src/api/routes/teams.router.ts` mapping to `listTeamsHandler` — place before any `GET /:id` routes

### Dashboard

- [x] T033 [US6] Create `dashboard/src/pages/TeamsPage.tsx` — fetch `GET /teams` on mount; render list of team cards showing team name, owner/member badge, and member count; "New Team" button opens an inline form or modal for team name input, calls `POST /teams`, navigates to `/teams/:id` on success; empty state when no teams; loading and error states
- [x] T034 [US6] Create `dashboard/src/pages/TeamDetailPage.tsx` — fetch `GET /teams/:id` on mount; show team name, owner info, members table with email and added-date columns; "Add Member" input (owner only): email field + submit calls `POST /teams/:id/members`, updates member list on success; "Remove" button per member row (owner only, not for self): ConfirmDialog → `DELETE /teams/:id/members/:userId`; "Delete Team" button (owner only, danger zone): ConfirmDialog → `DELETE /teams/:id` → navigate to `/teams`
- [x] T035 [US6] Add `/teams` and `/teams/:id` routes to `dashboard/src/App.tsx` (authenticated routes)
- [x] T036 [US6] Add "Teams" navigation link to `dashboard/src/components/Sidebar.tsx`
- [x] T037 [P] [US6] Add MSW handlers for all team endpoints to `dashboard/src/test/handlers.ts`: `GET /teams` → `{ items: Team[] }`, `GET /teams/:id` → team with members array, `POST /teams` → 201 team, `POST /teams/:id/members` → 201 membership, `DELETE /teams/:id/members/:userId` → 204, `DELETE /teams/:id` → 204

### Tests for User Story 6

- [x] T038 [P] [US6] Write `dashboard/src/pages/TeamsPage.test.tsx` — tests: renders team list from GET /teams; empty state shown when no teams; New Team form submits POST /teams; navigates to /teams/:id on success
- [x] T039 [P] [US6] Write `dashboard/src/pages/TeamDetailPage.test.tsx` — tests: renders members list; Add Member calls POST /teams/:id/members; Remove Member shows confirm dialog then calls DELETE; Delete Team shows confirm dialog then calls DELETE and navigates to /teams; non-owner does not see Add/Remove/Delete buttons

### Backend Tests for User Story 6

- [x] T040 [P] [US6] Write unit test for `listTeamsHandler` in `src/api/controllers/teams.controller.test.ts` — verify response shape includes `items` array with `memberCount` and `isOwner` fields; verify empty array returned for user with no teams
- [x] T041 [P] [US6] Write unit test for `listTeams` service in `src/services/team.service.test.ts` — verify owned teams included, member teams included, non-member teams excluded

**Checkpoint**: Teams pages accessible from sidebar. Create, view members, add member, remove member, delete all work correctly. Backend `GET /teams` returns correct user-scoped results. US6 complete and independently testable.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Consistency, test suite health, and validation across all stories.

- [x] T042 Run `npm test && npm run lint` from repo root — fix any regressions introduced by backend changes (T006–T016, T030–T032)
- [x] T043 Run `cd dashboard && npm test` — fix any regressions in existing dashboard tests caused by changes to `PipelineDetailPage.tsx`, `App.tsx`, `Sidebar.tsx`, or `handlers.ts`
- [x] T044 [P] Verify all new MSW handlers in `dashboard/src/test/handlers.ts` return shapes that exactly match the updated API contracts in `contracts/api.md` — cross-check field names and types
- [x] T045 [P] Verify the signing secret reveal-once flow: raw `secret` field is never logged (check `console.log` calls in `SigningSecretPanel.tsx`), `secret` state is cleared on component unmount
- [x] T046 [P] Verify `GET /jobs` query in `src/services/job.service.ts` uses indexed columns — confirm `pipeline_id` and `owner_user_id` are in the WHERE clause and that no full-table scan is introduced

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — confirms patterns before service edits
- **US1 (Phase 3)**: Depends on Phase 2 — can start immediately after
- **US2 (Phase 4)**: Depends on Phase 2 — **can run in parallel with US1** (touches same service file; coordinate on `job.service.ts` edits or split into sequential commits)
- **US3 (Phase 5)**: Depends on Phase 2 completion — independent of US1/US2 (all dashboard changes)
- **US4 (Phase 6)**: Depends on Phase 2 — independent of US1–US3
- **US5 (Phase 7)**: Depends on Phase 2 — independent of US1–US4
- **US6 (Phase 8)**: Depends on Phase 2 — independent of US1–US5; backend subtasks (T030–T032) can run in parallel with dashboard subtasks (T033–T039)
- **Polish (Phase 9)**: Depends on all desired stories being complete

### User Story Dependencies

- **US1 (P1)**: No story dependencies
- **US2 (P1)**: No story dependencies (shares `job.service.ts` with US1 — coordinate edits)
- **US3 (P2)**: No story dependencies — pure dashboard
- **US4 (P2)**: No story dependencies — pure dashboard
- **US5 (P3)**: No story dependencies — pure dashboard + auth flow
- **US6 (P3)**: No story dependencies — backend (GET /teams) + dashboard

### ⚠️ Shared File Coordination

`src/services/job.service.ts` is modified by both US1 (T006) and US2 (T012). Implement both changes in the same PR or coordinate commits carefully to avoid merge conflicts.

`dashboard/src/test/handlers.ts` is updated by T003, T015, T020, T023, T028, T037. All handler additions are additive (no modifications to existing handlers) — safe to merge independently.

`dashboard/src/pages/PipelineDetailPage.tsx` is updated by US3 (T019) and US4 (T022). Implement these sequentially or in the same PR to avoid conflicts.

---

## Parallel Execution Examples

### US1 + US2 (P1 stories — backend, run together)

```
Parallel group A (service layer — coordinate edits):
  T006: Add listJobs() to job.service.ts
  T012: Update getDeliveryAttempts() in job.service.ts

Parallel group B (controllers — after A):
  T007: Add listJobsHandler to jobs.controller.ts
  T013: Update getDeliveryAttempts controller

Parallel group C (routes — after B):
  T008: Add GET / to jobs.router.ts
  T014: Verify JobDetailPage (no code change)

Parallel group D (tests — after A):
  T010: Unit test listJobsHandler
  T011: Unit test listJobs service
  T016: Unit test getDeliveryAttempts controller
  T017: Unit test getDeliveryAttempts service
```

### US3 + US4 (P2 stories — both dashboard, run together)

```
Parallel group A:
  T018: Create SigningSecretPanel.tsx    [US3]
  T022: Add edit mode to PipelineDetailPage [US4]

Parallel group B (after A):
  T019: Add Security tab to PipelineDetailPage [US3]  ← depends on T018 and T022
  T020: Add MSW handlers for signing secrets [US3]
  T023: Add MSW handler for PATCH /pipelines/:id [US4]

Parallel group C (tests — after B):
  T021: SigningSecretPanel tests
  T024: PipelineDetailPage edit tests
```

### US6 (P3 — backend + dashboard in parallel)

```
Parallel group A:
  T030: Add listTeams() to team.service.ts
  T033: Create TeamsPage.tsx
  T034: Create TeamDetailPage.tsx

Parallel group B (after A):
  T031: Add listTeamsHandler to teams.controller.ts
  T035: Add /teams routes to App.tsx
  T036: Add Teams link to Sidebar.tsx
  T037: Add MSW handlers for teams

Parallel group C (after B):
  T032: Add GET /teams route to teams.router.ts
  T038: Write TeamsPage tests
  T039: Write TeamDetailPage tests
  T040: Write listTeamsHandler unit test
  T041: Write listTeams service test
```

---

## Implementation Strategy

### MVP First (US1 + US2 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T005)
3. Complete Phase 3: US1 — Fix Jobs Page (T006–T011)
4. Complete Phase 4: US2 — Fix Delivery Attempts (T012–T017)
5. **STOP and VALIDATE**: Both broken pages now work. Ship this immediately — it unblocks users.

### Incremental Delivery

1. Ship US1 + US2 → broken pages fixed ✅
2. Ship US3 + US4 → signing secrets + pipeline editing ✅
3. Ship US5 → registration ✅
4. Ship US6 → teams ✅

### Single-Developer Order

Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7 → Phase 8 → Phase 9

---

## Notes

- [P] tasks = different files, no shared-state dependencies
- Each user story delivers independently testable value
- US1 and US2 share `src/services/job.service.ts` — edit in one coordinated commit
- US3 and US4 both touch `PipelineDetailPage.tsx` — implement sequentially
- All MSW handler additions are additive — safe to merge in any order
- The `secret` field from signing-secret POST must never be logged — verify in T045
- Commit after each phase checkpoint to preserve incremental history

---

## Task Count Summary

| Phase | Tasks | Parallelizable |
|---|---|---|
| Phase 1: Setup | 3 | 2 |
| Phase 2: Foundational | 2 | 0 |
| Phase 3: US1 Fix Jobs Page | 6 | 4 |
| Phase 4: US2 Fix Delivery Attempts | 6 | 4 |
| Phase 5: US3 Signing Secrets | 4 | 2 |
| Phase 6: US4 Pipeline Editing | 3 | 1 |
| Phase 7: US5 Registration | 5 | 1 |
| Phase 8: US6 Teams | 12 | 8 |
| Phase 9: Polish | 5 | 3 |
| **Total** | **46** | **25** |
