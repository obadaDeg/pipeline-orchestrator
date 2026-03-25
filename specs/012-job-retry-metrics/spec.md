# Feature Specification: Job Retry & Dashboard Metrics

**Feature Branch**: `012-job-retry-metrics`
**Created**: 2026-03-24
**Status**: Draft
**Input**: User description: "Add a manual retry action for failed jobs in the dashboard. On the Jobs tab of a pipeline, failed jobs should have a 'Retry' button that re-queues the job for processing. The retry should reuse the original raw payload and reset the job status. Users should also be able to see how many times a job has been retried. Add a stats and metrics summary to the dashboard. Show a top-level overview page (or a Stats tab) with key numbers: total pipelines, jobs processed today, overall success rate, average delivery time, and which pipelines have the most failures. No external metrics system — compute from existing data in PostgreSQL."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Retry Failed Jobs (Priority: P1)

An operator viewing the Jobs tab of a pipeline sees a list of jobs. Jobs with a `FAILED` status display a **Retry** button. Clicking **Retry** re-queues the job using its original raw payload and resets the job status to `PENDING`, so the pipeline processes it again from the start. After retrying, the button disappears (because the job is no longer failed) and the job row updates to reflect the new status.

**Why this priority**: Delivery failures are the most critical operational issue users face. Without a manual retry path, a failed job is a dead end — operators must either re-send the original webhook from the upstream system or accept data loss. This is P1 because it directly unblocks stuck workflows.

**Independent Test**: Can be tested end-to-end by: creating a pipeline, triggering a webhook that fails delivery (e.g., subscriber URL is unreachable), navigating to the Jobs tab, clicking Retry on the failed job, and confirming the job re-appears in `PENDING` / `PROCESSING` state and is reprocessed.

**Acceptance Scenarios**:

1. **Given** a job with status `FAILED` exists on the Jobs tab, **When** the user clicks the **Retry** button, **Then** the job status resets to `PENDING`, is re-queued for processing, and the Retry button is no longer shown for that job.
2. **Given** a job with status `COMPLETED` or `PENDING` or `PROCESSING`, **When** the user views the Jobs tab, **Then** no Retry button is displayed for that job.
3. **Given** a failed job, **When** the retry is triggered, **Then** the original raw payload is reused exactly (no modification), and any new delivery attempts are recorded against the same job.
4. **Given** a retry request is submitted, **When** the retry action completes successfully, **Then** the UI shows a success notification and the job row reflects the updated status without a full page reload. The Retry button shows a loading state while awaiting the server response and only updates the row after the API confirms success.

---

### User Story 2 - Retry Count Visibility (Priority: P2)

After one or more retries, the operator can see how many times each job has been retried. This count is visible in the Jobs tab list and/or on the Job Detail page, so operators can identify jobs that have been retried many times and may indicate a systemic problem.

**Why this priority**: Visibility into retry history is secondary to the ability to retry itself. Once retrying is working (US1), showing the count adds operational insight — operators can spot "thrashing" jobs that keep failing. It is P2 because it does not block the core retry workflow.

**Independent Test**: Can be tested by: retrying a job multiple times and confirming the retry count increments correctly in the UI on both the Jobs list and the Job Detail page.

**Acceptance Scenarios**:

1. **Given** a job that has never been retried, **When** the user views the Jobs tab, **Then** the retry count is either not shown or shown as 0.
2. **Given** a job that has been retried twice, **When** the user views the Jobs tab or Job Detail page, **Then** the retry count displays as 2.
3. **Given** a job is retried, **When** the count updates, **Then** the count increments by 1 for each manual retry action (automated retries by the system do not count).

---

### User Story 3 - Dashboard Stats Overview (Priority: P1)

A user navigating to the dashboard sees a top-level **Stats** or **Overview** section showing a summary of key operational numbers: total pipelines, total jobs processed today, overall success rate (across all pipelines), average delivery time, and which pipelines have the highest failure count. All numbers are computed from existing data stored in PostgreSQL — no external analytics system is used.

**Why this priority**: Operators need a quick health check at a glance. Without any aggregate view, they must navigate into each pipeline individually to understand the system's state. This is P1 because it is directly requested as a primary dashboard feature alongside the retry capability.

**Independent Test**: Can be tested by: seeding a known set of jobs with known outcomes, navigating to the Stats page, and confirming each metric matches the expected calculated value.

**Acceptance Scenarios**:

1. **Given** a user is logged in and has pipelines with delivery history, **When** they navigate to the Stats page, **Then** they see: total pipeline count, jobs processed today (since midnight UTC), overall success rate as a percentage, average delivery time in milliseconds or seconds, and a ranked list of pipelines by failure count.
2. **Given** no jobs have been processed today, **When** viewing the Stats page, **Then** "jobs today" shows 0 and success rate shows either 0% or "N/A" rather than an error.
3. **Given** a pipeline has zero failures, **When** viewing the most-failing pipelines list, **Then** it either does not appear in the list or appears with a count of 0.
4. **Given** new jobs are processed, **When** the user refreshes the Stats page, **Then** the numbers update to reflect the latest state.

---

### Edge Cases

- What happens when a user retries a job for a pipeline that has since been deleted? The retry action should fail gracefully with an informative error message.
- What happens when the retry API is called on a job that is not in `FAILED` status (e.g., double-click race condition)? The server must reject the request with a clear error (e.g., 409 Conflict) rather than silently re-queuing.
- What happens when a job has been retried many times (e.g., 100+)? The retry count must display correctly without overflow or truncation.
- What happens when the Stats page is loaded by a user with no pipelines? All metrics should display as zeros or empty states — no errors or blank UI.
- What if average delivery time cannot be computed (no successful deliveries with timing data)? Show "N/A" rather than divide-by-zero or a missing value.
- What if a retry is triggered but the queue is unavailable? The user should see an error notification and the job status should remain `FAILED` (no partial state).

