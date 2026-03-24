# Feature Specification: Delivery Attempts Tab & Per-Pipeline Rate Limiting

**Feature Branch**: `011-delivery-attempts-tab`
**Created**: 2026-03-24
**Status**: Draft
**Input**: User description: "Add a Delivery Attempts tab to the pipeline job detail view in the dashboard (UI + API). Add per-pipeline rate limiting on the webhook ingest endpoint — each pipeline's source URL enforces a request rate cap, returns 429 with Retry-After when exceeded, and the limit is configurable per pipeline with a sensible default stored alongside the pipeline record."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - View Delivery Attempts for a Job (Priority: P1)

A developer notices a job is marked as failed and wants to understand why. They open the job from the pipeline's Jobs tab and navigate to a Delivery Attempts sub-tab. They see a list of every attempt made to deliver the processed payload to each subscriber URL — the HTTP status code returned, how long each attempt took, which attempt number it was, and whether it ultimately succeeded or failed.

**Why this priority**: Core diagnostic value. Delivery failures are the most common reason a user investigates a job; without this tab the information is completely inaccessible from the dashboard.

**Independent Test**: Open a job that has at least one failed delivery attempt → click the Delivery Attempts tab → confirm the table shows the subscriber URL, HTTP status code, response time, attempt number, and outcome for each attempt.

**Acceptance Scenarios**:

1. **Given** a job with multiple delivery attempts across multiple subscriber URLs, **When** the user opens the Delivery Attempts tab, **Then** every attempt is listed with its subscriber URL, HTTP status code, response time, attempt number, and a success/failure indicator.
2. **Given** a job where all deliveries succeeded on the first try, **When** the user views the tab, **Then** all rows show attempt number 1 and a success state.
3. **Given** a job where a subscriber required 3 retries before succeeding, **When** the user views the tab, **Then** all 3 attempts are shown for that subscriber URL with the last one marked successful.
4. **Given** a job where a subscriber exhausted all retries, **When** the user views the tab, **Then** all attempts for that subscriber are shown as failed.

---

### User Story 2 - Empty and Pending States for Delivery Attempts (Priority: P2)

A user opens a job that was filtered out by its pipeline action (no delivery triggered) or is still being processed. The Delivery Attempts tab exists but has no rows and renders a clear, helpful message rather than a blank area.

**Why this priority**: Prevents a broken-looking tab for valid and common job states. Necessary for a polished experience.

**Independent Test**: Open a COMPLETED job with no delivery attempts → the Delivery Attempts tab displays an empty state message rather than a blank or broken table.

**Acceptance Scenarios**:

1. **Given** a job that completed without delivering to any subscriber, **When** the user opens the Delivery Attempts tab, **Then** an empty state message is shown explaining no deliveries were made.
2. **Given** a job still in QUEUED or PROCESSING status, **When** the user views the tab, **Then** a message indicates delivery has not started yet.

---

### User Story 3 - Webhook Ingest Is Rate Limited Per Pipeline (Priority: P1)

A malicious actor or a misconfigured upstream system begins flooding a pipeline's source URL with hundreds of requests per minute. The service enforces a per-pipeline request cap. Once the cap is exceeded within the configured window, subsequent requests are immediately rejected with a standard "too many requests" response that tells the caller when to retry.

**Why this priority**: Protects the job queue and worker infrastructure from being overwhelmed. Without this, a single abusive source can degrade the entire service for all users.

**Independent Test**: Send requests to a pipeline's source URL faster than its configured limit → requests beyond the limit receive a 429 response with a `Retry-After` header → requests after the window resets are accepted normally.

**Acceptance Scenarios**:

1. **Given** a pipeline with a rate limit of 60 requests per minute, **When** the 61st request arrives within the same minute window, **Then** the service rejects it with a 429 status and a `Retry-After` header indicating when the window resets.
2. **Given** a pipeline where the rate limit window has expired, **When** new requests arrive, **Then** they are accepted normally up to the limit again.
3. **Given** a pipeline using the default rate limit (no custom limit set), **When** requests arrive, **Then** the default cap is enforced identically to a custom-configured limit.
4. **Given** two different pipelines, **When** one pipeline's limit is exceeded, **Then** the other pipeline's ingest endpoint is unaffected.

---

### User Story 4 - Configure Rate Limit When Creating or Editing a Pipeline (Priority: P2)

A pipeline owner wants to set a custom request rate cap for their pipeline's source URL because they know their upstream system sends bursts of 200 events per minute. When creating or editing a pipeline, they can specify a rate limit. The field is optional and pre-filled with the system default so they only need to change it when they have a specific requirement.

**Why this priority**: Without configurability, the feature is useful but inflexible. High-volume legitimate use cases would be incorrectly blocked by a one-size-fits-all default.

**Independent Test**: Create a pipeline with a custom rate limit of 200 req/min → verify that 200 requests succeed and the 201st is rejected with 429 → edit the pipeline to change the limit → verify the new limit takes effect.

**Acceptance Scenarios**:

