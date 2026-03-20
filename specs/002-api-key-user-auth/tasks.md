---

description: "Task list for 002-api-key-user-auth"
---

# Tasks: API Key Authentication & User-Scoped Flow Ownership

**Input**: Design documents from `/specs/002-api-key-user-auth/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks in same phase)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Exact file paths included in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install new dependency, extend types, and create core utility library

- [x] T001 [P] Add `argon2` package to dependencies in `package.json` and run `npm install`
- [x] T002 [P] Create Express Request type extension for `req.user` typed as authenticated user in `src/types/express.d.ts`
- [x] T003 [P] Create API key utility library — `generateApiKey()` (crypto.randomBytes → `wh_` prefix + base64), `hashApiKey()` (SHA-256 hex), `getKeyPrefix()` (first 8 chars) — in `src/lib/api-key.ts`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema additions and error types. MUST complete before any user story work begins.

**⚠️ CRITICAL**: No user story work can begin until T008 (migration) is complete.

- [x] T004 Add `users` table (id, email, password_hash, created_at, updated_at) and `api_keys` table (id, user_id, name, key_hash, key_prefix, last_used_at, revoked_at, created_at) with all indexes to `src/db/schema.ts`
- [x] T005 Add `teams` table (id, name, owner_user_id, created_at, updated_at) and `team_memberships` table (id, team_id, user_id, created_at) with UNIQUE constraint on `(team_id, user_id)` and indexes to `src/db/schema.ts`
- [x] T006 Add `audit_event_type` pg enum (`KEY_CREATED`, `KEY_REVOKED`, `AUTH_FAILED`, `TEAM_CREATED`, `TEAM_DELETED`, `TEAM_MEMBER_ADDED`, `TEAM_MEMBER_REMOVED`, `USER_REGISTERED`) and `audit_events` table (id, user_id, event_type, metadata jsonb, created_at) with indexes to `src/db/schema.ts`
- [x] T007 Add nullable `owner_user_id` (FK → users.id SET NULL) and `owner_team_id` (FK → teams.id SET NULL) columns with indexes to `pipelines` table in `src/db/schema.ts`
- [x] T008 Generate and apply Drizzle migration: run `npm run db:generate` then `npm run db:migrate`
- [x] T009 [P] Add `UnauthorizedError` (extends `AppError`, HTTP 401, code `UNAUTHORIZED`) and `ForbiddenError` (HTTP 403, code `FORBIDDEN`) to `src/lib/errors.ts`

**Checkpoint**: Database schema is ready and error types exist — user story implementation can now begin

---

## Phase 3: User Story 1 — Developer Registers and Obtains API Key (Priority: P1) 🎯 MVP

**Goal**: A developer can register, receive an API key, and authenticate all subsequent requests with it.

**Independent Test**: Register via `POST /auth/register` → receive a key → make an authenticated request → confirm 200. Make an unauthenticated request → confirm 401.

### Implementation for User Story 1

- [ ] T010 [US1] Create Zod schemas for `POST /auth/register` (email, password) and `POST /auth/login` (email, password) in `src/api/schemas/auth.schema.ts`
- [ ] T011 [US1] Implement `register(email, password)` — argon2id hash password, create user row, call `createApiKey()` with name "Default", return user + full key — in `src/services/auth.service.ts`
- [ ] T012 [US1] Implement `validateApiKey(rawKey)` — SHA-256 hash the key, look up `api_keys` by `key_hash` where `revoked_at IS NULL`, join to `users`, return user or null — in `src/services/auth.service.ts`
- [ ] T013 [US1] Implement `authenticate` Express middleware — extract `Authorization: Bearer <key>`, call `validateApiKey()`, attach `req.user` on success, call `next(new UnauthorizedError(...))` on failure, fire-and-forget `last_used_at` update — in `src/api/middleware/authenticate.ts`
- [ ] T014 [P] [US1] Implement auth controller handlers: `registerHandler` (calls `auth.service.register`, returns 201 with user + key) and `loginHandler` (validates password with argon2.verify, creates new key, returns 201) in `src/api/controllers/auth.controller.ts`
- [ ] T015 [US1] Create auth router with `POST /auth/register` and `POST /auth/login` routes (no auth middleware on these two) in `src/api/routes/auth.router.ts`
- [ ] T016 [US1] Register auth router at `/auth` prefix in `src/api/server.ts`
- [ ] T017 [P] [US1] Write unit tests for `src/lib/api-key.ts`: key format (`wh_` prefix), key length, prefix extraction, hash determinism, hash distinctness in `tests/unit/auth/api-key.test.ts`
- [ ] T018 [P] [US1] Write unit tests for `authenticate` middleware: valid key → `req.user` set, revoked key → 401, missing header → 401, malformed header → 401 in `tests/unit/auth/authenticate.test.ts`

**Checkpoint**: `POST /auth/register` returns a usable API key. All subsequent requests with `Authorization: Bearer <key>` are authenticated.

---

## Phase 4: User Story 2 — User Manages Flow Ownership (Priority: P2)

**Goal**: Every pipeline is owned by its creator. Users see only their own pipelines and cannot access others'.

**Independent Test**: Register user A and user B. User A creates a pipeline. User B's `GET /pipelines` returns empty. User B's `GET /pipelines/:id` (using A's ID) returns 404.

### Implementation for User Story 2

- [ ] T019 [US2] Apply `authenticate` middleware to all routes in `src/api/routes/pipelines.router.ts`
- [ ] T020 [US2] Apply `authenticate` middleware to all routes in `src/api/routes/jobs.router.ts`
- [ ] T021 [US2] Update `createPipeline()` to set `owner_user_id = req.user.id` (and `owner_team_id = null`) when no `teamId` is provided in `src/services/pipeline.service.ts`
- [ ] T022 [US2] Update `listPipelines()` to add `WHERE owner_user_id = userId` filter (personal scope only; team scope added in US3) in `src/services/pipeline.service.ts`
- [ ] T023 [US2] Update `getPipeline()`, `updatePipeline()`, `deletePipeline()` to verify `owner_user_id = req.user.id`; return 404 (not 403) when pipeline is inaccessible to prevent enumeration in `src/services/pipeline.service.ts`
- [ ] T024 [US2] Update all pipeline controller methods to extract and forward `req.user.id` as `userId` context to service calls in `src/api/controllers/pipelines.controller.ts`
- [ ] T025 [US2] Add optional `teamId` (uuid, nullable) field to `CreatePipelineBodySchema` in `src/api/schemas/pipeline.schema.ts`
- [ ] T026 [US2] Write integration test: register two users, each creates a pipeline, assert list isolation and 404 on cross-user access in `tests/integration/auth-pipeline-flow.test.ts`

**Checkpoint**: Pipelines are scoped per user. Cross-user access returns 404. Unauthenticated requests return 401.

---

## Phase 5: User Story 3 — Team Shares Flow Ownership (Priority: P3)

**Goal**: A team owner can create a team, invite members, and create shared pipelines that all members can manage.

**Independent Test**: Owner creates team → invites user B → owner creates team pipeline → user B lists pipelines → team pipeline appears. User C (non-member) → team pipeline does not appear.

### Implementation for User Story 3

- [ ] T027 [P] [US3] Create Zod schemas for `POST /teams` (name), `POST /teams/:id/members` (email) in `src/api/schemas/team.schema.ts`
- [ ] T028 [US3] Implement `createTeam(ownerUserId, name)`, `getTeam(teamId, requestingUserId)` (includes member list, enforces membership), and `deleteTeam(teamId, requestingUserId)` — on delete, UPDATE pipelines SET owner_user_id = team.owner_user_id, owner_team_id = NULL WHERE owner_team_id = teamId — in `src/services/team.service.ts`
- [ ] T029 [US3] Implement `addMember(teamId, ownerUserId, targetEmail)` — look up user by email, error if not found, insert team_membership — and `removeMember(teamId, ownerUserId, targetUserId)` — block owner self-removal — in `src/services/team.service.ts`
- [ ] T030 [US3] Implement `getUserTeamIds(userId)` — returns array of team IDs the user owns or is a member of — in `src/services/team.service.ts`
- [ ] T031 [P] [US3] Implement teams controller handlers: `createTeamHandler`, `getTeamHandler`, `deleteTeamHandler`, `addMemberHandler`, `removeMemberHandler` in `src/api/controllers/teams.controller.ts`
- [ ] T032 [US3] Create teams router: `POST /teams`, `GET /teams/:id`, `DELETE /teams/:id`, `POST /teams/:id/members`, `DELETE /teams/:id/members/:userId` — all behind `authenticate` middleware — in `src/api/routes/teams.router.ts`
- [ ] T033 [US3] Register teams router at `/teams` prefix in `src/api/server.ts`
- [ ] T034 [US3] Update `listPipelines()` and `getPipeline()` ownership filter in `src/services/pipeline.service.ts` to include pipelines where `owner_team_id IN (getUserTeamIds(userId))` using a JOIN or subquery
- [ ] T035 [US3] Update `createPipeline()` in `src/services/pipeline.service.ts` to accept `teamId`: verify user is team owner or member, set `owner_team_id = teamId` and `owner_user_id = null`
- [ ] T036 [P] [US3] Write unit tests for team service: createTeam, deleteTeam (verify pipeline transfer), addMember (user not found), removeMember (block owner), getUserTeamIds in `tests/unit/teams/team.service.test.ts`

**Checkpoint**: Teams exist. Team pipelines are visible to all members and invisible to non-members. Deleting a team transfers its pipelines to the owner.

---

## Phase 6: User Story 4 — User Revokes and Rotates API Keys (Priority: P4)

**Goal**: Users can list their keys, create named additional keys (up to 10), revoke any key immediately, and review their security audit log.

**Independent Test**: Create two keys. Revoke key 1. Request with key 1 → 401. Request with key 2 → 200. `GET /auth/audit-log` shows KEY_REVOKED event.

### Implementation for User Story 4

- [ ] T037 [US4] Add Zod schemas for key creation (`POST /auth/keys` body: `{ name }`) and list/revoke responses to `src/api/schemas/auth.schema.ts`
- [ ] T038 [US4] Implement `createApiKey(userId, name)` — enforce 10-key limit (count active keys), generate key, hash, insert row, return full key (only time) — in `src/services/auth.service.ts`
- [ ] T039 [US4] Implement `revokeApiKey(userId, keyId)` — verify key belongs to user and is not already revoked, set `revoked_at = now()` — in `src/services/auth.service.ts`
- [ ] T040 [US4] Implement `listApiKeys(userId)` — return all keys for user with metadata (id, name, key_prefix, created_at, last_used_at, revoked_at), never key_hash — in `src/services/auth.service.ts`
- [ ] T041 [P] [US4] Implement auth controller handlers: `listKeysHandler`, `createKeyHandler`, `revokeKeyHandler` in `src/api/controllers/auth.controller.ts`
- [ ] T042 [US4] Add `GET /auth/keys`, `POST /auth/keys`, `DELETE /auth/keys/:id` routes (all behind `authenticate`) to `src/api/routes/auth.router.ts`
- [ ] T043 [US4] Implement `emitAuditEvent(userId, eventType, metadata)` and `getUserAuditLog(userId, page, limit)` in `src/services/auth.service.ts`
- [ ] T044 [US4] Wire audit event calls into `register()` (USER_REGISTERED), `validateApiKey()` failure path (AUTH_FAILED), `createApiKey()` (KEY_CREATED), `revokeApiKey()` (KEY_REVOKED) in `src/services/auth.service.ts`
- [ ] T045 [US4] Wire audit event calls into team service: TEAM_CREATED, TEAM_DELETED, TEAM_MEMBER_ADDED, TEAM_MEMBER_REMOVED in `src/services/team.service.ts`
- [ ] T046 [P] [US4] Implement `getAuditLogHandler` with pagination support in `src/api/controllers/auth.controller.ts`
- [ ] T047 [US4] Add `GET /auth/audit-log` route (behind `authenticate`) to `src/api/routes/auth.router.ts`
- [ ] T048 [P] [US4] Write unit tests for auth service key lifecycle: createApiKey (success, 10-key limit enforced), revokeApiKey (success, already-revoked error, wrong-user 404), listApiKeys in `tests/unit/auth/auth.service.test.ts`

**Checkpoint**: All four user stories are independently functional. Full audit trail is available via API.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, compliance verification, and documentation

- [ ] T049 [P] Add request rate limiting middleware to `POST /auth/register` and `POST /auth/login` to prevent credential stuffing in `src/api/routes/auth.router.ts`
- [ ] T050 [P] Verify `last_used_at` update in `src/api/middleware/authenticate.ts` is fully non-blocking (fire-and-forget with caught error, no await)
- [ ] T051 [P] Review all authentication error responses in `src/api/middleware/authenticate.ts` and `src/services/auth.service.ts` to confirm no information leakage (revoked key and invalid key return identical `UNAUTHORIZED` response)
- [ ] T052 [P] Verify all new endpoints return `{ data: ... }` / `{ error: { code, message } }` envelope and correct HTTP status codes per constitution principle VIII
- [ ] T053 [P] Confirm all new DB tables have the indexes specified in `data-model.md` (cross-check `src/db/schema.ts` against constitution principle IX)
- [ ] T054 Update `README.md` with: auth endpoints reference, API key usage guide, team management guide, and link to `quickstart.md`
- [ ] T055 Run `npm test && npm run lint && npm run typecheck` — resolve all failures before marking this phase complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — all three tasks start immediately in parallel
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
  - T004–T007 are sequential (same file: `src/db/schema.ts`)
  - T009 can run in parallel with T004–T007 (different file)
  - T008 (migration) MUST complete before any user story begins
- **US1 (Phase 3)**: Depends on Foundational — no dependencies on other stories
- **US2 (Phase 4)**: Depends on US1 (requires `authenticate` middleware from T013)
- **US3 (Phase 5)**: Depends on US1 (requires auth); can run in parallel with US2
- **US4 (Phase 6)**: Depends on US1 (extends auth service); can run in parallel with US2/US3
- **Polish (Phase 7)**: Depends on all desired stories being complete

### User Story Dependencies

```
Phase 1 (Setup)
    └─→ Phase 2 (Foundational — schema + errors)
            └─→ Phase 3 (US1: Register & Auth) ← MVP stops here
                    ├─→ Phase 4 (US2: Pipeline Ownership)
                    ├─→ Phase 5 (US3: Teams)      ← parallel with US2
                    └─→ Phase 6 (US4: Key Lifecycle) ← parallel with US2/US3
                            └─→ Phase 7 (Polish)
