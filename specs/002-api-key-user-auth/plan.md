# Implementation Plan: API Key Authentication & User-Scoped Flow Ownership

**Branch**: `002-api-key-user-auth` | **Date**: 2026-03-20 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-api-key-user-auth/spec.md`

## Summary

Extend the webhook pipeline platform with multi-user authentication via API keys. Each user registers with email + password and receives a long-lived API key. All pipeline (flow) operations are scoped to the authenticated user's ownership — either personal pipelines or team-owned pipelines the user is a member of. Teams allow multiple users to share pipeline ownership. All security-relevant events are recorded in an audit log. The existing pipeline, job, and delivery infrastructure is unchanged; this feature adds the identity layer on top.

## Technical Context

**Language/Version**: TypeScript 5.4, Node.js 20 LTS
**Primary Dependencies**: Express 4.x, Drizzle ORM 0.30, Zod 3.x, `argon2` (password hashing), `node:crypto` (API key generation via `randomBytes`)
**Storage**: PostgreSQL — 5 new tables (`users`, `api_keys`, `teams`, `team_memberships`, `audit_events`); 2 new columns on existing `pipelines` table
**Testing**: Vitest (unit + integration), existing test infrastructure
**Target Platform**: Linux server (Docker), same as existing
**Project Type**: Web service (REST API)
**Performance Goals**: Auth middleware overhead < 5ms p95 (SHA-256 hash + single indexed DB lookup)
**Constraints**: No JWT, no session cookies, API-only; 10 active keys max per user; revocation within 1 second
**Scale/Scope**: 10,000 authenticated users, up to 10 keys each, multiple team memberships

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Asynchronous Processing | ✅ Pass | Auth feature does not touch ingestion path; async pipeline is unchanged |
| II. Reliability & Retry | ✅ Pass | Delivery engine unchanged; auth adds no new async paths |
| III. Clean Separation of Concerns | ✅ Pass | Auth is a new middleware layer (`src/api/middleware/authenticate.ts`) + new services/routes; does not mix into existing Job Consumer or Delivery Engine |
| IV. TypeScript Type Safety | ✅ Pass | All new code will use strict types; `any` prohibited; `req.user` typed via Express namespace extension |
| V. Infrastructure Reproducibility | ✅ Pass | New `argon2` dependency added to `package.json`; Drizzle migration for new tables; Docker Compose unchanged |
| VI. Code Quality Standards | ✅ Pass | Middleware ~20 lines; services decomposed per responsibility; no magic strings — error codes extracted as constants |
| VII. Testing Standards | ✅ Pass | Unit tests for auth middleware, key generation/hashing, ownership filter; integration test for full register→auth→create pipeline→list flow |
| VIII. API Consistency | ✅ Pass | All new endpoints follow `{ data: ... }` / `{ error: { code, message } }` envelope; proper HTTP status codes; lowercase hyphenated paths |
| IX. Performance Requirements | ✅ Pass | Auth lookup is O(1) via unique index on `key_hash`; `last_used_at` update is fire-and-forget (async) to avoid adding latency to every request |

**Complexity Tracking**: No violations. No new architectural patterns beyond what the constitution already mandates.

## Project Structure

### Documentation (this feature)

```text
specs/002-api-key-user-auth/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── auth-api.md
│   ├── teams-api.md
│   └── pipelines-auth-changes.md
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── api/
│   ├── middleware/
│   │   ├── authenticate.ts          ← NEW: API key auth middleware
│   │   ├── body-size-limit.ts       (existing)
│   │   ├── error-handler.ts         (existing)
│   │   └── validate-request.ts      (existing)
│   ├── routes/
│   │   ├── auth.router.ts           ← NEW: /auth/* routes
│   │   ├── teams.router.ts          ← NEW: /teams/* routes
│   │   ├── pipelines.router.ts      (existing — add auth middleware)
│   │   ├── jobs.router.ts           (existing — add auth middleware)
│   │   └── webhooks.router.ts       (existing — unchanged, no auth)
│   ├── controllers/
│   │   ├── auth.controller.ts       ← NEW
│   │   ├── teams.controller.ts      ← NEW
│   │   ├── pipelines.controller.ts  (existing — add ownership scoping)
│   │   └── jobs.controller.ts       (existing — add ownership scoping)
│   ├── schemas/
│   │   ├── auth.schema.ts           ← NEW: Zod schemas for register/login/key
│   │   ├── team.schema.ts           ← NEW: Zod schemas for team/member endpoints
│   │   └── pipeline.schema.ts       (existing — add optional teamId field)
│   └── server.ts                    (existing — register new routers)
├── services/
│   ├── auth.service.ts              ← NEW: register, login, key CRUD, audit logging
│   ├── team.service.ts              ← NEW: team CRUD, membership, ownership transfer
│   ├── pipeline.service.ts          (existing — add ownership filter to queries)
│   ├── ingestion.service.ts         (existing — unchanged)
│   └── job.service.ts               (existing — unchanged)
├── db/
│   └── schema.ts                    (existing — add new tables + pipeline columns)
└── lib/
    ├── api-key.ts                   ← NEW: key generation, hashing utilities
    └── errors.ts                    (existing — add UnauthorizedError, ForbiddenError)

tests/
├── unit/
│   ├── auth/
│   │   ├── api-key.test.ts          ← NEW: key generation + hashing
│   │   ├── authenticate.test.ts     ← NEW: middleware unit test
│   │   └── auth.service.test.ts     ← NEW: register, login, revoke
│   └── teams/
│       └── team.service.test.ts     ← NEW: team CRUD, membership, transfer
└── integration/
    └── auth-pipeline-flow.test.ts   ← NEW: register→auth→create→list→revoke
```

**Structure Decision**: Single project (Option 1). Auth is a pure extension of the existing Express API layer. No new services/processes required; the existing Docker Compose services (API, worker, DB, Redis) are unchanged.

## Implementation Phases

### Phase 1: Identity Foundation

**Goal**: Users can register and authenticate via API key. No ownership enforcement yet.

**Deliverables**:
1. DB schema additions: `users`, `api_keys` tables + Drizzle migration
2. `src/lib/api-key.ts`: key generation (`wh_` + 32 random bytes) + SHA-256 hashing
3. `src/lib/errors.ts`: add `UnauthorizedError` (401), `ForbiddenError` (403)
4. `src/services/auth.service.ts`: `register()`, `createApiKey()`, `revokeApiKey()`, `listApiKeys()`, `validateApiKey()`
5. `src/api/middleware/authenticate.ts`: reads Bearer token → hashes → DB lookup → sets `req.user`
6. `src/api/routes/auth.router.ts` + `auth.controller.ts` + `auth.schema.ts`: POST /auth/register, POST /auth/login, GET /auth/keys, POST /auth/keys, DELETE /auth/keys/:id
7. Register auth router in `server.ts`
8. Unit tests: `api-key.test.ts`, `authenticate.test.ts`, `auth.service.test.ts`

**Exit criteria**: Can register, receive key, and make authenticated requests. Unauthenticated requests to `/auth/*` return 401.

---

### Phase 2: Audit Logging

**Goal**: Security events are recorded.

**Deliverables**:
1. DB schema: `audit_events` table + Drizzle migration
2. `src/services/auth.service.ts`: emit audit events in `register()`, `createApiKey()`, `revokeApiKey()`, and the auth middleware failure path
3. GET /auth/audit-log endpoint (controller + schema)

**Exit criteria**: Registering, creating/revoking keys, and failed auth attempts each produce a record in `audit_events` retrievable via the API.

---

### Phase 3: Pipeline Ownership

**Goal**: Pipelines are scoped to the authenticated user.

**Deliverables**:
1. DB schema: add `owner_user_id`, `owner_team_id` to `pipelines` + Drizzle migration
2. Apply `authenticate` middleware to all `/pipelines` and `/jobs` routes
3. Update `pipeline.service.ts`: `createPipeline()` assigns `owner_user_id`; `listPipelines()`, `getPipeline()`, `updatePipeline()`, `deletePipeline()` filter by ownership; return 404 (not 403) for cross-user access
4. Update `pipelines.schema.ts`: add optional `teamId` field
5. Update `pipelines.controller.ts`: pass `req.user` context to service layer
6. Integration test: `auth-pipeline-flow.test.ts`

**Exit criteria**: User A cannot see or modify User B's pipelines. New pipelines are automatically owned by the creating user.

---

### Phase 4: Teams

**Goal**: Groups of users can share pipeline ownership.

**Deliverables**:
1. DB schema: `teams`, `team_memberships` tables + Drizzle migration
2. `src/services/team.service.ts`: `createTeam()`, `getTeam()`, `deleteTeam()` (with flow transfer), `addMember()`, `removeMember()`, `getUserTeamIds()`
3. `src/api/routes/teams.router.ts` + `teams.controller.ts` + `team.schema.ts`
4. Update ownership filter in `pipeline.service.ts` to also include pipelines owned by user's teams
5. Update `createPipeline()` to accept and validate `teamId`
6. Emit audit events for team events in `team.service.ts`
7. Unit tests: `team.service.test.ts`

**Exit criteria**: Team owner can create team, invite members, and create shared pipelines. All members can view and manage team pipelines. Non-members cannot access them.

---

### Phase 5: Polish & Hardening

**Goal**: Production-readiness of the auth layer.

**Deliverables**:
1. Rate limiting on `/auth/register` and `/auth/login` (prevent credential stuffing)
2. Ensure `last_used_at` update is truly non-blocking (fire-and-forget with error suppression)
3. Review all error messages for information leakage (auth failures must be opaque)
4. Confirm all new endpoints follow API envelope (VIII. API Consistency)
5. Confirm all new DB indexes match IX. Performance Requirements
6. Update README: document new auth endpoints, API key usage, team management
7. Full test run: `npm test` passes; `npm run lint` passes; `npm run typecheck` passes

**Exit criteria**: All 9 constitution principles satisfied. CI passes.
