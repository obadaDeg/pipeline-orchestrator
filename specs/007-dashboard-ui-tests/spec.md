# Feature Specification: Dashboard UI Test Suite

**Feature Branch**: `007-dashboard-ui-tests`
**Created**: 2026-03-23
**Status**: Draft
**Input**: User description: "lets add some testing for the current UI"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Shared Component Tests (Priority: P1)

A developer working on the dashboard can run a fast, isolated test suite that verifies the behaviour of every shared UI component (Badge, Button, EmptyState, ErrorState, SkeletonCard, SkeletonRow, SlideOver, Tabs, CodeBlock, ConfirmDialog, Toast, Pagination) without needing a running backend or browser. Tests confirm components render correctly for each variant, respond correctly to props, and fire the right callbacks on interaction.

**Why this priority**: Shared components are the foundation of every page. A regression in Badge or Button breaks every screen. Fast, isolated component tests catch these instantly and run in CI on every push.

**Independent Test**: Run the component test suite with a single command; all tests pass without a backend, database, or browser.

**Acceptance Scenarios**:

1. **Given** Badge is rendered with variant `"completed"`, **When** the DOM is inspected, **Then** the element has the green pill style and displays "Completed".
2. **Given** Button is rendered with `loading={true}`, **When** the DOM is inspected, **Then** the button is disabled and a spinner is visible.
3. **Given** EmptyState is rendered with `heading="No pipelines yet"` and an action CTA, **When** the DOM is inspected, **Then** the heading and action button are present.
4. **Given** ConfirmDialog is rendered with `open={true}`, **When** the user clicks "Cancel", **Then** the `onCancel` callback is invoked.
5. **Given** SlideOver is rendered with `open={false}`, **When** `open` changes to `true`, **Then** the panel becomes visible.
6. **Given** Tabs is rendered with `activeTab="jobs"`, **When** the user clicks the "Overview" tab, **Then** `onChange` is called with `"overview"`.

---

### User Story 2 — Page-Level Integration Tests (Priority: P2)

A developer can run integration tests that mount each full page component against a mocked API layer and verify that pages correctly fetch data, render content, handle loading/error/empty states, and respond to user interactions — without a real backend.

**Why this priority**: Pages combine multiple components and API calls; component tests alone cannot catch wiring errors between them. Mocked API tests verify data flow end-to-end within the browser environment at low cost.

**Independent Test**: Run page integration tests with a single command; mocked API responses drive all assertions.

**Acceptance Scenarios**:

1. **Given** PipelineListPage mounts with a mocked API returning 2 pipelines, **When** the page loads, **Then** 2 pipeline cards are rendered with correct names and badges.
2. **Given** PipelineListPage mounts with a mocked API returning an error, **When** the page loads, **Then** an ErrorState with a retry button is shown.
3. **Given** PipelineListPage mounts with no pipelines, **When** the page loads, **Then** the EmptyState with "No pipelines yet" is shown.
4. **Given** PipelineDetailPage mounts with a mocked pipeline, **When** the user clicks the "Jobs" tab, **Then** the jobs table becomes visible.
5. **Given** PipelineDetailPage mounts, **When** the user clicks "Delete" and confirms, **Then** the DELETE API call is made and the user is redirected to the list.
6. **Given** AccountPage mounts with 2 existing keys, **When** the user creates a new key, **Then** the new key is displayed in a one-time reveal block.
7. **Given** JobDetailPage mounts with 3 delivery attempts (1 failed), **When** the page loads, **Then** the failed attempt row has a red tint.

---

### User Story 3 — End-to-End Critical Path Tests (Priority: P3)

A developer or QA engineer can run a small set of end-to-end tests against a running application that exercise the most critical user journeys from login through to meaningful actions — catching integration failures between the frontend and backend that unit and integration tests cannot detect.

**Why this priority**: E2E tests are slow and require infrastructure, so they are limited to the highest-value paths only. They act as a final safety net before deployment.

