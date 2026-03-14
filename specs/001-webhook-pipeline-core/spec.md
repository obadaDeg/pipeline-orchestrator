# Feature Specification: Webhook-Driven Task Processing Pipeline

**Feature Branch**: `001-webhook-pipeline-core`
**Created**: 2026-03-14
**Status**: Draft
**Input**: docs/requirements.md + docs/High-Level Architecture/ + .specify/memory/constitution.md

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Pipeline Management (Priority: P1)

A developer registers a new pipeline by providing a name, selecting a processing action
type, configuring that action, and providing one or more subscriber URLs. The system
returns a unique, stable source URL the developer can share with any external system
that should trigger the pipeline. The developer can later update or delete the pipeline.

**Why this priority**: All other stories depend on pipelines existing. Without pipeline
CRUD, nothing else can be demonstrated or tested.

**Independent Test**: A pipeline can be created, retrieved, updated, and deleted using
only the pipeline management endpoints. No webhooks need to be sent to verify this story.

**Acceptance Scenarios**:

1. **Given** no pipelines exist, **When** a user POSTs a valid pipeline with a name,
   action type, action config, and one subscriber URL, **Then** the system returns 201
   with the new pipeline object including a unique, non-guessable source URL.

2. **Given** a pipeline exists, **When** a user GETs it by ID, **Then** the full
   pipeline record including its subscriber URLs is returned.

3. **Given** a pipeline exists, **When** a user PATCHes its name or subscriber list,
   **Then** the updated pipeline is returned reflecting the changes.

4. **Given** a pipeline exists, **When** a user DELETEs it, **Then** 204 is returned
   and subsequent GETs return 404.

5. **Given** multiple pipelines exist, **When** a user GETs `/pipelines`, **Then** a
   paginated list is returned in a consistent envelope format.

6. **Given** a POST with a missing required field (e.g., no action type), **When**
   submitted, **Then** 422 is returned with a machine-readable error code and message.

---

### User Story 2 - Webhook Ingestion (Priority: P1)

An external system sends an HTTP POST to a pipeline's source URL. The service
immediately acknowledges the request and queues the payload for background
processing — the sender never waits for transformation or delivery to complete.

**Why this priority**: This is the entry point of the entire pipeline. Without
ingestion, there are no jobs to process or deliver.

**Independent Test**: An external caller POSTs to a source URL and receives 202 within
200ms. A Job record with status PENDING appears and the caller does not wait for
any further processing.

**Acceptance Scenarios**:

1. **Given** a valid pipeline source URL, **When** an external system POSTs a JSON
   payload to it, **Then** the system responds with 202 Accepted within 200ms (p95)
   and a Job record with status PENDING is created containing the raw payload.

2. **Given** a valid pipeline source URL, **When** an external system POSTs a
   non-JSON body, **Then** the system still responds with 202 and stores the raw body.

3. **Given** an unknown source URL, **When** an external system POSTs to it, **Then**
   the system responds with 404.

4. **Given** a valid pipeline source URL, **When** a non-POST method is used,
   **Then** the system responds with 405 Method Not Allowed.

---

### User Story 3 - Job Processing & Subscriber Delivery (Priority: P1)

After ingestion, a background worker picks up queued jobs, applies the pipeline's
configured processing action to transform the payload, and delivers the result via
HTTP POST to every subscriber URL. Failed deliveries are retried automatically with
exponential backoff up to a configured maximum.

**Why this priority**: This is the core value — transforming and forwarding events.
Without it the pipeline serves no purpose.

**Independent Test**: Given a PENDING job, the worker processes it and delivers the
result to subscribers. Verified by checking the job transitions to COMPLETED and
DeliveryAttempt records exist for each subscriber.

**Acceptance Scenarios**:

1. **Given** a PENDING job, **When** the worker picks it up, **Then** the job status
   transitions to PROCESSING before any action executes.

2. **Given** a job whose action succeeds and all subscribers respond with 2xx,
   **Then** the job transitions to COMPLETED and each subscriber has a SUCCESS
   DeliveryAttempt record.

3. **Given** a subscriber that returns a 500 error, **When** the worker first attempts
   delivery, **Then** a FAILED DeliveryAttempt is recorded and the delivery is
   scheduled for retry with exponential backoff.

4. **Given** a delivery that has reached the maximum retry count and still fails,
   **Then** the final DeliveryAttempt records MaxRetriesExceeded and the job transitions
   to FAILED.

5. **Given** a job whose action throws an unrecoverable error, **Then** the job
   transitions to FAILED immediately with no delivery attempts made.

6. **Given** each of the three action types (Field Extractor, Payload Filter, HTTP
   Enricher) configured in separate pipelines, **When** a webhook is sent to each,
   **Then** each produces the expected transformed output per its configuration.

---

### User Story 4 - Job Status & History (Priority: P2)

