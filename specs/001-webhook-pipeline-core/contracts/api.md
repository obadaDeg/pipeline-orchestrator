# API Contracts: Webhook-Driven Task Processing Pipeline

**Branch**: `001-webhook-pipeline-core`
**Date**: 2026-03-14
**Base URL**: `http://localhost:3000` (dev) / `http://api:3000` (Docker)

---

## Response Envelope

All responses follow a consistent JSON envelope (Constitution Principle VIII):

**Success**:
```json
{ "data": <payload> }
```

**Paginated success**:
```json
{
  "data": {
    "items": [ ... ],
    "total": 42,
    "page": 1,
    "limit": 20
  }
}
```

**Error**:
```json
{ "error": { "code": "SCREAMING_SNAKE_CODE", "message": "Human-readable description" } }
```

**Standard HTTP Status Codes**:
| Code | Meaning |
|------|---------|
| 200 | OK |
| 201 | Created |
| 202 | Accepted (async webhook ingestion) |
| 204 | No Content (successful DELETE) |
| 400 | Bad Request (malformed JSON body) |
| 404 | Not Found |
| 405 | Method Not Allowed |
| 413 | Payload Too Large |
| 422 | Unprocessable Entity (semantic validation failure) |
| 500 | Internal Server Error |

---

## Pipeline Endpoints

### POST /pipelines

Create a new pipeline with a processing action and one or more subscriber URLs.

**Request body**:
```json
{
  "name": "string (required)",
  "actionType": "field_extractor | payload_filter | http_enricher (required)",
  "actionConfig": {
    "/* action-type-specific config (required, validated per actionType) */"
  },
  "subscriberUrls": ["https://example.com/hook"]
}
```

**Action config shapes** (validated at request time):
- `field_extractor`: `{ "mapping": { "outputKey": "source.path" } }`
- `payload_filter`: `{ "field": "event.type", "operator": "eq", "value": "purchase" }`
- `http_enricher`: `{ "url": "https://api.example.com/enrich", "mergeKey": "extra" }`

**Success 201**:
```json
{
  "data": {
    "id": "uuid",
    "name": "My Pipeline",
    "sourceUrl": "http://localhost:3000/webhooks/550e8400-e29b-41d4-a716-446655440000",
    "actionType": "field_extractor",
    "actionConfig": { "mapping": { "userId": "user.id" } },
    "subscribers": [
      { "id": "uuid", "url": "https://example.com/hook", "createdAt": "2026-03-14T10:00:00Z" }
    ],
    "createdAt": "2026-03-14T10:00:00Z",
    "updatedAt": "2026-03-14T10:00:00Z"
  }
}
```

**Error 422** (validation failure):
```json
{ "error": { "code": "VALIDATION_ERROR", "message": "actionType must be one of: field_extractor, payload_filter, http_enricher" } }
```

---

### GET /pipelines

List all pipelines with pagination. Subscriber list is **not** embedded in the list
response for performance (fetch the individual pipeline to get subscribers).

**Query params**: `page` (int, default 1), `limit` (int, default 20, max 100)

