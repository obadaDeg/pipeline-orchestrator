# Tasks: Dashboard UI Test Suite

**Input**: Design documents from `/specs/007-dashboard-ui-tests/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, quickstart.md ✓

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths are included in all descriptions

---

## Phase 1: Setup (Tooling Installation & Configuration)

**Purpose**: Install all test dependencies and configure the test runners. No production code changes here.

- [X] T00X Install Vitest 2.x test dependencies in dashboard/ — run `npm install -D vitest@^2.1.9 @vitest/coverage-v8@^2.1.9 jsdom` from `dashboard/`
- [X] T00X [P] Install React Testing Library in dashboard/ — run `npm install -D @testing-library/react @testing-library/user-event @testing-library/jest-dom` from `dashboard/`
- [X] T00X [P] Install MSW v2 in dashboard/ — run `npm install -D msw` from `dashboard/`
- [X] T00X Create `dashboard/vitest.config.ts` — defineConfig with `plugins: [react()]`, `test.environment: 'jsdom'`, `test.globals: true`, `test.setupFiles: ['./src/test/setup.ts']`, `test.include: ['src/**/*.test.{ts,tsx}']`, `test.exclude: ['e2e/**']`
- [X] T00X Update `dashboard/tsconfig.json` — add `"types": ["vitest/globals", "@testing-library/jest-dom"]` to `compilerOptions` and `"src/test"` to `include` array
- [X] T00X [P] Update `dashboard/package.json` scripts — add `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"`
- [X] T00X Install Playwright at repo root — run `npm install -D @playwright/test` then `npx playwright install chromium` from repo root
- [X] T00X Create `playwright.config.ts` at repo root — defineConfig with `testDir: './e2e'`, `fullyParallel: false`, `workers: 1`, `timeout: 30_000`, `use.baseURL: 'http://localhost:4000'`, `use.trace: 'on-first-retry'`, two projects: `setup` (testMatch `e2e/setup/auth.setup.ts`) and `chromium` (devices['Desktop Chrome'], storageState `e2e/.auth/user.json`, depends on `setup`)
- [X] T00X [P] Update root `package.json` scripts — add `"test:e2e": "playwright test"`, `"test:e2e:ui": "playwright test --ui"`, `"test:e2e:report": "playwright show-report"`

**Checkpoint**: All test tools installed; `npx vitest run` from `dashboard/` and `npx playwright test --list` from root both exit without errors.

---

## Phase 2: Foundational (Shared Test Infrastructure)

**Purpose**: Shared files that ALL test phases depend on. Must be complete before any component, page, or E2E tests are written.

**⚠️ CRITICAL**: No user story test files can be written until this phase is complete.

- [X] T0XX Export `AuthContext` from `dashboard/src/context/AuthContext.tsx` — change `const AuthContext = createContext<...>` to `export const AuthContext = createContext<...>` (required so `renderWithProviders` can import it; this is the only production source change in this spec)
- [X] T0XX Create `dashboard/src/test/setup.ts` — import `'@testing-library/jest-dom'`, import `{ server }` from `'./server'`, add `beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))`, `afterEach(() => server.resetHandlers())`, `afterAll(() => server.close())`
- [X] T0XX Create `dashboard/src/test/server.ts` — import `{ setupServer }` from `'msw/node'`, import `{ handlers }` from `'./handlers'`, export `const server = setupServer(...handlers)`
- [X] T0XX Create `dashboard/src/test/handlers.ts` — define happy-path MSW v2 handlers for all API routes used by pages. Every response MUST use the `{ data: ... }` envelope (useApi.ts unwraps `json.data`). Include: `http.get('/pipelines', ...)` returning `{ data: { items: [], total: 0, page: 1, limit: 20 } }`, `http.post('/pipelines', ...)` returning `{ data: { id, name, actionType, actionConfig, subscribers, createdAt } }` with status 201, `http.delete('/pipelines/:id', ...)` returning null body with status 204, `http.get('/pipelines/:id', ...)` returning a single pipeline with subscribers and recent jobs, `http.get('/jobs', ...)` returning `{ data: { items: [], total: 0, page: 1, limit: 20 } }`, `http.get('/jobs/:id', ...)` returning a job with deliveryAttempts array, `http.get('/auth/keys', ...)` returning `{ data: { items: [] } }`, `http.post('/auth/keys', ...)` returning `{ data: { id, key: 'wh_test_...', name, createdAt } }` with status 201, `http.delete('/auth/keys/:id', ...)` returning null with status 204
- [X] T0XX Create `dashboard/src/test/utils.tsx` — export `renderWithProviders(ui, { route? })` that sets `localStorage.setItem('pipeline_api_key', 'test-key')` then renders with `<MemoryRouter initialEntries={[route]}>` wrapping `<ToastProvider>` wrapping `{ui}`; also export `AuthContext` re-export for tests that need to mock auth values directly
- [X] T0XX Create `e2e/` directory structure — create `e2e/setup/`, `e2e/tests/`, `e2e/.auth/` directories; add `e2e/.auth/` to `.gitignore`; create `e2e/.auth/.gitkeep` placeholder
- [X] T0XX Create `e2e/setup/auth.setup.ts` — Playwright setup project that: registers test user via `POST /auth/register` (accepts 201 or 409), navigates to `/dashboard/login`, fills email + password fields using `page.getByLabel()`, clicks Sign In button, waits for redirect to `**/dashboard/`, saves storage state to `e2e/.auth/user.json` via `page.context().storageState({ path: AUTH_FILE })`

