# Feature Specification: Demo Seed Data & Webhook Inbound URL

**Feature Branch**: `009-demo-seeds-webhook-url`
**Created**: 2026-03-24
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Display Webhook Inbound URL on Pipeline Detail (Priority: P1)

A developer opens a pipeline's detail page and immediately sees the URL they need to configure in their external service (GitHub, Stripe, Slack, etc.) to start sending webhooks. They copy it with one click and paste it into the third-party webhook settings screen.

**Why this priority**: Without the inbound URL, a user cannot send any webhooks — the entire product is a dead end. This is the single most impactful change for a live demo.

**Independent Test**: Open any pipeline detail page. The inbound webhook URL is visible and has a working copy button. Copying the URL and sending a POST request to it produces a new job in the Jobs tab.

**Acceptance Scenarios**:

1. **Given** a pipeline exists, **When** a user navigates to its detail page, **Then** a clearly labelled "Webhook URL" is displayed in the Overview tab showing the full inbound URL for that pipeline.
2. **Given** the webhook URL is displayed, **When** the user clicks the copy button, **Then** the URL is written to the clipboard and a brief confirmation appears.
3. **Given** two different pipelines, **When** a user views each detail page, **Then** each shows a distinct URL.
4. **Given** the displayed URL, **When** a user sends a POST request with a JSON body to it, **Then** a new job appears in the pipeline's Jobs tab.

---

### User Story 2 — Bootstrap the App with Realistic Demo Data (Priority: P1)

A developer running the application locally finds the app pre-populated with a realistic dataset: a demo account, two teams, three pipelines (one per action type), one signing secret, and a history of processed jobs with delivery attempts. They can explore every feature without manually creating any data.

**Why this priority**: An empty app is unconvincing in a demo. Seed data lets a presenter walk through teams, pipelines, jobs, delivery attempts, signing secrets, and account management without live setup time.

**Independent Test**: Run the seed command against a fresh database, then log in with the demo credentials. Every page shows populated data with no manual entry required.

**Acceptance Scenarios**:

1. **Given** a fresh database, **When** the seed command is run, **Then** it completes without errors and prints a summary of created records.
2. **Given** the seed has run, **When** the demo user logs in with the published credentials, **Then** they see a populated pipelines list with at least three entries.
3. **Given** the seeded state, **When** the user navigates to Jobs, **Then** they see a list of completed and failed jobs across multiple pipelines.
4. **Given** the seeded state, **When** the user opens any seeded job, **Then** they see at least one delivery attempt with a recorded response.
5. **Given** the seeded state, **When** the user navigates to Teams, **Then** they see two teams with at least one member each.
6. **Given** the seeded state, **When** the user opens a seeded pipeline that has a signing secret, **Then** the Security tab shows "Active" status with a hint.
7. **Given** an already-seeded database, **When** the seed command is run again, **Then** it does not create duplicate records and completes without error.

---

### Edge Cases

- What if the seed command is run on a database that already has the demo user? It must upsert or skip — not error.
- What if the webhook URL display encounters a pipeline with a missing source identifier? The UI must show a placeholder rather than crash.
- What if the app is running behind a reverse proxy or on a non-standard port? The inbound URL must reflect the configured public base URL, not hardcoded localhost.

---

## Requirements *(mandatory)*

### Functional Requirements

**Webhook URL Display**

- **FR-001**: The pipeline detail page MUST display the full inbound webhook URL in the Overview tab.
- **FR-002**: The inbound URL MUST be unique per pipeline, derived from each pipeline's source identifier.
- **FR-003**: The URL display MUST include a one-click copy button that writes the URL to the clipboard.
- **FR-004**: After copying, the system MUST show a brief visual confirmation (button label change or toast).
- **FR-005**: The displayed URL MUST be constructed using a `VITE_PUBLIC_URL` environment variable as the base, falling back to the browser's current origin if the variable is not set. This ensures the URL is valid in all environments (local, staging, production) without hardcoding.
- **FR-006**: If the source identifier is unavailable, the UI MUST show a placeholder rather than a malformed URL.

**Demo Seed Data**

- **FR-007**: A single runnable seed command MUST exist, executable from the project root.
- **FR-008**: The seed MUST create a demo user with the fixed credentials: email `demo@example.com`, password `Password123!`. These credentials MUST be documented in the project quickstart.
- **FR-009**: The seed MUST create at least two API keys for the demo user.
- **FR-010**: The seed MUST create two teams, each owned by the demo user with at least one additional member.
- **FR-011**: The seed MUST create three pipelines — one per action type (field extractor, payload filter, HTTP enricher) — each assigned to a team.
- **FR-012**: At least one seeded pipeline MUST have an active signing secret.
- **FR-013**: The seed MUST create at least ten jobs across seeded pipelines with a mix of completed and failed statuses.
- **FR-014**: Each seeded job MUST have at least one delivery attempt with a recorded HTTP status code and response body.
- **FR-015**: The seed MUST be idempotent — running it on an already-seeded database MUST NOT create duplicate records. Idempotency is achieved by matching on natural keys (email for users, name for teams and pipelines) and skipping records that already exist.
- **FR-016**: The seed MUST print a human-readable completion summary (counts of records created or skipped).

### Key Entities

- **Pipeline**: Has a unique source identifier used to construct the inbound URL — pattern is `{BASE_URL}/api/webhooks/{sourceId}`.
- **Seed Script**: A standalone executable that inserts a fixed, well-known dataset. Idempotent on re-run.
- **Demo User**: A fixed account (known email + password) created by the seed to demonstrate all authenticated features.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can locate and copy the inbound webhook URL for any pipeline in under 10 seconds without consulting documentation.
- **SC-002**: After copying the URL and sending a POST request to it, a new job appears in the pipeline's Jobs tab within 5 seconds.
- **SC-003**: Running the seed command on a blank database completes in under 30 seconds and produces a non-empty pipelines list, jobs list, and teams list on first login.
- **SC-004**: Running the seed command a second time produces zero new records and exits without error.
- **SC-005**: A demo presenter can walk through all six major features (pipelines, jobs, delivery attempts, teams, signing secrets, API keys) using only seeded data, with no manual record creation.
- **SC-006**: The webhook URL displayed in the UI matches the URL that successfully receives webhooks in the running environment — no failures due to wrong host or port.

## Clarifications

### Session 2026-03-24

- Q: How is the public base URL provided to the frontend? → A: `VITE_PUBLIC_URL` environment variable, falling back to `window.location.origin` if not set.
- Q: What are the demo user credentials? → A: `demo@example.com` / `Password123!`, documented in quickstart.
- Q: How does the seed detect existing records to stay idempotent? → A: Match on natural keys (email for users, name for teams/pipelines) — skip if already exists.
