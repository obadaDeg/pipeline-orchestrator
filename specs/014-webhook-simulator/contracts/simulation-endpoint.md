# API Contract: Simulation Endpoint

**Feature**: 014-webhook-simulator
**Date**: 2026-03-26

---

## POST /pipelines/:id/fire-simulation

Fire a simulated webhook at a pipeline, reusing the full ingest processing chain.

### Authentication

Requires a valid Bearer token (`Authorization: Bearer <api_key>`). Same authentication middleware as all other `/pipelines` routes.

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | The pipeline to simulate against |

### Request Body

```json
{
  "payload": { "<any key>": "<any value>" }
}
```

| Field | Type | Required | Validation |
|-------|------|----------|-----------|
| `payload` | `Record<string, unknown>` | Yes | Must be a JSON object (not array, not primitive). Accepts any shape — the pipeline action decides what to do with it. |

### Success Response — 202 Accepted

```json
{
  "data": {
    "jobId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

| Field | Type | Description |
|-------|------|-------------|
| `jobId` | string (UUID) | ID of the created Job record. Use to construct a link to `GET /jobs/:jobId`. |

### Error Responses

| Status | Code | Condition |
|--------|------|-----------|
| `400 Bad Request` | `VALIDATION_ERROR` | `payload` field is missing, not an object, or request body is malformed JSON |
| `401 Unauthorized` | `UNAUTHORIZED` | Missing or invalid Bearer token |
| `404 Not Found` | `NOT_FOUND` | Pipeline with the given `id` does not exist or does not belong to the authenticated user |
| `429 Too Many Requests` | `RATE_LIMITED` | Pipeline rate limit exceeded — returned by `ingestWebhook()` |
| `500 Internal Server Error` | `INTERNAL_ERROR` | Unexpected server failure |

---

## Server-Side Behaviour

The implementation in `simulateWebhook(pipelineId, payload)` follows these steps:

1. **Fetch pipeline** — resolve `sourceId` from `pipelineId`. Return `404` if not found or not owned by the caller.
2. **Serialize payload** — `JSON.stringify(payload)` → `rawBody: string`.
3. **Check signing secret** — query `pipelineSigningSecrets` for an active secret on this pipeline.
   - If found: compute `timestamp = Math.floor(Date.now() / 1000).toString()` and `signature = sha256=<HMAC-SHA256(secret, "${timestamp}.${rawBody}")>`. Pass both as header values.
   - If not found: pass no signature headers.
4. **Call ingestWebhook** — `ingestWebhook(sourceId, rawBody, signatureHeader?, timestampHeader?)`. This executes the full ingest pipeline: rate limiting, optional signature verification, job insert (`PENDING`), queue enqueue.
5. **Return `{ jobId }`** — the `jobId` returned by `ingestWebhook()` is forwarded to the client in the `data` envelope.

The raw signing secret is **never** included in the HTTP response or logged.

---

## Frontend Integration

### Fire button request

```typescript
const response = await fetch(`/api/pipelines/${pipelineId}/fire-simulation`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`,
  },
  body: JSON.stringify({ payload: JSON.parse(editorValue) }),
});
const status = response.status;           // 202 or error code
const body = await response.json();       // { data: { jobId } } or { error: {...} }
```

### Displaying the result

- `202`: Show "202 Accepted — job created" + "View job →" link to `/jobs/${body.data.jobId}`
- `4xx/5xx`: Show `${status} ${statusText} — ${body.error?.message ?? 'Unknown error'}`

---

## Relationship to Existing Endpoints

| Existing endpoint | Relationship |
|-------------------|-------------|
| `POST /webhooks/:sourceId` | Simulation calls `ingestWebhook()` — the same service function that `POST /webhooks/:sourceId` calls. Not a redirect or proxy. |
| `GET /pipelines/:id/signing-secret` | Returns only hint (`whsec_***`). Simulation fetches the raw secret directly from the DB (server-side). |
| `GET /jobs/:id` | Used by the "View job →" link in the simulator UI after a successful fire. |
