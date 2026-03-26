# Feature Specification: Webhook Simulator

**Feature Branch**: `014-webhook-simulator`
**Created**: 2026-03-26
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fire a Template Payload at a Pipeline (Priority: P1)

A developer opens a pipeline's detail page, clicks the Simulator tab, selects a pre-built payload template (e.g. "GitHub — push event"), and clicks "Fire Webhook". The system sends the payload to the pipeline's ingest endpoint exactly as an external service would, creating a real job that processes and completes. The developer never leaves the dashboard and needs no external tools.

**Why this priority**: This is the entire value of the feature — firing a realistic payload through a real pipeline with one click. Everything else builds on this.

**Independent Test**: Open any pipeline, go to the Simulator tab, select any template, click "Fire Webhook", and confirm a new COMPLETED job appears in the Jobs tab within a few seconds.

**Acceptance Scenarios**:

1. **Given** a pipeline exists and the developer is on its Simulator tab, **When** they select the "GitHub — push" template and click "Fire Webhook", **Then** the payload is sent to `POST /webhooks/:sourceId`, the response shows `202 Accepted`, and a new job appears in the Jobs tab.

2. **Given** a pipeline with a `field_extractor` action and a registered subscriber, **When** the developer fires the GitHub push template, **Then** the job processes through the action, delivers to the subscriber, and reaches `COMPLETED` status.

3. **Given** a pipeline with an active signing secret, **When** the developer fires a template payload, **Then** the simulator constructs a valid HMAC signature and the request is accepted (not rejected with 401).

4. **Given** the developer clicks "Fire Webhook", **When** the request completes, **Then** the response status (`202 Accepted` or an error code) is displayed inline — the developer does not need to open browser dev tools.

---

### User Story 2 - Edit the Payload Before Firing (Priority: P1)

A developer selects a template, modifies the pre-filled JSON in the payload editor (e.g. changes the repo name, amount, or event type), and fires the customised payload. The editor validates JSON and prevents firing if the payload is malformed.

**Why this priority**: Templates are starting points. Developers need to adjust values for their specific demo or test scenario. This is essential for the simulator to be useful beyond a single canned example.

**Independent Test**: Select a template, change a field value in the editor, fire the webhook, and confirm the job's raw payload in the dashboard shows the modified value.

**Acceptance Scenarios**:

1. **Given** a template is loaded in the editor, **When** the developer modifies a field value and fires, **Then** the job's stored raw payload reflects the edited content, not the original template.

2. **Given** the developer edits the payload to introduce invalid JSON (e.g. a missing closing brace), **When** they attempt to fire, **Then** the "Fire Webhook" button is disabled and an inline error indicates the JSON is invalid.

3. **Given** the developer has edited the payload, **When** they select a different template from the dropdown, **Then** the editor resets to the new template's content (with a confirmation if the current content was modified).

---

### User Story 3 - Switch Between Templates (Priority: P2)

A developer switches between payload templates — GitHub push, GitHub pull request, GitHub release, Stripe charge, Stripe payment intent, and a blank custom template — using a dropdown. Each selection pre-fills the editor with a realistic, correctly-shaped payload for that service and event type.

**Why this priority**: The value of the simulator increases with the variety of templates. Multiple templates let developers demo different pipeline action configurations without writing payloads from scratch.

**Independent Test**: Cycle through all 6 templates in the dropdown and confirm each one loads a distinct, valid JSON payload in the editor.

**Acceptance Scenarios**:

1. **Given** the developer opens the template dropdown, **When** they select "Stripe — charge.succeeded", **Then** the editor fills with a payload containing `type: "charge.succeeded"`, `amount`, `currency`, and `customer` fields representative of a real Stripe event.

2. **Given** the developer selects "Custom (blank)", **Then** the editor shows an empty JSON object `{}` ready for the developer to fill in.

3. **Given** the developer selects any GitHub template, **Then** the payload includes realistic fields matching GitHub's actual webhook schema for that event (`ref`, `repository`, `pusher`, etc. for push events).

---

### User Story 4 - See the Created Job Immediately (Priority: P2)

After firing a webhook, the developer can navigate directly to the resulting job without manually searching through the Jobs tab. The simulator shows a link or preview of the newly created job inline.

**Why this priority**: Closing the feedback loop — developers should be able to verify the job was processed correctly immediately after firing. Without this, they have to switch tabs and find the job manually.

**Independent Test**: Fire a webhook, click the resulting job link, and confirm it navigates to the correct Job Detail page showing the raw payload and processed result.

**Acceptance Scenarios**:

1. **Given** the developer fires a webhook and receives `202 Accepted`, **When** the response is displayed, **Then** a "View job →" link appears that navigates to the Job Detail page for the newly created job.

