# End-to-End Demo Walkthrough

A complete, realistic walkthrough of the application using the seeded demo dataset.
Follow these steps in order to showcase every major feature interactively.

---

## Prerequisites

```bash
docker compose up -d          # starts API (:4000), worker, Postgres (:5433), Redis
npm run dev:dashboard         # dashboard on :5173
npm run db:seed               # populate demo data (safe to run multiple times)
```

---

## 1. Register & Log In

### Dashboard

Open `http://localhost:5173` → click **Log in** → enter:

| Field | Value |
|-------|-------|
| Email | `demo@example.com` |
| Password | `Password123!` |

After login you land on the **Pipelines** page. You'll see 3 pre-seeded pipelines:
- **GitHub Events** — `field_extractor` action
- **Stripe Payments** — `payload_filter` action
- **Slack Alerts** — `http_enricher` action

### API (get a key)

```bash
API_KEY=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"Password123!"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data.apiKey.key))")

echo $API_KEY   # wh_...
```

---

## 2. Explore the Pipelines

```bash
curl -s http://localhost:4000/pipelines \
  -H "Authorization: Bearer $API_KEY" | jq '.data.items[] | {name, actionType, sourceUrl}'
```

Each pipeline has a `sourceUrl` — this is the ingest endpoint that external systems POST webhooks to.

**Dashboard**: Click any pipeline → **Overview** tab shows the Webhook URL with a **Copy** button.

---

## 3. Send a Webhook (Unsigned Pipeline)

**Stripe Payments** has no signing secret configured — it accepts any POST.

```bash
# Get the Stripe pipeline's sourceId from the URL
STRIPE_SOURCE_ID=$(curl -s http://localhost:4000/pipelines \
  -H "Authorization: Bearer $API_KEY" \
  | jq -r '.data.items[] | select(.name=="Stripe Payments") | .sourceUrl' \
  | grep -oP '[a-f0-9-]{36}$')

# Send a webhook
curl -s -X POST "http://localhost:4000/webhooks/$STRIPE_SOURCE_ID" \
  -H "Content-Type: application/json" \
  -d '{"type":"charge.succeeded","amount":4999,"currency":"usd","customer":"cus_demo"}'
# Response: 202 Accepted {"data":{"jobId":"..."}}
```

Wait 2 seconds, then check the job in the dashboard: **Jobs** tab on the Stripe Payments pipeline → a new `COMPLETED` job appears with the processed payload (the `payload_filter` action kept only events where `type = charge.succeeded`).

---

## 4. Send a Signed Webhook (GitHub Events)

**GitHub Events** has an active signing secret. Unsigned requests are rejected with `401`.

```bash
# Get the signing secret from the DB (in a real integration, you'd copy it from the dashboard)
SECRET=$(psql -h localhost -p 5433 -U postgres -d pipeline_orchestrator -t \
  -c "SELECT pss.secret_value FROM pipeline_signing_secrets pss JOIN pipelines p ON p.id = pss.pipeline_id WHERE p.name = 'GitHub Events';" \
  | tr -d ' \n')

# Get the GitHub Events ingest URL
GH_SOURCE_ID=$(curl -s http://localhost:4000/pipelines \
  -H "Authorization: Bearer $API_KEY" \
  | jq -r '.data.items[] | select(.name=="GitHub Events") | .sourceUrl' \
  | grep -oP '[a-f0-9-]{36}$')

# Build and sign the request
BODY='{"event":"push","repo":"pipeline-orchestrator","ref":"refs/heads/main","author":"demo"}'
TS=$(date +%s)
SIG="sha256=$(echo -n "${TS}.${BODY}" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $2}')"

curl -s -X POST "http://localhost:4000/webhooks/$GH_SOURCE_ID" \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Signature: $SIG" \
  -H "X-Webhook-Timestamp: $TS" \
  -d "$BODY"
# Response: 202 Accepted
```

**Show the failure case** — send without the signature header:
```bash
curl -s -X POST "http://localhost:4000/webhooks/$GH_SOURCE_ID" \
  -H "Content-Type: application/json" \
  -d "$BODY"
# Response: 401 {"error":{"code":"UNAUTHORIZED","message":"Webhook signature verification failed"}}
```

**Dashboard**: Open GitHub Events → **Overview** tab → **Security** tab → signing secret shows as **Active** with hint `whsec_`.

---

## 5. Watch a Job Flow End-to-End

```bash
# Send a webhook, capture the job ID
JOB_ID=$(curl -s -X POST "http://localhost:4000/webhooks/$STRIPE_SOURCE_ID" \
  -H "Content-Type: application/json" \
  -d '{"type":"charge.succeeded","amount":1000}' \
  | jq -r '.data.jobId')

echo "Job ID: $JOB_ID"

# Poll status (normally resolves within 1-2s)
curl -s "http://localhost:4000/jobs/$JOB_ID" \
  -H "Authorization: Bearer $API_KEY" | jq '{status: .data.status, processedPayload: .data.processedPayload}'
```