```

### Parallel Opportunities Within Phases

**Phase 1**: T001, T002, T003 all parallel

**Phase 2**: T004→T005→T006→T007 sequential (same file); T009 parallel with all of them; T008 after T004–T007

**Phase 3 (US1)**: T010→T011→T012→T013 sequential; T014 parallel with T013; T015 after T013; T017, T018 parallel with each other and with T014

**Phase 5 (US3)**: T027 parallel with T028–T030; T031 parallel with T028–T029; T036 parallel with T028–T035

**Phase 6 (US4)**: T037, T043 can start independently; T038→T039→T040 sequential; T041, T046 parallel with each other; T048 parallel with T041/T046

---

## Parallel Execution Examples

### Phase 1 — All in parallel

```
Task: T001 — Install argon2 (package.json)
Task: T002 — Create src/types/express.d.ts
Task: T003 — Create src/lib/api-key.ts
```

### Phase 3 (US1) — Models then parallel

```
# Sequential core:
T010 → T011 → T012 → T013 → T015 → T016

# Parallel with T013:
Task: T014 — auth.controller.ts (register + login handlers)
Task: T017 — tests/unit/auth/api-key.test.ts
Task: T018 — tests/unit/auth/authenticate.test.ts
```

### Phase 5 (US3) — Services then parallel controllers

```
# Sequential services (shared state):
T028 → T029 → T030 → T034 → T035

