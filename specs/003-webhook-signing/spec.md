# Feature Specification: Webhook Signature Verification

**Feature Branch**: `003-webhook-signing`
**Created**: 2026-03-21
**Status**: Draft
**Input**: User description: "Each pipeline owner can configure a webhook signing secret for their pipeline. When a webhook arrives at the ingestion endpoint, the platform verifies the request signature before processing it. Unverified requests are rejected immediately. The signing secret is managed by the pipeline owner (create, rotate, revoke) via the API. Signature verification should follow the HMAC-SHA256 pattern (similar to GitHub and Stripe webhooks) using a shared secret and a timestamp in the header to prevent replay attacks. Pipelines without a configured secret accept all incoming webhooks (opt-in enforcement). The feature should integrate with the existing per-user pipeline ownership model."

---

## Overview

Pipeline owners need confidence that incoming webhooks originate from trusted sources. This feature lets each owner attach a signing secret to their pipeline. Senders sign their requests using that secret; the platform verifies the signature before processing. Pipelines without a secret remain open (backwards-compatible). The design follows widely-adopted industry patterns (GitHub, Stripe) so existing sender tooling works with minimal configuration.

---

## User Scenarios & Testing

### User Story 1 — Enable Signature Verification on a Pipeline (Priority: P1)

A pipeline owner wants to ensure only authorised senders can trigger their pipeline. They generate a signing secret via the API, share it with the sending service, and from that point all unsigned or incorrectly signed requests to that pipeline are rejected before any processing occurs.

**Why this priority**: Core security value. Without this story the feature delivers nothing. Delivers a standalone, independently testable security boundary.

**Independent Test**: Owner calls the "generate secret" endpoint → receives the full secret once. Sends a correctly signed webhook → pipeline processes it. Sends an unsigned webhook to the same pipeline → rejected with 401.

**Acceptance Scenarios**:

1. **Given** a pipeline with no signing secret, **When** the owner generates a signing secret, **Then** the full secret value is returned once and only a masked hint is shown on subsequent reads.
2. **Given** a pipeline with a signing secret, **When** a correctly signed webhook arrives, **Then** the platform accepts and processes it normally.
3. **Given** a pipeline with a signing secret, **When** an unsigned webhook arrives, **Then** the platform rejects it with `401 Unauthorized` and does not enqueue any job.
4. **Given** a pipeline with a signing secret, **When** a webhook with an invalid or tampered signature arrives, **Then** the platform rejects it with `401 Unauthorized`.
5. **Given** a pipeline with **no** signing secret, **When** any webhook arrives (signed or unsigned), **Then** the platform accepts it as before (opt-in enforcement, zero regression).

---

### User Story 2 — Replay Attack Prevention via Timestamp Tolerance (Priority: P2)

A pipeline owner needs assurance that a captured valid request cannot be replayed hours or days later to trigger duplicate pipeline executions.

**Why this priority**: Without replay protection, signature verification alone is insufficient — a valid signed request can be captured and re-sent indefinitely.

**Independent Test**: Send a correctly signed request with a timestamp older than 5 minutes → rejected. Send an identical request with a fresh timestamp → accepted.

**Acceptance Scenarios**:

1. **Given** a signed webhook with a timestamp within the 5-minute tolerance window, **When** it arrives, **Then** the platform accepts it.
2. **Given** a signed webhook with a timestamp older than 5 minutes, **When** it arrives, **Then** the platform rejects it with `401 Unauthorized`.
3. **Given** a signed webhook with a timestamp more than 1 minute in the future, **When** it arrives, **Then** the platform rejects it (clock skew protection).
4. **Given** a signed webhook with a missing timestamp header at a pipeline that has a secret, **When** it arrives, **Then** the platform rejects it with `401 Unauthorized`.

---

### User Story 3 — Secret Rotation Without Downtime (Priority: P3)

A pipeline owner suspects their signing secret may have been compromised, or follows a regular rotation policy. They rotate the secret; the old secret is immediately invalidated and the new one takes over.

**Why this priority**: Rotation is a standard operational requirement for any long-lived credential. Enables security hygiene without removing the feature entirely.

**Independent Test**: Owner rotates the secret. Requests signed with the old secret are rejected. Requests signed with the new secret are accepted.

**Acceptance Scenarios**:

1. **Given** an existing signing secret, **When** the owner rotates it, **Then** a new secret is generated and returned once in full; the old secret is immediately invalidated.
2. **Given** a rotated secret, **When** a webhook arrives signed with the old secret, **Then** the platform rejects it with `401 Unauthorized`.
3. **Given** a rotated secret, **When** a webhook arrives signed with the new secret, **Then** the platform accepts and processes it.

---

### User Story 4 — Secret Revocation (Disable Verification) (Priority: P4)

A pipeline owner wants to remove signature verification from their pipeline entirely, reverting it to the open (accept-all) state for testing or decommissioning.

**Why this priority**: Owners must be able to undo the feature cleanly. Completes the full lifecycle of the signing secret.

**Independent Test**: Owner revokes the secret → pipeline returns to accept-all. Unsigned webhooks are subsequently accepted.