**Checkpoint**: Run `cd dashboard && npm test` — setup.ts loads without errors (0 test files matched is fine). Run `npx playwright test --list` — shows the setup project.

---

## Phase 3: User Story 1 — Shared Component Tests (Priority: P1) 🎯 MVP

**Goal**: Every shared UI component has isolated tests covering all documented variants and interactive callbacks. Runs in under 30 seconds without a backend.

**Independent Test**: `cd dashboard && npm test -- --reporter=verbose` — all component tests pass.

- [X] T0XX [P] [US1] Create `dashboard/src/components/Badge.test.tsx` — test all variant values: `completed` (green, "Completed"), `failed` (red, "Failed"), `pending` (amber, "Pending"), `processing` (blue, "Processing"), `field_extractor` (blue), `payload_filter` (amber), `http_enricher` (violet); test deprecated `status` prop still works; test unknown variant renders title-cased fallback without crashing (covers spec edge case FR-003)
- [X] T0XX [P] [US1] Create `dashboard/src/components/Button.test.tsx` — test `primary` variant renders with indigo styling; test `loading={true}` disables button and shows spinner element (covers spec US1 scenario 2); test `danger` variant renders; test `onClick` callback fires on click; test `disabled` prop prevents click
- [X] T0XX [P] [US1] Create `dashboard/src/components/EmptyState.test.tsx` — test renders `heading` prop text; test renders `body` prop when provided; test renders action button when `action` prop passed (covers spec US1 scenario 3); test `icon` prop renders (use `LayoutGrid` from lucide-react as test icon); test omitting optional props does not crash
- [X] T0XX [P] [US1] Create `dashboard/src/components/ErrorState.test.tsx` — test renders `message` prop text; test renders retry button when `onRetry` prop provided; test clicking retry button invokes `onRetry` callback; test omitting `onRetry` does not crash
- [X] T0XX [P] [US1] Create `dashboard/src/components/SkeletonCard.test.tsx` — test renders with `animate-pulse` class present; test renders expected number of shimmer bars (assert at least 3 child elements)
- [X] T0XX [P] [US1] Create `dashboard/src/components/SkeletonRow.test.tsx` — test renders as `<tr>` element; test default `cols={4}` renders 4 `<td>` elements; test custom `cols={6}` renders 6 `<td>` elements
- [X] T0XX [P] [US1] Create `dashboard/src/components/SlideOver.test.tsx` — test `open={false}` keeps panel hidden (translate-x-full or not visible); test `open={true}` makes panel visible (covers spec US1 scenario 5); test `title` prop renders in panel header; test clicking backdrop calls `onClose`; test `children` render inside panel
- [X] T0XX [P] [US1] Create `dashboard/src/components/Tabs.test.tsx` — test renders all tab buttons from `tabs` prop; test active tab has indigo/active styling; test clicking inactive tab calls `onChange` with correct tab id (covers spec US1 scenario 6); test `onChange` is NOT called when clicking already-active tab
- [X] T0XX [P] [US1] Create `dashboard/src/components/CodeBlock.test.tsx` — test renders `code` prop content in the DOM; test renders language label when `language` prop provided; test copy button is present; test clicking copy button calls `navigator.clipboard.writeText` (mock `navigator.clipboard` via `vi.stubGlobal`)
- [X] T0XX [P] [US1] Create `dashboard/src/components/ConfirmDialog.test.tsx` — test `open={false}` does not render dialog content; test `open={true}` renders `title` and `message` props; test clicking Cancel invokes `onCancel` (covers spec US1 scenario 4); test clicking confirm button (uses `confirmLabel` or default "Confirm") invokes `onConfirm`; test `dangerous={true}` renders confirm button with red/danger styling
- [X] T0XX [P] [US1] Create `dashboard/src/components/Toast.test.tsx` — test success toast renders message with green styling and CheckCircle icon; test error toast renders message with red styling and XCircle icon; test `onDismiss` callback fires when close button clicked
- [X] T0XX [P] [US1] Create `dashboard/src/components/Pagination.test.tsx` — test renders page count correctly; test Previous button is disabled on page 1; test Next button is disabled on last page; test clicking a page number calls `onPageChange` with correct page; test clicking Next calls `onPageChange` with currentPage + 1

