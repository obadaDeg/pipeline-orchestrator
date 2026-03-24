# Quickstart: Delivery Attempts Tab & Per-Pipeline Rate Limiting

## Prerequisites

- Dashboard running (`npm run dev:dashboard`)
- Backend running with a connected database and Redis
- At least one pipeline with a known subscriber URL

---

## Scenario 1: Inspect delivery attempts for a failed job

**Goal**: Verify that response time, status codes, and attempt numbers are visible for a failed delivery.

1. Navigate to a pipeline that has at least one FAILED job.
2. Open the Jobs tab and click a failed job ID.
3. Scroll to the Delivery Attempts section.
4. **Expected**: A table showing each subscriber URL, HTTP status code, response time in milliseconds (e.g. `342ms`), attempt number, and a red FAILED badge or green SUCCESS badge.
5. Find a row where the outcome is FAILED — hover or expand it and confirm the `responseSnippet` is visible.
6. Find a subscriber that succeeded after retries — confirm multiple rows exist for that URL with only the last showing SUCCESS.
7. **Expected for null response time** (e.g., timed-out attempt): The response time cell shows `—` rather than an error or blank.

---

## Scenario 2: Webhook ingest is rejected when the pipeline rate limit is exceeded

**Goal**: Verify the 429 response and Retry-After header when a pipeline is flooded.

1. Create a pipeline with `rateLimitPerMinute: 5` (via dashboard form or API).
2. Send 6 POST requests to `POST /webhook/{sourceId}` within one minute.
3. **Expected for requests 1–5**: `202 Accepted`.
4. **Expected for request 6 (and beyond until the window resets)**:
   ```
   HTTP/1.1 429 Too Many Requests
   Retry-After: 42

   { "error": { "code": "RATE_LIMIT_EXCEEDED", "message": "..." } }
   ```
5. Wait for the `Retry-After` value (seconds) to elapse.
6. Send one more request.
7. **Expected**: `202 Accepted` — the window has reset.

---

## Scenario 3: Configure a custom rate limit on a new pipeline

**Goal**: Verify the rate limit field in the Create Pipeline form.

1. Open the dashboard and click **New Pipeline**.
2. Observe the **Rate limit (req/min)** field — it should be pre-filled with `60`.
3. Change the value to `200`.
4. Fill in the remaining required fields and click **Create Pipeline**.
5. Open the newly created pipeline's detail page.
6. **Expected**: The pipeline overview shows `Rate limit: 200 req/min`.
7. Try sending 201 requests in one minute — the 201st should return 429.

---

## Scenario 4: Edit rate limit on an existing pipeline

**Goal**: Verify the rate limit field in the Edit Pipeline flow.

1. Open an existing pipeline.
2. Click **Edit**.
3. Find the **Rate limit (req/min)** field — it should show the current value (or `60` if default).
4. Change the value and click **Save**.
5. **Expected**: The updated rate limit is shown in the overview immediately.
6. **Expected**: Sending requests beyond the new limit produces 429; sending requests below it produces 202.

---

## Scenario 5: Default rate limit applies when no custom limit is set

**Goal**: Verify that pipelines with no custom rate limit use the system default (60 req/min).

1. Create a pipeline leaving the Rate limit field at its default value (60).
2. Verify the stored value in the pipeline detail is `60 (default)` or equivalent.
3. Send 61 requests within one minute.
4. **Expected**: Request 61 returns 429.
