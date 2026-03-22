# Research: CI/CD Pipeline Improvements

**Branch**: `004-improve-cicd` | **Date**: 2026-03-22

---

## Decision 1: GitHub Actions Service Containers for Postgres and Redis

**Decision**: Use GitHub Actions native `services:` block to provision ephemeral Postgres 16 and Redis 7 containers per-job.

**Rationale**: Service containers are the idiomatic GitHub Actions mechanism for spinning up real infrastructure dependencies per CI job. They are started before the job steps run, health-checked automatically if `options:` is configured, and torn down after the job completes. No extra Docker Compose or setup scripts required.

**Alternatives considered**:
- `docker compose up` in a step before tests — requires waiting on container health manually, harder to cache, and couples CI to the compose file used in production.
- Hosted external test DB — adds secret management, network latency, and state isolation risk.

---

## Decision 2: Environment Variables for Integration Tests

**Decision**: Hardcode CI-only env vars in the job's `env:` block. No repository secrets required.

**Rationale**: The test database uses throwaway credentials (`postgres:postgres`) on a loopback address — there is no secret to protect. The integration test helper (`tests/helpers/db-test-client.ts`) reads `DATABASE_URL` directly from `process.env`. The app's config reads `REDIS_HOST` and `REDIS_PORT` separately (not a `REDIS_URL`). Required env block:

```yaml
env:
  DATABASE_URL: postgresql://postgres:postgres@localhost:5432/webhook_test
  REDIS_HOST: localhost
  REDIS_PORT: 6379
  NODE_ENV: test
```

**Alternatives considered**:
- `REDIS_URL` — the app's `config.ts` uses `REDIS_HOST` + `REDIS_PORT` individually, not a URL. No change to app code needed.

---

## Decision 3: Migrations Inside the Test Helper vs. Separate Step

**Decision**: No separate `npm run db:migrate` step in CI. The integration test `beforeAll` hook calls `runTestMigrations()` from the test helper, which runs the Drizzle migrator against the test DB before any test executes.

**Rationale**: `tests/helpers/db-test-client.ts` already runs `migrate(testDb, { migrationsFolder: 'drizzle' })` inside `runTestMigrations()`. All integration test files call this in `beforeAll`. Adding a duplicate migration step in CI would be redundant and could cause ordering issues.

**Alternatives considered**:
- Separate `npm run db:migrate` step — would require `tsx` to be available in PATH in CI, and runs migrations before the test process owns the connection. Redundant since the test helper already handles this.

---

## Decision 4: Branch Trigger — All Branches

**Decision**: Change `push.branches` from `[main]` to `['**']` to match all branches.

**Rationale**: The glob `'**'` matches any branch name including those with slashes (e.g., `feature/my-branch`). This is the standard GitHub Actions pattern for "all branches". Using `branches-ignore` as an alternative would require listing exclusions explicitly and is harder to maintain.

**Alternatives considered**:
- Remove the `push` trigger entirely and rely only on `pull_request` — developers would get no feedback on their branch until they open a PR, which is the current problem.
- `push.branches: ['**', '!dependabot/**']` — excluding Dependabot is a reasonable addition but out of scope for this feature.

---

## Decision 5: Docker Build Job Using `docker compose build`

**Decision**: Add a job that runs `docker compose build` without starting containers. Depends on `lint-and-typecheck` passing.

**Rationale**: `docker compose build` validates that all Dockerfiles parse, all `COPY` instructions reference files that exist, and all `RUN` commands succeed. It is faster than `docker compose up` and does not require a running Postgres/Redis. It catches Dockerfile syntax errors and missing files — the most common breakage scenario.

**Alternatives considered**:
- `docker build` directly on each Dockerfile — requires knowing all Dockerfile paths; `docker compose build` handles multi-service builds automatically.
- Full `docker compose up` smoke test — starts all services, requires more setup (env files, migrations), and is slower. Adds value but is out of scope for this feature.

---

## Decision 6: Job Dependency Graph

**Decision**: All new jobs depend on `lint-and-typecheck`. Integration tests and Docker build run in parallel after that gate.

```
lint-and-typecheck
├── build
├── test (unit)
├── test-integration   ← new
└── docker-build       ← new
```

**Rationale**: No point running expensive integration tests or Docker builds if the code doesn't even compile or lint. The `build` job and `test` job already follow this pattern — new jobs should be consistent.

**Alternatives considered**:
- Integration tests depend on `build` — unnecessary since Vitest runs TypeScript directly via `tsx`, not from compiled output.
