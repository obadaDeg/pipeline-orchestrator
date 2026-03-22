# Tasks: CI/CD Pipeline Improvements

**Input**: Design documents from `/specs/004-improve-cicd/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅

**Tests**: Not applicable — this feature modifies CI configuration, not application code. Validation is done by inspecting YAML structure and verifying the workflow triggers correctly.

**Organization**: Tasks grouped by user story. All three stories modify the same file (`.github/workflows/ci.yml`) — they MUST be applied sequentially to avoid edit conflicts.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US3)

---

## Phase 1: Foundation (Blocking Prerequisites)

**Purpose**: Confirm the existing workflow structure and test command availability before modifying anything.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 Read `.github/workflows/ci.yml` and verify the existing job structure (lint-and-typecheck, build, test) to confirm the baseline before making changes
- [X] T002 Confirm `npm run test:integration` exists in `package.json` and runs `vitest run tests/integration` — this is the command the new CI job will call
- [X] T003 Confirm `tests/helpers/db-test-client.ts` reads `DATABASE_URL` from `process.env` and that `src/config.ts` uses `REDIS_HOST` + `REDIS_PORT` (not `REDIS_URL`) — required to set the correct env vars in the CI job

**Checkpoint**: Existing workflow understood; env var requirements confirmed.

---

## Phase 2: User Story 1 — Integration Tests Run in CI (Priority: P1) 🎯 MVP

**Goal**: Add a `test-integration` job to `.github/workflows/ci.yml` that provisions Postgres 16 and Redis 7 as service containers, sets the required env vars, and runs `npm run test:integration`.

**Independent Test**: Push a commit to any branch → CI shows a new "Integration Tests" job running. Introduce a SQL error → the job fails while unit tests pass.

- [X] T004 [US1] Add `test-integration` job to `.github/workflows/ci.yml` — place after the existing `test` job; set `needs: [lint-and-typecheck]`; add `services:` block with `postgres:16` (env: POSTGRES_DB=webhook_test, POSTGRES_USER=postgres, POSTGRES_PASSWORD=postgres; port 5432:5432; health-cmd: pg_isready) and `redis:7` (port 6379:6379; health-cmd: redis-cli ping); set job `env:` block (DATABASE_URL=postgresql://postgres:postgres@localhost:5432/webhook_test, REDIS_HOST=localhost, REDIS_PORT="6379", NODE_ENV=test); steps: checkout → setup-node@v4 (node 20, cache npm) → `npm ci` → `npm run test:integration`

**Checkpoint**: US1 complete — `Integration Tests` job appears in CI and runs the full integration suite against live Postgres + Redis.

---

## Phase 3: User Story 2 — All Branches Get CI Feedback (Priority: P2)

**Goal**: Change the `push` trigger in `.github/workflows/ci.yml` from `branches: [main]` to `branches: ['**']` so CI fires on every branch push, not only main.

**Independent Test**: Push a commit to the `004-improve-cicd` feature branch → all CI jobs trigger without opening a PR.

- [X] T005 [US2] In `.github/workflows/ci.yml`, change `on.push.branches` from `[main]` to `['**']` — keep `on.pull_request.branches: [main]` unchanged

**Checkpoint**: US2 complete — any branch push now triggers all CI jobs.

---

## Phase 4: User Story 3 — Docker Build Validated on Every Run (Priority: P3)

**Goal**: Add a `docker-build` job to `.github/workflows/ci.yml` that runs `docker compose build` and fails if the image cannot be built.

**Independent Test**: Introduce a syntax error in the Dockerfile → the `Docker Build` job fails on the same push.

- [X] T006 [US3] Add `docker-build` job to `.github/workflows/ci.yml` — place after the `build` job; set `needs: [lint-and-typecheck]`; steps: checkout → `docker compose build`

**Checkpoint**: US3 complete — every CI run now includes a `Docker Build` job.

---

## Phase 5: Polish & Validation

**Purpose**: Validate the final YAML is syntactically correct and the job graph matches the design.

- [X] T007 Verify the final `.github/workflows/ci.yml` job dependency graph matches the plan: `lint-and-typecheck` → `{ build, test, test-integration, docker-build }` — confirm no circular dependencies and all `needs:` references exist
- [X] T008 Run `npm test` locally to confirm no regressions to unit tests from the CI config change
- [X] T009 [P] Update `specs/004-improve-cicd/tasks.md` to mark all tasks complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundation)**: No dependencies — start immediately
- **Phase 2 (US1)**: Depends on Phase 1 — confirms env var requirements before writing job YAML
- **Phase 3 (US2)**: Depends on Phase 1 — one-line trigger change; can follow immediately after Phase 2
- **Phase 4 (US3)**: Depends on Phase 1 — straightforward job addition; can follow Phase 3
- **Phase 5 (Polish)**: Depends on Phases 2–4 — validates the complete final state

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 1 only — no dependency on US2 or US3
- **US2 (P2)**: Can start after Phase 1 — independent one-line change; can be applied in any order relative to US1
- **US3 (P3)**: Can start after Phase 1 — independent job addition; can be applied in any order relative to US1/US2

**Note**: All three stories modify `.github/workflows/ci.yml`. Apply them sequentially in a single editing session to avoid conflicts.

### Parallel Opportunities

- T002 and T003 (Phase 1 confirmations) can be checked in parallel — different files
- T005 (trigger change) and T006 (docker-build job) can be planned in parallel but applied sequentially to the same file
- T007 and T008 (validation) can run in parallel — different concerns

---

## Parallel Example: US1

```bash
# After T001–T003 are done, these can be done in parallel (read/plan only):
Task T005: Plan trigger change (one line)
Task T006: Plan docker-build job YAML

# Then apply sequentially to ci.yml:
Task T004 → Task T005 → Task T006
```

---

## Implementation Strategy

### MVP First (US1 Only — Phase 2)

1. Complete Phase 1: Verify existing structure and env var requirements
2. Complete Phase 2: Add integration test job
3. **STOP and VALIDATE**: Push to branch — does "Integration Tests" appear in CI? Do unit tests still pass?
4. If valid → proceed to US2 and US3

### Incremental Delivery

1. Foundation → US1 → demo: "integration tests catch real regressions in CI"
2. Add US2 → demo: "feature branches get instant feedback"
3. Add US3 → demo: "Dockerfile breakage is caught before evaluator runs the project"
4. Polish → final YAML validated, tasks marked complete

---

## Notes

- [P] tasks = different files or independent concerns, no cross-task data dependencies
- All three user stories edit the same YAML file — apply changes in one session, not separate PRs
- The integration test job does NOT need a separate migration step — `runTestMigrations()` inside `beforeAll` handles this
- `REDIS_PORT` should be quoted as `"6379"` in YAML env blocks to ensure it is treated as a string, not an integer
- No application source code changes — this feature is pure CI configuration
