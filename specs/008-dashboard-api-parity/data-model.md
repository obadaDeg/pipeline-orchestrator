# Data Model: Dashboard API Parity & Bug Fixes

**Feature**: 008-dashboard-api-parity
**Date**: 2026-03-23

No new database tables or columns are introduced by this feature. All entities below already exist. This document clarifies the full shape of each entity as consumed by the dashboard.

---

## Entities

### Job

The record of a single webhook delivery event. Created when a webhook arrives at a pipeline source URL.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `pipelineId` | UUID | FK → pipelines.id |
| `status` | enum | `PENDING` \| `PROCESSING` \| `COMPLETED` \| `FAILED` |
| `rawPayload` | JSONB | Original webhook body (not exposed in list responses) |
| `processedPayload` | JSONB | Output of the action transformer (not in list) |
| `errorMessage` | string \| null | Set on FAILED status |
| `createdAt` | timestamp | When the job was created |
| `updatedAt` | timestamp | Last status change |

**State machine**:
```
PENDING → PROCESSING → COMPLETED
                     ↘ FAILED
```

**List projection** (used by `GET /jobs` and `GET /pipelines/:id/jobs`): `id`, `pipelineId`, `status`, `createdAt`. Full fields only on `GET /jobs/:id`.

---

### DeliveryAttempt

One HTTP dispatch attempt for a job to a subscriber URL. A job may have many delivery attempts across retries.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `jobId` | UUID | FK → jobs.id |
| `subscriberId` | UUID \| null | FK → subscribers (if configured) |
| `subscriberUrl` | string | Actual URL POSTed to |
| `httpStatus` | integer \| null | HTTP response code, null if network error |
| `responseSnippet` | string \| null | First N bytes of subscriber response body |
| `attemptNumber` | integer | 1-based, increments on retry |
| `outcome` | enum | `SUCCESS` \| `FAILED` |
| `attemptedAt` | timestamp | When this attempt was made |

**Pagination note**: The `GET /jobs/:id/delivery-attempts` endpoint previously returned all attempts with no pagination. After this fix it returns `{ items, total, page, limit }` using `?page` and `?limit` query parameters (default limit: 50, max: 100).

---

### Pipeline

The core configuration entity. Defines a webhook ingestion source, transformation action, and subscriber delivery targets.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | string | Human-readable label (editable) |
| `description` | string \| null | Optional description (editable) |
| `sourceId` | UUID | The unique webhook reception identifier |
| `actionType` | enum | `field_extractor` \| `payload_filter` \| `http_enricher` |
| `actionConfig` | JSONB | Configuration for the action type |
| `ownerUserId` | UUID \| null | The creating user (null if team-owned) |
| `ownerTeamId` | UUID \| null | Owning team (null if user-owned) |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

**Editable fields** (via `PATCH /pipelines/:id`): `name`, `description` only. `ownerTeamId`, `actionType`, `actionConfig` are out of scope for this feature.

---

### SigningSecret

The HMAC-SHA256 signing configuration for a pipeline. At most one active signing secret exists per pipeline at any time.

| Field | Type | Notes |
|---|---|---|
| `pipelineId` | UUID | FK → pipelines.id (composite PK or unique constraint) |
| `hint` | string | First 6 characters of the raw secret (for identification) |
| `createdAt` | timestamp | When current secret was generated or last rotated |

**Raw secret**: Never stored. The backend stores only the HMAC hash for signature verification. The raw value is returned exactly once — in the `POST /pipelines/:id/signing-secret` response — and must be treated as a one-time reveal.

**Status transitions**:
```
none → active (POST - generate)
active → active (POST - rotate; old hash replaced atomically)
active → none (DELETE - revoke)
```

---

### Team

A named group of users that can collectively own pipelines.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | string | Team display name |
| `ownerUserId` | UUID | FK → users.id; the creating user |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

---

### TeamMembership

The association between a user and a team. The team owner is NOT stored as a membership row — ownership is tracked on the `teams` table.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `teamId` | UUID | FK → teams.id |
| `userId` | UUID | FK → users.id |
| `addedAt` | timestamp | When the member was added |

**Access rules**: Only the team owner can add or remove members. Team members can view team-owned pipelines.

---

### User

The registered account entity.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `email` | string | Unique; used for login and member lookup |
| `passwordHash` | string | Never exposed via API |
| `createdAt` | timestamp | |

---

### ApiKey

An authentication credential issued to a user. Multiple keys per user are supported.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `userId` | UUID | FK → users.id |
| `name` | string | Display label (e.g., "Default") |
| `keyPrefix` | string | First 8 characters of the raw key (for identification) |
| `keyHash` | string | HMAC hash; raw key never stored after creation |
| `createdAt` | timestamp | |
| `lastUsedAt` | timestamp \| null | Updated on each authenticated request |

**Registration**: A "Default" key is auto-created on `POST /auth/register`. The raw key is returned once in the registration response.

---

### AuditEvent

An immutable log entry recording security-relevant actions.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `userId` | UUID | FK → users.id |
| `eventType` | enum | e.g., `LOGIN`, `API_KEY_CREATED`, `SIGNATURE_FAILED`, etc. |
| `metadata` | JSONB | Event-specific context (IP, key name, etc.) |
| `createdAt` | timestamp | |

---

## Entity Relationships

```
User ─────────────────────── owns 0..N ApiKey
User ─────────────────────── owns 0..N AuditEvent
User ─────────────────────── owns 0..N Pipeline (ownerUserId)
User ─────────────────────── owns 0..N Team (ownerUserId)
User ─────────── through TeamMembership ─── member of 0..N Team
Team ──────────────────────── owns 0..N Pipeline (ownerTeamId)
Pipeline ─────────────────── has 0..1 SigningSecret
Pipeline ─────────────────── has 0..N Job
Job ───────────────────────── has 0..N DeliveryAttempt
```

---

## No Schema Changes

This feature introduces no new database tables, columns, or migrations. All required backend changes are confined to:

1. Adding a new `GET /jobs` route and controller (queries existing `jobs` + `pipelines` tables).
2. Updating the `getDeliveryAttempts` service method to accept and apply pagination parameters.
3. Adding a new `GET /teams` route and controller (queries existing `teams` + `team_memberships` tables).
