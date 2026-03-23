# Feature Specification: Dashboard UI Redesign

**Feature Branch**: `006-dashboard-ui-redesign`
**Created**: 2026-03-23
**Status**: Draft

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Sidebar Navigation & Layout Shell (Priority: P1)

A logged-in user navigates the application using a fixed left sidebar that clearly shows their current location, provides quick access to all sections (Pipelines, Jobs, Account), and displays their identity at the bottom with a logout option. The sidebar creates a consistent shell around all content pages.

**Why this priority**: The sidebar is the structural foundation of the redesign. All other improvements live inside this layout shell. Without it, no other visual change has a coherent frame to live in.

**Independent Test**: Can be fully tested by logging in and verifying the sidebar renders on all authenticated pages, the active state highlights the current section, hovering shows visual feedback, user email is shown at the bottom, and clicking Logout clears the session and redirects to the login page.

**Acceptance Scenarios**:

1. **Given** a logged-in user on any authenticated page, **When** they view the sidebar, **Then** they see the app logo, nav links for Pipelines, Jobs, and Account (each with an icon), the user's email address, and a Logout button at the bottom.
2. **Given** a user currently on the Pipelines page, **When** they view the sidebar, **Then** the Pipelines link has a visually distinct active state (e.g., filled background or left accent border) compared to the other links.
3. **Given** a user hovering over a non-active sidebar link, **When** they hover, **Then** the link background changes subtly to indicate interactivity.
4. **Given** a user clicking the Logout button, **When** they confirm, **Then** their session is cleared and they are redirected to the login page.

---

### User Story 2 — Pipeline List as Card Grid (Priority: P2)

A user viewing their list of pipelines sees them displayed as a responsive card grid instead of a plain data table. Each card communicates the pipeline name, action type (with a color-coded badge), subscriber count with an icon, and how long ago the pipeline was created — at a glance. Hovering over a card provides visual feedback, and clicking navigates to the detail view.

**Why this priority**: The pipeline list is the home screen every user lands on after login. It is the highest-impact visual change and sets the first impression of the product's quality.

**Independent Test**: Can be fully tested by navigating to the pipelines page and verifying: cards render in a grid, badges are color-coded by type, subscriber count and relative timestamp are visible on each card, the hover lift effect works, clicking a card navigates to the detail page, the empty state renders correctly when no pipelines exist, and skeleton loaders are shown during data loading.

**Acceptance Scenarios**:

1. **Given** a user with multiple pipelines, **When** they visit the pipelines page, **Then** pipelines are displayed in a 2-column grid on wide screens and a single column on narrow/mobile screens.
2. **Given** a pipeline with action type `field_extractor`, **When** the card renders, **Then** its badge is blue; `payload_filter` is amber; `http_enricher` is violet.
3. **Given** a user hovering over a pipeline card, **When** they move the cursor onto it, **Then** the card's shadow increases (lift effect) and the cursor changes to a pointer.
4. **Given** a user with no pipelines, **When** they visit the pipelines page, **Then** a centered empty state is shown with an icon, the heading "No pipelines yet", a supporting message, and a "New Pipeline" CTA button.
5. **Given** the page is fetching pipeline data, **When** the request is in-flight, **Then** card-shaped skeleton loaders are shown instead of content.

---

### User Story 3 — Create Pipeline Slide-Over Form (Priority: P3)

A user creates a new pipeline using a slide-over panel that appears from the right side of the screen with a semi-transparent backdrop, rather than expanding an inline section of the page. The form gives real-time feedback when the JSON config field contains invalid JSON, and has a clearly styled sticky footer with Cancel and Submit buttons.

**Why this priority**: The creation flow is the primary action users take on the list page. A polished slide-over removes the jarring inline expansion and creates a focused, modal-like experience without leaving the page.

**Independent Test**: Can be fully tested by clicking "New Pipeline", verifying the panel slides in with an overlay backdrop, entering invalid JSON and seeing an inline validation message, submitting a valid form and seeing a success toast and the new card in the grid, and cancelling to close the panel without creating anything.

**Acceptance Scenarios**:

