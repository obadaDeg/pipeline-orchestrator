# Research: Dashboard API Parity & Bug Fixes

**Feature**: 008-dashboard-api-parity
**Date**: 2026-03-23
**Branch**: `008-dashboard-api-parity`

## Codebase Audit Summary

### What Was Found

| Area | Finding |
|---|---|
| `GET /jobs` (global list) | Does not exist. Only `GET /jobs/:id` and `GET /jobs/:id/delivery-attempts` are defined. |
| Delivery attempts response | Returns `{ data: { items: [...] } }` — no `total`, `page`, `limit` fields. |
| `PATCH /pipelines/:id` | Exists and is functional. Not surfaced in the dashboard at all. |
| `POST /auth/register` | Exists. Accepts `{ email, password }` — no `name` field in schema. Returns `{ user, apiKey }`. |
| Teams API | Full CRUD exists: POST /teams, GET /teams/:id, DELETE /teams/:id, POST/DELETE /teams/:id/members. No list-all-teams endpoint. |
| Signing secrets API | Full CRUD exists on `/pipelines/:id/signing-secret`. Dashboard has zero UI for it. |
| Response envelope | All responses use `{ data: <payload> }`. `useApi` hook unwraps `data` before returning to callers. |
| Pagination utilities | `parsePagination()` and `paginatedResponse()` in `src/lib/pagination.ts` — ready to reuse. |
| MSW test handlers | Already mock `GET /jobs` in `dashboard/src/test/handlers.ts` with correct paginated shape. |
| AuthContext | Stores `apiKey` + `userEmail` in localStorage. `login(key, email)` method handles both. |

---

## Decision Log

### D-001: How to implement GET /jobs (global list)

**Decision**: Add a new `GET /jobs` endpoint in the backend scoped to the authenticated user's pipelines.

**Rationale**: The dashboard's `JobsPage` already calls `/jobs?page=X&limit=20` and the MSW handler mocks it correctly. Redesigning the page to remove global job visibility would reduce navigational value. The implementation follows the exact same pattern as `GET /pipelines` — query user's pipeline IDs, join to jobs, paginate.

**Approach**:
- Filter jobs to pipelines owned by `req.user!.id` (via `ownerUserId`) or team-owned pipelines the user belongs to.
- Support optional `?pipelineId=<uuid>` query parameter for filtering to a single pipeline.
- Reuse `parsePagination()` and `paginatedResponse()` utilities.
- Mount at `GET /jobs` in the jobs router (before `GET /jobs/:id` to avoid path conflicts).

**Alternatives considered**:
- Redesign JobsPage to use per-pipeline navigation only — rejected because it removes a useful cross-pipeline jobs overview.
- Aggregate client-side by fetching all pipelines then all jobs — rejected because it would not scale and is unnecessary server work.

---

### D-002: Fix delivery attempts pagination

**Decision**: Update `getDeliveryAttempts` controller to accept `?page` and `?limit` query parameters and return full pagination metadata.

**Rationale**: The dashboard's `JobDetailPage` calls `/jobs/:id/delivery-attempts?page=X&limit=50` and expects `{ items, total, page, limit }`. The current controller ignores query params and returns only `{ items }`. This is a one-function fix in the controller + one-query fix in the service.

**Approach**:
- Controller: call `parsePagination(req.query)` and pass `{ limit, offset }` to service.
- Service: update `getDeliveryAttempts` to accept pagination params; return `{ items, total }` using a count query.
- Controller: wrap result with `paginatedResponse(items, total, page, limit)`.

---

### D-003: Registration — name field

**Decision**: Do not add a `name` field to the registration flow. Keep the form to `email` + `password` only, matching the existing backend schema.

**Rationale**: The backend `POST /auth/register` schema only accepts `{ email, password }`. Adding a `name` field would require a backend schema + DB column change that is out of scope. The spec's assumption about a `name` field was incorrect — the backend was already fully built without it.

**Impact on spec**: FR-012 "collect name, email, and password" should be read as "collect email and password". The registration page will have two fields.

---

### D-004: Teams listing endpoint

**Decision**: Add `GET /teams` endpoint that returns all teams where the authenticated user is owner or member.

**Rationale**: Without a teams listing endpoint, the Teams UI has no way to show which teams a user belongs to. The `GET /teams/:id` single-team endpoint alone is insufficient to build a teams landing page. This is a small addition to the teams router following the same auth-scoped pattern as pipelines.

**Approach**:
- New controller `listTeams` — joins `teams` with `team_memberships`, returns all teams where `ownerUserId = req.user!.id OR userId = req.user!.id`.
- Response: `{ data: { items: Team[] } }` — no pagination needed initially (teams per user expected to be small).

---

### D-005: Signing secret — reveal-once pattern

**Decision**: Display the raw signing secret in a one-time copyable text field immediately after generation or rotation. The field is cleared when the user navigates away from the panel.

**Rationale**: The backend already enforces reveal-once (secret is never stored in plaintext; only the HMAC hash is persisted). The dashboard must mirror this — the `POST` response contains `secret` only on that response. The UI must clearly communicate that this is the only time the value is visible.

**Approach**:
- Store the returned `secret` in local React state within the SigningSecretPanel component.
- Display with a "Copy" button and a warning message.
- Clear state on unmount or when switching tabs.
- After rotation, the old secret is invalidated by the backend — no special handling needed on the frontend.

---

### D-006: AuthContext for registration flow

**Decision**: After a successful `POST /auth/register`, extract `apiKey.key` and `user.email` from the response and call `auth.login(apiKey.key, user.email)`.

**Rationale**: `AuthContext.login()` already handles storing to localStorage and navigating to `/`. Registration and login share the same post-success flow. The register endpoint returns the auto-created "Default" API key in the same shape as a login response.

---

### D-007: Pipeline edit scope

**Decision**: Limit pipeline editing to `name` and `description` fields only.

**Rationale**: The backend `PATCH /pipelines/:id` accepts `name`, `description`, and `teamId`. Changing `teamId` (team ownership transfer) has complex access-control implications (the target team must exist, user must be owner). This is out of scope for the current feature. Changing `actionType` or `actionConfig` could break active pipelines and is similarly out of scope.

---

## Open Questions (Resolved)

| Question | Answer |
|---|---|
| Does GET /jobs need user-scoping? | Yes — only return jobs from pipelines owned by or accessible to the authenticated user. |
| What pagination limit for delivery attempts? | Dashboard requests `limit=50`; cap at 100 (same as other endpoints). |
| Can any team member edit pipelines? | No — only the pipeline owner (ownerUserId). Team member access is read-only for now. |
| Should teams listing include member count? | Yes — include member count in the list response to avoid N+1 on the UI. |