2. **Given** the developer clicks "View job →", **Then** the Job Detail page shows the simulator's payload as the raw payload and the action's output as the processed payload.

---

### Edge Cases

- What happens when the pipeline has no source URL configured? The "Fire Webhook" button is disabled with a tooltip explaining the pipeline is not yet active.
- What happens when the pipeline has a signing secret? The `fire-simulation` endpoint fetches the secret server-side, computes the HMAC, and attaches the correct headers before forwarding to the ingest endpoint — the request is always correctly signed.
- What happens when the ingest endpoint returns an error (e.g. 429 rate limited)? The response status and error message are shown inline in the simulator UI.
- What happens when the developer fires while a previous job is still processing? A new job is created independently — the simulator does not block or wait.
- What happens when the payload editor contains valid JSON but the pipeline action cannot process it (e.g. field_extractor with missing fields)? The job completes with `FAILED` status — this is expected behaviour and visible in the Jobs tab.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The pipeline detail page MUST include a "Simulator" tab alongside Overview, Jobs, and Subscribers.
- **FR-002**: The Simulator tab MUST provide a template dropdown with the following options: GitHub — push, GitHub — pull_request opened, GitHub — release published, Stripe — charge.succeeded, Stripe — payment_intent.created, Custom (blank).
- **FR-003**: Selecting a template MUST pre-fill the payload editor with a realistic, valid JSON payload for that service and event type.
- **FR-004**: The payload editor MUST validate JSON in real time and display an inline error when the content is not valid JSON.
- **FR-005**: The "Fire Webhook" button MUST be disabled when the payload editor contains invalid JSON.
- **FR-006**: Clicking "Fire Webhook" MUST send the payload to a dedicated `POST /pipelines/:id/fire-simulation` endpoint. The server fetches the pipeline's signing secret (if any), computes the HMAC signature, calls the ingest endpoint internally, and returns the ingest response to the client. The raw signing secret MUST NOT be exposed to the browser.
- **FR-007**: The `fire-simulation` endpoint MUST compute and attach the correct `X-Webhook-Signature` and `X-Webhook-Timestamp` headers when the pipeline has an active signing secret, ensuring signed pipelines are never rejected with 401 from the simulator.
- **FR-008**: The response status code and a brief message MUST be displayed inline in the Simulator tab after each fire (e.g. "202 Accepted — job created" or "401 Unauthorized").
- **FR-009**: On a `202` response, the simulator MUST display a link to the newly created job using the `jobId` from the response body.
- **FR-010**: The payload editor MUST use the same CodeMirror-based JSON editor already used in the pipeline action config editor (reuse existing component).

### Key Entities

- **Payload Template**: A named, pre-defined JSON object representing a realistic webhook payload from a specific external service and event type. Templates are defined statically in the frontend — they are not stored in the database.
- **Simulator Request**: A one-time POST to `POST /pipelines/:id/fire-simulation` carrying the editor's JSON payload. The server constructs and signs the ingest request internally. Not persisted separately — the resulting Job record is the only persistent artefact.
- **Simulation Endpoint**: A new authenticated REST endpoint (`POST /pipelines/:id/fire-simulation`) that accepts a raw JSON payload, optionally signs it using the pipeline's stored signing secret, fires it against the pipeline's ingest URL, and returns the ingest response (status + jobId).

## Assumptions

- The simulator requires one new backend endpoint (`POST /pipelines/:id/fire-simulation`). The raw signing secret is never sent to the browser — HMAC computation happens entirely server-side.
- Templates are hardcoded in the frontend — no backend changes are needed to store or serve them beyond the simulation endpoint.
- The payload editor reuses the existing CodeMirror component from the action config editor (feature 010).
- The simulation endpoint calls the ingest logic internally (or proxies to `POST /webhooks/:sourceId`) — the pipeline's full processing chain runs as normal.
- After firing, the Jobs tab does not auto-refresh; the developer clicks the "View job →" link to navigate directly to the new job.

## Clarifications

### Session 2026-03-26

- Q: How should the simulator handle HMAC signing for signed pipelines given the frontend cannot access the raw secret? → A: New `POST /pipelines/:id/fire-simulation` endpoint — server computes signature and fires internally; raw secret stays on the server.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer can fire a realistic GitHub push event at a pipeline and see a completed job in under 30 seconds, without leaving the dashboard or using any external tool.
- **SC-002**: All 6 templates load correctly and produce valid JSON payloads that are accepted by the ingest endpoint (`202 Accepted`) on an unsigned pipeline.
- **SC-003**: Firing against a signed pipeline succeeds without signature errors 100% of the time — the simulator always computes the correct HMAC.
- **SC-004**: Invalid JSON in the payload editor is caught before the request is sent — zero malformed requests reach the API from the simulator.
- **SC-005**: The developer can navigate to the resulting job in one click from the simulator response area.
