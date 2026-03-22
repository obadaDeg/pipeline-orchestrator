# Implementation Plan: Webhook Signature Verification

**Branch**: `003-webhook-signing` | **Date**: 2026-03-21 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-webhook-signing/spec.md`

---

## Summary

Per-pipeline HMAC-SHA256 webhook signature verification (opt-in). Pipeline owners generate a signing secret via the management API; the ingestion service verifies the signature and timestamp on every incoming webhook before enqueuing any job. Pipelines without a secret remain open. Secrets are stored hashed; full value returned once at creation. Rotation and revocation are supported. Failed verifications emit a `SIGNATURE_FAILED` audit event.

---

## Technical Context

**Language/Version**: TypeScript 5.4, Node.js 20 LTS
**Primary Dependencies**: Express 4.x, Drizzle ORM 0.30, Zod 3.x, `node:crypto` (HMAC-SHA256, randomBytes — zero new dependencies)
**Storage**: PostgreSQL — new table `pipeline_signing_secrets`; enum value `SIGNATURE_FAILED` added to existing `audit_event_type`
**Testing**: Vitest — unit tests for signing service + middleware, integration test for full sign→ingest flow
**Target Platform**: Linux server (Docker)
**Project Type**: Web service (REST API + async worker)
**Performance Goals**: Signature verification adds one indexed DB lookup per ingestion request; p95 ingestion target of 200ms (Constitution IX) is preserved
**Constraints**: No new npm dependencies; reuse `node:crypto` already available in Node.js 20
**Scale/Scope**: One active secret per pipeline; single-instance load

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Asynchronous Processing | ✅ PASS | Signature check happens before job insert; 202 still returned for valid requests. Rejected requests return 401 before any job is written — correct behaviour. |
| II. Reliability & Retry | ✅ PASS | No changes to job state machine or delivery engine. |
| III. Clean Separation of Concerns | ✅ PASS | Verification logic lives in `signing.service.ts` (new). Ingestion service calls the signing service as a pre-check — no bypass of broker or delivery contract. |
| IV. TypeScript Type Safety | ✅ PASS | All new code in strict TypeScript. `any` prohibited. New types: `SigningVerificationResult`, `GeneratedSecret`. |
| V. Infrastructure Reproducibility | ✅ PASS | New migration added to `drizzle/`. No new external services. `docker compose up` still fully functional. |
| VI. Code Quality Standards | ✅ PASS | Tolerance constants extracted (`TIMESTAMP_TOLERANCE_MS`, `FUTURE_TOLERANCE_MS`). Functions ≤40 lines. No dead code. |
| VII. Testing Standards | ✅ PASS | Unit tests: signing service (generate, verify, rotate, revoke). Integration test: sign→ingest accepted; unsigned→ingest rejected. |
| VIII. API Consistency | ✅ PASS | All responses use `{ data }` / `{ error }` envelope. `201` for secret creation, `204` for revocation, `401` for verification failure. |
| IX. Performance Requirements | ✅ PASS | Signing secret lookup is a single indexed query on `pipeline_id`. No additional round-trips for unsigned pipelines (early return on null). |

**Complexity Tracking**: No violations. No additional complexity justified.

---

## Project Structure

### Documentation (this feature)

```text
specs/003-webhook-signing/
├── plan.md              ← this file
├── research.md          ← 9 architectural decisions
├── data-model.md        ← pipeline_signing_secrets table + SIGNATURE_FAILED event
├── quickstart.md        ← 4 integration scenarios
├── contracts/
│   └── signing.yaml     ← OpenAPI 3.1 for signing secret endpoints + updated /webhook
└── checklists/
    └── requirements.md  ← quality checklist (all pass)
```

### Source Code Changes

```text
src/
├── db/
│   └── schema.ts                              MODIFY — add pipeline_signing_secrets table + SIGNATURE_FAILED enum value
├── lib/
│   └── signing-secret.ts                      NEW — generateSigningSecret(), hashSecret(), verifySignature()
├── services/
│   ├── signing.service.ts                     NEW — createSecret(), rotateSecret(), revokeSecret(), getSecretStatus(), verifyWebhookSignature()
│   └── ingestion.service.ts                   MODIFY — accept signature headers, call verifyWebhookSignature() before job insert
├── api/
│   ├── schemas/
│   │   └── signing.schema.ts                  NEW — (empty body for POST; no request body needed)
│   ├── controllers/
│   │   └── signing.controller.ts              NEW — generateOrRotateHandler, revokeHandler, getStatusHandler
│   └── routes/
│       └── pipelines.router.ts                MODIFY — add signing-secret sub-routes under /:id
└── api/controllers/
    └── webhooks.controller.ts                 MODIFY — forward X-Webhook-Signature + X-Webhook-Timestamp to ingestion service

drizzle/
└── 0002_<auto>.sql                            NEW — migration for pipeline_signing_secrets table + enum value

tests/
├── unit/
│   └── signing/
│       ├── signing-secret.test.ts             NEW — generateSigningSecret, hashSecret, verifySignature unit tests
│       └── signing-service.test.ts            NEW — createSecret, rotateSecret, revokeSecret, getSecretStatus unit tests
└── integration/
    └── webhook-signing-flow.test.ts           NEW — end-to-end: generate secret → signed ingest accepted → unsigned ingest rejected → replay rejected → rotate → revoked key rejected
```

---

## Implementation Phases

### Phase 1 — Schema & Crypto Foundation (T001–T007)

- Add `pipeline_signing_secrets` table to `schema.ts`
- Add `SIGNATURE_FAILED` to `audit_event_type` enum in `schema.ts`
- Generate and apply Drizzle migration
- Create `src/lib/signing-secret.ts` with `generateSigningSecret()`, `hashSecret()`, `verifySignature()`
- Unit tests for the crypto utilities

### Phase 2 — Signing Service (T008–T013)

- Create `src/services/signing.service.ts`: `createOrRotateSecret()`, `revokeSecret()`, `getSecretStatus()`, `verifyWebhookSignature()`
- Unit tests for the service layer

### Phase 3 — Ingestion Integration (T014–T016)

- Modify `ingestWebhook()` signature to accept `signatureHeader` and `timestampHeader` (optional)
- Inside `ingestWebhook()`: look up active signing secret; if present, call `verifyWebhookSignature()` — throw `UnauthorizedError` on failure (fire-and-forget `SIGNATURE_FAILED` audit event)
- Modify `webhooks.controller.ts` to extract and forward the two headers

### Phase 4 — Management API (T017–T022)

- Create `src/api/controllers/signing.controller.ts`
- Add `POST /pipelines/:id/signing-secret`, `DELETE /pipelines/:id/signing-secret`, `GET /pipelines/:id/signing-secret` to `pipelines.router.ts`
- All three routes use existing `authenticate` middleware + ownership check

### Phase 5 — Integration Tests & Polish (T023–T028)

- Integration test: full sign→ingest flow (accepted, unsigned rejected, replay rejected, rotate, old key rejected)
- Verify `npm test && npm run lint` passes clean
- Update `README.md` with signing secret usage section