1. **Given** a user on the pipelines page, **When** they click "New Pipeline", **Then** a panel animates in from the right edge of the screen with a semi-transparent backdrop covering the rest of the page.
2. **Given** the slide-over is open and a user enters invalid JSON in the Action Config field, **When** they blur the field or attempt to submit, **Then** an inline error message appears directly below the field.
3. **Given** a user clicking Cancel, **When** the panel closes, **Then** no pipeline is created and the list is unchanged.
4. **Given** a user submitting a valid pipeline form, **When** the submission succeeds, **Then** the panel closes, a success toast notification appears in the top-right corner, and the new pipeline card appears in the grid.

---

### User Story 4 — Pipeline Detail Page Redesign (Priority: P4)

A user viewing a pipeline's detail page sees a structured two-section layout: a header with the pipeline name, action type badge, and action buttons (Edit, Delete, Copy Webhook URL), followed by tabbed content areas for Overview (config as syntax-highlighted JSON), Subscribers (URL list), and Jobs (delivery history table with status badges).

**Why this priority**: The detail page is where users spend the most time managing a pipeline — reviewing config, checking subscribers, and diagnosing delivery history. A clear tab structure and readable config display reduce friction for the app's primary use case.

**Independent Test**: Can be tested by navigating to any pipeline detail page and verifying: header renders with all buttons, tabs switch content correctly, JSON config is syntax-highlighted, "Copy Webhook URL" copies to clipboard and shows a toast, and Delete shows a confirmation before removing the pipeline.

**Acceptance Scenarios**:

1. **Given** a user on a pipeline detail page, **When** the page loads, **Then** the header shows the pipeline name, a colored action type badge, an Edit button, a Delete button, and a Copy Webhook URL button.
2. **Given** a user clicking between tabs, **When** they select Overview, Subscribers, or Jobs, **Then** only the content for the selected tab is rendered; the other tabs are hidden.
3. **Given** a user on the Overview tab, **When** viewing the action config, **Then** the JSON is rendered in a monospace, syntax-highlighted, read-only code block — not a plain textarea.
4. **Given** a user clicking Copy Webhook URL, **When** the button is pressed, **Then** the webhook URL is copied to the clipboard and a brief success toast appears.
5. **Given** a user clicking Delete and confirming, **When** the deletion succeeds, **Then** the pipeline is removed and the user is redirected to the pipelines list with a success toast.

---

### User Story 5 — Job Detail Timeline & Universal Status Badges (Priority: P5)

A user viewing a job's detail page sees delivery attempts displayed as a timeline, with each attempt color-coded by status. Clicking an attempt row expands it to reveal the full request and response data. Status badges throughout the entire app are pill-shaped and consistently color-coded.

**Why this priority**: Job history is the primary debugging tool when a webhook fails. A scannable, expandable timeline with color-coded status makes diagnosing failures significantly faster than a plain table.

**Independent Test**: Can be tested by navigating to a job detail page and verifying: attempts appear as a vertical timeline, statuses show colored pill badges, clicking a row expands to show request and response details, and failed attempt rows have a subtle red tint.

**Acceptance Scenarios**:

1. **Given** a job with multiple delivery attempts, **When** a user views the job detail, **Then** attempts are shown in chronological order as a vertical timeline list with connectors between entries.
2. **Given** any status badge in the app, **When** rendered, **Then** `success` is green, `failed` is red, `pending` is amber, `processing` is blue — all displayed as pill shapes.
3. **Given** a user clicking an attempt row to expand it, **When** it expands, **Then** the request URL, request headers, request body, response status, response headers, and response body are all visible.
4. **Given** a delivery attempt with `failed` status, **When** the row is displayed, **Then** the row background has a subtle red tint to draw attention without obscuring content.

---

### User Story 6 — Account Page & Toast Notification System (Priority: P6)

The Account page is structured as a settings-style layout with clearly separated sections for API key management (a table of existing keys with a Revoke action, and a create-key form) and an audit log. Across the entire app, a toast notification system confirms create, update, and delete actions in the top-right corner and auto-dismisses after 4 seconds.

**Why this priority**: The account page is visited less frequently but must feel as polished as the rest of the product. The toast system is a cross-cutting UX improvement that completes the feedback loop for all user actions throughout the app.

