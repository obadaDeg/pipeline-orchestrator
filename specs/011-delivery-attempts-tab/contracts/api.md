# API Contracts: Delivery Attempts Tab & Per-Pipeline Rate Limiting

All responses follow the project envelope: `{ data: <payload> }` for success, `{ error: { code, message } }` for errors.

---

## 1. GET /jobs/:id/delivery-attempts

Retrieve all delivery attempts for a job. Endpoint already exists; contract documents the updated shape including `responseTimeMs`.

**Auth**: API key required (`Authorization: Bearer <key>`)
**Access**: Only accessible to the pipeline owner or a team member of the pipeline's team.

### Query Parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number (1-based) |
| `limit` | integer | 50 | Items per page (max 100) |

### Success Response — 200 OK

```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "jobId": "uuid",
        "subscriberUrl": "https://example.com/webhook",
        "httpStatus": 200,
        "responseTimeMs": 143,
        "responseSnippet": "ok",
        "attemptNumber": 1,
        "outcome": "SUCCESS",
        "attemptedAt": "2026-03-24T10:00:00.000Z"
      },
      {
        "id": "uuid",
        "jobId": "uuid",
        "subscriberUrl": "https://slow.example.com/hook",
        "httpStatus": 503,
        "responseTimeMs": 9987,
        "responseSnippet": "Service Unavailable",
        "attemptNumber": 1,
        "outcome": "FAILED",
        "attemptedAt": "2026-03-24T10:00:00.100Z"
      },
      {
        "id": "uuid",
        "jobId": "uuid",
        "subscriberUrl": "https://slow.example.com/hook",
        "httpStatus": 200,
        "responseTimeMs": 312,
        "responseSnippet": "received",
        "attemptNumber": 2,
        "outcome": "SUCCESS",
        "attemptedAt": "2026-03-24T10:00:05.000Z"
      }
    ],
    "total": 3,
    "page": 1,
    "limit": 50
  }
}
```

**Field notes**:
- `responseTimeMs`: integer milliseconds, or `null` when no response was received (timeout / network error).
- `httpStatus`: integer HTTP status code, or `null` on network error.
- `responseSnippet`: first 500 chars of response body, or `null`.
- `outcome`: `"SUCCESS"` | `"FAILED"`.
- Items are ordered by `attemptedAt` ascending (earliest first).

### Error Responses

| Status | Code | Condition |
|---|---|---|
| 401 | `UNAUTHORIZED` | Missing or invalid API key |
| 403 | `FORBIDDEN` | Job belongs to a pipeline the caller cannot access |
| 404 | `JOB_NOT_FOUND` | No job with the given ID |

---

## 2. POST /webhook/:sourceId — updated to enforce rate limiting

The existing webhook ingest endpoint now returns 429 when the pipeline's rate cap is exceeded.

**No change to the success path** — 202 Accepted is unchanged.

### New Error Response — 429 Too Many Requests

Returned when the pipeline's per-minute request cap is exceeded.

**Headers**:
```
Retry-After: 38
```
(Integer seconds until the current 60-second window resets.)

**Body**:
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded for this pipeline. Retry after 38 seconds."
  }
}
```

**Isolation**: A 429 for one pipeline has no effect on any other pipeline's ingest endpoint.

---

## 3. POST /pipelines — updated to accept rateLimitPerMinute

### Request Body (additions only)

```json
{
  "name": "My Pipeline",
  "actionType": "field_extractor",
  "actionConfig": { "mapping": { "event": "event" } },
  "subscriberUrls": ["https://example.com/hook"],
  "rateLimitPerMinute": 120
}
```

| Field | Type | Required | Constraints | Default |
|---|---|---|---|---|
| `rateLimitPerMinute` | integer \| null | No | 1 – 1000 | `null` (system default: 60) |

### Validation Error — 422 Unprocessable Entity

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "rateLimitPerMinute must be an integer between 1 and 1000"
  }
}
```

---

## 4. PATCH /pipelines/:id — updated to accept rateLimitPerMinute

All fields remain optional. `rateLimitPerMinute` can be updated or reset to null (system default).

```json
{
  "rateLimitPerMinute": 200
}
```

To reset to system default:
```json
{
  "rateLimitPerMinute": null
}
```

The new rate limit takes effect immediately for the next incoming request (Redis key for any in-progress window is unaffected but the next window picks up the new value).

---

## 5. GET /pipelines/:id — updated response shape

The pipeline object now includes `rateLimitPerMinute` in the response:

```json
{
  "data": {
    "id": "uuid",
    "name": "My Pipeline",
    "sourceId": "uuid",
    "sourceUrl": "https://app.example.com/webhook/uuid",
    "actionType": "field_extractor",
    "actionConfig": { "mapping": { "event": "event" } },
    "rateLimitPerMinute": 120,
    "subscribers": [...],
    "createdAt": "...",
    "updatedAt": "..."
  }
}
```

`rateLimitPerMinute` is `null` when using the system default; the dashboard displays "60 (default)" in this case.
