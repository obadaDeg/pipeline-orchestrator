# Feature Specification: Real-World Integration Examples

**Feature Branch**: `013-real-world-integrations`
**Created**: 2026-03-25
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 - GitHub Webhook Integration (Priority: P1)

A developer registers the Pipeline Orchestrator as a webhook receiver on a GitHub repository. When they push a commit or open a pull request, GitHub sends an event to the pipeline, a job is created, the payload is processed through the configured action, and the result is delivered to a subscriber. The pipeline is configured without an inbound signing secret (unsigned mode) because GitHub's `X-Hub-Signature-256` header format is structurally incompatible with the pipeline's `X-Webhook-Signature` scheme. The developer can watch the entire flow in the dashboard and in their subscriber terminal in real time.

**Why this priority**: This is the highest-value integration — it demonstrates a complete, production-like end-to-end flow with a real external service using real HMAC signature verification. It makes the system tangibly real and is the headline feature for demos.

**Independent Test**: Can be tested end-to-end by running the system locally, exposing it via a tunnel, configuring a GitHub webhook on a real repository, and pushing a commit. A new `COMPLETED` job should appear in the dashboard within seconds.

**Acceptance Scenarios**:

1. **Given** the API is running and exposed via a public HTTPS URL, **When** the developer runs the GitHub integration setup script with their GitHub token, repo name, tunnel URL, pipeline source ID, and signing secret, **Then** a webhook is registered on the GitHub repository that sends `push`, `pull_request`, and `release` events to the pipeline ingest endpoint.

2. **Given** the GitHub webhook is registered and a subscriber is attached to the pipeline, **When** the developer pushes a commit to the GitHub repository, **Then** a signed POST request arrives at the pipeline ingest endpoint, passes HMAC signature verification, creates a job, processes the payload, delivers it to the subscriber, and the dashboard shows a new `COMPLETED` job.

3. **Given** a GitHub webhook is registered, **When** the developer runs the delete script with the hook ID, **Then** the webhook is removed from the GitHub repository.

4. **Given** the GitHub pipeline is configured without an inbound signing secret (unsigned mode), **When** a GitHub webhook arrives carrying `X-Hub-Signature-256`, **Then** the pipeline accepts the request and creates a job — the pipeline does not attempt to verify the GitHub-format signature.

---

### User Story 2 - Public Tunnel Exposure (Priority: P1)

A developer exposes their locally running API over a public HTTPS URL using a tunnel tool so that external platforms (GitHub, etc.) can send webhooks to it. The guide walks through installing the tunnel tool, authenticating, starting a tunnel, and using the resulting URL when registering webhooks on external platforms.

**Why this priority**: The tunnel is a prerequisite for all external platform integrations (GitHub, webhook.site sending to the local API). Without a working tunnel, no real external integration is possible.

**Independent Test**: Can be tested independently by starting the tunnel and verifying that the public URL successfully forwards requests to the local API (e.g., `curl https://xxxx.ngrok-free.app/health` returns a response).

**Acceptance Scenarios**:

1. **Given** the developer has installed and authenticated the tunnel tool, **When** they run the tunnel command pointing at port 4000, **Then** a public HTTPS URL is displayed that forwards all requests to `localhost:4000`.

2. **Given** the tunnel is running, **When** an external service (or curl command) sends a request to the public tunnel URL, **Then** the request arrives at the local API and receives the correct response.

---

### User Story 3 - webhook.site as a Subscriber (Priority: P2)

A developer uses webhook.site as a zero-setup subscriber to visually inspect processed deliveries in their browser. They register a webhook.site URL as a subscriber on a pipeline, send a webhook to the ingest endpoint, and watch the processed payload appear in the webhook.site dashboard without needing to run any local server.

**Why this priority**: This provides instant gratification — no local server setup needed. It is ideal for quick demos and developers who want to see deliveries without writing any code.

**Independent Test**: Can be tested by opening webhook.site in a browser, copying the unique URL, registering it as a subscriber via the API or dashboard, sending a test webhook, and confirming the processed payload appears on webhook.site.

**Acceptance Scenarios**:

