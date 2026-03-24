# Tasks: Demo Seed Data & Webhook Inbound URL

**Input**: Design documents from `/specs/009-demo-seeds-webhook-url/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/screens.md ✓

**Organization**: Two fully independent user stories — can be worked in parallel.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)

---

## Phase 1: User Story 1 — Webhook Inbound URL Display (Priority: P1) 🎯 MVP

**Goal**: Show the pre-built `sourceUrl` field (already returned by `GET /pipelines/:id`) in the Overview tab of `PipelineDetailPage` with a one-click copy button.

**Independent Test**: Open any pipeline detail page → Overview tab shows a "Webhook URL" row with the full URL → clicking Copy changes the button to "Copied!" for 2 seconds → the URL can be pasted and used with curl to trigger a job.

### Implementation for User Story 1

- [x] T001 [US1] Add `sourceUrl: string` to the `Pipeline` interface in `dashboard/src/pages/PipelineDetailPage.tsx` (field is already returned by the API — confirmed in research D-001)
- [x] T002 [US1] Add `isCopied` boolean state and `handleCopy()` function to `dashboard/src/pages/PipelineDetailPage.tsx` — `navigator.clipboard.writeText(pipeline.sourceUrl)`, set `isCopied = true`, reset after 2000ms via `setTimeout`
- [x] T003 [US1] Add "Webhook URL" row to the Overview tab in `dashboard/src/pages/PipelineDetailPage.tsx` — label + read-only URL text (full value, monospace) + Copy button that shows "Copied!" when `isCopied` is true; show "—" and disable copy button if `sourceUrl` is falsy
- [x] T004 [P] [US1] Add `sourceUrl` field to the `MOCK_PIPELINE` constant in `dashboard/src/test/handlers.ts` — use a realistic value like `http://localhost:3000/api/webhooks/550e8400-e29b-41d4-a716-446655440000`

**Checkpoint**: Open any pipeline → Overview tab shows the Webhook URL row. Copy works. US1 complete and independently testable.

---

## Phase 2: User Story 2 — Demo Seed Script (Priority: P1)

**Goal**: Create `src/db/seed.ts` — an idempotent TypeScript script that populates a complete demo dataset: 2 users, 2 API keys, 2 teams with members, 3 pipelines (one per action type), 1 signing secret, and 12 jobs with delivery attempts.

**Independent Test**: Run `npm run db:seed` on a clean database → output summary shows all records created → log in as `demo@example.com` / `Password123!` → Pipelines, Jobs, Teams pages all show populated data → run seed again → output shows all records skipped → no duplicates.

### Implementation for User Story 2

- [x] T005 [US2] Add `"db:seed": "node --import tsx/esm src/db/seed.ts"` to the `scripts` section of `package.json` — place after `db:migrate`
- [x] T006 [US2] Create `src/db/seed.ts` scaffold — import `db` from `./index.js`, import schema tables, define named constants for all demo data: `DEMO_EMAIL = 'demo@example.com'`, `DEMO_PASSWORD = 'Password123!'`, `MEMBER_EMAIL = 'member@example.com'`, pipeline names/configs; define a `log(entity, name, action)` helper that prints `[seed] <entity>: <name> (<action>)`; export a `seed()` async function that calls each helper in order; call `seed()` at the bottom with `.catch(console.error).finally(() => process.exit())`
- [x] T007 [US2] Implement `seedUser(email: string, password: string): Promise<string>` in `src/db/seed.ts` — query `users` table where `email = email`; if found: log "skipped", return existing `id`; if not found: hash password using `argon2.hash(password, { type: argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 })`, insert row, log "created", return new `id`
- [x] T008 [US2] Implement `seedApiKeys(userId: string): Promise<void>` in `src/db/seed.ts` — count existing keys for userId; if ≥ 2: log "skipped"; otherwise insert keys named `'Default'` and `'CI/CD'` using `node:crypto` `randomBytes(32).toString('hex')` for the key value, log "created" for each
- [x] T009 [US2] Implement `seedTeam(name: string, ownerUserId: string): Promise<string>` and `seedMembership(teamId: string, userId: string): Promise<void>` in `src/db/seed.ts` — team: query by name, skip if found; membership: query `team_memberships` by `(teamId, userId)`, skip if found; log appropriately for each
- [x] T010 [US2] Implement `seedPipeline(name: string, actionType: string, actionConfig: object, ownerTeamId: string): Promise<string>` in `src/db/seed.ts` — query `pipelines` by name, skip if found; insert row with `sourceId: crypto.randomUUID()`, log "created"/"skipped"
- [x] T011 [US2] Implement `seedSigningSecret(pipelineId: string): Promise<void>` in `src/db/seed.ts` — query `pipeline_signing_secrets` for pipelineId; if active record found: log "skipped"; otherwise insert with `secret: randomBytes(32).toString('hex')`, `hint: secret.slice(-4)`, log "created"
- [x] T012 [US2] Implement `seedJobs(pipelineId: string, count: number, failCount: number): Promise<void>` in `src/db/seed.ts` — check existing job count for pipeline; if already ≥ count: log "skipped"; otherwise create `count` jobs: first `(count - failCount)` as `COMPLETED`, last `failCount` as `FAILED`; spread `createdAt` over past 7 days using `Date.now() - i * 14_400_000`; for each COMPLETED job insert 1 delivery attempt (HTTP 200, body `'{"ok":true}'`); for each FAILED job insert 2 delivery attempts (HTTP 500 then 503)
- [x] T013 [US2] Wire all helpers into the `seed()` function body in `src/db/seed.ts`:
  1. `demoId = await seedUser(DEMO_EMAIL, DEMO_PASSWORD)`
  2. `memberId = await seedUser(MEMBER_EMAIL, DEMO_PASSWORD)`
  3. `await seedApiKeys(demoId)`
  4. `team1Id = await seedTeam('Acme Platform', demoId)` + `seedMembership(team1Id, memberId)`
  5. `team2Id = await seedTeam('Acme Data', demoId)` + `seedMembership(team2Id, memberId)`
  6. `p1Id = await seedPipeline('GitHub Events', 'field_extractor', { fields: ['event','repo','ref'] }, team1Id)`
  7. `p2Id = await seedPipeline('Stripe Payments', 'payload_filter', { field: 'type', values: ['charge.succeeded','invoice.paid'] }, team1Id)`
  8. `p3Id = await seedPipeline('Slack Alerts', 'http_enricher', { url: 'https://httpbin.org/post', method: 'POST' }, team2Id)`
  9. `await seedSigningSecret(p1Id)`
  10. `await seedJobs(p1Id, 5, 1)` + `await seedJobs(p2Id, 4, 1)` + `await seedJobs(p3Id, 3, 2)`

