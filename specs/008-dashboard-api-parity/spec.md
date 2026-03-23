# Feature Specification: Dashboard API Parity & Bug Fixes

**Feature Branch**: `008-dashboard-api-parity`
**Created**: 2026-03-23
**Status**: Draft
**Input**: Close the gap between the dashboard UI and the existing backend API — surface signing secrets, teams, pipeline editing, and user registration; fix broken JobsPage and delivery-attempts pagination.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fix Broken Jobs Page (Priority: P1)

A user navigates to the Jobs page expecting to browse recent webhook delivery jobs across all their pipelines. Currently the page crashes because it calls an endpoint that does not exist. After this fix the page loads successfully with paginated results.

**Why this priority**: The page is completely broken today — it is the highest-visibility defect. Users cannot use a core dashboard view at all.

**Independent Test**: Navigate to /jobs while authenticated. The page must render a paginated list of jobs without an error state, and each row must link to the job detail view.

**Acceptance Scenarios**:

1. **Given** a logged-in user with pipelines that have received webhooks, **When** they navigate to the Jobs page, **Then** they see a paginated list of jobs (most recent first) with pipeline name, status, and timestamp visible.
2. **Given** a logged-in user with no jobs, **When** they navigate to the Jobs page, **Then** they see an empty state message rather than an error.
3. **Given** a logged-in user on the Jobs page, **When** they click a job row, **Then** they are taken to the Job Detail page for that job.
4. **Given** more jobs than fit on one page, **When** the user clicks next/previous pagination controls, **Then** the list updates to show the correct page of results.

---

### User Story 2 - Fix Delivery Attempts Pagination (Priority: P1)

A user viewing a job's detail page expects to see all delivery attempts with accurate pagination controls. Currently the backend omits pagination metadata, so the dashboard either crashes or shows broken controls.

**Why this priority**: Job Detail is a core debugging view. Users investigating failed webhooks rely on this page — broken pagination makes it unreliable for large jobs.

**Independent Test**: Open any Job Detail page. The delivery attempts section must render with correct total count and functional pagination controls (or show all attempts if the count is small enough to fit on one page).

**Acceptance Scenarios**:

1. **Given** a job with multiple delivery attempts, **When** the user views the Job Detail page, **Then** delivery attempts are shown with correct total count and page indicators.
2. **Given** a job with more attempts than the page limit, **When** the user pages through results, **Then** each page shows the correct subset of attempts.
3. **Given** a job with zero delivery attempts, **When** the user views the Job Detail page, **Then** an appropriate empty state is shown in the delivery attempts section.

---

### User Story 3 - Manage Webhook Signing Secrets (Priority: P2)

A pipeline owner wants to secure their webhook endpoint by generating an HMAC signing secret. They can view the secret's status, rotate it when compromised, and revoke it entirely — all from the pipeline detail page.

**Why this priority**: The signing infrastructure is fully built in the backend but completely invisible to users. This is a meaningful security feature that users have no way to access today.

**Independent Test**: Open a pipeline detail page. A "Signing Secret" section must appear allowing the user to generate, view status, rotate, and revoke the signing secret without leaving the page.

**Acceptance Scenarios**:

1. **Given** a pipeline with no signing secret, **When** the user opens the pipeline detail page, **Then** a "Signing Secret" panel shows "No secret configured" with a "Generate" button.
2. **Given** the user clicks "Generate", **When** the secret is created, **Then** the secret value is shown once in a copyable field and the panel updates to show "Active" status.
3. **Given** a pipeline with an active signing secret, **When** the user clicks "Rotate", **Then** a confirmation prompt appears, and upon confirmation the old secret is replaced and the new value is shown once.
4. **Given** a pipeline with an active signing secret, **When** the user clicks "Revoke" and confirms, **Then** the secret is deleted and the panel returns to "No secret configured" state.
5. **Given** the user has copied the secret, **When** they navigate away and return, **Then** only the secret status ("Active") is shown — the raw value is never shown again.

