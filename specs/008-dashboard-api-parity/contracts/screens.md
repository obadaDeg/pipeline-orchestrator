# UI Screen Contracts: Dashboard API Parity & Bug Fixes

**Feature**: 008-dashboard-api-parity
**Date**: 2026-03-23

---

## New Pages

### /register — Registration Page

**Route**: `/register`
**Access**: Unauthenticated only (redirect to `/` if already logged in)
**Linked from**: Login page ("Create account" link)

**Layout**: Centered card, same visual style as LoginPage.

**Form fields**:
| Field | Type | Validation |
|---|---|---|
| Email | text/email | Required, valid email format |
| Password | password | Required, minimum 8 characters (client-side check before submit) |

**Actions**:
- **Submit ("Create account")**: POST /auth/register → on success, call `auth.login(apiKey.key, user.email)` → redirects to `/`
- **Login link**: Navigate to `/login`

**States**:
- Default — empty form
- Submitting — button disabled, spinner shown
- Error — server error message shown below form (e.g., "Email already registered")
- Client validation error — field-level error messages shown inline (no server call made)

---

### /teams — Teams List Page

**Route**: `/teams`
**Access**: Authenticated
**Linked from**: Sidebar navigation

**Content**:
- Page title: "Teams"
- "New Team" button (top-right)
- List of teams (cards or table rows), each showing:
  - Team name
  - "Owner" or "Member" badge
  - Member count
  - "View" link → navigates to `/teams/:id`
- Empty state: "You don't belong to any teams yet. Create one to get started."

**Actions**:
- **New Team**: Opens CreateTeamModal → on success, navigates to `/teams/:id`

**Data source**: `GET /teams`

---

### /teams/:id — Team Detail Page

**Route**: `/teams/:id`
**Access**: Authenticated (owner or member of the team)

**Content**:
- Team name (heading)
- Owner badge (shows "You" if authenticated user is owner)
- Members table:
  - Columns: Email, Added date, Actions
  - "Remove" button per member row (owner only, not shown for owner's own row)
- "Add Member" button (owner only)
- "Delete Team" button (owner only, danger zone / bottom of page)

**Actions**:
- **Add Member**: Text input + submit → POST /teams/:id/members `{ email }` → member appears in list
- **Remove Member**: Inline button → ConfirmDialog → DELETE /teams/:id/members/:userId → member removed from list
- **Delete Team**: ConfirmDialog → DELETE /teams/:id → navigate to `/teams`

**Error states**:
- Add member: "No user found with that email" / "User is already a member"
- 403 on any action: show error toast

**Data source**: `GET /teams/:id`

---

## Modified Pages

### PipelineDetailPage — Signing Secrets Panel (new section)

**Added to**: Existing `PipelineDetailPage` at `/pipelines/:id`
**Placement**: New "Security" tab alongside existing tabs (Overview, Jobs)

**States**:

**State A — No secret configured**:
- Label: "Signing Secret"
- Status: "Not configured"
- Description: "Generate a secret to verify webhook authenticity using HMAC-SHA256 signatures."
- Button: "Generate Secret"

**State B — Secret just generated/rotated (one-time reveal)**:
- Status badge: "Active"
- Secret field: read-only text input showing full hex string + "Copy" button
- Warning banner: "This is the only time this secret will be shown. Copy it now."
- Hint shown: "Hint: abc123…"
- Actions: "Rotate" button, "Revoke" button

**State C — Active (returning to page after generation)**:
- Status badge: "Active"
- Hint shown: "Hint: abc123…" (no raw secret visible)
- Created: formatted date
- Actions: "Rotate" button, "Revoke" button

**State D — No secret (after revoke)**:
- Returns to State A

**Confirmation dialogs**:
- Rotate: "Rotating the secret will immediately invalidate the current one. Any services using the old secret will fail verification. Continue?"
- Revoke: "Revoking the secret will disable signature verification for all incoming webhooks. Continue?"

**Data sources**:
- On mount: `GET /pipelines/:id/signing-secret` → determine State A or C
- Generate: `POST /pipelines/:id/signing-secret` → transition to State B
- Rotate: `POST /pipelines/:id/signing-secret` → transition to State B (after confirmation)
- Revoke: `DELETE /pipelines/:id/signing-secret` → transition to State A (after confirmation)

---

### PipelineDetailPage — Pipeline Editing (new action)

**Added to**: Existing pipeline Overview section

**Trigger**: "Edit" button next to the pipeline name/description in the overview header.

**Behaviour**:
- Clicking "Edit" toggles name and description into editable inline fields (or opens a SlideOver panel)
- Pre-filled with current values
- "Save" → `PATCH /pipelines/:id { name, description }` → updates displayed values on success → shows success toast
- "Cancel" → restores original values, exits edit mode

**Validation**:
- Name: Required. Empty name shows inline error, blocks save.
- Description: Optional.

**States**:
- View mode — static display
- Edit mode — editable fields, Save + Cancel buttons
- Saving — Save button disabled, spinner
- Error — toast notification with server error message

---

### JobsPage — Fixed global jobs list

**Route**: `/jobs`
**Change**: Previously broken (called `GET /jobs` which didn't exist). Now functional with new backend endpoint.

**No UI changes needed**: The page already renders correctly when the API returns data. The fix is entirely on the backend (adding the `GET /jobs` endpoint).

**Data source**: `GET /jobs?page=X&limit=20`

---

### JobDetailPage — Fixed delivery attempts pagination

**Route**: `/jobs/:id`
**Change**: Previously showed broken/empty pagination controls because backend returned no `total`, `page`, or `limit` fields.

**No UI changes needed**: The page already handles paginated responses correctly. The fix is entirely on the backend (adding pagination to `GET /jobs/:id/delivery-attempts`).

**Data source**: `GET /jobs/:id/delivery-attempts?page=X&limit=50`

---

## Updated MSW Test Handlers

The following new MSW handlers must be added to `dashboard/src/test/handlers.ts` to support unit tests for the new UI:

| Method | Path | Response |
|---|---|---|
| GET | /auth/register | 201 `{ user, apiKey }` |
| GET | /pipelines/:id/signing-secret | 200 `{ active, hint, createdAt }` |
| POST | /pipelines/:id/signing-secret | 201 `{ secret, hint, createdAt }` |
| DELETE | /pipelines/:id/signing-secret | 204 |
| PATCH | /pipelines/:id | 200 updated pipeline |
| GET | /teams | 200 `{ items: Team[] }` |
| GET | /teams/:id | 200 team with members |
| POST | /teams | 201 team |
| POST | /teams/:id/members | 201 membership |
| DELETE | /teams/:id/members/:userId | 204 |
| DELETE | /teams/:id | 204 |

Note: `GET /jobs` and `GET /jobs/:id/delivery-attempts` (paginated) are already mocked in the existing handlers file — verify they match the updated response shape.