1. **Given** a pipeline exists and a webhook.site URL is registered as a subscriber, **When** the developer sends a webhook payload to the pipeline ingest endpoint, **Then** the processed payload is delivered to the webhook.site URL and appears in the webhook.site dashboard in real time.

2. **Given** the delivery arrives at webhook.site, **When** the developer views the delivery in the webhook.site dashboard, **Then** they can see all request headers, the processed JSON payload, and the delivery timestamp.

---

### User Story 4 - Local Subscriber Server (Priority: P2)

A developer runs a standalone subscriber server included in the project repository. The server listens for deliveries from the Pipeline Orchestrator, verifies the delivery signature if a secret is configured, and pretty-prints each delivery to the terminal showing the job ID, status, original payload, and processed result.

**Why this priority**: This is ideal for local development and live demos where the developer wants to see deliveries in their terminal alongside the dashboard without depending on a third-party service.

**Independent Test**: Can be tested by starting the subscriber server, registering `http://host.docker.internal:5050` as a subscriber on a pipeline, sending a webhook, and confirming the delivery appears in the server's terminal output.

**Acceptance Scenarios**:

1. **Given** the subscriber server is running on port 5050, **When** the Pipeline Orchestrator worker delivers a processed job, **Then** the server prints the job ID, status, and processed payload to the terminal in a readable, color-coded format.

2. **Given** the subscriber server is started with `SUBSCRIBER_SECRET` configured, **When** a delivery arrives with a valid `x-delivery-signature` header, **Then** the server prints a "signature valid" confirmation and returns `200 OK`.

3. **Given** the subscriber server is started with `SUBSCRIBER_SECRET` configured, **When** a delivery arrives with an invalid or missing signature, **Then** the server prints a "signature INVALID" error and returns `401 Unauthorized`.

4. **Given** the subscriber server is running without `SUBSCRIBER_SECRET`, **When** any delivery arrives, **Then** the server prints a notice that signature verification is not configured, accepts the delivery, and returns `200 OK`.

---

### Edge Cases

- What happens when the GitHub webhook is fired before the tunnel is running? The request is rejected by GitHub (connection refused) — the developer must ensure the tunnel is running before registering the webhook.
- What happens when the tunnel URL changes (tunnel restarted)? The registered GitHub webhook will fail — the developer must update the webhook URL on GitHub or re-run the setup script.
- What happens when the subscriber server is registered as `localhost:5050` instead of `host.docker.internal:5050`? The worker (running inside Docker) cannot reach the host — delivery will fail with a connection error. The guide must clearly document the correct URL for Docker environments.
- What happens when `WEBHOOK_SECRET` is set in the setup script? GitHub will generate an `X-Hub-Signature-256` header, but the pipeline does not read that header — verification is not performed. The pipeline accepts the request in unsigned mode regardless. The integration guide MUST document this behavior clearly so developers are not misled into thinking inbound signature verification is active.
- What happens when the subscriber server receives a non-JSON body? The server logs the raw body (up to 200 characters) and returns `400 Bad Request`.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The project MUST include a setup script that registers a GitHub webhook on a specified repository using environment variables for the GitHub token, repo name, tunnel URL, and pipeline source ID. The signing secret parameter MUST be optional; the recommended approach is to register the target pipeline without an inbound signing secret (unsigned mode), since GitHub's `X-Hub-Signature-256` verification scheme is incompatible with the pipeline's `X-Webhook-Signature` scheme. The integration guide MUST instruct users to create a GitHub Personal Access Token with the `admin:repo_hook` scope (minimum required; `repo` scope also works but grants broader access than necessary).
- **FR-002**: The project MUST include a delete script that removes a GitHub webhook from a repository given the hook ID and GitHub credentials.
- **FR-003**: The setup script MUST register the webhook for `push`, `pull_request`, and `release` event types.
- **FR-004**: The project MUST include a standalone subscriber server that listens for HTTP POST deliveries on a configurable port (default 5050).
- **FR-005**: The subscriber server MUST pretty-print each delivery to the terminal including job ID, status, processed result, and original payload.
- **FR-006**: The subscriber server MUST verify the `x-delivery-signature` HMAC-SHA256 header when `SUBSCRIBER_SECRET` is set in the environment, returning `401` for invalid signatures and `200` for valid ones.
- **FR-007**: `docs/DEMO.md` MUST be expanded to document how to expose the local API over a public HTTPS URL using a tunnel tool.
- **FR-008**: `docs/DEMO.md` MUST include a new section documenting how to use webhook.site as a zero-setup subscriber, including registering the URL, sending a test webhook, and viewing deliveries.
- **FR-009**: `docs/DEMO.md` MUST document how to run the complete GitHub integration end-to-end (tunnel → subscriber server → webhook registration → push commit → view job in dashboard), with the GitHub pipeline configured in unsigned mode.
- **FR-010**: All integration scripts MUST validate required environment variables on startup and print a clear usage error if any are missing.

