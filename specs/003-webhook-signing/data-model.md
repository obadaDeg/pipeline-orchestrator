# Data Model: Webhook Signature Verification

**Feature**: 003-webhook-signing
**Date**: 2026-03-21

---

## New Table: `pipeline_signing_secrets`

Stores the signing secret configuration for each pipeline. At most one active row per pipeline.

| Column        | Type                     | Constraints                          | Notes |
|---------------|--------------------------|--------------------------------------|-------|
| `id`          | UUID                     | PK, default `gen_random_uuid()`      | |
| `pipeline_id` | UUID                     | NOT NULL, FK → `pipelines.id` CASCADE, UNIQUE | One active secret per pipeline |
| `secret_hash` | TEXT                     | NOT NULL                             | SHA-256 hex of raw secret. Never the raw value. |
| `secret_hint` | TEXT                     | NOT NULL                             | First 6 chars of raw secret (e.g. `whsec_`) |
| `revoked_at`  | TIMESTAMP WITH TIME ZONE | NULL                                 | NULL = active. Non-null = revoked. |
| `created_at`  | TIMESTAMP WITH TIME ZONE | NOT NULL, default `NOW()`            | |

**Indexes**:
- `UNIQUE idx_pipeline_signing_secrets_pipeline_id` on `(pipeline_id)` — enforces one-secret-per-pipeline and enables fast lookup during ingestion.

**Rotation behaviour**: Rotation is implemented as a DELETE + INSERT (or full row replacement via upsert on `pipeline_id`). The previous row is deleted; a new row is inserted with the new hash. This avoids storing revoked secrets indefinitely and keeps the lookup simple.

**Revocation behaviour**: `revoked_at` is set to `NOW()`. The ingestion service checks `revoked_at IS NULL` when looking up the active secret.

---

## Modified Table: `audit_events`

**Change**: Add `SIGNATURE_FAILED` to the `audit_event_type` enum.

| New Enum Value     | When emitted                                        |
|--------------------|-----------------------------------------------------|
| `SIGNATURE_FAILED` | Every time a webhook is rejected due to invalid signature, expired/missing timestamp, or missing headers |

**Metadata shape for `SIGNATURE_FAILED`**:
```json
{
  "pipelineId": "<uuid>",
  "sourceId": "<uuid>",
  "reason": "MISSING_HEADERS | INVALID_SIGNATURE | TIMESTAMP_EXPIRED | TIMESTAMP_FUTURE"
}
```

Note: `userId` on the audit event will be `NULL` for `SIGNATURE_FAILED` events — the sender is not an authenticated platform user.

---

## Unchanged Tables

The following existing tables require no structural changes:

- `pipelines` — the signing secret is a separate child entity; no column is added to `pipelines`.
- `jobs` — ingestion is rejected before any job row is written; no change needed.
- `users`, `api_keys`, `teams`, `team_memberships` — unaffected.

---

## Entity Relationships

```
pipelines (1) ──────── (0..1) pipeline_signing_secrets
```

A pipeline may have zero or one active signing secret (UNIQUE FK). When the secret is revoked, the row's `revoked_at` is set; during rotation, the old row is replaced by a new one.

---

## Secret Lifecycle State Machine

```
[No Secret]
    │  POST /pipelines/:id/signing-secret
    ▼
[Active Secret] ──────── POST /pipelines/:id/signing-secret (rotate)
    │                         │
    │                         ▼
    │                   [New Active Secret]
    │
    │  DELETE /pipelines/:id/signing-secret
    ▼
[No Secret]  (row deleted or revoked_at set)
```

For simplicity the implementation will DELETE the old row and INSERT a new one on rotation, keeping the table clean. Revocation will DELETE the row entirely (pipeline reverts to open/accept-all state).