A developer can query the current status of any job, browse the job history for a
pipeline, and inspect every individual delivery attempt — all without requiring direct
database access.

**Why this priority**: Observability is essential for debugging and verification but
does not block the core pipeline flow from being demonstrated.

**Independent Test**: Using only the status API, a developer can trace a webhook from
ingestion to final delivery outcome, including all retry attempts and their outcomes.

**Acceptance Scenarios**:

1. **Given** a job ID, **When** a user GETs `/jobs/:id`, **Then** the full job record
   is returned including status, raw payload, processed payload (if complete), and
   timestamps.

2. **Given** a pipeline ID, **When** a user GETs `/pipelines/:id/jobs`, **Then** a
   paginated list of all jobs for that pipeline is returned ordered newest first.

3. **Given** a job ID, **When** a user GETs `/jobs/:id/delivery-attempts`, **Then**
   all delivery attempts are returned, each showing subscriber URL, HTTP status code,
   response snippet, timestamp, and attempt number.

4. **Given** a permanently failed job, **When** a user queries its delivery attempts,
   **Then** each failed attempt is visible, with the terminal attempt showing
   MaxRetriesExceeded status.

---

### Edge Cases

- What happens when a pipeline is deleted while a job for it is PENDING or PROCESSING?
  Jobs in flight are processed to completion (or failure); no new jobs are accepted for
  the deleted pipeline's source URL.
- What happens when a subscriber URL is unreachable (DNS failure, connection timeout)?
  Treated as a delivery failure; exponential backoff retry applies identically.
- What happens when the worker process crashes while a job is PROCESSING?
  On worker startup and on a recurring interval, any job stuck in PROCESSING beyond
  a configurable staleness threshold (default: 5 minutes) is automatically
  re-queued as PENDING for reprocessing. The threshold is configurable via
  environment variable.
- What happens when a subscriber URL responds very slowly?
  A configurable delivery timeout applies; responses exceeding the timeout are treated
  as failures.
- What happens when a pipeline has no subscribers?
  A pipeline with no subscribers is valid; ingested webhooks are processed (action runs)
  but no delivery attempts are made. Job transitions to COMPLETED immediately.
- What happens when a webhook payload exceeds the configured size limit?
  The ingestion endpoint immediately returns 413 Payload Too Large. No Job record is
  created and nothing is enqueued.

---

## Requirements *(mandatory)*

### Functional Requirements

**Pipeline Management**

- **FR-001**: System MUST allow creating a pipeline with: a human-readable name, one
  action type (from three supported types), action configuration, and at least one
  subscriber URL.
- **FR-002**: System MUST auto-generate a unique, stable source URL for each pipeline
  at creation time. This URL MUST NOT change when other pipeline fields are updated.
- **FR-003**: System MUST allow reading a single pipeline by ID and listing all
  pipelines with pagination support.
- **FR-004**: System MUST allow updating a pipeline's name, action configuration, and
  subscriber list independently.
- **FR-005**: System MUST allow deleting a pipeline. Deletion MUST NOT destroy existing
  Job or DeliveryAttempt records associated with that pipeline.

**Webhook Ingestion**

- **FR-006**: System MUST accept HTTP POST requests to a pipeline's source URL and
  respond with 202 Accepted before executing any processing logic. The maximum accepted
  request body size MUST be configurable via environment variable (default: 1 MB).
  Requests exceeding this limit MUST be rejected with 413 Payload Too Large.
- **FR-007**: System MUST persist the incoming request body as a Job record with status
  PENDING before returning 202.
- **FR-008**: System MUST enqueue a background processing task immediately after
  persisting the Job record.
- **FR-009**: System MUST return 404 for requests to source URLs that do not correspond
  to any known pipeline.

**Job Processing**

- **FR-010**: The background worker MUST update the job to PROCESSING status before
  executing any action logic.
- **FR-011**: System MUST support exactly the following three processing action types:
  - **Field Extractor**: Selects and reshapes a configurable subset of fields from a
    JSON payload using a field mapping definition.
  - **Payload Filter**: Evaluates the payload against a configured condition rule;
    forwards only if the condition is met. Jobs that do not match complete with no
    delivery.
  - **HTTP Enricher**: Fetches data from a configured external URL and merges the
    response into the payload before delivery. If the external URL is unreachable,
    times out, or returns a non-2xx response, the enrichment is treated as an
    unrecoverable action error and the job transitions to FAILED immediately (no
    delivery attempts made, no action-level retry).
- **FR-012**: Worker MUST persist the processed (transformed) payload to the Job record
  after successful action execution.

**Delivery & Retry**

- **FR-013**: Worker MUST deliver the processed payload via HTTP POST to every subscriber
  URL associated with the pipeline.