**Independent Test**: Run E2E tests against a locally running stack; tests pass against a clean database with a seeded test user.

**Acceptance Scenarios**:

1. **Given** a registered user, **When** they log in with correct credentials, **Then** they are redirected to the pipeline list page and the sidebar is visible.
2. **Given** a logged-in user on the pipeline list, **When** they create a new pipeline via the slide-over form, **Then** the new card appears in the grid and a success toast is shown.
3. **Given** a logged-in user on a pipeline detail page, **When** they click "Copy Webhook URL", **Then** a "Webhook URL copied" toast appears.
4. **Given** a logged-in user on a pipeline detail page, **When** they delete the pipeline and confirm, **Then** they are redirected to the list and the pipeline no longer appears.
5. **Given** a logged-in user on the account page, **When** they create a new API key, **Then** the key is revealed once in a code block with a copy button.

---

### Edge Cases

- What happens when Badge receives an unknown `variant` value — does it degrade gracefully with a fallback style rather than crash?
- What happens when the API returns a malformed response — does the page show an error state rather than a blank screen?
- What happens when the slide-over form is submitted with invalid JSON in the config field — is the inline error shown before any API call is made?
- What happens when a toast auto-dismisses while the user is looking at the page — does the DOM update without errors?
- What happens when the user rapidly clicks between tabs — does the UI remain consistent without stale data from race conditions?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The test suite MUST run with a single command from the `dashboard/` directory without manual setup beyond installing dependencies.
- **FR-002**: Component tests MUST complete in under 30 seconds on a developer laptop without a running server or database.
- **FR-003**: Component tests MUST cover every shared component's documented variants and interactive callbacks.
- **FR-004**: Page integration tests MUST mock all API calls so they run without a backend.
- **FR-005**: Page integration tests MUST cover loading, error, empty, and populated states for each page.
- **FR-006**: E2E tests MUST run against the actual running application stack and MUST NOT use mocked API responses.
- **FR-007**: E2E tests MUST register a dedicated test user before the suite runs and clean up all created data after each test.
- **FR-008**: All tests MUST be runnable in CI on every pull request with results reported as pass/fail.
- **FR-009**: Test output MUST clearly identify which component or page a failure belongs to.
- **FR-010**: Tests MUST NOT require changes to production source code to function (no test-only props added unless they are standard accessibility attributes such as `aria-label`).

### Key Entities

- **Component test**: An isolated test that mounts a single component with controlled props and asserts on rendered output and user interaction callbacks.
- **Page integration test**: A test that mounts a full page with mocked API responses and asserts on the complete rendered result.
- **E2E test**: A test that controls a real browser against a running application and asserts on visible UI state.
- **Test fixture**: A pre-defined set of data (pipeline, job, API key) used to make E2E tests repeatable and deterministic.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The component and page integration test suite completes in under 60 seconds, enabling fast feedback during development.
- **SC-002**: At least 80% of shared components have test coverage across all documented variants and interactive states.
- **SC-003**: All 5 critical E2E paths (login, create pipeline, copy webhook URL, delete pipeline, create API key) pass consistently against a clean local stack.
- **SC-004**: Zero changes to production source code are required to make the tests work.
- **SC-005**: Tests run automatically in CI on every pull request and block merge on failure.

## Assumptions

- The existing dashboard codebase (spec 006) is the sole test target; no new features are built as part of this spec.
- A jsdom-based environment is sufficient for component and page integration tests since the dashboard uses standard DOM APIs.
- E2E tests target `http://localhost:4000` (Docker stack); the same tests work in CI by standing up the Docker compose stack.
- A test user is created via `POST /auth/register` at the start of the E2E suite and all resources are cleaned up via the API after each test.
- The `data-testid` attribute convention is acceptable for targeting elements in tests when no semantic selector (role, label, text) is available.
- E2E coverage is intentionally limited to 5 critical paths; exhaustive E2E coverage is out of scope.
