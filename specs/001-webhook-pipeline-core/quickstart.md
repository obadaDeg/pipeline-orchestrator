# Quickstart: Webhook-Driven Task Processing Pipeline

**Branch**: `001-webhook-pipeline-core`
**Date**: 2026-03-14

---

## Prerequisites

- Docker Desktop (for `docker compose up`)
- Node.js 20 LTS (for local development)
- `npm install` already run

---

## Running with Docker Compose (recommended)

Start the full stack (PostgreSQL, Redis, API, Worker, Migrations) with a single command:

```bash
docker compose up --build
```

Services started:
- **postgres** on port 5432
- **redis** on port 6379
- **migrator** — runs DB migrations once, then exits
- **api** on port 3000 (waits for postgres, redis, and migrator)
- **worker** — background job processor (waits for same)

To stop:
```bash
docker compose down
```

To reset all data:
```bash
docker compose down -v   # removes the postgres_data volume
```

---

## Local Development (without Docker)

1. Start PostgreSQL and Redis locally (or use only the infra services from compose):

```bash
docker compose up postgres redis -d
```

2. Copy environment file:

```bash
cp .env.example .env
```

3. Run database migrations:

```bash
npm run db:migrate
```

4. Start the API server (hot-reload):

```bash
npm run dev
```

5. Start the worker (separate terminal):

```bash
npm run worker
```

---

## Running Tests

```bash
npm test
```

Integration tests require a running PostgreSQL and Redis instance. The test suite uses
a dedicated test database (configured via `DATABASE_URL` with `_test` suffix or via the
`TEST_DATABASE_URL` override if set).

Run tests in watch mode:

```bash
npm run test:watch
```

---

## Verifying the Setup

### 1. Create a pipeline

```bash
curl -s -X POST http://localhost:3000/pipelines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Pipeline",
    "actionType": "field_extractor",
    "actionConfig": { "mapping": { "userId": "user.id", "event": "type" } },
    "subscriberUrls": ["https://webhook.site/your-unique-url"]
  }' | jq .
```

Save the `data.id` (pipeline ID) and `data.sourceUrl` from the response.

### 2. Send a webhook

```bash
curl -s -X POST http://localhost:3000/webhooks/<source-id-from-above> \
  -H "Content-Type: application/json" \
  -d '{ "user": { "id": 42, "name": "Alice" }, "type": "purchase" }' | jq .
```

Save the `data.jobId` from the 202 response.

### 3. Poll job status

```bash
curl -s http://localhost:3000/jobs/<job-id> | jq .data.status
```

Expected progression: `"PENDING"` → `"PROCESSING"` → `"COMPLETED"`

### 4. Check delivery attempts

```bash
curl -s http://localhost:3000/jobs/<job-id>/delivery-attempts | jq .
```

---

## Database Schema Management

After modifying `src/db/schema.ts`:

```bash
# Generate a new migration file
npm run db:generate

# Apply pending migrations
npm run db:migrate

# Browse the database (Drizzle Studio)
npm run db:studio
```

---

## Build for Production

```bash
npm run build       # compiles TypeScript → dist/
npm run typecheck   # type-check without emitting
npm run lint        # ESLint check
```

The Docker image is built via the multi-stage `Dockerfile`:
- Stage 1 (`builder`): compiles TypeScript
- Stage 2 (`runtime`): runs `dist/` with production deps only

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Runtime environment |
| `PORT` | `3000` | API server port |
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_HOST` | `localhost` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | — | Redis password (optional) |
| `WORKER_CONCURRENCY` | `5` | Concurrent BullMQ jobs |
| `DELIVERY_MAX_RETRIES` | `5` | Max delivery attempts per subscriber |
| `DELIVERY_BACKOFF_MS` | `1000` | Base backoff delay in ms (exponential) |
| `DELIVERY_TIMEOUT_MS` | `10000` | Per-delivery HTTP timeout in ms |
| `MAX_PAYLOAD_BYTES` | `1048576` | Max webhook body size (1 MB) |
| `STALLED_JOB_TIMEOUT_MS` | `300000` | PROCESSING job recovery threshold (5 min) |
