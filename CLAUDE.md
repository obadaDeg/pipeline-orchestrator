# Webhook Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-14

## Active Technologies
- TypeScript 5.4, Node.js 20 LTS + Express 4.x, Drizzle ORM 0.30, Zod 3.x, `argon2` (password hashing), `node:crypto` (API key generation via `randomBytes`) (002-api-key-user-auth)
- PostgreSQL — 5 new tables (`users`, `api_keys`, `teams`, `team_memberships`, `audit_events`); 2 new columns on existing `pipelines` table (002-api-key-user-auth)

- TypeScript 5.x strict mode, Node.js 20 LTS + Express 4.x, BullMQ 5.x + ioredis 5.x, Drizzle ORM 0.30 + pg 8.x, Zod 3.x (001-webhook-pipeline-core)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x strict mode, Node.js 20 LTS: Follow standard conventions

## Recent Changes
- 002-api-key-user-auth: Added TypeScript 5.4, Node.js 20 LTS + Express 4.x, Drizzle ORM 0.30, Zod 3.x, `argon2` (password hashing), `node:crypto` (API key generation via `randomBytes`)

- 001-webhook-pipeline-core: Added TypeScript 5.x strict mode, Node.js 20 LTS + Express 4.x, BullMQ 5.x + ioredis 5.x, Drizzle ORM 0.30 + pg 8.x, Zod 3.x

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->
