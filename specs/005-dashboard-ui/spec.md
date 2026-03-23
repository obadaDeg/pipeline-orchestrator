# Feature Specification: Dashboard UI

**Feature Branch**: `005-dashboard-ui`
**Created**: 2026-03-22
**Status**: Draft
**Input**: User description: "lets implement a dashboard UI as the stretch goal — a web interface where users can view their pipelines, monitor job status, see delivery attempts, and manage their account"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Pipeline Overview (Priority: P1)

A user logs into the dashboard and sees a list of all their pipelines at a glance. Each pipeline shows its name, current status, and a quick summary of recent activity. The user can create a new pipeline from this screen, or click into any pipeline to see more detail.

**Why this priority**: The pipeline list is the entry point to everything else. Without it, no other part of the dashboard delivers value.

**Independent Test**: Can be fully tested by logging in and verifying that created pipelines appear in the list with correct names and metadata. Delivers immediate value as a read-only monitoring view.

**Acceptance Scenarios**:

1. **Given** a user with two pipelines, **When** they open the dashboard, **Then** both pipelines are listed with name, action type, and subscriber count visible.
2. **Given** a user with no pipelines, **When** they open the dashboard, **Then** an empty state with a "Create pipeline" prompt is shown.
3. **Given** a logged-in user, **When** they click "Create pipeline", **Then** a form collects name, action type, action config, and subscriber URLs and submits to create the pipeline.
4. **Given** a pipeline in the list, **When** the user clicks it, **Then** they are taken to that pipeline's detail view.

---

### User Story 2 — Job Monitoring (Priority: P2)

A user selects a pipeline and sees a paginated history of all jobs that have run through it. Each job shows its status (Pending, Processing, Completed, Failed), when it was received, and a summary of the payload. Clicking a job reveals the full raw and processed payloads, plus a log of every delivery attempt including outcome and HTTP status.

**Why this priority**: Operational visibility into what's happening with jobs is the core value of a monitoring dashboard — more useful day-to-day than pipeline management.

**Independent Test**: Can be tested by sending webhooks through a pipeline and verifying the job list updates with correct statuses and that delivery attempts are visible per job.

**Acceptance Scenarios**:

1. **Given** a pipeline with 10 completed jobs, **When** the user views the pipeline detail, **Then** jobs are listed in reverse-chronological order with status badges and timestamps.
2. **Given** a job in the list, **When** the user clicks it, **Then** they see the raw payload, processed payload, and a table of delivery attempts with timestamp, outcome, and HTTP status code.
3. **Given** a pipeline with a failed job, **When** the user views job details, **Then** the error message and all retry attempts are visible.
4. **Given** more than 20 jobs, **When** the user views the list, **Then** pagination controls allow navigating through all jobs.

---

### User Story 3 — Account & API Key Management (Priority: P3)

A user visits their account page to view their active API keys, create a new named key, or revoke an existing one. They can also view their audit log to see a history of account activity.

**Why this priority**: Key management is already available via the API; surfacing it in the UI rounds out the experience but is not needed for core monitoring.

**Independent Test**: Can be tested by creating a key from the UI, verifying it appears in the list with a hint, revoking it, and confirming it disappears.

**Acceptance Scenarios**:

1. **Given** a user with two active API keys, **When** they visit the account page, **Then** both keys are listed with their name, prefix hint, and creation date — but not the full key value.
2. **Given** the account page, **When** the user creates a new key with a name, **Then** the full key is shown once in a copy prompt, and the list refreshes.
3. **Given** an active key in the list, **When** the user revokes it, **Then** it is removed from the list immediately.
4. **Given** the account page, **When** the user views the audit log tab, **Then** recent account events are listed with type, timestamp, and metadata.

---

### Edge Cases

- What happens when the session/API key expires mid-session? The user should be redirected to the login page without losing context.
- What happens when a pipeline has thousands of jobs? Pagination must prevent the page from becoming unusable.
- What happens when a webhook payload is very large (near the 1 MB limit)? The UI should truncate the display with an option to expand.
- What happens when the backend is unreachable? The UI shows a clear error state rather than a blank screen.
- What happens when a user has no API keys (e.g., all revoked)? They should still be able to log in via the login flow to generate a new one.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The dashboard MUST require authentication — unauthenticated users are redirected to a login page.
- **FR-002**: Users MUST be able to log in using their email and password and receive a session that persists across page refreshes.
- **FR-003**: The dashboard MUST display a paginated list of the authenticated user's pipelines.
- **FR-004**: Users MUST be able to create a new pipeline through the UI by providing name, action type, action configuration, and optional subscriber URLs.
- **FR-005**: Users MUST be able to delete a pipeline from the UI with a confirmation step.
- **FR-006**: The pipeline detail view MUST show a paginated, reverse-chronological list of all jobs for that pipeline.
- **FR-007**: Each job entry MUST display its status, creation timestamp, and a truncated payload preview.
- **FR-008**: Users MUST be able to click a job to view the full raw payload, processed payload, and all delivery attempts with outcomes and HTTP status codes.
- **FR-009**: The account page MUST list all active API keys with name, prefix hint, and creation date.
- **FR-010**: Users MUST be able to create a named API key and copy the full key value from a one-time display prompt.
- **FR-011**: Users MUST be able to revoke any of their API keys from the UI.
- **FR-012**: The account page MUST include a paginated audit log showing recent account events.
- **FR-013**: The dashboard MUST display clear error and empty states — no blank screens on API failure or missing data.
- **FR-014**: The UI MUST be served by the same backend — no separate hosting requirement.

### Key Entities

- **Session**: Represents an authenticated browser session; tied to the user's API key stored client-side.
- **Pipeline card**: A summary view of a pipeline — name, action type, subscriber count, job count.
- **Job row**: A summary view of a job — ID (truncated), status badge, received-at timestamp, payload preview.
- **Delivery attempt row**: Outcome badge, timestamp, HTTP status code, error detail if failed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can log in, view their pipelines, inspect a job's delivery attempts, and revoke an API key — all without leaving the browser — in under 3 minutes from a cold start.
- **SC-002**: The pipeline list and job history load within 2 seconds on a standard connection.
- **SC-003**: All data visible in the dashboard is consistent with what the REST API returns — no stale or fabricated state.
- **SC-004**: The UI remains usable (no blank screens, no unhandled errors) when the backend returns an error for any individual request.
- **SC-005**: A first-time visitor can navigate from the login page to viewing a job's delivery attempts without external documentation.

## Assumptions

- Authentication in the dashboard uses the existing email/password login endpoint; the returned API key is stored client-side and sent as a Bearer token on subsequent requests.
- The dashboard is a single-page application served as static files from the same Express server.
- No new backend endpoints are required — the dashboard consumes the existing REST API exclusively.
- Mobile responsiveness is a nice-to-have, not a hard requirement for this iteration.
- No real-time updates are in scope — the user refreshes or navigates to see updated state.