---

### User Story 4 - Edit a Pipeline (Priority: P2)

A pipeline owner wants to update their pipeline's name or description after initial creation. They can do this inline from the pipeline detail page without needing to delete and recreate the pipeline.

**Why this priority**: Editing is a standard CRUD expectation. The backend supports it but users have no recourse other than deleting and recreating pipelines.

**Independent Test**: Open any pipeline detail page. An "Edit" action must allow changing the pipeline name and description, and the changes must persist after saving and refreshing the page.

**Acceptance Scenarios**:

1. **Given** a user viewing their pipeline detail page, **When** they click "Edit", **Then** the pipeline name and description become editable fields pre-filled with current values.
2. **Given** the user modifies the name and saves, **When** the save succeeds, **Then** the page reflects the updated name and a success notification is shown.
3. **Given** the user submits an empty pipeline name, **When** they try to save, **Then** a validation error is shown and the save is blocked.
4. **Given** the user clicks "Cancel" during editing, **When** no changes are saved, **Then** the original values are restored.

---

### User Story 5 - Register a New Account (Priority: P3)

A new user who has not yet been invited can create their own account by visiting the registration page linked from the login page.

**Why this priority**: Without a registration path, new users cannot onboard themselves. The backend endpoint exists but the UI is absent.

**Independent Test**: Navigate to /register. The form must accept name, email, and password, submit successfully, and redirect the user to the dashboard.

**Acceptance Scenarios**:

1. **Given** an unauthenticated user on the login page, **When** they click "Create account", **Then** they are taken to the /register page.
2. **Given** the user fills in valid name, email, and password and submits, **When** registration succeeds, **Then** they are logged in automatically and redirected to the pipelines list.
3. **Given** the user submits an email that is already registered, **When** the server rejects it, **Then** an error message is shown on the form.
4. **Given** the user submits a password that is too short, **When** the client validates, **Then** an error message is shown before the request is sent.

---

### User Story 6 - Manage Teams (Priority: P3)

An authenticated user can create a team, invite other users by adding their accounts as members, and remove members. They can also assign a team when creating a pipeline, making that pipeline accessible to all team members.

**Why this priority**: Teams unlock multi-user access to pipelines. The backend is fully built but the feature is invisible. Lower priority than fixes and signing secrets because teams require additional coordination to use.

**Independent Test**: Create a team, add a member, create a pipeline owned by the team. The pipeline must be visible to both the owner and the added member.

**Acceptance Scenarios**:

1. **Given** a logged-in user, **When** they navigate to Teams and click "New Team", **Then** they can enter a team name and create the team.
2. **Given** a team owner on the team detail page, **When** they enter a user identifier and click "Add Member", **Then** the new member appears in the member list.
3. **Given** a team owner on the team detail page, **When** they click "Remove" next to a member and confirm, **Then** the member is removed from the team.
4. **Given** a user creating a new pipeline, **When** they select a team from the optional Team dropdown, **Then** the pipeline is created with that team as owner.
5. **Given** a team member who did not create a pipeline, **When** that pipeline is owned by their team, **Then** they can view and interact with the pipeline in the dashboard.

---

### Edge Cases

- What happens when a user tries to rotate a signing secret that was just revoked by another session?
- How does the Jobs page behave when the server returns an error mid-pagination?
- What happens when a team member is removed while they have the team's pipeline detail page open?
- How does the signing secret panel behave if the generate request times out — is a partial state shown?
- What happens when a user with no teams tries to create a pipeline and the team field is shown?

## Requirements *(mandatory)*

### Functional Requirements

**Bug Fixes**

- **FR-001**: The system MUST provide a paginated endpoint for listing jobs, optionally filtered by pipeline, so that the Jobs page can load without error.
- **FR-002**: The delivery attempts endpoint MUST return pagination metadata (total count, current page, page limit) alongside the list of attempts.