- **FR-014**: Every delivery attempt — success or failure — MUST be persisted as a
  DeliveryAttempt record containing: subscriber URL, HTTP status code, response body
  snippet, attempt number, and timestamp.
- **FR-015**: Failed deliveries MUST be retried with exponential backoff. The maximum
  retry count MUST be configurable (default: 3). Retry delays MUST include jitter.
- **FR-016**: When a delivery reaches the maximum retry count without success, the job
  MUST transition to FAILED.
- **FR-017**: When all subscriber deliveries succeed, the job MUST transition to
  COMPLETED.
- **FR-018**: When the processing action throws an unrecoverable error, the job MUST
  transition to FAILED with no delivery attempts made and the error recorded.
- **FR-019**: On worker startup and on a recurring background interval, the worker
  MUST detect jobs stuck in PROCESSING status beyond a configurable staleness
  threshold (default: 5 minutes) and re-queue them as PENDING for reprocessing.
  The staleness threshold MUST be configurable via environment variable.

**Observability**

- **FR-020**: System MUST expose an endpoint to retrieve a job by ID including status,
  raw payload, processed payload (nullable), and created/updated timestamps.
- **FR-021**: System MUST expose an endpoint to list all jobs for a given pipeline,
  paginated and ordered by creation time descending.
- **FR-022**: System MUST expose an endpoint to list all delivery attempts for a given
  job ordered by attempt number ascending.

### Key Entities

- **Pipeline**: Unique identifier, human-readable name, auto-generated source URL
  (immutable after creation), action type, action configuration (structured key-value),
  created/updated timestamps.
- **Subscriber**: Unique identifier, reference to owning pipeline, destination URL,
  created timestamp.
- **Job**: Unique identifier, reference to originating pipeline, raw payload, processed
  payload (nullable), status (PENDING / PROCESSING / COMPLETED / FAILED), created and
  last-updated timestamps.
- **DeliveryAttempt**: Unique identifier, reference to job, reference to subscriber,
  HTTP status code received, response body snippet (truncated), attempt number,
  outcome (SUCCESS / FAILED), timestamp.

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: External senders receive acknowledgment of their webhook within 200ms
  (p95) regardless of current processing backlog.
- **SC-002**: A pipeline can be created, a webhook sent, and delivery to a subscriber
  confirmed within 5 seconds end-to-end under normal single-instance conditions with
  no competing jobs.
- **SC-003**: Every delivery failure triggers at least one automatic retry; no failed
  delivery is ever silently discarded.
- **SC-004**: All three action types produce verifiably correct output for their
  respective test payloads, demonstrable without examining source code.
- **SC-005**: The complete service starts from a clean machine using one command with
  zero additional manual steps.
- **SC-006**: Every job's complete lifecycle — ingestion, processing, all delivery
  attempts, and final status — is fully traceable through the API alone.
- **SC-007**: CI passes (build and lint at minimum) on every push to the main branch.

---

## Clarifications

### Session 2026-03-14

- Q: Should the ingestion endpoint enforce a maximum request body size? → A: Configurable limit via environment variable, default 1 MB (413 returned if exceeded).
- Q: When the HTTP Enricher's external URL fails, what happens to the job? → A: Job transitions to FAILED immediately — same as any unrecoverable action error (FR-018). No action-level retry, no best-effort fallback.
- Q: How should jobs stuck in PROCESSING status be recovered after a worker crash? → A: Auto-requeued as PENDING after a configurable staleness timeout (default: 5 min), checked on startup and periodically (FR-019).

---

## Assumptions

The following decisions use reasonable defaults and may be revisited if constraints change:

1. **Action types**: Field Extractor, Payload Filter, and HTTP Enricher cover
   transformation, filtering, and enrichment — three meaningfully distinct categories.
2. **Default max retries**: 3 attempts with delays of ~10s, ~20s, ~40s plus jitter.
   Configurable via environment variable.
3. **Source URL format**: `/webhooks/{uuid}` — UUID generated at pipeline creation,
   never changes.
4. **Delivery timeout**: 10 seconds per subscriber request; configurable via environment
   variable. Timeouts count as failures.
5. **Pagination**: Offset-based with page size defaulting to 20 items.
6. **No authentication on the ingestion endpoint**: The unguessable source URL UUID
   serves as the implicit shared secret. Full auth (API keys, HMAC verification) is a
   stretch goal per requirements.
7. **Non-JSON bodies**: Stored as raw strings. Field Extractor and Payload Filter skip
   transformation for non-JSON input; HTTP Enricher proceeds with an empty base object.
8. **Job retention**: Jobs and delivery attempts are retained indefinitely. Purge or
   archival logic is a stretch goal.
9. **Stalled job staleness threshold**: 5 minutes default. Configurable via environment
   variable (`STALLED_JOB_TIMEOUT_MS`). Recovery check runs on worker startup and
   on a recurring interval (same configurable value).
