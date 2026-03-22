# Research: Webhook Signature Verification

**Feature**: 003-webhook-signing
**Date**: 2026-03-21

---

## Decision 1: Signature Header Format

**Decision**: Use two headers — `X-Webhook-Signature: sha256=<hex-digest>` and `X-Webhook-Timestamp: <unix-seconds-string>`

**Rationale**: This mirrors GitHub and Stripe exactly. The `sha256=` prefix in the signature header makes the algorithm explicit and forwards-compatible (if SHA-512 is ever needed, a new prefix can be introduced). Separating the timestamp into its own header makes it trivial to parse and validate without splitting the signature string.

**Alternatives considered**:
- Single header with `t=<timestamp>,v1=<signature>` (Stripe format with comma-separated parts) — equally valid, but the two-header approach is simpler to parse and document.
- JWT-based signing — rejected; JWTs carry a payload which is redundant when the entire body is already the payload.

---

## Decision 2: Signature Computation Formula

**Decision**: `HMAC-SHA256(rawSecret, "${timestamp}.${rawBody}")` where `timestamp` is the value from `X-Webhook-Timestamp` and `rawBody` is the raw request body as a UTF-8 string. The digest is hex-encoded.

**Rationale**: Binding the timestamp to the signed payload prevents an attacker from re-signing a new timestamp against an old captured body. This is the same approach Stripe uses. Using `node:crypto`'s `createHmac` keeps the dependency footprint at zero.

**Alternatives considered**:
- Signing only the body (no timestamp in the signed string) — rejected; allows replay by simply re-sending the valid signature with a new timestamp.
- Including additional headers in the signed string — rejected; adds complexity without proportionate security benefit for this use case.

---

## Decision 3: Secret Storage

**Decision**: Store a SHA-256 hash of the raw secret in the DB. The raw secret is returned once at generation time and never persisted. Display only the first 6 characters as a hint.

**Rationale**: The signing secret is a high-entropy random value (~32 bytes from `node:crypto.randomBytes`). SHA-256 is collision-resistant and fast enough for a single lookup per request; argon2id would be unnecessarily slow. This mirrors the API key storage pattern already established in the codebase (`src/lib/api-key.ts`).

**Alternatives considered**:
- Symmetric encryption (AES-256) to allow secret recovery — rejected; recovery is not a requirement and adds key management complexity.
- Argon2id — rejected; too slow for synchronous per-request verification and unnecessary for a 32-byte random secret.

---

## Decision 4: Timestamp Tolerance Window

**Decision**: Reject requests where `|now - timestamp| > 5 minutes`. Additionally reject if `timestamp > now + 60 seconds` (future tolerance = 1 minute).

**Rationale**: Five minutes is the industry standard (Stripe, GitHub). One minute of future tolerance accommodates minor clock skew without allowing meaningful forward-dated replay.

**Alternatives considered**:
- 30-second window — tighter security but increases false-positive rejection on slow networks.
- Configurable per-pipeline — deferred to a future release; adds significant schema and UI complexity.

---

## Decision 5: One Active Secret Per Pipeline (No Dual-Window Rotation)

**Decision**: Each pipeline has at most one active signing secret. Rotation immediately invalidates the old secret.

**Rationale**: Dual-window rotation (both old and new accepted simultaneously) adds DB complexity (store two secrets, expiry logic) and is out of scope per the feature spec. Operators who need zero-downtime rotation can coordinate a brief overlap by deploying the new secret to senders before rotating — a process-level solution, not a platform-level one.

**Alternatives considered**:
- Storing last-N secrets with overlap TTL — rejected; out of scope, adds schema complexity.

---

## Decision 6: Integration Point

**Decision**: Signature verification is performed inside `ingestWebhook()` in `src/services/ingestion.service.ts`, before the job is inserted into the DB. The raw body string is already passed into this function, making the integration clean.

**Rationale**: Performing verification as the first step of ingestion ensures that no DB write occurs for rejected requests, satisfying FR-008 (no job enqueued on failure). The existing function signature `ingestWebhook(sourceId, rawBody)` needs to be extended to also accept the signature and timestamp headers.

**Alternatives considered**:
- Express middleware — rejected; the middleware would need to look up the pipeline signing secret (a DB call), which duplicates the pipeline lookup already in `ingestWebhook`. Putting it in the service keeps the logic co-located.

---

## Decision 7: New Audit Event Type

**Decision**: Add `SIGNATURE_FAILED` to the existing `auditEventTypeEnum` in `src/db/schema.ts` and emit it on every failed signature verification (fire-and-forget, like the existing `AUTH_FAILED` event).

**Rationale**: Consistent with the existing audit logging pattern. The event records the `pipelineId` and `sourceId` in metadata so failed attempts can be correlated to a specific pipeline without storing the invalid payload.

---

## Decision 8: Secret Generation Utility

**Decision**: Reuse the existing pattern from `src/lib/api-key.ts` — `randomBytes(32).toString('base64url')` — for secret generation. The secret will have the prefix `whsec_` to be recognisable in sender configurations.

**Rationale**: Consistent with the existing API key utility. 32 random bytes = 256 bits of entropy, far beyond any brute-force threshold. The `base64url` encoding avoids `+`, `/`, `=` characters that cause issues in config files.

---

## Decision 9: API Route Design

**Decision**: Mount signing secret management under the existing pipeline routes:
- `POST /pipelines/:id/signing-secret` — generate (first time) or rotate (if one already exists); returns the full secret once
- `DELETE /pipelines/:id/signing-secret` — revoke (clears the secret; pipeline becomes open)
- `GET /pipelines/:id/signing-secret` — returns status and hint only (never the full secret)

All three routes are protected by the existing `authenticate` middleware and ownership checks.

**Rationale**: Scoping under `/pipelines/:id` is natural — the signing secret is an attribute of a pipeline. Keeping generate and rotate as a single `POST` simplifies the API (clients don't need to know whether a secret already exists).