**Signing Secrets**

- **FR-003**: Users MUST be able to generate a signing secret for any pipeline they own, receiving the raw secret value exactly once at generation time.
- **FR-004**: Users MUST be able to view the current signing secret status (active, none) for any pipeline they own.
- **FR-005**: Users MUST be able to rotate the signing secret for a pipeline they own, which invalidates the old secret and generates a new one.
- **FR-006**: Users MUST be able to revoke the signing secret for a pipeline they own, returning the pipeline to unsigned mode.
- **FR-007**: The system MUST require explicit confirmation before rotating or revoking a signing secret.

**Pipeline Editing**

- **FR-008**: Users MUST be able to update a pipeline's name from the pipeline detail page.
- **FR-009**: Users MUST be able to update a pipeline's description from the pipeline detail page.
- **FR-010**: The system MUST prevent saving a pipeline with an empty name.

**User Registration**

- **FR-011**: Unauthenticated users MUST be able to reach a registration page from a link on the login page.
- **FR-012**: The registration form MUST collect name, email, and password.
- **FR-013**: The system MUST validate password minimum length on the client before submitting.
- **FR-014**: Upon successful registration, the user MUST be automatically authenticated and redirected to the dashboard.

**Team Management**

- **FR-015**: Authenticated users MUST be able to create a team with a name.
- **FR-016**: Team owners MUST be able to add existing users as team members.
- **FR-017**: Team owners MUST be able to remove members from a team.
- **FR-018**: Users MUST be able to optionally assign a team when creating a pipeline.
- **FR-019**: Team members MUST be able to view pipelines owned by their teams.

### Key Entities

- **Job**: A single webhook delivery event; belongs to a pipeline; has status, timestamps, and one or more delivery attempts.
- **Delivery Attempt**: A single HTTP dispatch attempt for a job; has status, response code, response body, and timestamp.
- **Signing Secret**: A secret token associated with a pipeline used to verify webhook authenticity; has an active/inactive status; the raw value is only available at generation or rotation time.
- **Team**: A named group of users; can own pipelines; has an owner and zero or more members.
- **Team Membership**: The association between a user and a team.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The Jobs page loads successfully (no error state) for 100% of authenticated users who have at least one job.
- **SC-002**: Job delivery attempts display correctly with accurate pagination on the Job Detail page, regardless of the number of attempts.
- **SC-003**: A user can generate, rotate, and revoke a pipeline signing secret in under 60 seconds per action, including confirmation dialogs.
- **SC-004**: A user can update a pipeline's name or description and see the change reflected immediately after saving, without a full page reload.
- **SC-005**: A new user can self-register and reach the dashboard in under 2 minutes.
- **SC-006**: A team owner can create a team and add a member in under 90 seconds.
- **SC-007**: All previously broken dashboard pages (Jobs, Job Detail) produce no console errors related to missing data or malformed responses.

## Assumptions

- Password minimum length for registration defaults to 8 characters (industry standard); this can be adjusted by the backend validation.
- The "Add Member" flow for teams identifies users by their registered email address.
- Team membership visibility (whether members can see each other's identities) follows the same access level as pipeline visibility — no additional privacy controls are introduced in this feature.
- The Jobs page will be backed by a new `GET /jobs` endpoint with optional `pipelineId` query param and standard `page`/`limit` pagination — redesigning the page to remove the global view is not preferred as it removes navigation value.
- Pipeline editing is limited to name and description; changing the webhook source URL or team ownership is out of scope for this feature to limit risk.
- Only the team owner can add or remove members; no role hierarchy beyond owner/member is introduced.

## Dependencies

- Backend `GET /jobs` endpoint must be implemented before the Jobs page fix can be validated end-to-end.
- Backend delivery-attempts pagination must be updated before the Job Detail fix can be validated end-to-end.
- All other dashboard changes depend only on already-deployed backend endpoints.
