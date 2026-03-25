# API Contract: Retry Job

## Endpoint

`POST /jobs/:id/retry`

## Authentication

Required. Bearer token (API key) via `Authorization: Bearer <key>` header.

## Authorization

The authenticated user must own the pipeline that the job belongs to — either personally (`ownerUserId`) or as a team member (`ownerTeamId`). Returns 404 if the job does not exist or is inaccessible.

## Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| id | UUID string | Yes | The database job ID to retry |

## Request Body

None.

## Success Response

**Status**: `200 OK`

```json
{
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "pipelineId": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
    "status": "PENDING",
    "retryCount": 1,
    "errorMessage": null,
    "createdAt": "2026-03-24T10:00:00.000Z",
    "updatedAt": "2026-03-24T10:05:30.000Z"
  }
}
```

## Error Responses

| HTTP Status | Error Code | Condition |
|-------------|------------|-----------|
| 401 Unauthorized | `UNAUTHORIZED` | Missing or invalid API key |
| 404 Not Found | `JOB_NOT_FOUND` | Job does not exist, pipeline was deleted, or user lacks access |
| 409 Conflict | `JOB_NOT_RETRYABLE` | Job status is not `FAILED` (e.g., PENDING, PROCESSING, COMPLETED) |

```json
{
  "error": {
    "code": "JOB_NOT_RETRYABLE",
    "message": "Only jobs with status FAILED can be retried"
  }
}
```

## Side Effects (on success, in order)

1. `jobs.status` set to `'PENDING'`
2. `jobs.retry_count` incremented by 1
3. `jobs.error_message` set to `null`
4. `jobs.updated_at` set to current timestamp
5. New BullMQ task enqueued: `{ jobId, pipelineId }` on `webhook-jobs` queue
6. `JOB_RETRIED` audit event inserted with metadata `{ jobId, pipelineId, retryCount }`

All six side effects are executed atomically within a database transaction (steps 1–4 + 6); step 5 (BullMQ enqueue) occurs after the transaction commits.

## Notes

- The job is processed using `raw_payload` stored at original ingestion time — no re-fetching from source
- After re-enqueue, the worker picks up the job and transitions it through the standard `PENDING → PROCESSING → COMPLETED/FAILED` lifecycle
- Concurrent double-click protection: if two retry requests arrive simultaneously for the same job, only one will succeed; the second will receive 409 because `status` will already be `PENDING`
