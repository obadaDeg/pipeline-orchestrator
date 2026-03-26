# Quickstart: Real-World Integrations

**Feature**: 013-real-world-integrations
**Date**: 2026-03-25

---

## Prerequisites

```bash
docker compose up -d          # API on :4000, worker, Postgres, Redis
npm run db:seed               # Populate demo data (safe to re-run)

# Get API key
API_KEY=$(curl -s -X POST http://localhost:4000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@example.com","password":"Password123!"}' \
  | node -e "let d='';process.stdin.on('data',c=>d+=c).on('end',()=>console.log(JSON.parse(d).data.apiKey.key))")
```

---

## Option A — webhook.site (no local server needed)

1. Open https://webhook.site in browser → copy the unique URL (e.g. `https://webhook.site/abcd-1234`)

2. Register as a subscriber on any pipeline:
   ```bash
   PIPELINE_ID="<your-pipeline-id>"
   curl -s -X POST "http://localhost:4000/pipelines/$PIPELINE_ID/subscribers" \
     -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"url":"https://webhook.site/abcd-1234"}'
   ```

3. Send a test webhook:
   ```bash
   SOURCE_ID=$(curl -s "http://localhost:4000/pipelines/$PIPELINE_ID" \
     -H "Authorization: Bearer $API_KEY" | jq -r '.data.sourceUrl' | grep -oP '[a-f0-9-]{36}$')
   curl -s -X POST "http://localhost:4000/webhooks/$SOURCE_ID" \
     -H "Content-Type: application/json" \
     -d '{"event":"test","message":"hello from pipeline orchestrator"}'
   ```

4. Watch the processed payload appear in the webhook.site browser tab within 1–2 seconds.

---

## Option B — Local Subscriber Server (terminal output)

1. Start the server:
   ```bash
   node examples/subscriber-server/index.mjs
   # Listening on http://localhost:5050
   ```

2. Register it as a subscriber (worker inside Docker → use host.docker.internal):
   ```bash
   PIPELINE_ID="<your-pipeline-id>"
   curl -s -X POST "http://localhost:4000/pipelines/$PIPELINE_ID/subscribers" \
     -H "Authorization: Bearer $API_KEY" \
     -H "Content-Type: application/json" \
     -d '{"url":"http://host.docker.internal:5050"}'
   ```

3. Send a test webhook and watch deliveries appear in the terminal.

---

## Option C — GitHub Live Integration (real push events)

**Extra prerequisite**: ngrok installed and authenticated (https://ngrok.com free account).

1. Expose the API publicly:
   ```bash
   ngrok http 4000
   # Copy: https://xxxx.ngrok-free.app
   ```

2. Verify tunnel is working:
   ```bash
   curl https://xxxx.ngrok-free.app/stats -H "Authorization: Bearer $API_KEY"
   ```

3. Get the Stripe Payments pipeline source ID (unsigned pipeline for GitHub):
   ```bash
   GH_SOURCE_ID=$(curl -s http://localhost:4000/pipelines \
     -H "Authorization: Bearer $API_KEY" \
     | jq -r '.data.items[] | select(.name=="Stripe Payments") | .sourceUrl' \
     | grep -oP '[a-f0-9-]{36}$')
   ```

4. Optionally start the subscriber server (Option B) and register it.

5. Register GitHub webhook:
   ```bash
   GITHUB_TOKEN=ghp_... \
   GITHUB_REPO=your-username/your-repo \
   TUNNEL_URL=https://xxxx.ngrok-free.app \
   PIPELINE_SOURCE_ID=$GH_SOURCE_ID \
   node examples/github-integration/setup.mjs
   # Outputs: Hook ID: <id>  (save this for cleanup)
   ```

6. Push a commit:
   ```bash
   git commit --allow-empty -m "test: trigger webhook pipeline"
   git push
   ```

7. Watch the job appear in the dashboard at http://localhost:5173

8. Cleanup:
   ```bash
   GITHUB_TOKEN=ghp_... GITHUB_REPO=your-username/your-repo HOOK_ID=<id> \
   node examples/github-integration/delete.mjs
   ```
