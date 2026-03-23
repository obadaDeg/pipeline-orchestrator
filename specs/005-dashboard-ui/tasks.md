# Tasks: Dashboard UI

**Input**: Design documents from `/specs/005-dashboard-ui/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, contracts/screens.md ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup (Dashboard Project Initialization)

**Purpose**: Bootstrap the `dashboard/` React project and wire it into the existing Express server and Docker build.

- [X] T001 Create `dashboard/` directory at project root with `package.json` (react 18, react-dom, react-router-dom v6, typescript 5.4), `vite.config.ts` (outDir `../public/dashboard`), `tsconfig.json` (strict, moduleResolution bundler, jsx react-jsx), `index.html`, and `dashboard/src/main.tsx` entry point
- [X] T002 [P] Install and configure TailwindCSS in `dashboard/` — add `tailwind.config.ts`, `postcss.config.js`, and `@tailwind` directives in `dashboard/src/index.css`
- [X] T003 [P] Add `build:dashboard` (`cd dashboard && npm run build`) and `dev:dashboard` (`cd dashboard && npm run dev`) scripts to root `package.json`
- [X] T004 Add `express.static` mount and SPA catch-all to `src/api/server.ts` — mount `/dashboard` to `public/dashboard` after all existing API routes and before the error handler
- [X] T005 Extend `Dockerfile` to 3-stage build: `backend-builder` (existing tsc), `frontend-builder` (dashboard npm ci + vite build), `runtime` (copies both `dist/` and `public/dashboard/` from their respective builder stages)
- [X] T006 [P] Update `.gitignore` to exclude `public/dashboard/` (build output) and `dashboard/node_modules/`; update `.dockerignore` to exclude `dashboard/node_modules/`

---

## Phase 2: Foundational (Shared Auth + Layout + API Client)

**Purpose**: Authentication context, API fetch wrapper, shared components, and app router — required by all three user stories.

**⚠️ CRITICAL**: No user story pages can be built until this phase is complete.

- [ ] T007 Implement `dashboard/src/context/AuthContext.tsx` — React Context that stores the API key in localStorage, exposes `login(key)`, `logout()`, `setUnauthorized()` (clears key + redirects to `/dashboard/login`), and `isReady` flag (hydrated from localStorage on mount)
- [ ] T008 Implement `dashboard/src/hooks/useApi.ts` — custom hook that returns a typed `apiFetch(url, options?)` function; reads `apiKey` from `AuthContext`; injects `Authorization: Bearer <key>` header; calls `setUnauthorized()` on 401; throws on non-2xx responses with the API error message
- [ ] T009 Implement `dashboard/src/App.tsx` — React Router v6 `BrowserRouter` with `basename="/dashboard"`, `AuthProvider` wrapper, `ProtectedRoute` outlet (redirects to `/login` if no key and `isReady`), and all 5 routes: `/login`, `/`, `/pipelines/:id`, `/jobs/:id`, `/account`
- [ ] T010 [P] Implement `dashboard/src/components/Badge.tsx` — status badge with colour map: COMPLETED/SUCCESS=green, FAILED=red, PROCESSING=blue, PENDING=yellow, field_extractor=purple, payload_filter=indigo, http_enricher=teal
- [ ] T011 [P] Implement `dashboard/src/components/Layout.tsx` — top nav with "Pipeline Orchestrator" logo (links to `/`), "Pipelines" and "Account" nav links, "Sign Out" button (calls `logout()`), and a `<main>` content outlet
- [ ] T012 [P] Implement `dashboard/src/components/Pagination.tsx` — Previous/Next buttons with "Page X of Y" label; accepts `page`, `totalPages`, `onPageChange` props; buttons disabled at bounds
- [ ] T013 [P] Implement `dashboard/src/components/Spinner.tsx`, `dashboard/src/components/EmptyState.tsx` (icon + message + optional CTA button), and `dashboard/src/components/ErrorState.tsx` (error message + Retry button)
- [ ] T014 [P] Implement `dashboard/src/components/Button.tsx` — variants: `primary` (blue), `secondary` (gray), `danger` (red); forwards all `<button>` HTML attributes

**Checkpoint**: Auth flow, shared components, and routing scaffold are complete. All pages can now be stubbed and routed.

---

## Phase 3: User Story 1 — Pipeline Overview (Priority: P1) 🎯 MVP

**Goal**: Logged-in users can view their pipeline list, create a new pipeline, and navigate to a pipeline's detail page.

**Independent Test**: Register via API, open `/dashboard/login`, sign in, verify pipeline list loads. Create a pipeline via the form, verify it appears. Click it, verify the detail page loads with pipeline metadata.

- [ ] T015 [US1] Implement `dashboard/src/pages/LoginPage.tsx` — centered card with email + password inputs and "Sign In" button; on submit calls `POST /auth/login`, stores `data.apiKey.key` via `AuthContext.login()`, navigates to `/`; shows inline error on 401 or network failure; disables button while loading
- [ ] T016 [US1] Implement `dashboard/src/pages/PipelineListPage.tsx` — fetches `GET /pipelines?page=1&limit=20` via `useApi`; renders table with columns Name (link to `/pipelines/:id`), Action Type (Badge), Subscribers (count), Created (relative time); shows `EmptyState` when no pipelines; shows `ErrorState` on fetch failure; includes `Pagination` controls
- [ ] T017 [US1] Add "New Pipeline" button and inline create form to `PipelineListPage.tsx` — form fields: Name (text), Action Type (select), Action Config (JSON textarea with validation), Subscriber URLs (textarea, one per line); on submit calls `POST /pipelines`; on success refreshes list and closes form; shows field-level validation errors
- [ ] T018 [US1] Implement `dashboard/src/pages/PipelineDetailPage.tsx` — fetches `GET /pipelines/:id`; renders metadata card (Name, Action Type, Source URL with copy button, Created, Subscriber URLs list); shows `Spinner` while loading; shows `ErrorState` on 404 or fetch failure; includes "Delete Pipeline" button with confirm dialog that calls `DELETE /pipelines/:id` and navigates back to `/`
- [ ] T019 [US1] Add job list section to `PipelineDetailPage.tsx` — fetches `GET /pipelines/:id/jobs?page=1&limit=20`; renders table with columns Status (Badge), Job ID (monospace truncated 8 chars, links to `/jobs/:id`), Received (relative time), Payload preview (80 char truncation); includes `Pagination`

**Checkpoint**: US1 complete. User can log in, see pipelines, create one, and navigate to its detail page with jobs listed.

---

## Phase 4: User Story 2 — Job Monitoring (Priority: P2)

**Goal**: Users can click a job and see full payload details plus every delivery attempt.

**Independent Test**: From a pipeline detail page, click a job row. Verify the job detail page shows raw payload, processed payload, and the delivery attempts table with outcome badges and HTTP status codes.

- [ ] T020 [US2] Implement `dashboard/src/pages/JobDetailPage.tsx` — fetches `GET /jobs/:id` via `useApi`; renders: "← [Pipeline Name]" back link (uses `pipelineId` to construct URL), large Status badge, received and updated timestamps, two-column layout with Raw Payload and Processed Payload (JSON pretty-printed, monospace, max-height 400px with scroll, "—" if null), error message box when status is FAILED
- [ ] T021 [US2] Add delivery attempts table to `JobDetailPage.tsx` — fetches `GET /jobs/:id/delivery-attempts?page=1&limit=50`; table columns: # (1-indexed), Outcome (Badge), HTTP Status, Timestamp (relative), Error Detail (collapsed `<details>` element); shows `EmptyState` if no attempts yet; shows `Pagination` if > 50 attempts
- [ ] T022 [US2] Add large payload truncation to `JobDetailPage.tsx` — payloads > 10 KB are truncated with a "Show full payload" toggle button that expands inline without a separate page

**Checkpoint**: US2 complete. Full job drill-down is functional with delivery attempt history.

---

## Phase 5: User Story 3 — Account & API Key Management (Priority: P3)

**Goal**: Users can manage their API keys and view the audit log from the Account page.

**Independent Test**: Navigate to `/account`. Verify active keys are listed with prefix hints. Create a new key, copy it from the one-time modal, verify it appears in the list. Revoke it, verify it disappears. Switch to Audit Log tab and verify events are listed.

- [ ] T023 [US3] Implement `dashboard/src/pages/AccountPage.tsx` with two tabs (API Keys | Audit Log) using tab state; default tab is API Keys
- [ ] T024 [US3] Implement API Keys tab in `AccountPage.tsx` — fetches `GET /auth/keys`; renders table with Name, Prefix (monospace), Created, Revoke button; "New Key" button opens create form (name input + submit); on create success shows one-time modal with full key, "Copy" button, and warning "This key will not be shown again"; closes modal and refreshes list
- [ ] T025 [US3] Implement key revocation in `AccountPage.tsx` — "Revoke" button per row opens confirm dialog "Revoke this key? This cannot be undone."; on confirm calls `DELETE /auth/keys/:id`; on success removes key from list immediately without full refetch
- [ ] T026 [US3] Implement Audit Log tab in `AccountPage.tsx` — fetches `GET /auth/audit-log?page=1&limit=20`; renders table with Event type (Badge where applicable), Timestamp, Details (JSON collapsed in `<details>`); includes `Pagination`

**Checkpoint**: US3 complete. All three user stories are independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final integration, UX hardening, and documentation.

- [ ] T027 Add Vite dev-server proxy to `dashboard/vite.config.ts` — proxy `/auth`, `/pipelines`, `/jobs`, `/teams`, `/webhooks` to `http://localhost:3000` so `npm run dev:dashboard` works without CORS issues during development
- [ ] T028 [P] Add relative timestamp formatting utility `dashboard/src/utils/time.ts` — `formatRelative(date)` returns strings like "2 hours ago", "just now", "3 days ago" using the browser's `Intl.RelativeTimeFormat`
- [ ] T029 [P] Add JSON pretty-print utility `dashboard/src/utils/json.ts` — `safeParseJson(str)` returns parsed object or original string; `formatJson(value)` returns indented string; used by payload display in `JobDetailPage`
- [ ] T030 Add "Source URL" copy-to-clipboard button to `PipelineDetailPage.tsx` using the `navigator.clipboard` API with a "Copied!" toast feedback (inline, 2s timeout)
- [ ] T031 [P] Update `README.md` — add "Dashboard" section documenting the `/dashboard` URL, login flow, and screenshot placeholder; reference `docker compose up -d` as the one-command start
- [ ] T032 Run `npm run build:dashboard` and verify the built assets are copied correctly into the Docker runtime image by running `docker compose up -d --build` and opening `http://localhost:4000/dashboard/login`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user story pages
- **Phase 3 (US1)**: Depends on Phase 2
- **Phase 4 (US2)**: Depends on Phase 2; integrates with Phase 3 (navigates from pipeline detail)
- **Phase 5 (US3)**: Depends on Phase 2; independent of US1/US2
- **Phase 6 (Polish)**: Depends on all user story phases