**Success 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "My Pipeline",
        "sourceUrl": "http://localhost:3000/webhooks/550e8400-...",
        "actionType": "field_extractor",
        "actionConfig": { "mapping": { "userId": "user.id" } },
        "createdAt": "2026-03-14T10:00:00Z",
        "updatedAt": "2026-03-14T10:00:00Z"
      }
    ],
    "total": 3,
    "page": 1,
    "limit": 20
  }
}
```

---

### GET /pipelines/:id

Retrieve a single pipeline including its subscriber list.

**Success 200**: Full pipeline object (same shape as POST 201 response, with `subscribers`).

**Error 404**:
```json
{ "error": { "code": "PIPELINE_NOT_FOUND", "message": "Pipeline not found" } }
```

---

### PATCH /pipelines/:id

Update a pipeline. All fields are optional. `subscriberUrls`, if provided, performs a
**full replacement** of the subscriber list (all existing subscribers are deleted and
replaced with the new list).

**Request body** (all optional):
```json
{
  "name": "Updated Name",
  "actionConfig": { "mapping": { "email": "user.email" } },
  "subscriberUrls": ["https://new-subscriber.example.com/hook"]
}
```

Note: `actionType` cannot be changed after creation (would require data migration of
existing `actionConfig` values).

**Success 200**: Updated pipeline object with `subscribers`.

**Error 404**: Pipeline not found.
**Error 422**: Validation failure on provided fields.

---

### DELETE /pipelines/:id

Delete a pipeline and its subscribers. Does NOT delete associated Jobs or
DeliveryAttempts (their `pipeline_id` is set to NULL — history preserved per FR-005).

**Success 204**: Empty body.

**Error 404**: Pipeline not found.

---

## Webhook Ingestion

### POST /webhooks/:sourceId

Receive a webhook payload. Responds immediately without processing.

**Request**: Any body (JSON, form, plain text). Max size: `MAX_PAYLOAD_BYTES` (default 1 MB).

**Headers**:
- `Content-Type`: Any (body stored as raw text)
- `Content-Length`: Used for early payload size rejection before body is buffered

**Success 202**:
```json
{ "data": { "jobId": "uuid" } }
```

The `jobId` can be used to poll job status via `GET /jobs/:id`.

**Error 404** (unknown source URL):
```json
{ "error": { "code": "PIPELINE_NOT_FOUND", "message": "No pipeline found for this source URL" } }
```

**Error 413** (body exceeds limit):
```json
{ "error": { "code": "PAYLOAD_TOO_LARGE", "message": "Request body exceeds the 1048576 byte limit" } }
```

**Error 405** (wrong method):
```json
{ "error": { "code": "METHOD_NOT_ALLOWED", "message": "Only POST is accepted on this endpoint" } }
```

---

## Job Endpoints

### GET /jobs/:id

Retrieve the current state of a job including its processed payload and any error.

**Success 200**:
```json
{
  "data": {
    "id": "uuid",
    "pipelineId": "uuid | null",
    "status": "PENDING | PROCESSING | COMPLETED | FAILED",
    "rawPayload": "{\"event\": \"purchase\"}",
    "processedPayload": { "userId": 42 },
    "errorMessage": null,
    "createdAt": "2026-03-14T10:00:00Z",
    "updatedAt": "2026-03-14T10:00:05Z"
  }
}
```

Notes:
- `processedPayload` is `null` until the action has executed successfully
- `errorMessage` is `null` unless status is `FAILED`
- `pipelineId` may be `null` if the pipeline was deleted after the job was created

**Error 404**:
```json
{ "error": { "code": "JOB_NOT_FOUND", "message": "Job not found" } }
```

---

### GET /pipelines/:id/jobs

List all jobs for a pipeline, newest first.

**Query params**: `page` (int, default 1), `limit` (int, default 20, max 100)

**Note**: `rawPayload` and `processedPayload` are **omitted** from the list response
for bandwidth efficiency. Use `GET /jobs/:id` for the full record.

**Success 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "pipelineId": "uuid",
        "status": "COMPLETED",
        "errorMessage": null,
        "createdAt": "2026-03-14T10:00:00Z",
        "updatedAt": "2026-03-14T10:00:05Z"
      }
    ],
    "total": 14,
    "page": 1,
    "limit": 20
  }
}
```

**Error 404**: Pipeline not found.

---

### GET /jobs/:id/delivery-attempts

List all delivery attempts for a job, ordered by `attempt_number ASC`. Not paginated —
total attempts are bounded by `DELIVERY_MAX_RETRIES × subscriber_count`.

**Success 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "jobId": "uuid",
        "subscriberId": "uuid | null",
        "subscriberUrl": "https://example.com/hook",
        "httpStatus": 500,
        "responseSnippet": "Internal Server Error",
        "attemptNumber": 1,
        "outcome": "FAILED",
        "attemptedAt": "2026-03-14T10:00:02Z"
      },
      {
        "id": "uuid",
        "jobId": "uuid",
        "subscriberId": "uuid",
        "subscriberUrl": "https://example.com/hook",
        "httpStatus": 200,
        "responseSnippet": "OK",
        "attemptNumber": 2,
        "outcome": "SUCCESS",
        "attemptedAt": "2026-03-14T10:00:13Z"
      }
    ]
  }
}
```

Notes:
- `subscriberId` may be `null` if the subscriber was deleted after the attempt was recorded
- `subscriberUrl` is always present (denormalized at delivery time)
- `httpStatus` is `null` when no HTTP response was received (network error, timeout)
- `responseSnippet` is `null` when no response body was received

**Error 404**: Job not found.

---

## Error Code Reference

| Code | HTTP | Trigger |
|------|------|---------|
| `PIPELINE_NOT_FOUND` | 404 | Pipeline ID or source URL does not exist |
| `JOB_NOT_FOUND` | 404 | Job ID does not exist |
| `VALIDATION_ERROR` | 422 | Request body fails Zod schema validation |
| `PAYLOAD_TOO_LARGE` | 413 | Webhook body exceeds `MAX_PAYLOAD_BYTES` |
| `METHOD_NOT_ALLOWED` | 405 | Wrong HTTP method on webhook ingestion endpoint |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