**Independent Test**: Can be tested by visiting the Account page, verifying the three sections render, creating a new API key, revoking an API key, and then performing an action elsewhere in the app (e.g., creating a pipeline) to verify a toast appears and auto-dismisses.

**Acceptance Scenarios**:

1. **Given** a user on the Account page, **When** the page loads, **Then** they see an API Keys section with a table listing key name, prefix, last used date, created date, and a Revoke button per row; a "Create new key" form with a name input field; and an Audit Log section below.
2. **Given** a user clicking Revoke on an API key and confirming, **When** the revocation succeeds, **Then** the key is removed from the table and a success toast appears.
3. **Given** any successful create, update, or delete action in the app, **When** it completes, **Then** a green success toast appears in the top-right corner and auto-dismisses after 4 seconds.
4. **Given** any action that results in a server or network error, **When** the error occurs, **Then** a red error toast appears in the top-right corner and auto-dismisses after 4 seconds.
5. **Given** multiple toasts triggered in quick succession, **When** they are displayed, **Then** they stack vertically without overlapping.

---

### Edge Cases

- What happens when a pipeline name is very long (50+ characters)? The card truncates the name with an ellipsis; the full name is visible on hover via a tooltip or title attribute.
- What happens when a pipeline has 0 subscribers? The card shows "0 subscribers" with the icon rather than hiding the field.
- What happens when the action config JSON is an empty object `{}`? It is displayed as valid syntax-highlighted JSON, not an error state.
- What happens when the slide-over form is submitted and the API returns a validation error? An inline error message is shown inside the form and a red error toast is shown simultaneously.
- What happens when a user is on a mobile screen (<768px)? The pipeline grid switches to single column; the sidebar behavior degrades gracefully (collapses or becomes a hamburger-triggered drawer).
- What happens when a toast appears while another is already visible? Toasts stack vertically, with the newest appearing below (or above) existing ones without overlapping.
- What happens on the job detail page when there are no delivery attempts? An empty state is shown with a message "No delivery attempts recorded yet."

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: All authenticated pages MUST display a fixed left sidebar (240px wide on desktop).
- **FR-002**: The sidebar MUST contain: app logo, navigation links with icons (Pipelines, Jobs, Account), current user's email, and a Logout button.
- **FR-003**: The sidebar link corresponding to the current page MUST display a visually distinct active state.
- **FR-004**: The pipelines list MUST display pipelines as a card grid (2 columns desktop, 1 column mobile/narrow).
- **FR-005**: Each pipeline card MUST display: pipeline name, action type badge, subscriber count with icon, and relative creation timestamp.
- **FR-006**: Action type badge colors MUST be: `field_extractor` = blue, `payload_filter` = amber, `http_enricher` = violet.
- **FR-007**: Pipeline cards MUST show a shadow lift effect and pointer cursor on hover.
- **FR-008**: The pipeline list MUST display card-shaped skeleton loaders while data is fetching.
- **FR-009**: An empty pipeline list MUST display a centered empty state with icon, heading "No pipelines yet", supporting text, and a "New Pipeline" CTA.
- **FR-010**: The create pipeline form MUST open as a right-anchored slide-over panel with a semi-transparent backdrop overlay.
- **FR-011**: The slide-over MUST have a sticky footer with Cancel and Submit buttons always visible regardless of form length.
- **FR-012**: The Action Config JSON field MUST show inline validation feedback when the entered value is not valid JSON.
- **FR-013**: The pipeline detail page MUST have a header with: pipeline name, action type badge, Edit button, Delete button, and Copy Webhook URL button.
- **FR-014**: The pipeline detail page MUST use tabbed navigation to separate Overview, Subscribers, and Jobs content.
- **FR-015**: The Overview tab MUST render the action config JSON in a syntax-highlighted, read-only code block.
- **FR-016**: The Copy Webhook URL button MUST copy the URL to the system clipboard and confirm via a toast.
- **FR-017**: Status badges MUST be pill-shaped and color-coded: `success` = green, `failed` = red, `pending` = amber, `processing` = blue.
- **FR-018**: The job detail page MUST display delivery attempts as a vertical timeline list.
- **FR-019**: Each delivery attempt row MUST be expandable to reveal full request and response details (headers and body).
- **FR-020**: The Account page MUST contain three sections: API key management table, create new key form, and audit log.
- **FR-021**: The app MUST provide a toast notification system anchored to the top-right corner that auto-dismisses after 4 seconds.
- **FR-022**: All existing functionality MUST continue to work after the redesign; no API contracts or backend logic may change.
- **FR-023**: The design MUST use Inter as the primary typeface, indigo/violet as the primary accent color, and white/light-gray as the base.
- **FR-024**: All interactive controls MUST be keyboard-navigable and have visible focus states.