**Checkpoint**: `cd dashboard && npm test` — all 12 component test files pass. Run time should be well under 30 seconds.

---

## Phase 4: User Story 2 — Page Integration Tests (Priority: P2)

**Goal**: Each full page component mounts against mocked API responses and correctly handles all states: loading, populated, empty, and error.

**Independent Test**: `cd dashboard && npm test` — all 5 page test files pass with zero real network calls.

- [X] T0XX [US2] Create `dashboard/src/pages/PipelineListPage.test.tsx` — use `renderWithProviders` and MSW overrides to test: (a) populated state — override `GET /pipelines` to return 2 items, assert 2 pipeline card headings appear (covers spec US2 scenario 1); (b) error state — override `GET /pipelines` with status 500, assert ErrorState message is visible (covers spec US2 scenario 2); (c) empty state — override `GET /pipelines` to return `items: []`, assert "No pipelines yet" heading appears (covers spec US2 scenario 3); (d) loading state — assert skeleton cards render before API resolves; (e) create pipeline — click "New Pipeline" button, fill name field in SlideOver, submit, assert success toast appears and new card visible; use `server.use(http.post('/pipelines', ...))` override for the creation mock
- [X] T0XX [US2] Create `dashboard/src/pages/PipelineDetailPage.test.tsx` — render with `route='/pipelines/pipe-1'` in renderWithProviders; test: (a) populated state — pipeline name, webhook URL, and action type badge visible; (b) Jobs tab — click "Jobs" tab button, assert jobs table becomes visible (covers spec US2 scenario 4); (c) delete flow — click Delete button, ConfirmDialog appears, click confirm, assert `DELETE /pipelines/pipe-1` was called and navigation occurs (covers spec US2 scenario 5, use `vi.fn()` + MemoryRouter to capture navigation); (d) copy webhook URL — click Copy button, assert `navigator.clipboard.writeText` called with correct URL
- [X] T0XX [US2] Create `dashboard/src/pages/JobDetailPage.test.tsx` — override `GET /jobs/job-1` to return a job with 3 delivery attempts (1 with `status: 'FAILED'`, 2 with `status: 'SUCCESS'`); test: (a) all 3 attempt rows render; (b) the failed attempt row has `bg-red-50` class or red styling (covers spec US2 scenario 7); (c) clicking a row expands it to show response details; (d) breadcrumb back link is present
- [X] T0XX [US2] Create `dashboard/src/pages/JobsPage.test.tsx` — test: (a) populated state renders job rows with status badges; (b) empty state shows empty message; (c) error state shows ErrorState component; (d) loading state shows SkeletonRow elements
- [X] T0XX [US2] Create `dashboard/src/pages/AccountPage.test.tsx` — override `GET /auth/keys` to return 2 existing keys; test: (a) 2 key rows rendered with masked key display; (b) create new key — click "Create Key" button, fill name, submit, assert one-time key reveal code block appears with the key value (covers spec US2 scenario 6); (c) revoke key — click Revoke on first key, ConfirmDialog appears, confirm, assert `DELETE /auth/keys/:id` called; (d) loading state shows SkeletonRow elements