### Key Entities

- **Integration Guide**: `docs/DEMO.md` — the canonical end-to-end reference document, expanded to cover all four integration scenarios with copy-paste commands, expected outputs, and cleanup steps.
- **Subscriber Server**: A standalone Node.js HTTP server included in the project that acts as a downstream delivery endpoint, supporting delivery signature verification and formatted terminal output.
- **Public Tunnel**: A tool-agnostic reverse proxy tunnel that exposes `localhost:4000` over a public HTTPS URL, enabling external platforms to send webhooks to the local API.
- **Setup Script**: A script that automates the registration of a GitHub webhook on a target repository, requiring no GitHub UI interaction.

## Assumptions

- The tunnel tool used in examples is ngrok (free tier), but the guide is written tool-agnostically so any HTTP tunnel works.
- The subscriber server is a development/demo tool only — it is not production-grade and does not need to handle high concurrency.
- The GitHub integration scripts already exist in `examples/github-integration/` and the subscriber server already exists in `examples/subscriber-server/` — this spec covers the completion and documentation of those artifacts.
- The `examples/` directory is not part of the production API or dashboard — it is a collection of runnable scripts for developers.
- Docker Compose networking means the worker reaches host services at `host.docker.internal` — this is documented in the integration guide.
- GitHub's `X-Hub-Signature-256` HMAC scheme (body-only, sent in a different header) is structurally incompatible with the pipeline's `X-Webhook-Signature` scheme (timestamp + body, separate timestamp header). For the GitHub integration, the pipeline runs in unsigned mode. These are two independent signing layers: GitHub's inbound signature vs the pipeline's outbound delivery signature.

## Clarifications

### Session 2026-03-25

- Q: How should inbound GitHub webhook signature verification be handled given the header/format mismatch between GitHub's `X-Hub-Signature-256` and the pipeline's `X-Webhook-Signature`? → A: Use unsigned mode — configure the GitHub pipeline without an inbound signing secret; document that the two HMAC schemes are separate concepts.
- Q: Where should the integration guide live? → A: Expand `docs/DEMO.md` — add webhook.site as a new section and polish the existing GitHub/subscriber sections to match the spec.
- Q: What GitHub Personal Access Token scope should the guide instruct users to request? → A: `admin:repo_hook` — minimum scope for webhook management, principle of least privilege.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A developer with no prior knowledge of the project can go from zero to receiving a real GitHub push event as a completed job in the dashboard in under 10 minutes by following only the integration guide.
- **SC-002**: The subscriber server correctly verifies delivery signatures 100% of the time — valid signatures produce `200 OK`, invalid signatures produce `401 Unauthorized`.
- **SC-003**: The GitHub setup script completes registration in a single command invocation with no interactive prompts, requiring only environment variables as input.
- **SC-004**: The integration guide covers all four integration scenarios (GitHub, webhook.site, local subscriber server, public tunnel) with copy-paste-ready commands for each step.
- **SC-005**: Every step in the integration guide produces a verifiable output that the developer can check before proceeding to the next step (e.g., tunnel URL displayed, hook ID printed, subscriber terminal shows delivery).
- **SC-006**: The subscriber server handles malformed, unsigned, and correctly signed deliveries gracefully — no crashes or unhandled promise rejections under any input.