### Key Entities

- **Pipeline Card**: Visual unit in the list grid — displays name, type badge, subscriber count, timestamp, links to detail.
- **Slide-Over Panel**: A right-anchored drawer with backdrop, scrollable body, and sticky footer — used for the create pipeline form.
- **Status Badge**: A pill-shaped label conveying job or delivery status using consistent color coding.
- **Skeleton Loader**: A placeholder matching the shape of the target content, shown while data is in-flight.
- **Toast Notification**: A transient top-right message that confirms an action or reports an error, auto-dismissing after 4 seconds.
- **Timeline Entry**: A single delivery attempt rendered as a node in a vertical timeline, expandable to reveal request/response detail.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new user can locate and initiate the "New Pipeline" action within 5 seconds of landing on the pipelines page without any instruction.
- **SC-002**: All pages render visible above-the-fold content within 1 second on a standard broadband connection.
- **SC-003**: A user can determine the status of any delivery attempt within 2 seconds of opening the job detail page, relying solely on the color-coded badge without reading surrounding text.
- **SC-004**: The sidebar navigation is usable and accessible on screen widths from 375px (mobile) to 1920px (large desktop).
- **SC-005**: All existing user tasks (create pipeline, view jobs, manage API keys, view audit log) can be completed in the same number of steps or fewer compared to the current UI.
- **SC-006**: The visual design passes a consistency audit: all spacing follows an 8px grid, all interactive elements use the defined accent color, and no arbitrary color values appear outside the design palette.

## Assumptions

- The redesign targets the existing React and TailwindCSS stack; no additional CSS framework is introduced.
- Inter font will be loaded from Google Fonts or bundled; the existing Tailwind config will be extended to set it as the default sans-serif font.
- Syntax highlighting for the JSON config viewer will use a lightweight library (e.g., highlight.js or Prism.js) or be hand-coded with TailwindCSS utility classes.
- The mobile sidebar (hamburger/drawer behavior) is a stretch goal and not required for the initial implementation; a graceful fallback (e.g., collapsed or hidden) is acceptable.
- No backend changes are required; all API response shapes remain identical.
- The existing `useApi` hook, `AuthContext`, and React Router structure are preserved; only visual components and page-level layout are replaced.
- The `Badge`, `Button`, `Spinner`, `EmptyState`, `ErrorState`, and `Pagination` shared components will be redesigned in place (same file paths, updated implementations).
- **Icons**: Lucide React will be used as the icon library (tree-shakeable, individually imported React components). Each icon is imported by name; no icon font or sprite sheet is used.
- **JSON syntax highlighting**: highlight.js (JSON language pack only, ~5KB) will be used to render the action config code block on the pipeline detail Overview tab. It is called once on mount; no interactive tree view is required.
- **Animations**: All transitions (slide-over entry/exit, toast appear/dismiss) will use Tailwind CSS utility classes (`transition`, `translate-x-full`, `opacity-0`, `duration-*`). No animation library will be added.

## Clarifications

### Session 2026-03-23

- Q: Which icon library should be used for sidebar, cards, and empty states? → A: Lucide React (tree-shakeable, individually imported React components)
- Q: How should JSON syntax highlighting be implemented on the pipeline detail Overview tab? → A: highlight.js with the JSON language pack only (~5KB, called once on mount)
- Q: How should slide-over and toast animations be implemented? → A: CSS transitions via Tailwind utilities (translate-x, opacity); no animation library needed
