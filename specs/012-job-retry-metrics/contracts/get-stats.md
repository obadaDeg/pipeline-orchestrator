# API Contract: Get Dashboard Stats

## Endpoint

`GET /stats`

## Authentication

Required. Bearer token (API key) via `Authorization: Bearer <key>` header.

## Authorization

All metrics are scoped to pipelines the authenticated user can access (personal ownership + team membership).

## Request Parameters

None.

## Success Response

**Status**: `200 OK`

```json
{
  "data": {
    "totalPipelines": 12,
    "jobsToday": 347,
    "successRate": 94.2,
    "avgDeliveryMs": 182.5,
    "topFailingPipelines": [
      { "id": "uuid-1", "name": "Stripe Webhooks", "failureCount": 23 },
      { "id": "uuid-2", "name": "GitHub Events", "failureCount": 11 },
      { "id": "uuid-3", "name": "Shopify Orders", "failureCount": 5 }
    ]
  }
}
```

## Empty State Response (new user / no data)

**Status**: `200 OK`

```json
{
  "data": {
    "totalPipelines": 0,
    "jobsToday": 0,
    "successRate": null,
    "avgDeliveryMs": null,
    "topFailingPipelines": []
  }
}
```

## Field Definitions

| Field | Type | Description |
|-------|------|-------------|
| totalPipelines | integer | Count of all pipelines accessible to the user |
| jobsToday | integer | Count of jobs with `created_at ≥ midnight UTC today` |
| successRate | float \| null | `COMPLETED / (COMPLETED + FAILED)` × 100 for terminal-state jobs today. `null` if no terminal jobs today |
| avgDeliveryMs | float \| null | Mean `response_time_ms` for `SUCCESS` delivery attempts across all user-accessible jobs. `null` if no timing data |
| topFailingPipelines | array[object] | Up to 5 pipelines ranked by total `FAILED` job count, descending |

### topFailingPipelines item shape

| Field | Type | Description |
|-------|------|-------------|
| id | UUID string | Pipeline ID |
| name | string | Pipeline display name |
| failureCount | integer | Total count of FAILED jobs (all time, not just today) |

## Error Responses

| HTTP Status | Error Code | Condition |
|-------------|------------|-----------|
| 401 Unauthorized | `UNAUTHORIZED` | Missing or invalid API key |

## Notes

- `successRate` is `null` (not `0`) when no terminal-state jobs exist today, to avoid a misleading 0%
- `avgDeliveryMs` is `null` (not `0`) when no delivery attempts with timing data exist
- `topFailingPipelines` counts failures over all time (not just today) — provides cumulative pipeline health signal
- Data is computed fresh on each request; no server-side caching
- All five metrics are computed in parallel queries to minimise response latency
