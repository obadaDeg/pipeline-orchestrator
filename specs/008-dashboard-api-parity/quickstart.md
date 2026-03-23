# Developer Quickstart: Dashboard API Parity & Bug Fixes

**Feature**: 008-dashboard-api-parity
**Date**: 2026-03-23

---

## What This Feature Does

This feature closes the gap between the existing backend API and the dashboard UI:

1. **Bug fix** — adds `GET /jobs` to the backend so the Jobs page loads.
2. **Bug fix** — adds pagination metadata to `GET /jobs/:id/delivery-attempts` so the Job Detail page works correctly.
3. **New UI** — Signing Secrets panel on the Pipeline Detail page.
4. **New UI** — Pipeline editing (name + description) on the Pipeline Detail page.
5. **New UI** — User registration page at `/register`.
6. **New UI** — Teams pages (`/teams`, `/teams/:id`).
7. **New backend** — `GET /teams` list endpoint.

---

## Prerequisites

```bash
# Backend + DB running
docker compose up -d

# Backend dependencies (already installed)
npm install

# Dashboard dependencies (already installed)
cd dashboard && npm install
```

---

## Running the Stack

```bash
# Terminal 1: Backend API
npm run dev

# Terminal 2: Dashboard (Vite dev server)
cd dashboard && npm run dev
```

Dashboard runs at `http://localhost:5173`. Backend API at `http://localhost:3000`.

---

## Backend Changes

### 1. Add GET /jobs

**File**: `src/api/routes/jobs.router.ts`

Add route before the existing `GET /jobs/:id`:
```
GET /jobs   → listJobsHandler
```

**File**: `src/api/controllers/jobs.controller.ts`

Add `listJobsHandler`:
- Call `parsePagination(req.query)` for `page`, `limit`, `offset`.
- Accept optional `?pipelineId` query param for filtering.
- Delegate to `jobService.listJobs(userId, { page, limit, offset, pipelineId })`.
- Return `successResponse(paginatedResponse(items, total, page, limit))`.

**File**: `src/services/job.service.ts`

Add `listJobs(userId, params)`:
- Query jobs that belong to pipelines where `ownerUserId = userId`.
- Also include jobs from team-owned pipelines where the user is a member.
- Return `{ items, total }`.

### 2. Fix GET /jobs/:id/delivery-attempts

**File**: `src/api/controllers/jobs.controller.ts`

Update `getDeliveryAttempts`:
- Add `parsePagination(req.query)` call.
- Pass `{ limit, offset }` to `jobService.getDeliveryAttempts`.
- Return `successResponse(paginatedResponse(items, total, page, limit))`.

**File**: `src/services/job.service.ts`

Update `getDeliveryAttempts(jobId, params?)`:
- Accept `{ limit, offset }`.
- Run a count query alongside the paginated data query.
- Return `{ items, total }`.

### 3. Add GET /teams

**File**: `src/api/routes/teams.router.ts`

Add route:
```
GET /teams  → listTeamsHandler
```

**File**: `src/api/controllers/teams.controller.ts`

Add `listTeamsHandler`:
- Delegate to `teamService.listTeams(userId)`.
- Return `successResponse({ items })`.

**File**: `src/services/team.service.ts`

Add `listTeams(userId)`:
- Query all teams where `ownerUserId = userId` OR user has a row in `team_memberships`.
- Include member count and `isOwner` flag in results.

---

## Dashboard Changes

### 1. Registration Page

**New file**: `dashboard/src/pages/RegisterPage.tsx`

- Form with `email` and `password` fields.
- Client-side: validate password ≥ 8 chars before submitting.
- On submit: `POST /auth/register` via `useApi`.
- On success: `auth.login(data.apiKey.key, data.user.email)`.
- Link to `/login`.

**Update**: `dashboard/src/App.tsx`

- Add `/register` route (unauthenticated, redirect to `/` if already logged in).
- Add link in `LoginPage`.

### 2. Teams Pages

**New files**:
- `dashboard/src/pages/TeamsPage.tsx` — lists all user teams via `GET /teams`.
- `dashboard/src/pages/TeamDetailPage.tsx` — shows team detail via `GET /teams/:id`.

**Update**: `dashboard/src/App.tsx`
- Add `/teams` and `/teams/:id` routes.

**Update**: `dashboard/src/components/Sidebar.tsx`
- Add Teams navigation link.

### 3. Signing Secrets Panel

**New component**: `dashboard/src/components/SigningSecretPanel.tsx`

- Manages local state: `{ status: 'none' | 'active' | 'revealed', secret?: string, hint?: string, createdAt?: string }`.
- On mount: `GET /pipelines/:id/signing-secret` to determine initial state.
- Generate/Rotate: `POST /pipelines/:id/signing-secret` → store `secret` in local state momentarily.
- Revoke: `DELETE /pipelines/:id/signing-secret`.
- Use `ConfirmDialog` for Rotate and Revoke actions.

**Update**: `dashboard/src/pages/PipelineDetailPage.tsx`
- Add "Security" tab to the existing tab navigation.
- Render `<SigningSecretPanel pipelineId={id} />` in the Security tab.

### 4. Pipeline Editing

**Update**: `dashboard/src/pages/PipelineDetailPage.tsx`

- Add edit mode state: `isEditing`, `editName`, `editDescription`.
- "Edit" button toggles edit mode.
- On save: `PATCH /pipelines/:id { name, editDescription }` → update local state on success.
- "Cancel" restores original values.

---

## Testing

### Backend unit tests

```bash
npm test
```

New tests to write:
- `listJobs` controller — with and without `pipelineId` filter, pagination.
- `getDeliveryAttempts` controller — pagination params applied, correct shape returned.
- `listTeams` controller — returns owned teams and memberships.

### Dashboard unit tests (Vitest)

```bash
cd dashboard && npm test
```

New tests to write:
- `RegisterPage` — renders form, validates password, calls register endpoint, redirects on success.
- `SigningSecretPanel` — all four states (none, revealed, active, after revoke).
- `TeamsPage` — renders list from GET /teams, empty state.
- `TeamDetailPage` — renders members, add member flow, remove member flow.
- `PipelineDetailPage` — edit mode toggle, save with validation, cancel restores values.

### MSW handler verification

The existing `dashboard/src/test/handlers.ts` already mocks `GET /jobs` — verify it returns the correct paginated shape. Add all new handlers listed in `contracts/screens.md`.

---

## Key Files Reference

| File | Purpose |
|---|---|
| `src/api/routes/jobs.router.ts` | Add `GET /jobs` route |
| `src/api/routes/teams.router.ts` | Add `GET /teams` route |
| `src/api/controllers/jobs.controller.ts` | Add `listJobsHandler`, fix `getDeliveryAttempts` |
| `src/api/controllers/teams.controller.ts` | Add `listTeamsHandler` |
| `src/services/job.service.ts` | Add `listJobs`, fix `getDeliveryAttempts` pagination |
| `src/services/team.service.ts` | Add `listTeams` |
| `dashboard/src/pages/RegisterPage.tsx` | New file |
| `dashboard/src/pages/TeamsPage.tsx` | New file |
| `dashboard/src/pages/TeamDetailPage.tsx` | New file |
| `dashboard/src/components/SigningSecretPanel.tsx` | New file |
| `dashboard/src/pages/PipelineDetailPage.tsx` | Add Security tab + edit mode |
| `dashboard/src/App.tsx` | Add new routes |
| `dashboard/src/components/Sidebar.tsx` | Add Teams link |
| `dashboard/src/test/handlers.ts` | Add new MSW handlers |
