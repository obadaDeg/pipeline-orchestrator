# Quickstart: Webhook Simulator

**Feature**: 014-webhook-simulator
**Date**: 2026-03-26

---

## Prerequisites

- Docker Compose stack running (`docker compose up`)
- Dashboard accessible at `http://localhost:5173`
- At least one pipeline exists (the demo seeds include GitHub Pipeline and Stripe Payments Pipeline)
- API key available for `curl` tests (set as `$API_KEY`)

---

## Scenario 1: Fire a GitHub Push Template (Happy Path, Unsigned Pipeline)

**Goal**: Verify the end-to-end simulation flow on an unsigned pipeline.

1. Open the dashboard and navigate to **GitHub Pipeline** (or any pipeline without a signing secret).
2. Click the **Simulator** tab.
3. From the template dropdown, select **GitHub — push**.
4. The payload editor pre-fills with a realistic GitHub push payload.
5. Click **Fire Webhook**.
6. Expected: The response area shows `202 Accepted — job created` and a **View job →** link.
7. Click the link — the Job Detail page shows the raw payload and the processed result.
8. Navigate back to the **Jobs** tab — the new job appears with `COMPLETED` status.

**curl equivalent** (bypass the UI):

```bash
curl -X POST http://localhost:4000/pipelines/$PIPELINE_ID/fire-simulation \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "payload": {
      "ref": "refs/heads/main",
      "repository": { "full_name": "owner/repo", "name": "repo" },
      "pusher": { "name": "developer" },
      "commits": [{ "id": "abc123", "message": "feat: add feature", "author": { "name": "developer" } }],
      "head_commit": { "id": "abc123", "message": "feat: add feature" }
    }
  }'
# Expected: {"data":{"jobId":"<uuid>"}}  HTTP 202
```

---

## Scenario 2: Fire Against a Signed Pipeline (HMAC Auto-Computed)

**Goal**: Verify that the simulator correctly signs the request when the pipeline has an active signing secret.

1. Navigate to a pipeline that has an active signing secret (check the **Security** tab — it should show `whsec_***`).
2. Click the **Simulator** tab.
3. Select any template and click **Fire Webhook**.
4. Expected: `202 Accepted` (not `401 Unauthorized`) — the server computed the HMAC correctly.
5. Click **View job →** — the job exists and is being processed.

**Validation**: If you see `401`, the HMAC computation has a bug. Check `simulation.service.ts` — the timestamp and raw body must match the format in `signing-secret.ts`.

---

## Scenario 3: Edit the Payload Before Firing

**Goal**: Verify that the editor accepts custom JSON and that the job stores the modified payload.

1. Open any pipeline's Simulator tab.
2. Select **GitHub — push**.
3. Change `"owner/repo"` to `"myorg/myrepo"` in the payload editor.
4. Click **Fire Webhook**.
5. Click **View job →**.
6. Expected: The job's raw payload shows `"full_name": "myorg/myrepo"` — the edited value, not the template default.

---

## Scenario 4: Invalid JSON Prevention

**Goal**: Verify the client-side validation prevents malformed requests.

1. Open any pipeline's Simulator tab.
2. Select any template.
3. Delete the closing `}` to create invalid JSON.
4. Expected: The **Fire Webhook** button becomes disabled. An inline error indicator appears in the editor (red underline or linting error via CodeMirror).
5. Fix the JSON — the button re-enables.

---

## Scenario 5: Stripe Template — charge.succeeded

**Goal**: Verify Stripe templates load correctly.

1. Navigate to **Stripe Payments Pipeline** (or any pipeline).
2. Open the Simulator tab.
3. Select **Stripe — charge.succeeded**.
4. Expected: Editor shows a payload with `type: "charge.succeeded"`, `data.object.amount`, `data.object.currency`, `data.object.customer`.
5. Fire the webhook — `202 Accepted`.

---

## Scenario 6: Custom (Blank) Template

**Goal**: Verify the blank template allows arbitrary payloads.

1. Open the Simulator tab on any pipeline.
2. Select **Custom (blank)**.
3. Expected: Editor shows `{}`.
4. Type a custom payload: `{ "event": "test", "userId": "123" }`.
5. Click **Fire Webhook** — `202 Accepted`.

---

## API Contract Quick Check

```bash
# Minimal valid body
curl -X POST http://localhost:4000/pipelines/$PIPELINE_ID/fire-simulation \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload": {}}'
# Expected: 202 {"data":{"jobId":"<uuid>"}}

# Missing payload field → 400
curl -X POST http://localhost:4000/pipelines/$PIPELINE_ID/fire-simulation \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"notPayload": {}}'
# Expected: 400 {"error":{"code":"VALIDATION_ERROR","message":"..."}}

# Non-existent pipeline → 404
curl -X POST http://localhost:4000/pipelines/00000000-0000-0000-0000-000000000000/fire-simulation \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"payload": {}}'
# Expected: 404 {"error":{"code":"NOT_FOUND","message":"..."}}

# No auth → 401
curl -X POST http://localhost:4000/pipelines/$PIPELINE_ID/fire-simulation \
  -H "Content-Type: application/json" \
  -d '{"payload": {}}'
# Expected: 401
```