**Acceptance Scenarios**:

1. **Given** a pipeline with a signing secret, **When** the owner revokes it, **Then** the pipeline returns to the open (accept-all) state immediately.
2. **Given** a revoked secret, **When** an unsigned webhook arrives, **Then** the platform accepts and processes it.

---

### Edge Cases

- What if the signing secret is generated but the sender never uses it, and then an unsigned request arrives? → Reject; the presence of any active secret activates enforcement for that pipeline.
- What if two rotation requests are made in rapid succession? → Each generates a fresh secret; the immediately previous secret is invalidated on each rotation.
- What if a pipeline is deleted? → Its signing secret is removed with it; no orphaned credentials remain.
- What if a team member (non-owner) manages the signing secret for a team-owned pipeline? → Permitted, consistent with existing team permissions where members manage flows.
- What if the request body is empty? → Signature must still be validated; an empty body with a valid HMAC and fresh timestamp is accepted.
- What if the timestamp and signature headers are present but the timestamp value is not a valid number? → Reject with `401 Unauthorized`.

---

## Requirements

### Functional Requirements

- **FR-001**: The system MUST allow a pipeline owner (or team member with pipeline access) to generate a signing secret for any pipeline they have access to.
- **FR-002**: The system MUST return the full signing secret exactly once — at generation time — and never expose the full value again in any subsequent read or list response.
- **FR-003**: The system MUST display only a masked hint (first 6 characters followed by `...`) when listing or reading a pipeline's signing configuration after the initial creation.
- **FR-004**: When a pipeline has an active signing secret, the system MUST reject any incoming webhook that does not include a valid signature in the request headers.
- **FR-005**: The system MUST reject signed requests where the included timestamp is more than 5 minutes in the past.
- **FR-006**: The system MUST reject signed requests where the included timestamp is more than 1 minute in the future.
- **FR-007**: The system MUST reject signed requests that are missing the signature header, the timestamp header, or both.
- **FR-008**: The system MUST NOT enqueue any job for a webhook that fails signature or timestamp validation.
- **FR-009**: When a pipeline has no active signing secret, the system MUST accept all incoming webhooks without any signature check.
- **FR-010**: The system MUST allow a pipeline owner to rotate the signing secret; rotation immediately invalidates the previous secret with no overlap window.
- **FR-011**: The system MUST allow a pipeline owner to revoke the signing secret, returning the pipeline to the open (accept-all) state.
- **FR-012**: Rejected webhook requests MUST receive a `401 Unauthorized` response; the response body MUST NOT reveal whether the failure was due to a wrong signature, expired timestamp, or missing headers.
- **FR-013**: The signing secret MUST be stored such that the full plaintext value is not recoverable after the creation response (stored hashed or encrypted at rest).
- **FR-014**: A failed signature verification MUST be recorded as a security audit event associated with the pipeline.

### Key Entities

- **Pipeline Signing Secret**: A credential scoped to a single pipeline. Attributes: pipeline reference, secret hint (display only, non-sensitive), active/revoked status, creation timestamp. The full secret value is never stored in recoverable form after creation.
- **Webhook Signature Headers**: Two sender-supplied request headers — one carrying the HMAC-SHA256 digest (computed over the raw request body + timestamp), one carrying the Unix timestamp used in that computation.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of webhooks with an invalid signature or expired/missing timestamp are rejected before any job is enqueued, with zero false negatives.
- **SC-002**: 0% of valid, correctly signed, in-window webhooks are rejected under normal clock conditions (zero false positives).
- **SC-003**: A pipeline owner can generate, rotate, or revoke a signing secret in under 30 seconds via the API.
- **SC-004**: Pipelines without a configured secret continue to accept 100% of incoming webhooks with no change in behaviour (zero regression for existing pipelines).
- **SC-005**: The full secret value is never retrievable after the initial creation response — confirmed by reading the signing config after creation and receiving only the masked hint.
- **SC-006**: 100% of replayed requests (timestamp > 5 minutes old) are rejected regardless of signature validity.

---

## Assumptions

- The timestamp tolerance window is fixed at ±5 minutes (future tolerance: 1 minute). This matches Stripe and GitHub defaults and is not configurable per-pipeline in this release.
- Senders are expected to include two headers: `X-Webhook-Signature` (HMAC-SHA256 hex digest of `timestamp.rawBody`) and `X-Webhook-Timestamp` (Unix seconds as a string).
- Each pipeline has at most one active signing secret at any point in time. Rotation is an immediate switchover (no dual-secret grace period).
- Team members with pipeline access (as per the existing ownership model) may manage signing secrets for team-owned pipelines.
- The existing audit event infrastructure (introduced in feature 002) is used to record `SIGNATURE_FAILED` events.
- Senders who currently send webhooks to pipelines without a secret are unaffected until the pipeline owner explicitly generates a secret.

---

## Out of Scope

- Per-pipeline configurable timestamp tolerance windows.
- A dual-secret grace period during rotation where both old and new secrets are accepted simultaneously.
- Signed responses from the platform back to the sender.
- Webhook delivery retries triggered by signature failures.
- A UI for managing signing secrets (API only for this release).
