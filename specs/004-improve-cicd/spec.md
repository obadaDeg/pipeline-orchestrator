# Feature Specification: CI/CD Pipeline Improvements

**Feature Branch**: `004-improve-cicd`
**Created**: 2026-03-22
**Status**: Draft
**Input**: User description: "Improve CI/CD pipeline to add integration tests with real DB and Redis service containers, widen trigger to all branches, and validate Docker build on every run"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Integration Tests Run in CI (Priority: P1)

A developer pushes code that changes the ingestion service, signing service, or any database-interacting code. They want CI to catch regressions that only appear when a real database and message broker are involved — not just unit tests with mocked dependencies.

**Why this priority**: Unit tests mock the database. Real bugs in SQL queries, ORM mappings, and end-to-end request flows are invisible without a live DB and Redis. This is the highest-value gap in the current pipeline.

**Independent Test**: Can be verified by opening a PR that breaks a DB query — integration tests fail in CI while unit tests still pass.

**Acceptance Scenarios**:

1. **Given** a PR is opened against main, **When** CI runs, **Then** a dedicated integration test job starts Postgres and Redis as service containers, runs DB migrations, and executes the full integration test suite.
2. **Given** an integration test fails (e.g., a SQL query is broken), **When** CI runs, **Then** the job reports failure and the PR is blocked from merging.
3. **Given** all integration tests pass, **When** CI runs, **Then** the integration job completes successfully and the PR can proceed.
4. **Given** the Postgres or Redis service container fails to become healthy, **When** CI runs, **Then** the job fails with a clear health-check error before tests are attempted.

---

### User Story 2 — All Branches Get CI Feedback (Priority: P2)

A developer working on a feature branch pushes commits throughout the day. They want to know immediately — on every push — whether lint, type checks, unit tests, and integration tests pass, without waiting until they open a PR against main.

**Why this priority**: The current trigger only fires on `push: main` and `pull_request: main`. Developers on feature branches receive no automated feedback, so broken code accumulates undetected before review.

**Independent Test**: Can be verified by pushing a commit directly to a feature branch and observing that all CI jobs run automatically.

**Acceptance Scenarios**:

1. **Given** a developer pushes to any branch (e.g., `004-improve-cicd`), **When** the push completes, **Then** all CI jobs (lint, typecheck, unit tests, integration tests, Docker build) trigger automatically.
2. **Given** a developer pushes to main directly, **When** the push completes, **Then** CI runs as before.
3. **Given** a PR is opened or updated against main, **When** the event fires, **Then** CI runs on the PR head commit.

---

### User Story 3 — Docker Build Validated on Every Run (Priority: P3)

A developer changes a Dockerfile, compose configuration, or a production dependency. They want CI to confirm the Docker image still builds successfully so that `docker compose up` is never broken at submission time.

**Why this priority**: The project deliverable explicitly requires a working `docker compose up`. Without a CI check, a broken image goes undetected until the evaluator tries to run it.

**Independent Test**: Can be verified by introducing a syntax error in the Dockerfile and confirming the Docker build job fails in CI on that same push.

**Acceptance Scenarios**:

1. **Given** any push or PR, **When** CI runs, **Then** a Docker build job runs and verifies the image builds without error.
2. **Given** the Dockerfile contains a syntax error, **When** CI runs, **Then** the Docker build job fails and the error is visible in the job log.
3. **Given** the Docker build succeeds, **When** CI runs, **Then** the job completes and its green status is reported alongside other jobs.

---

### Edge Cases

- What happens when Postgres takes longer than expected to be ready? Health checks with retries must gate the migration step before tests run.
- What happens if DB migrations fail during CI? The integration test job should fail at the migration step with a clear error, not produce confusing test output.
- What happens if a feature branch name contains special characters? The branch trigger pattern must match all valid Git branch names.
- What if the Docker build succeeds but the container would fail at runtime due to missing env vars? Out of scope — build-time validation only; runtime smoke testing is a future improvement.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The CI pipeline MUST trigger on every push to any branch.
- **FR-002**: The CI pipeline MUST trigger on pull requests targeting main.
- **FR-003**: CI MUST include an integration test job that provisions a live Postgres database and Redis instance as ephemeral service containers for the duration of the job.
- **FR-004**: The integration test job MUST run database migrations before executing integration tests.
- **FR-005**: The integration test job MUST fail and halt if either service container does not become healthy within a reasonable timeout.
- **FR-006**: CI MUST include a Docker build validation job that builds the production Docker image and fails if the build does not succeed.
- **FR-007**: The Docker build validation job MUST depend on the lint/typecheck job passing.
- **FR-008**: The integration test job MUST depend on the lint/typecheck job passing.
- **FR-009**: All existing CI jobs (lint, typecheck, build, unit tests) MUST continue to run and pass unchanged.
- **FR-010**: Each CI job MUST have a clear, descriptive name so developers can identify the source of a failure without reading logs.

### Key Entities

- **CI Pipeline**: The workflow configuration file that defines all automated checks run on code changes.
- **Service Container**: An ephemeral, isolated Postgres or Redis instance provisioned by the CI environment for one job's duration.
- **Integration Test Job**: A CI job that runs the full integration test suite against live infrastructure.
- **Docker Build Job**: A CI job that validates the production Docker image can be built from the current source.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every push to any branch triggers all CI jobs — no push goes without automated feedback.
- **SC-002**: A broken SQL query introduced on a feature branch is caught by CI before a PR is opened against main.
- **SC-003**: A broken Dockerfile is caught by CI on the same push that introduced the breakage.
- **SC-004**: The full CI pipeline (lint + unit tests + integration tests + Docker build) completes within 5 minutes on a standard push.
- **SC-005**: Zero regressions to existing CI jobs — all currently passing checks continue to pass after the workflow is updated.

## Assumptions

- The project already has a working `docker compose build` locally — no new Dockerfile changes are required.
- Integration tests already exist and pass locally when pointed at live Postgres and Redis instances.
- The CI environment supports ephemeral service containers for Postgres 16 and Redis 7.
- Environment variables needed for integration tests (`DATABASE_URL`, `REDIS_URL`) can be hardcoded in the CI job using service container defaults — no repository secrets are required.
- The existing `npm run db:migrate` command is idempotent and safe to run against a fresh empty database.