**Checkpoint**: `cd dashboard && npm test` — all 17 test files (12 component + 5 page) pass. Confirm 0 unhandled requests (MSW `onUnhandledRequest: 'error'` will catch any missing handlers).

---

## Phase 5: User Story 3 — End-to-End Critical Path Tests (Priority: P3)

**Goal**: 5 critical user journeys pass against the real running application stack. Requires `docker compose up` before running.

**Independent Test**: `docker compose up -d && npm run test:e2e` — all 4 E2E spec files pass.

- [X] T0XX [US3] Create `e2e/tests/login.spec.ts` — use cleared storage state (`test.use({ storageState: { cookies: [], origins: [] } })`); test: given unauthenticated user, navigate to `/dashboard/login`, fill email + password, click Sign In, assert redirected to `/dashboard/` and sidebar is visible with Pipelines/Jobs/Account links (covers spec US3 scenario 1); assert invalid credentials show an error message
- [X] T0XX [US3] Create `e2e/tests/pipeline-crud.spec.ts` — uses storageState from setup project; test create pipeline: click "New Pipeline" button, fill pipeline name in SlideOver, select action type, click Create, assert new pipeline card appears in grid AND success toast is visible (covers spec US3 scenario 2); test delete pipeline: navigate to pipeline detail, click Delete, confirm in dialog, assert redirected to list page and deleted pipeline card no longer visible (covers spec US3 scenario 4)
- [X] T0XX [US3] Create `e2e/tests/pipeline-detail.spec.ts` — uses storageState from setup project; navigate to a pipeline detail page (create one via API in beforeEach using `request` fixture); test copy webhook URL: click "Copy" button on webhook URL field, assert toast "Webhook URL copied" appears (covers spec US3 scenario 3)
- [X] T0XX [US3] Create `e2e/tests/account.spec.ts` — uses storageState from setup project; navigate to `/dashboard/account`; test create API key: click "Create Key", enter key name, submit, assert code block with key value appears and is non-empty (covers spec US3 scenario 5); assert key is shown only once (reveal block disappears on next render)

**Checkpoint**: `npm run test:e2e` with Docker stack running — all 4 spec files pass consistently. `npm run test:e2e:report` shows green results.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: CI integration and final validation pass.

- [X] T0XX Add Vitest test job to `.github/workflows/ci.yml` — add a `test-dashboard` job that runs `cd dashboard && npm ci && npm test` without Docker (runs on every push); job should run in parallel with existing lint/typecheck jobs
- [X] T0XX [P] Add Playwright E2E job to `.github/workflows/ci.yml` — add an `e2e` job with `needs: [test-dashboard]`, uses `services:` to spin up Postgres + the app via Docker Compose, then runs `npm run test:e2e`; gate this job to PRs targeting `main` only via `if: github.base_ref == 'main'`
- [X] T0XX [P] Verify `SC-001` — run `cd dashboard && npm run test:run` and confirm wall-clock time is under 60 seconds; document actual time in a comment in `vitest.config.ts`
- [X] T0XX [P] Verify `SC-004` — audit production source files for any test-only props or changes introduced during this spec beyond `export const AuthContext` (T010); confirm zero additional production code changes

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1, T001–T009)**: No dependencies — start immediately
- **Foundational (Phase 2, T010–T016)**: Depends on Phase 1 completion — BLOCKS all user story test writing
- **US1 Component Tests (Phase 3, T017–T028)**: Depends on Phase 2 — all 12 files can be written in parallel [P]
- **US2 Page Tests (Phase 4, T029–T033)**: Depends on Phase 2 — all 5 files can be written after foundational setup; benefits from US1 being done (page tests use same components) but can start independently
- **US3 E2E Tests (Phase 5, T034–T037)**: Depends on Phase 1 (Playwright install) and Phase 2 (auth setup); does NOT depend on US1/US2 — tests real browser, not RTL
- **Polish (Phase 6, T038–T041)**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: Depends only on Phase 2 foundational. All 12 component test files are fully independent of each other [P].
- **US2 (P2)**: Depends on Phase 2 foundational. Page tests are independent of each other [P] but share MSW handlers from Phase 2.
- **US3 (P3)**: Depends on Phase 1 (Playwright) and Phase 2 (auth setup T015–T016). E2E spec files are independent of each other [P].