1. **Given** the Create Pipeline form, **When** the user leaves the rate limit field blank, **Then** the pipeline is created with the system default limit.
2. **Given** the Create Pipeline form, **When** the user enters a custom limit, **Then** the pipeline is created with that limit and it is enforced on ingest.
3. **Given** an existing pipeline, **When** the owner edits the rate limit to a new value, **Then** the new limit takes effect immediately for subsequent requests.
4. **Given** an invalid rate limit value (zero, negative, or non-numeric), **When** the user tries to save, **Then** an inline validation error is shown and the pipeline is not saved.

---

### Edge Cases

- What if a response time is unavailable for a delivery attempt (timeout before response)? → Display a dash.
- What if a job has attempts to many subscribers with many retries? → All attempts shown in a flat chronological list; no pagination for MVP.
- What if two pipelines share a source (not possible by design, but worth noting the rate limit is keyed per pipeline, not per IP).
- What is the maximum configurable rate limit? → Capped at a reasonable upper bound (e.g. 1,000 req/min) to prevent accidental misconfiguration that bypasses the protection.
- What happens to the `Retry-After` value — is it seconds or a timestamp? → Standard practice is seconds remaining until the window resets.

## Requirements *(mandatory)*

### Functional Requirements

**Delivery Attempts (US1 & US2)**

- **FR-001**: The job detail view MUST include a Delivery Attempts tab alongside existing tabs.
- **FR-002**: The tab MUST display one row per individual attempt, not one row per subscriber.
- **FR-003**: Each row MUST show: subscriber URL, HTTP status code, response time, attempt number, and a success/failure indicator.
- **FR-004**: Rows MUST be ordered chronologically, earliest first.
- **FR-005**: The tab MUST display an appropriate empty state when no delivery attempts exist.
- **FR-006**: Missing response time MUST display as a dash rather than an error.
- **FR-007**: The success/failure indicator MUST use a visual treatment (colour or icon) so users can scan outcomes at a glance.
- **FR-008**: Only the pipeline owner or a team member MUST be able to view delivery attempts.

**Rate Limiting (US3 & US4)**

- **FR-009**: Each pipeline's ingest endpoint MUST enforce a per-pipeline request rate cap.
- **FR-010**: When the rate cap is exceeded, the service MUST respond with HTTP 429 and a `Retry-After` header indicating seconds until the window resets.
- **FR-011**: The rate limit MUST be configurable per pipeline and stored alongside the pipeline record.
- **FR-012**: A system-wide default rate limit MUST apply to pipelines where no custom limit is set. Default: 60 requests per minute.
- **FR-013**: The rate limit MUST be enforceable as an optional field when creating or editing a pipeline via the dashboard.
- **FR-014**: Invalid rate limit values (zero, negative, non-integer) MUST be rejected with a validation error.
- **FR-015**: Rate limit enforcement MUST be isolated per pipeline — one pipeline reaching its limit MUST NOT affect others.
- **FR-016**: The maximum configurable rate limit MUST be capped at 1,000 requests per minute.

### Key Entities

- **Delivery Attempt**: A single outbound call to one subscriber URL. Carries: subscriber URL, HTTP status code, response time in milliseconds (nullable), attempt number, and a succeeded boolean. Belongs to one job.
- **Job**: A unit of work from an inbound webhook. Has a status and owns zero or more delivery attempts.
- **Pipeline Rate Limit**: A per-minute request cap attached to a pipeline. Has a numeric limit value and a window duration (fixed at 1 minute for MVP). Defaults to 60 if not set.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can identify the cause of a delivery failure without leaving the dashboard.
- **SC-002**: All delivery attempts for a job load and display within 2 seconds of opening the tab.
- **SC-003**: Users can distinguish successful from failed delivery attempts at a glance without reading status codes.
- **SC-004**: The delivery attempts tab renders without errors for all job states: QUEUED, PROCESSING, COMPLETED, FAILED.
- **SC-005**: A pipeline receiving requests beyond its rate cap responds with 429 in under 50ms (no queuing or processing work is done for rejected requests).
- **SC-006**: Legitimate requests within the rate cap are never rejected — the rate limiter has zero false positives under normal load.
- **SC-007**: A pipeline owner can configure a custom rate limit and have it take effect within one request of saving the change.

## Assumptions

- Delivery attempt records already exist in the data store with all required fields. No schema changes are needed for US1/US2.
- Pagination for delivery attempts is out of scope for this release (bounded by retry limit × subscriber count, typically under 50 rows).
- Response time is stored as whole-number milliseconds; display as `Nms` or `N.Ns`.
- US1/US2 are read-only — manual retry triggering is out of scope.
- Rate limiting (US3/US4) requires a schema change: a `rateLimitPerMinute` integer column on the pipelines table, nullable (null = use system default).
- The rate limit window is fixed at 1 minute for this release. Configurable windows are out of scope.
- Rate limit state (request counts within a window) is stored in-memory or in Redis — not in the primary database. Exact storage mechanism is a planning-phase decision.
- The `Retry-After` header value is expressed in whole seconds.
