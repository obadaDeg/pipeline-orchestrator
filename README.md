# Pipeline Orchestrator

A webhook-driven task processing platform. Receive webhooks, transform payloads, and fan-out to subscribers — with per-user flow ownership, team workspaces, and API key authentication.

## Quick Start

```bash
# Start infrastructure (Postgres on :5433, Redis on :6379)
docker compose up -d

# Install dependencies
npm install

# Run migrations
npm run db:migrate

# Start API server and worker
npm run dev
npm run worker
```

---

## Authentication

All pipeline, job, and team endpoints require an API key passed as a Bearer token:

```
Authorization: Bearer wh_<your-key>
```

### Register and get your first key

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "supersecret123"}'
```

Response includes a `data.apiKey.key` — **save it now, it is only shown once**.

### Login (get a new key)

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "supersecret123"}'
```

> Rate limited: 5 attempts / 15 min for register, 10 attempts / 15 min for login.

---

## API Key Management

```bash
export API_KEY="wh_..."

# List all your keys (metadata only — full key never shown again)
curl http://localhost:3000/auth/keys -H "Authorization: Bearer $API_KEY"

# Create a named key (e.g. for CI/CD)
curl -X POST http://localhost:3000/auth/keys \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "CI/CD"}'

# Revoke a key immediately
curl -X DELETE http://localhost:3000/auth/keys/{keyId} \
  -H "Authorization: Bearer $API_KEY"
```

- Maximum **10 active keys** per user. Revoke one before creating more.
- Revocation is permanent and takes effect immediately.

---

## Pipelines

### Create a personal pipeline

```bash
curl -X POST http://localhost:3000/pipelines \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Pipeline",
    "actionType": "field_extractor",
    "actionConfig": {"mapping": {"userId": "user.id"}},
    "subscriberUrls": ["https://my-service.example.com/hook"]
  }'
```

Action types: `field_extractor`, `payload_filter`, `http_enricher`.

### List, get, update, delete

```bash
GET    /pipelines          # paginated list (your pipelines + team pipelines you're a member of)
GET    /pipelines/:id
PATCH  /pipelines/:id      # body: { name?, actionConfig?, subscriberUrls? }
DELETE /pipelines/:id
GET    /pipelines/:id/jobs  # delivery history
```

---

## Team Workspaces

Teams let multiple users share ownership of pipelines.

```bash
# Create a team
curl -X POST http://localhost:3000/teams \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp"}'

# Invite a member (must already be registered)
curl -X POST http://localhost:3000/teams/{teamId}/members \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "bob@example.com"}'

# Create a pipeline owned by the team
curl -X POST http://localhost:3000/pipelines \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Shared Pipeline",
    "actionType": "payload_filter",
    "actionConfig": {"field": "type", "operator": "eq", "value": "order.created"},
    "teamId": "{teamId}"
  }'

# Remove a member
curl -X DELETE http://localhost:3000/teams/{teamId}/members/{userId} \
  -H "Authorization: Bearer $API_KEY"

# Delete team (pipelines transferred to team owner's personal workspace)
curl -X DELETE http://localhost:3000/teams/{teamId} \
  -H "Authorization: Bearer $API_KEY"
```

- Team pipelines are visible to all members.
- Non-members get `404` (not `403`) to prevent enumeration.
- Only the team owner can manage membership and delete the team.

---

## Audit Log

```bash
curl "http://localhost:3000/auth/audit-log?page=1&limit=20" \
  -H "Authorization: Bearer $API_KEY"
```

Events recorded: `USER_REGISTERED`, `KEY_CREATED`, `KEY_REVOKED`, `AUTH_FAILED`, `TEAM_CREATED`, `TEAM_DELETED`, `TEAM_MEMBER_ADDED`, `TEAM_MEMBER_REMOVED`, `SIGNATURE_FAILED`.

---

## Webhook Signature Verification

Pipeline owners can require that incoming webhooks are signed with an HMAC-SHA256 secret. Pipelines without a secret remain open (accept all requests). Enabling a secret is opt-in and takes effect immediately.

### How it works

Senders sign requests using a shared secret:

```
Signed message = "<unix-timestamp-seconds>.<raw-body>"
Header: X-Webhook-Signature: sha256=<hex-digest>
Header: X-Webhook-Timestamp: <unix-timestamp-seconds>
```

The server rejects requests where the HMAC does not match, the timestamp is missing or unparseable, the timestamp is more than **5 minutes in the past** (replay attack prevention), or the timestamp is more than **1 minute in the future** (clock skew limit).

### Generate a signing secret

```bash
curl -X POST http://localhost:3000/pipelines/{pipelineId}/signing-secret \
  -H "Authorization: Bearer $API_KEY"
```

Response includes `data.secret` — **save it now, it is only shown once**. The `hint` field (first 6 characters) is stored and displayed on subsequent status requests.

### Send a signed webhook (Node.js example)

```js
import { createHmac } from 'node:crypto';

const secret = 'whsec_...'; // from generate response
const body = JSON.stringify({ event: 'order.created', id: '123' });
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = 'sha256=' + createHmac('sha256', secret)
  .update(`${timestamp}.${body}`)
  .digest('hex');

await fetch('https://your-host/webhooks/{sourceId}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
    'X-Webhook-Timestamp': timestamp,
  },
  body,
});
```

### Check secret status

```bash
GET /pipelines/{id}/signing-secret
# → { data: { active: true, hint: "whsec_", createdAt: "..." } }
```

### Rotate the secret

Calling `POST /pipelines/:id/signing-secret` again generates a new secret and **immediately invalidates the old one** — there is no overlap window.

```bash
curl -X POST http://localhost:3000/pipelines/{pipelineId}/signing-secret \
  -H "Authorization: Bearer $API_KEY"
```

### Revoke (disable verification)

```bash
curl -X DELETE http://localhost:3000/pipelines/{pipelineId}/signing-secret \
  -H "Authorization: Bearer $API_KEY"
# → 204 No Content
```

After revocation the pipeline reverts to open mode and accepts all unsigned webhooks. Returns `422` if no secret is active.

---

## Response Envelope

All responses follow a consistent envelope:

```json
{ "data": { ... } }           // success
{ "error": { "code": "...", "message": "..." } }  // error
```

Paginated responses wrap items:
```json
{ "data": { "items": [...], "total": 42, "page": 1, "limit": 20 } }
```

---

## Development

```bash
npm test              # unit tests
npm run test:integration  # integration tests (requires running DB + Redis)
npm run test:all      # all tests
npm run lint
npm run typecheck
npm run build
```

For a full walkthrough see [`specs/002-api-key-user-auth/quickstart.md`](specs/002-api-key-user-auth/quickstart.md).