### Within Each User Story

- Component test files (US1): all independent, no shared state
- Page test files (US2): independent files; `handlers.ts` must have all routes they need
- E2E spec files (US3): must run serially (workers: 1); each spec manages its own test data

---

## Parallel Opportunities

### Phase 1 Setup — Parallel Group

```
T001 (Vitest install) ─┐
T002 (RTL install)     ├─ all can run simultaneously (different packages)
T003 (MSW install)     ┘
T004 (vitest.config.ts)
T005 (tsconfig.json)   ─┐ after T001 completes
T006 (package.json)    ┘
T007 (Playwright install)
T008 (playwright.config.ts)  ─ after T007
T009 (root scripts)
```

### Phase 3 US1 — All Component Tests in Parallel

```
T017 Badge    ─┐
T018 Button   ├─┐
T019 EmptyState │ ├─ all 12 component test files
T020 ErrorState │ │   can be written simultaneously
T021 SkeletonCard│ │   (independent files)
T022 SkeletonRow│ │
T023 SlideOver  │ │
T024 Tabs       │ │
T025 CodeBlock  │ │
T026 ConfirmDialog│
T027 Toast      │
T028 Pagination ┘
```

### Phase 4 US2 — All Page Tests in Parallel

```
T029 PipelineListPage   ─┐
T030 PipelineDetailPage  ├─ all 5 page files can be
T031 JobDetailPage       │   written simultaneously
T032 JobsPage            │
T033 AccountPage        ─┘
```

---

## Implementation Strategy

### MVP First (User Story 1 Only — Component Tests)

1. Complete Phase 1: Setup (T001–T009)
2. Complete Phase 2: Foundational (T010–T016)
3. Complete Phase 3: Component tests (T017–T028)
4. **STOP and VALIDATE**: `cd dashboard && npm test` — all 12 component tests green
5. PR is valuable at this point: fast, stable component test coverage with no backend needed

### Incremental Delivery

1. Setup + Foundational → test runner configured
2. US1 Component Tests → `npm test` passes (MVP)
3. US2 Page Tests → `npm test` passes (adds integration coverage)
4. US3 E2E Tests → `npm run test:e2e` passes (adds critical-path coverage)
5. Polish → CI integrated

### Parallel Team Strategy

With multiple developers after Phase 2 completes:
- Developer A: All 12 US1 component test files (T017–T028)
- Developer B: All 5 US2 page test files (T029–T033)
- Developer C: Phase 1 Playwright setup + US3 E2E files (T007, T008, T015, T016, T034–T037)

---

## Notes

- `[P]` tasks = different files, no incomplete dependencies — safe to run simultaneously
- Vitest **must** be version `^2.x` — Vitest 3/4 requires Vite 6+ but dashboard uses Vite 5
- Every MSW handler must return `{ data: <payload> }` envelope — `useApi.ts` unwraps `json.data`
- `AuthContext` export (T010) is the only production file change — required for `renderWithProviders`
- E2E tests use `workers: 1` + `fullyParallel: false` — shared Docker PostgreSQL would cause race conditions otherwise
- `playwright.config.ts` lives at **repo root** (not inside `e2e/`) — needed because root `package.json` has `"type": "module"`
- `import.meta.dirname` (not `__dirname`) in E2E files — ESM requirement on Node 20
- Commit after each checkpoint (Phase 2, Phase 3, Phase 4, Phase 5)
