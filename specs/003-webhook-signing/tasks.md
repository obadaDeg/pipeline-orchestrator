# Tasks: Webhook Signature Verification

**Input**: Design documents from `/specs/003-webhook-signing/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/signing.yaml ✅, quickstart.md ✅

**Tests**: Included — unit tests per phase, one end-to-end integration test in Polish phase.

**Organization**: Tasks grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Foundation (Blocking Prerequisites)

**Purpose**: DB schema, migration, and crypto utility required by all user stories.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T001 Add `pipeline_signing_secrets` table to `src/db/schema.ts` (columns: id, pipeline_id UNIQUE FK, secret_hash, secret_hint, revoked_at, created_at; index on pipeline_id)
- [X] T002 Add `SIGNATURE_FAILED` value to `auditEventTypeEnum` in `src/db/schema.ts`
- [X] T003 Generate Drizzle migration with `npx drizzle-kit generate` and apply it with `npm run db:migrate`
- [X] T004 Create `src/lib/signing-secret.ts` — export `generateSigningSecret()` (returns `{ secret, secretHash, secretHint }`), `hashSecret(raw: string): string` (SHA-256 hex), `verifyHmac(secret: string, timestamp: string, rawBody: string, signature: string): boolean`

**Checkpoint**: Schema applied, crypto utilities available.

---

## Phase 2: User Story 1 — Enable Signature Verification on a Pipeline (Priority: P1) 🎯 MVP

**Goal**: Pipeline owners can generate a signing secret via the API; the ingestion endpoint enforces the signature for all pipelines that have one. Pipelines without a secret remain open.

**Independent Test**: `POST /pipelines/:id/signing-secret` returns the full secret once. `POST /webhook/:sourceId` with a valid signature is accepted (202). The same endpoint with no signature headers returns 401. A pipeline with no secret continues to return 202 for unsigned webhooks.

- [X] T005 [US1] Create `src/services/signing.service.ts` — export `createOrRotateSecret(pipelineId: string): Promise<{ secret: string; hint: string; createdAt: Date }>` (deletes any existing row, inserts new one) and `getSecretStatus(pipelineId: string): Promise<{ active: boolean; hint: string | null; createdAt: Date | null }>`
- [X] T006 [US1] Add `verifyWebhookSignature(pipelineId: string, signatureHeader: string | undefined, timestampHeader: string | undefined, rawBody: string): Promise<void>` to `src/services/signing.service.ts` — looks up active secret; if none, returns immediately; if present, validates headers and HMAC (throws `UnauthorizedError` on failure)
- [X] T007 [US1] Update `ingestWebhook(sourceId, rawBody, signatureHeader?, timestampHeader?)` in `src/services/ingestion.service.ts` — call `verifyWebhookSignature()` immediately after pipeline lookup, before any DB write
- [X] T008 [US1] Update `src/api/controllers/webhooks.controller.ts` to extract `X-Webhook-Signature` and `X-Webhook-Timestamp` request headers and pass them to `ingestWebhook()`
- [X] T009 [P] [US1] Create `src/api/controllers/signing.controller.ts` — export `generateOrRotateHandler` (calls `createOrRotateSecret`, returns 201 `{ data: { secret, hint, createdAt } }`) and `getStatusHandler` (calls `getSecretStatus`, returns 200 `{ data: { active, hint, createdAt } }`)
- [X] T010 [US1] Add `POST /pipelines/:id/signing-secret` and `GET /pipelines/:id/signing-secret` routes to `src/api/routes/pipelines.router.ts` — both protected by `authenticate` middleware and pipeline ownership check (404 for non-owner, consistent with existing pipeline routes)
- [X] T011 [P] [US1] Write unit tests in `tests/unit/signing/signing-secret.test.ts` — `generateSigningSecret` format and uniqueness, `hashSecret` determinism, `verifyHmac` accepts valid, rejects tampered body, rejects tampered timestamp
- [X] T012 [P] [US1] Write unit tests in `tests/unit/signing/signing-service.test.ts` — `createOrRotateSecret` creates row and returns full secret once, `getSecretStatus` returns active=true with hint, getSecretStatus returns active=false when no row, `verifyWebhookSignature` passes for valid signature, throws for invalid signature, passes (no-op) when no secret configured

**Checkpoint**: US1 fully functional — secret generation, enforcement on ingestion, open pipeline behaviour unchanged.

---

## Phase 3: User Story 2 — Replay Attack Prevention via Timestamp Tolerance (Priority: P2)

**Goal**: Requests with a timestamp older than 5 minutes or more than 1 minute in the future are rejected, even if the signature is cryptographically valid.

**Independent Test**: Send a correctly signed request with a timestamp 6 minutes in the past → 401. Send the same request with a fresh timestamp → 202. Send with a timestamp 2 minutes in the future → 401.

- [X] T013 [US2] Extract `TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000` and `FUTURE_TOLERANCE_MS = 60 * 1000` as named constants in `src/lib/signing-secret.ts`
- [X] T014 [US2] Add timestamp validation inside `verifyWebhookSignature()` in `src/services/signing.service.ts` — parse timestamp header as integer (reject if NaN), reject if `|Date.now() - timestampMs| > TIMESTAMP_TOLERANCE_MS`, reject if `timestampMs > Date.now() + FUTURE_TOLERANCE_MS`
- [X] T015 [P] [US2] Extend `tests/unit/signing/signing-service.test.ts` — timestamp missing → throws, timestamp NaN → throws, timestamp > 5 min past → throws, timestamp 1 sec past → passes, timestamp > 1 min future → throws, timestamp 30 sec future → passes

**Checkpoint**: US2 complete — replay attacks via stale timestamps are rejected.

---

## Phase 4: User Story 3 — Secret Rotation Without Downtime (Priority: P3)

**Goal**: Calling `POST /pipelines/:id/signing-secret` on a pipeline that already has an active secret generates a new secret and immediately invalidates the old one.

**Independent Test**: Generate a secret, sign and send a webhook → 202. Call `POST /signing-secret` again (rotate). Send a webhook signed with the old secret → 401. Send a webhook signed with the new secret → 202.

- [X] T016 [US3] Confirm `createOrRotateSecret()` in `src/services/signing.service.ts` uses `DELETE WHERE pipeline_id = :id` before `INSERT` (not an upsert that leaves the old hash in place) — update if needed
- [X] T017 [P] [US3] Extend `tests/unit/signing/signing-service.test.ts` — call `createOrRotateSecret` twice for same pipeline; assert second call returns a different secret; assert first secret hash no longer exists in DB (or mock verifies delete was called)

**Checkpoint**: US3 complete — rotation immediately invalidates the previous secret.

---

## Phase 5: User Story 4 — Secret Revocation / Disable Verification (Priority: P4)

**Goal**: `DELETE /pipelines/:id/signing-secret` removes the secret; the pipeline reverts to open (accept-all) mode immediately.

**Independent Test**: Generate a secret. `DELETE /signing-secret` → 204. Send unsigned webhook → 202.

- [X] T018 [US4] Add `revokeSecret(pipelineId: string): Promise<void>` to `src/services/signing.service.ts` — deletes the `pipeline_signing_secrets` row; throws `UnprocessableEntityError` (422) if no active secret exists
- [X] T019 [P] [US4] Add `revokeHandler` to `src/api/controllers/signing.controller.ts` — calls `revokeSecret()`, returns 204 on success; error handler surfaces 422 if no secret
- [X] T020 [US4] Add `DELETE /pipelines/:id/signing-secret` route to `src/api/routes/pipelines.router.ts` — protected by `authenticate` + ownership check
- [X] T021 [P] [US4] Extend `tests/unit/signing/signing-service.test.ts` — `revokeSecret` deletes row; subsequent `getSecretStatus` returns active=false; `revokeSecret` with no secret throws 422; `verifyWebhookSignature` after revocation is a no-op (passes unsigned requests)

**Checkpoint**: US4 complete — full secret lifecycle (generate → rotate → revoke) operational.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Audit trail, end-to-end integration test, lint/typecheck, README.

- [X] T022 Add fire-and-forget `SIGNATURE_FAILED` audit event emission inside `verifyWebhookSignature()` in `src/services/signing.service.ts` — call `emitAuditEvent({ userId: null, eventType: 'SIGNATURE_FAILED', metadata: { pipelineId, reason } })` wrapped in `.catch(() => {})` to avoid blocking ingestion
- [X] T023 Write integration test in `tests/integration/webhook-signing-flow.test.ts` — register user, create pipeline, generate secret, send signed webhook → 202, send unsigned webhook → 401, send request with expired timestamp → 401, rotate secret, send webhook with old secret → 401, send webhook with new secret → 202, revoke secret, send unsigned → 202
- [X] T024 Run `npm test && npm run lint` — resolve all type errors, lint violations, and test failures
- [X] T025 Update `README.md` — add "Webhook Signature Verification" section covering: what it is, how to generate a secret, the signing algorithm (`sha256=HMAC(secret, "${timestamp}.${body}")`), Node.js sender example, and rotation/revocation instructions

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundation)**: No dependencies — start immediately
- **Phase 2 (US1)**: Depends on Phase 1 completion — BLOCKS all user stories
- **Phase 3 (US2)**: Depends on Phase 2 — builds on `verifyWebhookSignature()` already created
- **Phase 4 (US3)**: Depends on Phase 2 — confirms rotation behaviour of `createOrRotateSecret()`
- **Phase 5 (US4)**: Depends on Phase 2 — adds `revokeSecret()` to the signing service
- **Phase 6 (Polish)**: Depends on Phases 2–5 completion

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 1 only
- **US2 (P2)**: Depends on US1 (`verifyWebhookSignature()` must exist)
- **US3 (P3)**: Depends on US1 (`createOrRotateSecret()` must exist); independent of US2
- **US4 (P4)**: Depends on US1 (signing service must exist); independent of US2/US3

Phases 3–5 can proceed in parallel once Phase 2 is complete.

### Parallel Opportunities

- T011 and T012 (unit tests) can run in parallel with T009 (controller) — different files
- T015 (US2 tests) can run in parallel once T014 is implemented
- T017 (US3 tests) and T021 (US4 tests) can run in parallel — different test describe blocks
- T019 (controller revokeHandler) and T021 (tests) can run in parallel — different files

---

## Parallel Example: US1

```bash
# After T005–T008 are done, these can run in parallel:
Task T009: Create signing.controller.ts (generateOrRotateHandler, getStatusHandler)
Task T011: Write signing-secret.test.ts unit tests
Task T012: Write signing-service.test.ts unit tests
```

---

## Implementation Strategy

### MVP First (US1 Only — Phases 1–2)

1. Complete Phase 1: Foundation (schema + migration + crypto lib)
2. Complete Phase 2: US1 (service + ingestion integration + management endpoints)
3. **STOP and VALIDATE**: Generate secret, send signed webhook (202), send unsigned webhook (401)
4. Pipeline without secret still returns 202 → zero regression confirmed

### Incremental Delivery

1. Foundation → US1 → demo: "pipelines can require signed webhooks"
2. Add US2 → demo: "stale/replayed requests are rejected"
3. Add US3 → demo: "secrets can be rotated immediately"
4. Add US4 → demo: "verification can be disabled (revoked)"
5. Polish → full audit trail + integration test + README

---

## Notes

- [P] tasks = different files, no cross-task data dependencies
- [Story] label maps each task to its user story for traceability
- `verifyWebhookSignature()` is the central function shared by US1 and US2 — implement US1's structural skeleton first, then add timestamp logic in US2
- `createOrRotateSecret()` covers both US1 (first-time generate) and US3 (rotation) — US3's phase confirms the DELETE+INSERT behaviour explicitly
- Commit after each phase checkpoint