**Dashboard**: Jobs tab → click the job row → **Job Detail** page shows:
- Original payload vs processed payload
- Status timeline
- Delivery attempts with HTTP status and response time

---

## 6. Trigger a Failed Job & Retry It

Force a job into `FAILED` state (simulates a subscriber that returned 5xx):

```bash
PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres -d pipeline_orchestrator \
  -c "UPDATE jobs SET status='FAILED', error_message='Subscriber returned 503' \
      WHERE id='$JOB_ID' RETURNING id, status;"
```

**Dashboard**:
1. Refresh the Jobs tab — the row shows **FAILED** badge
2. Click the **Retry** button → button shows a spinner
3. Row updates to **PENDING** without page reload
4. Wait 1-2 seconds → job transitions back to **COMPLETED**
5. The retry count badge appears: **1 retry**

**API**:
```bash
curl -s -X POST "http://localhost:4000/jobs/$JOB_ID/retry" \
  -H "Authorization: Bearer $API_KEY" | jq '{status: .data.status, retryCount: .data.retryCount}'
# Response: {"status":"PENDING","retryCount":1}
```

**Show the 409 error case** — retry a job that isn't FAILED:
```bash
# Wait for it to complete, then retry again
sleep 3
curl -s -X POST "http://localhost:4000/jobs/$JOB_ID/retry" \
  -H "Authorization: Bearer $API_KEY" | jq .
# Response: 409 {"error":{"code":"JOB_NOT_RETRYABLE",...}}
```

---

## 7. Stats Page

**Dashboard**: Click **Stats** in the sidebar.

Shows:
- **3** Total Pipelines → click **View all** → lands on Pipelines list
- **Jobs Today** → increases as you send webhooks in this session
- **Success Rate** → color-coded (green if ≥90%, amber 70–89%, red <70%)
- **Top Failing Pipelines** → click a pipeline name → navigates to that pipeline's detail page

**API**:
```bash
curl -s http://localhost:4000/stats \
  -H "Authorization: Bearer $API_KEY" | jq .data
```

---

## 8. Team Management

The demo dataset includes two teams. Show multi-tenancy:

```bash
# List teams
curl -s http://localhost:4000/teams \
  -H "Authorization: Bearer $API_KEY" | jq '.data.items[] | {name, id}'

# Log in as the member user — they can also see the team pipelines
MEMBER_KEY=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"member@example.com","password":"Password123!"}' \
  | jq -r '.data.apiKey.key')

curl -s http://localhost:4000/pipelines \
  -H "Authorization: Bearer $MEMBER_KEY" | jq '[.data.items[].name]'
# member sees the same pipelines because they're in both teams
```

**Dashboard**: Click **Teams** → Acme Platform and Acme Data, each with 2 members.

---

## 9. API Key Management

**Dashboard**: Click **Account** → shows 2 API keys (Default + CI/CD).

```bash
# List keys
curl -s http://localhost:4000/auth/keys \
  -H "Authorization: Bearer $API_KEY" | jq '[.data[] | {name, keyPrefix, revokedAt}]'

# Create a new key
NEW_KEY=$(curl -s -X POST http://localhost:4000/auth/keys \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"Demo Session"}' | jq -r '.data.key')
echo "New key: $NEW_KEY"

# Revoke it
KEY_ID=$(curl -s http://localhost:4000/auth/keys \
  -H "Authorization: Bearer $API_KEY" \
  | jq -r '.data[] | select(.name=="Demo Session") | .id')

curl -s -X DELETE "http://localhost:4000/auth/keys/$KEY_ID" \
  -H "Authorization: Bearer $API_KEY"
# Response: 204 No Content

# Try using the revoked key
curl -s http://localhost:4000/pipelines \
  -H "Authorization: Bearer $NEW_KEY" | jq .
# Response: 401 UNAUTHORIZED
```

---

## 10. Audit Log

Every significant action is recorded:

```bash
curl -s "http://localhost:4000/auth/audit-log?page=1&limit=10" \
  -H "Authorization: Bearer $API_KEY" | jq '[.data.items[] | {eventType, metadata, createdAt}]'
```

You'll see events like `KEY_CREATED`, `KEY_REVOKED`, `JOB_RETRIED`, `SIGNATURE_FAILED` from the steps above.

---

## 11. Create Your Own Pipeline (Live Demo)

Show the full create flow:

**Dashboard**:
1. Click **New Pipeline** → slide-over opens
2. Name: `Order Notifications`
3. Action Type: `field_extractor`
4. Action Config (code editor with syntax highlighting):
   ```json
   {
     "mapping": {
       "orderId": "order_id",
       "status": "status",
       "total": "amount_total"
     }
   }
   ```
5. Click **Create** → pipeline appears in the list

Then send a webhook to it immediately:

```bash
NEW_SOURCE_ID=$(curl -s http://localhost:4000/pipelines \
  -H "Authorization: Bearer $API_KEY" \
  | jq -r '.data.items[] | select(.name=="Order Notifications") | .sourceUrl' \
  | grep -oP '[a-f0-9-]{36}$')

curl -s -X POST "http://localhost:4000/webhooks/$NEW_SOURCE_ID" \
  -H "Content-Type: application/json" \
  -d '{"orderId":"ord_123","status":"paid","amount_total":4999,"currency":"usd","customer_email":"buyer@example.com"}'
# 202 Accepted
```

