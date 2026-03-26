# Data Model: Webhook Simulator

**Feature**: 014-webhook-simulator
**Date**: 2026-03-26

---

## No New Database Entities

This feature introduces **no new database tables, columns, or migrations**.

The simulator is a development-tooling layer that reuses the existing ingest pipeline end-to-end. The only persistent artefact produced by a simulation run is a standard `Job` record — identical to one created by a real external webhook.

---

## Existing Entities Referenced

### Job (existing — `jobs` table)

A simulation fire creates a `Job` record via the existing `ingestWebhook()` call. The returned `jobId` is surfaced in the simulator UI.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID (PK) | Returned to the client as `jobId` |
| `pipelineId` | UUID (FK) | Links to the pipeline under test |
| `sourceId` | UUID (FK) | Pipeline's `sourceId` from the `pipelineSources` table |
| `status` | enum | `PENDING → PROCESSING → COMPLETED / FAILED` |
| `rawPayload` | JSONB | The simulator payload as submitted (stores the JSON object) |
| `processedPayload` | JSONB | Result of the pipeline action (populated by the worker) |
| `createdAt` | timestamptz | Job creation time |

### PipelineSigningSecret (existing — `pipelineSigningSecrets` table)

Queried server-side during simulation when the pipeline has an active signing secret. The raw secret is fetched at call time, used to compute HMAC, and never exposed beyond the server process.

| Field | Type | Notes |
|-------|------|-------|
| `pipelineId` | UUID (FK) | Unique index — one row per pipeline; presence of row = active secret |
| `secretValue` | text | Raw HMAC secret — fetched by simulation service, never sent to browser |
| `secretHint` | text | First 6 chars of raw secret — used for UI display only, not read by simulation |

### Pipeline (existing — `pipelines` table)

Used to resolve `sourceId` from `pipelineId` before calling `ingestWebhook()`.

| Field | Type | Notes |
|-------|------|-------|
| `id` | UUID (PK) | Input to `simulateWebhook()` |
| `sourceId` | UUID (FK) | Passed to `ingestWebhook()` as the first argument |

---

## Transient Entities (Frontend-Only)

### PayloadTemplate

Defined as TypeScript constants in `SimulatorTab.tsx`. Never stored in the database.

| Field | Type | Notes |
|-------|------|-------|
| `key` | string | Unique identifier (e.g., `github_push`) |
| `label` | string | Display name (e.g., `GitHub — push`) |
| `payload` | object | Pre-filled JSON object for the editor |

### SimulatorRequest

Not persisted. Represents the one-time POST from the browser to `POST /pipelines/:id/fire-simulation`.

| Field | Type | Notes |
|-------|------|-------|
| `payload` | `Record<string, unknown>` | JSON object from the payload editor |

### SimulatorResponse

Returned by the `fire-simulation` endpoint. Not stored separately.

| Field | Type | Notes |
|-------|------|-------|
| `jobId` | string (UUID) | ID of the created Job — used for the "View job →" link |

---

## Summary

| Entity | Storage | Change |
|--------|---------|--------|
| `Job` | PostgreSQL | Unchanged — simulation produces a normal Job record |
| `PipelineSigningSecret` | PostgreSQL | Unchanged — read-only access to `secretValue` |
| `Pipeline` | PostgreSQL | Unchanged — read-only access to `sourceId` |
| `PayloadTemplate` | Frontend constant | New — TypeScript-only, no DB |
| `SimulatorRequest` | None | Transient — not persisted |
| `SimulatorResponse` | None | Transient — returned in HTTP response body |