### User Story Dependencies

- **US1 (P1)**: Requires Phase 2 foundation. No dependency on US2 or US3.
- **US2 (P2)**: Requires Phase 2 foundation. Links from US1's pipeline detail page but is independently testable via direct URL.
- **US3 (P3)**: Requires Phase 2 foundation. Fully independent of US1 and US2.

### Parallel Opportunities

- T002, T003, T006 (Phase 1) can run in parallel with T001
- T010–T014 (Phase 2 shared components) can all run in parallel after T007–T009
- T016, T017 build on T015 — sequential within US1
- T021, T022 build on T020 — sequential within US2
- T024, T025, T026 build on T023 — sequential within US3
- T028, T029, T031 (Polish utilities + docs) can run in parallel

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) — bootstrap dashboard project
2. Complete Phase 2 (Foundational) — auth + shared components
3. Complete Phase 3 (US1) — login + pipeline list + detail
4. **STOP and VALIDATE**: Open `http://localhost:4000/dashboard/login`, sign in, verify pipeline list and detail work
5. Ship as demo-ready MVP

### Incremental Delivery

1. Phase 1 + 2 → scaffold ready
2. Phase 3 (US1) → login + pipelines ✅ demo-ready
3. Phase 4 (US2) → job drill-down ✅ monitoring complete
4. Phase 5 (US3) → account page ✅ full feature
5. Phase 6 → polish + Docker validation

---

## Notes

- `[P]` tasks touch different files and have no cross-task dependencies within their phase
- All `useApi` calls must handle loading, error, and empty states — no silent failures
- `any` is prohibited — define TypeScript interfaces for all API response shapes
- Commit after each phase checkpoint
- The Vite dev proxy (T027) should be added early in Phase 6 so local dev works throughout