Go to the pipeline → Jobs tab → the new job is `COMPLETED` with processed payload showing only the mapped fields.

---

## 12. Real GitHub Integration (Live Push → Pipeline)

This turns the demo into a live system — every push to your GitHub repo triggers a real job.

### Step 1 — Install ngrok and expose the API

```bash
# Install ngrok (one-time)
npm install -g ngrok
# or: winget install ngrok  /  brew install ngrok

# Authenticate (free account at https://ngrok.com)
ngrok config add-authtoken <your-token>

# Start the tunnel
ngrok http 4000
```

Copy the `https://xxxx.ngrok-free.app` URL from the ngrok output.

### Step 2 — Start the subscriber server

The subscriber server receives processed deliveries and pretty-prints them to your terminal.

```bash
node examples/subscriber-server/index.mjs
# Listening on http://localhost:5050
```

In a new terminal, register it as a subscriber on the GitHub Events pipeline:

```bash
API_KEY="wh_..."   # your demo API key
GH_PIPELINE_ID="9b6a020e-9ff6-4414-b962-dfc295a6e92d"   # GitHub Events pipeline

curl -s -X POST "http://localhost:4000/pipelines/$GH_PIPELINE_ID/subscribers" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url":"http://host.docker.internal:5050"}'
# The worker runs inside Docker, so it reaches your host at host.docker.internal
```

### Step 3 — Register the GitHub webhook

You need a [GitHub Personal Access Token](https://github.com/settings/tokens) with `repo` scope.

```bash
# Get the signing secret for the GitHub Events pipeline from the DB
SECRET=$(PGPASSWORD=postgres psql -h localhost -p 5433 -U postgres \
  -d pipeline_orchestrator -t \
  -c "SELECT pss.secret_value FROM pipeline_signing_secrets pss JOIN pipelines p ON p.id = pss.pipeline_id WHERE p.name = 'GitHub Events';" \
  | tr -d ' \n')

# Get the pipeline source UUID
GH_SOURCE_ID=$(curl -s http://localhost:4000/pipelines \
  -H "Authorization: Bearer $API_KEY" \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{ \
      const p=JSON.parse(d).data.items.find(x=>x.name==='GitHub Events'); \
      console.log(p.sourceUrl.split('/').pop()); })")

# Register the webhook on your repo
GITHUB_TOKEN=ghp_... \
GITHUB_REPO=obadaDeg/pipeline-orchestrator \
TUNNEL_URL=https://xxxx.ngrok-free.app \
PIPELINE_SOURCE_ID=$GH_SOURCE_ID \
WEBHOOK_SECRET=$SECRET \
node examples/github-integration/setup.mjs
```

### Step 4 — Push a commit and watch it flow

```bash
git commit --allow-empty -m "demo: trigger webhook pipeline"
git push origin main
```

**What happens next:**
1. GitHub sends `POST https://xxxx.ngrok-free.app/webhooks/<sourceId>` with a signed payload
2. ngrok forwards it to `localhost:4000`
3. The API verifies the HMAC signature → creates a job → enqueues to BullMQ
4. The worker picks it up → applies the `field_extractor` action (extracts `event`, `repo`, `ref`)
5. The processed result is delivered to your subscriber server on `:5050`
6. Your terminal shows the pretty-printed delivery in real time
7. The dashboard updates — new `COMPLETED` job in the GitHub Events pipeline

**In the dashboard** (`http://localhost:5173`):
- **Pipelines → GitHub Events → Jobs tab** → new job with your commit metadata
- **Stats page** → Jobs Today counter increments
- **Job detail** → shows original GitHub payload vs extracted fields side-by-side

### Step 5 — Trigger different events

```bash
# Create and push a new branch (triggers push event)
git checkout -b demo/live-test
git push origin demo/live-test

# Create a release tag (triggers release event)
git tag v1.0.0-demo && git push origin v1.0.0-demo
```

Each one creates a new job. The subscriber server terminal shows each delivery arrive.

### Cleanup

```bash
# Delete the GitHub webhook when done
GITHUB_TOKEN=ghp_... \
GITHUB_REPO=obadaDeg/pipeline-orchestrator \
HOOK_ID=<hook-id-from-setup-output> \
node examples/github-integration/delete.mjs
```

---

## Quick Reference

| What | Where |
|------|-------|
| Dashboard | `http://localhost:5173` |
| API base | `http://localhost:4000` |
| Demo login | `demo@example.com` / `Password123!` |
| Member login | `member@example.com` / `Password123!` |
| Webhook ingest | `POST /webhooks/:sourceId` |
| Retry a job | `POST /jobs/:id/retry` |
| Stats | `GET /stats` or `/stats` in sidebar |
| Audit log | `GET /auth/audit-log` or Account page |
