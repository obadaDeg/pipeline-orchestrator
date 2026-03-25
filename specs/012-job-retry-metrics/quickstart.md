# Quickstart: Job Retry & Dashboard Metrics

## Prerequisites

- `docker compose up` running (API, worker, Postgres, Redis)
- Valid API key obtained via `POST /auth/keys`
- At least one pipeline created

---

## Scenario 1: Retry a Failed Job

**Goal**: Verify the retry endpoint resets a FAILED job and re-enqueues it.

**Setup**: Create a pipeline with a subscriber URL that returns a non-2xx status (or is unreachable), causing the delivery engine to exhaust retries and mark the job as FAILED.

**Steps**:

```bash
# 1. Create pipeline with bad subscriber
PIPELINE=$(curl -s -X POST http://localhost:3000/pipelines \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Retry Test","actionType":"field_extractor","actionConfig":{},"subscriberUrls":["http://localhost:9999/dead"]}')
PIPELINE_ID=$(echo $PIPELINE | jq -r '.data.id')
SOURCE_URL=$(echo $PIPELINE | jq -r '.data.sourceUrl')

# 2. Trigger a webhook
curl -s -X POST $SOURCE_URL \
  -H "Content-Type: application/json" \
  -d '{"event":"test","value":42}'

# 3. Wait for job to reach FAILED (all delivery retries exhausted)
# Poll until status = FAILED
JOB_ID=$(curl -s "http://localhost:3000/jobs?pipelineId=$PIPELINE_ID" \
  -H "Authorization: Bearer $API_KEY" | jq -r '.data.items[0].id')

# 4. Retry the failed job
curl -s -X POST "http://localhost:3000/jobs/$JOB_ID/retry" \
  -H "Authorization: Bearer $API_KEY"
```

**Expected**:
- Response: `200 OK` with `{ "data": { "status": "PENDING", "retryCount": 1, "errorMessage": null } }`
- Subsequent GET on the job shows it transitioning from PENDING → PROCESSING → COMPLETED/FAILED
- `retryCount` is 1 after first retry, 2 after second retry

**Error scenario — wrong status**:
```bash
# Retry a COMPLETED job — should fail
curl -s -X POST "http://localhost:3000/jobs/$JOB_ID/retry" \
  -H "Authorization: Bearer $API_KEY"
# Expected: 409 Conflict, code JOB_NOT_RETRYABLE
```

---

## Scenario 2: Retry Count Increments Correctly

**Goal**: Verify retryCount is a monotonically increasing integer that survives page refreshes.

**Steps**:
1. Obtain a FAILED job from Scenario 1.
2. Retry → `retryCount = 1`, `status = PENDING`.
3. Wait for the job to fail again (subscriber still unreachable).
4. Retry again → `retryCount = 2`, `status = PENDING`.

**Expected**:
- `GET /jobs/:id` returns the current `retryCount` accurately.
- The dashboard Jobs tab displays the retryCount alongside the job row.
- The dashboard Job Detail page also shows the retryCount.

---

## Scenario 3: Dashboard Stats — Data Available

**Goal**: Verify all five metrics return correct values against known data.

**Setup**: Use the seeded demo data (if available) or manually create jobs with known outcomes.

```bash
curl -s "http://localhost:3000/stats" \
  -H "Authorization: Bearer $API_KEY" | jq .
```

**Expected response shape**:
```json
{
  "data": {
    "totalPipelines": <number ≥ 0>,
    "jobsToday": <number ≥ 0>,
    "successRate": <float 0–100 or null>,
    "avgDeliveryMs": <float > 0 or null>,
    "topFailingPipelines": [
      { "id": "...", "name": "...", "failureCount": <int> }
    ]
  }
}
```

**Verification**:
- `totalPipelines`: cross-check with `GET /pipelines` total
- `jobsToday`: count jobs in `GET /jobs` created since midnight UTC today
- `successRate`: manually calculate from known COMPLETED/FAILED counts
- `avgDeliveryMs`: verify against delivery attempt response times
- `topFailingPipelines`: confirm top-N pipelines match manual failure count ranking

---

## Scenario 4: Dashboard Stats — Empty State

**Goal**: Verify no errors when a user has no data.

**Setup**: Register a fresh user with no pipelines.

```bash
curl -s "http://localhost:3000/stats" \
  -H "Authorization: Bearer $FRESH_API_KEY" | jq .
```

**Expected**:
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

---

## Dashboard UI Verification

1. Navigate to `http://localhost:3000/dashboard` and log in.
2. Confirm "Stats" appears in the sidebar navigation.
3. Click "Stats" → navigates to `/dashboard/stats`.
4. Confirm all five metric cards render (no blank UI, no errors).
5. Navigate to a pipeline → Jobs tab → confirm FAILED jobs show a "Retry" button.
6. Click Retry → button shows loading state → job row updates to PENDING — no page reload.
7. Confirm success toast notification appears.