## Requirements *(mandatory)*

### Functional Requirements

**Retry Action**

- **FR-001**: The system MUST expose an API endpoint to retry a specific failed job by job ID.
- **FR-002**: The retry endpoint MUST only accept jobs in `FAILED` status; requests for jobs in any other status MUST be rejected with a conflict error.
- **FR-003**: On retry, the system MUST reset the job's status to `PENDING` and re-enqueue it using the original `rawBody` stored at ingestion time.
- **FR-004**: On retry, the system MUST increment the job's retry count by 1.
- **FR-005**: The retry endpoint MUST enforce the same ownership/visibility rules as the pipeline — users may only retry jobs belonging to pipelines they own or are a member of.
- **FR-005a**: On every successful retry, the system MUST record a `JOB_RETRIED` audit event containing the job ID, pipeline ID, and the ID of the acting user.
- **FR-006**: The dashboard Jobs tab MUST display a **Retry** button on each row where the job status is `FAILED`.
- **FR-007**: After a successful retry action, the dashboard MUST update the job row status and remove the Retry button without requiring a full page reload. The Retry button MUST show a loading/disabled state while the server request is in flight, and the row MUST only update after the API confirms success.
- **FR-008**: The dashboard MUST display a success or error notification after the retry action completes.

**Retry Count Visibility**

- **FR-009**: The jobs table MUST include a `retryCount` field (integer, default 0) that is incremented on each manual retry.
- **FR-010**: The Jobs tab list MUST display the retry count for each job (shown only when > 0, or always shown — see Assumptions).
- **FR-011**: The Job Detail page MUST display the retry count for the selected job.

**Dashboard Stats**

- **FR-012**: The system MUST expose an API endpoint that returns the following computed metrics for the authenticated user's accessible pipelines:
  - Total pipeline count
  - Total jobs processed today (since midnight UTC)
  - Overall success rate (percentage of `COMPLETED` jobs out of all terminal-state jobs today)
  - Average delivery time in milliseconds (across all successful deliveries with timing data)
  - Top N pipelines by failure count (pipeline name, failure count, ranked descending)
- **FR-013**: All metrics MUST be computed from existing PostgreSQL data — no external metrics system, no caching layer.
- **FR-014**: The dashboard MUST include a Stats page accessible as a dedicated top-level route (e.g., `/stats`) in the main sidebar navigation, displaying the metrics from FR-012.
- **FR-015**: The Stats page MUST show an appropriate empty or zero state for each metric when no data is available.
- **FR-016**: The top failing pipelines list MUST include only pipelines the authenticated user can access (personal + team pipelines).

### Key Entities *(include if feature involves data)*

- **Job** (existing entity, extended): Represents a single webhook ingestion event being processed. Gains a new `retryCount` integer attribute (default 0) and the existing `rawBody` field is used as the source of truth for retries.
- **Pipeline Stats** (computed, not stored): A transient aggregate derived on request from existing job and delivery attempt records. Contains: pipeline ID, pipeline name, failure count. No new table is required.
- **Stats Summary** (computed, not stored): A transient response combining: total pipelines, jobs today, success rate, average delivery time, top failing pipelines list.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: An operator can retry a failed job in 2 clicks or fewer from the Jobs tab (click Retry → confirm in notification).
- **SC-002**: The retry action completes and the job is re-queued within 3 seconds of the user clicking Retry under normal operating conditions.
- **SC-003**: The Stats page loads and displays all five metrics within 5 seconds for a user with up to 100 pipelines and 10,000 jobs.
- **SC-004**: Retry count is always accurate — it reflects the exact number of manual retries, with no off-by-one errors or resets on page refresh.
- **SC-005**: 100% of jobs in `FAILED` status on the Jobs tab have a visible Retry button; 0% of non-failed jobs show a Retry button.
- **SC-006**: The Stats page shows meaningful data for users with at least one job record and appropriate zero/empty states for users with no data — no unhandled errors in either case.

## Clarifications

### Session 2026-03-24

- Q: Where in the dashboard navigation should the Stats/Metrics view live? → A: New top-level sidebar route (e.g., `/stats`) — standalone page in the main nav.
- Q: After clicking Retry, how should the job row update — optimistic, server-confirmed, or full list reload? → A: Server-confirmed — show a loading state on the Retry button and update the row only after the API responds successfully.
- Q: Should manually triggering a retry create an entry in the audit log? → A: Yes — create a `JOB_RETRIED` audit event recording the job ID, pipeline ID, and acting user.

## Assumptions

- **Retry count scope**: Only manual retries (triggered via the Retry button/API) increment `retryCount`. Automated system retries (if any exist) do NOT increment this counter.
- **Stats time zone**: "Today" for the jobs-processed-today metric is defined as midnight UTC to the current moment UTC.
- **Top failing pipelines**: The list shows the top 5 pipelines by failure count. "Failure" means jobs with status `FAILED` (not delivery attempt failures specifically).
- **Success rate definition**: Computed over all jobs in terminal state (`COMPLETED` or `FAILED`) today. Jobs still in `PENDING` or `PROCESSING` are excluded from the rate calculation.
- **Retry count display threshold**: The retry count is always shown in the Jobs list and Job Detail page (even when 0), for simplicity.
- **Stats refresh**: The Stats page data is fetched fresh on page load / manual refresh. No auto-polling or live updates are required.
- **rawBody availability**: All jobs have a `rawBody` field populated at ingestion time. This is the payload used for retries — no re-fetching from the original source is needed.