**Checkpoint**: `npm run db:seed` completes without error; prints 16 log lines; all 6 dashboard pages show populated data; second run prints all "skipped". US2 complete and independently testable.

---

## Phase 3: Polish & Cross-Cutting Concerns

- [ ] T014 Run `npm run db:seed` on a fresh database and verify the stdout matches the contract in `specs/009-demo-seeds-webhook-url/contracts/screens.md` — all 16 entity lines present, exits 0
- [ ] T015 Run `npm run db:seed` a second time and verify every line prints "skipped" — confirms idempotency (FR-015)
- [x] T016 Run `npm run lint` from repo root and confirm `src/db/seed.ts` introduces no ESLint errors
- [ ] T017 Log in as `demo@example.com` / `Password123!` — navigate to Pipelines, Jobs (check COMPLETED + FAILED mix), Teams, "GitHub Events" Security tab (signing secret Active), Account (2 API keys) — all pages show expected seeded data (SC-005)

---

## Dependencies & Execution Order

### Phase Dependencies

- **US1 (Phase 1)**: No dependencies — start immediately; touches only dashboard files
- **US2 (Phase 2)**: No dependencies — start immediately; touches only backend files + package.json
- **Polish (Phase 3)**: Depends on both US1 and US2 being complete

### User Story Dependencies

- **US1 and US2 are fully independent** — no shared files; can be worked in parallel

### ⚠️ Shared File Coordination

`dashboard/src/test/handlers.ts` (T004) and `dashboard/src/pages/PipelineDetailPage.tsx` (T001–T003) are both US1 files. T004 can run in parallel with T001–T003 since it touches a different file.

---

## Parallel Execution Examples

### US1 + US2 (run both stories simultaneously)

```
Parallel group A (independent stories):
  Developer A: T001 → T002 → T003  [PipelineDetailPage changes]
  Developer B: T005 → T006 → ... → T013  [seed.ts]

Parallel within US1:
  T004 (handlers.ts update) can run alongside T001–T003

Parallel within US2:
  T007, T008, T009, T010, T011 are all helpers in the same file —
  implement sequentially to avoid merge conflicts; each is a named function
```

---

## Implementation Strategy

### MVP First (US1 — 4 tasks, ~30 minutes)

1. Complete T001–T004 (PipelineDetailPage + handlers)
2. **STOP and VALIDATE**: Open pipeline detail → Webhook URL row visible → copy works
3. Ship / demo US1 immediately

### Full Feature (US1 + US2 — 17 tasks)

1. US1 first (T001–T004) — high-visibility, minimal work
2. US2 scaffold + helpers (T005–T012) — seed infrastructure
3. US2 wire-up (T013) — run the full seed
4. Polish (T014–T017) — idempotency + lint + demo walkthrough

---

## Notes

- [P] tasks = different files, no dependencies on each other
- US1 is pure frontend (dashboard only); US2 is pure backend (src/db only + package.json)
- No new API endpoints — `sourceUrl` already returned by existing pipeline endpoint
- No schema changes — seed uses all existing tables
- Seed uses `tsx/esm` loader (already a dev dependency via existing `db:migrate` pattern)