# Parallel:
Task: T027 — team.schema.ts
Task: T031 — teams.controller.ts
Task: T036 — tests/unit/teams/team.service.test.ts
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T009) — CRITICAL gate
3. Complete Phase 3: User Story 1 (T010–T018)
4. **STOP AND VALIDATE**: Run `npm test`, curl `POST /auth/register`, curl an authenticated endpoint
5. Ship/demo if ready

### Incremental Delivery

1. Setup + Foundational → Schema and error types ready
2. **+US1** → Any developer can register and authenticate (MVP)
3. **+US2** → Pipelines are isolated per user (multi-tenant safe)
4. **+US3** → Teams can share pipelines (collaboration enabled)
5. **+US4** → Full key lifecycle + audit log (production-ready security)
6. **+Polish** → Rate limiting, docs, CI green

### Single-Developer Sequential Path

```
T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009
→ T010 → T011 → T012 → T013 → T014 → T015 → T016 → T017 → T018  ← US1 done
→ T019 → T020 → T021 → T022 → T023 → T024 → T025 → T026          ← US2 done
→ T027 → T028 → T029 → T030 → T031 → T032 → T033 → T034 → T035 → T036  ← US3 done
→ T037 → T038 → T039 → T040 → T041 → T042 → T043 → T044 → T045 → T046 → T047 → T048  ← US4 done
→ T049 → T050 → T051 → T052 → T053 → T054 → T055                 ← Polish done
```

---

## Notes

- `[P]` tasks operate on different files with no incomplete dependencies — safe to parallelize
- `[USn]` labels map each task to its user story for traceability
- Each story phase ends with a named **Checkpoint** — validate independently before moving on
- Auth failure responses MUST be opaque: never distinguish "key not found" from "key revoked"
- The `key` field in API responses appears **only once** (at creation) — verify this in controller tests
- Commit after each logical group; use the checklist to track progress
