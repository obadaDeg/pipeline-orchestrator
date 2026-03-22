# Pipeline Orchestrator

A webhook-driven task processing platform. Receive webhooks, transform payloads, and fan-out to subscribers — with per-user flow ownership, team workspaces, and API key authentication.

## Quick Start

### Production / demo

```bash
docker compose up -d
```

That's it. Docker Compose builds the image, runs migrations, and starts the API (`http://localhost:4000`) and background worker. All services are health-checked so the API only starts after Postgres is ready and migrations complete.

### Local development

```bash
# Start infrastructure only (Postgres on :5433, Redis on :6379)
docker compose up -d postgres redis

# Install dependencies
npm install

# Run migrations
npm run db:migrate

# Start API server and worker (with hot-reload)
npm run dev        # API on :3000
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

## Architecture & Design Decisions

### System overview

The platform is split into two processes that communicate through a Redis-backed queue:

![High-Level Architecture](docs/High-Level%20Architecture/High-Level%20Architecture.png)

**Delivery sequence:**

![Sequence Diagram](docs/High-Level%20Architecture/SequenceDiagram.svg)

The API process never waits for delivery. It persists the job, enqueues a task, and returns `202` immediately. The worker is the only component that performs delivery and retries.

### Key design decisions

**BullMQ + Redis for the job queue**
BullMQ provides durable, ordered job storage with built-in retry and exponential backoff. Jobs survive process restarts. Redis is already required for queue operation so there is no additional infrastructure dependency.

**PostgreSQL + Drizzle ORM**
All business state lives in Postgres. Drizzle provides compile-time type safety for queries and generates SQL migration files that are committed to the repo and applied deterministically at startup — both in development and CI.

**API key authentication (not JWT)**
API keys are stateless bearer tokens that can be revoked instantly. There is no refresh-token complexity or short expiry dance. Each key is hashed with Argon2 at rest; only a non-reversible prefix hint is stored in plaintext. A user may hold up to 10 active keys simultaneously to support key rotation without downtime.

**HMAC-SHA256 webhook signatures**
The signing scheme follows the same pattern used by Stripe and GitHub: `sha256=HMAC(secret, "<timestamp>.<body>")`. Including the timestamp in the signed payload provides replay-attack protection (5-minute window enforced server-side). The secret is generated once, shown once, and only a 6-character hint is stored — the server stores the secret in plaintext only for the duration of the HTTP response.

**404 instead of 403 for cross-user access**
Returning `404` when a user requests another user's pipeline prevents resource enumeration. An attacker who guesses a pipeline UUID gets no confirmation that it exists.

**Fire-and-forget audit events**
Audit events are written with `.catch(() => {})` so that a logging failure never blocks the main operation. Auditability is valuable but must not degrade availability.

**Argon2 for passwords**
Argon2id is memory-hard and resistant to GPU brute-force attacks. It is the current OWASP-recommended algorithm for password hashing.

**Single-table-per-concern schema**
Each domain concept (`users`, `api_keys`, `pipelines`, `jobs`, `delivery_attempts`, `pipeline_signing_secrets`, `audit_events`, `teams`, `team_memberships`) has its own table. No polymorphic columns or JSON blobs for structured data that needs to be queried.

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
