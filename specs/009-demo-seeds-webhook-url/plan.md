# Implementation Plan: Demo Seed Data & Webhook Inbound URL

**Branch**: `009-demo-seeds-webhook-url` | **Date**: 2026-03-24 | **Spec**: [spec.md](spec.md)

## Summary

Two independent deliverables:

1. **Webhook URL display** (US1): The pipeline detail page already receives `sourceUrl` from `GET /pipelines/:id`. Add the field to the dashboard's `Pipeline` interface and render it with a copy button in the Overview tab. Zero backend changes required.

2. **Demo seed script** (US2): Create `src/db/seed.ts` — an idempotent TypeScript script that inserts 2 users, 2 teams, 3 pipelines (one per action type), 1 signing secret, and 12 jobs with delivery attempts. Adds `npm run db:seed` to `package.json`. Matched on natural keys; skips existing records.

---

## Technical Context

**Language/Version**: TypeScript 5.4, Node.js 20 LTS
**Primary Dependencies**: Express 4.x (backend), React 18.3 + Vite 5 (dashboard), Drizzle ORM 0.30, argon2 (password hashing), node:crypto (signing secret generation)
**Storage**: PostgreSQL — no schema changes; all seed data uses existing tables
**Testing**: Vitest (dashboard), Node test runner (backend unit); seed script verified by manual run
**Target Platform**: Linux container (Docker), local development (WSL/macOS/Windows)
**Project Type**: Full-stack web service + dashboard
**Performance Goals**: Seed completes in < 30 seconds on a standard dev machine (SC-003)
**Constraints**: Seed must be idempotent (FR-015); webhook URL display requires zero new API calls
**Scale/Scope**: 2 users, 2 teams, 3 pipelines, 12 jobs, ~24 delivery attempts

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Asynchronous Processing | ✅ Pass | No changes to ingestion path |
| II. Reliability & Retry | ✅ Pass | No changes to delivery/retry logic |
| III. Clean Separation of Concerns | ✅ Pass | Seed script is standalone tooling; URL display is pure UI |
| IV. TypeScript Type Safety | ✅ Pass | Seed written in strict TypeScript; no `any` |
| V. Infrastructure Reproducibility | ✅ Pass | `npm run db:seed` documented; no compose changes required |
| VI. Code Quality Standards | ✅ Pass | Seed uses named constants for credentials and dataset config |
| VII. Testing Standards | ✅ Pass | No new production logic paths; seed is dev tooling |
| VIII. API Consistency | ✅ Pass | No new endpoints; existing `sourceUrl` field consumed as-is |
| IX. Performance Requirements | ✅ Pass | No changes to hot paths; seed runs offline |

No violations. Complexity Tracking table not required.

---

## Project Structure

### Documentation (this feature)

```text
specs/009-demo-seeds-webhook-url/
├── plan.md              ← this file
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── screens.md
├── checklists/
│   └── requirements.md
└── tasks.md             ← created by /speckit.tasks
```

### Source Code Changes

```text
src/
└── db/
    └── seed.ts          ← NEW: idempotent demo seed script

dashboard/
└── src/
    └── pages/
        └── PipelineDetailPage.tsx   ← MODIFIED: add sourceUrl to interface + display row

package.json             ← MODIFIED: add "db:seed" script
```

---

## Phase 0: Research

Complete. See [research.md](research.md).

Key findings:
- `sourceUrl` already returned by `GET /pipelines/:id` — no backend change needed (D-001)
- `VITE_PUBLIC_URL` retained as optional env var for documentation; not required for URL display (D-002)
- Seed location: `src/db/seed.ts`, script: `npm run db:seed` (D-003)
- Password hashing: `argon2` with same options as `auth.service.ts` (D-004)
- Idempotency: natural-key match + skip (D-005)
- Second seed user: `member@example.com` for team membership (D-006)
- 12 jobs seeded: 8 COMPLETED + 4 FAILED, spread across 3 pipelines (D-007)

---

## Phase 1: Design

### US1 — Webhook URL Display

**File**: `dashboard/src/pages/PipelineDetailPage.tsx`

Changes:
1. Add `sourceUrl: string` to the `Pipeline` interface (already returned by the API).
2. In the Overview tab, add a "Webhook URL" row between the pipeline metadata and the action config section.
3. Row renders: label + truncated URL (full URL in tooltip or revealed on hover) + Copy button.
4. Copy button uses `navigator.clipboard.writeText(pipeline.sourceUrl)` and shows "Copied!" for 2 seconds.
5. If `sourceUrl` is falsy: show "—" and disable the copy button.

No new hooks, services, or API calls required.

**Dependency**: None — uses existing pipeline data already fetched on mount.

---

### US2 — Demo Seed Script

**File**: `src/db/seed.ts`

Structure:
```
seed()
  ├── seedUser(email, password) → userId         [idempotent: skip if email exists]
  ├── seedApiKeys(userId)                         [idempotent: skip if user has ≥ 2 keys]
  ├── seedTeam(name, ownerUserId) → teamId        [idempotent: skip if name exists]
  ├── seedMembership(teamId, userId)              [idempotent: skip if row exists]
  ├── seedPipeline(name, actionType, ...) → id   [idempotent: skip if name exists]
  ├── seedSigningSecret(pipelineId)               [idempotent: skip if active secret exists]
  └── seedJobs(pipelineId, count, status) → ids  [idempotent: skip if pipeline has ≥ N jobs]
      └── seedDeliveryAttempts(jobId, status)
```

Each helper prints `[seed] <entity>: <name> (created | skipped)`.

**`package.json` addition**:
```json
"db:seed": "node --import tsx/esm src/db/seed.ts"
```
(Matches the pattern used by the existing `db:migrate` script.)

---

## Implementation Order

Tasks are independent — US1 (dashboard only) and US2 (backend + package.json) can be worked in parallel.

Suggested sequence for a single developer:
1. US1: PipelineDetailPage webhook URL display (small, high-visibility, demo-critical)
2. US2: seed.ts scaffold + user/team/pipeline seeding
3. US2: job + delivery attempt seeding
4. Polish: verify idempotency, verify copy button, run full seed on clean DB
