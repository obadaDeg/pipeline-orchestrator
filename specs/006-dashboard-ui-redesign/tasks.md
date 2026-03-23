# Tasks: Dashboard UI Redesign

**Input**: Design documents from `/specs/006-dashboard-ui-redesign/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/screens.md ✅, quickstart.md ✅

**Context**: Spec 005 (Dashboard UI) was fully implemented by the user — all pages, components, auth, and routing are working. This spec is a redesign on top of that foundation. No backend changes. All tasks modify or create frontend files in `dashboard/` only.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6)

---

## Phase 1: Setup (New Dependencies & Configuration)

**Purpose**: Install the two new libraries, update Tailwind config with Inter font, add highlight.js CSS theme, and ensure the json utility exists.

- [X] T001 Install `lucide-react` and `highlight.js` as dependencies in `dashboard/package.json` by running `cd dashboard && npm install lucide-react highlight.js`
- [X] T002 [P] Update `dashboard/tailwind.config.ts` — import `defaultTheme` from `tailwindcss/defaultTheme`; extend `theme.extend.fontFamily.sans` with `['Inter', ...defaultTheme.fontFamily.sans]`
- [X] T003 [P] Update `dashboard/src/index.css` — add `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');` before the `@tailwind` directives; add `@import 'highlight.js/styles/github.css';` after
- [X] T004 [P] Create `dashboard/src/utils/json.ts` if it does not already exist — export `safeParseJson(str: string): unknown` (try JSON.parse, return original string on failure) and `formatJson(value: unknown): string` (returns JSON.stringify(value, null, 2) or String(value) if not serializable)

---

## Phase 2: Foundational (Toast System + Shared Component Redesigns)

**Purpose**: The toast system and redesigned shared components are used by every user story. MUST be complete before any page redesign begins.

**⚠️ CRITICAL**: No user story page work can begin until this phase is complete.

### Toast System (sequential — each step depends on the previous)

- [X] T005 Create `dashboard/src/context/ToastContext.tsx` — define `Toast` type (`{ id: string; message: string; type: 'success' | 'error' }`); use `useReducer` with ADD and REMOVE actions; `addToast(message, type)` generates a `Date.now()` id, dispatches ADD, and schedules `setTimeout(() => dispatch REMOVE, 4000)`; `removeToast(id)` dispatches REMOVE; export `ToastProvider` and `ToastContext`
- [X] T006 Create `dashboard/src/hooks/useToast.ts` — `export function useToast()` returns `{ addToast }` from `useContext(ToastContext)`; throws if used outside `ToastProvider`
- [X] T007 Create `dashboard/src/components/Toast.tsx` — props: `toast: Toast`, `onDismiss: (id: string) => void`; success variant: `bg-green-50 border-green-200 text-green-800` with `CheckCircle2` icon from lucide-react; error variant: `bg-red-50 border-red-200 text-red-800` with `XCircle` icon; includes an `×` dismiss button (`X` icon, calls `onDismiss`); `pointer-events-auto rounded-lg border shadow-md px-4 py-3 flex items-start gap-3 text-sm font-medium`
- [X] T008 Create `dashboard/src/components/ToastContainer.tsx` — no props; reads `toasts` and `removeToast` from `ToastContext`; renders `<div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none w-80">` containing a `<Toast>` for each toast in state
- [X] T009 Update `dashboard/src/App.tsx` — import `ToastProvider` from `./context/ToastContext`; wrap the existing `<AuthProvider><Routes>...</Routes></AuthProvider>` tree inside `<ToastProvider>`; import and render `<ToastContainer />` inside `ToastProvider` but outside `AuthProvider`

### Component Redesigns (all parallel — different files, no inter-task dependencies)

- [X] T010 [P] Redesign `dashboard/src/components/Badge.tsx` — pill shape: `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium`; accept `variant` prop (replaces old `status` prop but remain backward-compatible via type union); color map: `field_extractor`=`bg-blue-100 text-blue-700`, `payload_filter`=`bg-amber-100 text-amber-700`, `http_enricher`=`bg-violet-100 text-violet-700`, `pending`=`bg-amber-100 text-amber-700`, `processing`=`bg-blue-100 text-blue-700`, `completed`/`success`=`bg-green-100 text-green-700`, `failed`=`bg-red-100 text-red-700`; add human-readable label map ("Field Extractor", "Payload Filter", etc.); fallback: capitalize and replace underscores for unmapped values
- [X] T011 [P] Redesign `dashboard/src/components/Button.tsx` — variants: `primary` (`bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500`), `secondary` (`bg-white border border-gray-300 text-gray-700 hover:bg-gray-50`), `danger` (`bg-red-600 hover:bg-red-700 text-white focus:ring-red-500`), `ghost` (`text-gray-600 hover:bg-gray-100`); sizes: `sm` (`px-3 py-1.5 text-sm`), `md` (`px-4 py-2 text-sm`) default; add `loading?: boolean` prop — when true shows `Loader2` icon (`animate-spin` from lucide-react) and disables; base: `inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none`
- [X] T012 [P] Redesign `dashboard/src/components/EmptyState.tsx` — new props: `icon?: React.ComponentType<{ size?: number; className?: string }>`, `heading: string`, `body?: string`, `action?: React.ReactNode`; renders centered `div` with icon at `size={48} className="text-gray-300 mb-4"`, heading as `text-lg font-semibold text-gray-900`, body as `text-sm text-gray-500 mt-1 mb-4`, then action; overall: `flex flex-col items-center justify-center py-16 text-center`; remove old `message` prop (breaking change is acceptable since all callers will be updated in later tasks)
- [X] T013 [P] Redesign `dashboard/src/components/ErrorState.tsx` — props: `error: string`, `onRetry?: () => void`; render centered container with `AlertCircle` icon from lucide-react (`size={40} className="text-red-400 mb-3"`), error message (`text-sm text-gray-600 mt-1`), and a secondary Button "Retry" if `onRetry` is provided
- [X] T014 [P] Create `dashboard/src/components/SkeletonCard.tsx` — no props; renders a `div` matching pipeline card dimensions with `animate-pulse`: outer `bg-white rounded-xl border border-gray-200 p-5`; inside: top row with `h-5 bg-gray-200 rounded w-2/3` and `h-5 bg-gray-200 rounded-full w-20`; bottom row with two `h-4 bg-gray-200 rounded` blocks (`w-24` and `w-20`); gap between rows: `mb-3`
- [X] T015 [P] Create `dashboard/src/components/SkeletonRow.tsx` — props: `columns?: number` (default 4); renders `<tr>` with `animate-pulse`; each `<td>` contains a `h-4 bg-gray-200 rounded` block; first column is `w-1/4`, rest are `w-full`; `py-4 px-3` cell padding
- [X] T016 [P] Create `dashboard/src/components/SlideOver.tsx` — props: `open: boolean`, `onClose: () => void`, `title: string`, `children: React.ReactNode` (scrollable body), `footer: React.ReactNode` (sticky footer); renders: (1) backdrop `fixed inset-0 bg-black/40 z-40 transition-opacity duration-300` — `opacity-100 pointer-events-auto` when open, `opacity-0 pointer-events-none` when closed; clicking backdrop calls `onClose`; (2) panel `fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col transform transition-transform duration-300 ease-in-out` — `translate-x-0` when open, `translate-x-full` when closed; panel header: title `text-lg font-semibold text-gray-900` + `X` icon button (calls `onClose`); `flex-1 overflow-y-auto p-6` body; `border-t border-gray-200 p-4 bg-white` footer
- [X] T017 [P] Create `dashboard/src/components/Tabs.tsx` — props: `tabs: Array<{ key: string; label: string }>`, `activeTab: string`, `onChange: (key: string) => void`; renders `<div className="border-b border-gray-200"><nav className="-mb-px flex space-x-6">` with a `<button>` per tab; active: `border-b-2 border-indigo-600 text-indigo-600 font-medium`; inactive: `border-b-2 border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300`; no panel rendering — parent controls visible content based on `activeTab`
- [X] T018 [P] Create `dashboard/src/components/CodeBlock.tsx` — props: `code: string`, `language?: string` (default `'json'`); imports `hljs` from `highlight.js/lib/core` and `json` from `highlight.js/lib/languages/json`; calls `hljs.registerLanguage('json', json)` once at module level; `useRef<HTMLElement>(null)` and `useEffect([code])` that sets `ref.current.textContent = code`, `ref.current.className = 'language-json'`, then calls `hljs.highlightElement(ref.current)`; renders `<pre className="rounded-lg overflow-x-auto text-sm border border-gray-200 bg-gray-50"><code ref={ref} /></pre>`
- [X] T019 [P] Create `dashboard/src/components/ConfirmDialog.tsx` — props: `open: boolean`, `title: string`, `message: string`, `confirmLabel?: string` (default `'Delete'`), `onConfirm: () => void`, `onCancel: () => void`, `loading?: boolean`; renders: fixed `inset-0 bg-black/50 z-50 flex items-center justify-center` overlay; centered `bg-white rounded-xl shadow-xl max-w-sm w-full mx-4 p-6`; title `text-lg font-semibold text-gray-900`; message `text-sm text-gray-500 mt-2 mb-6`; button row `flex justify-end gap-3`: Cancel (secondary Button, calls `onCancel`, disabled when `loading`) + confirm (danger Button, `loading` prop forwarded)

**Checkpoint**: Toast system and all shared components are ready. Page redesigns can now begin.

---

## Phase 3: User Story 1 — Sidebar Navigation & Layout Shell (Priority: P1) 🎯 MVP

**Goal**: Replace the top-navigation header with a fixed left sidebar shell on all authenticated pages.

**Independent Test**: Log in, verify the sidebar renders on `/` and `/account`, active nav item is highlighted, user email shows at bottom, and clicking Logout clears session.

- [X] T020 [US1] Create `dashboard/src/components/Sidebar.tsx` — fixed `w-60 bg-white border-r border-gray-200 flex flex-col z-30 inset-y-0 left-0`; logo section (h-16, border-b): `Zap` icon (indigo-600) + "Pipeline Orchestrator" text (font-semibold text-sm); nav section (flex-1 px-3 py-4 space-y-1 overflow-y-auto): three `NavLink` items using React Router's `NavLink` component with `className` callback for active state — active: `bg-indigo-50 text-indigo-700 font-medium`, inactive: `text-gray-600 hover:bg-gray-100 hover:text-gray-900`; each link: `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors`; links: `Zap` icon → `/` ("Pipelines"), `Briefcase` icon → `/jobs` ("Jobs"), `User` icon → `/account` ("Account"); user section (border-t p-4): user email from `useAuth()` as `text-xs text-gray-500 truncate mb-2`; Logout button: `flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900` with `LogOut` icon — calls `logout()` from `useAuth()`
- [X] T021 [US1] Create `dashboard/src/pages/JobsPage.tsx` — minimal jobs list needed for the sidebar "/jobs" link; fetches `GET /jobs?page=1&limit=20` via `useApi`; renders page title "Jobs" with subtitle; table with Status (Badge), Job ID (monospace link to `/jobs/:id`), Pipeline ID (truncated link to `/pipelines/:id`), Received (formatRelative); shows 4x `SkeletonRow columns={4}` while loading; shows `EmptyState` (icon=`Briefcase` from lucide-react, heading="No jobs yet", body="Jobs appear here when webhooks are received by a pipeline.") when empty
- [X] T022 [US1] Update `dashboard/src/App.tsx` — add `import { JobsPage } from './pages/JobsPage'`; add `<Route path="/jobs" element={<JobsPage />} />` inside the protected routes group (alongside the existing `/jobs/:id` route)
- [X] T023 [US1] Redesign `dashboard/src/components/Layout.tsx` — remove the existing `<header>` top-nav entirely; new structure: `<div className="flex min-h-screen bg-gray-50">` containing `<Sidebar />` and `<main className="flex-1 ml-60"><div className="p-8">{children || <Outlet />}</div></main>`; import and use `Sidebar` component; remove all existing nav link markup

**Checkpoint**: Sidebar renders on all authenticated pages. Navigate between Pipelines, Jobs, Account. Logout works. Active link is highlighted.

---

## Phase 4: User Story 2 — Pipeline List as Card Grid (Priority: P2)

**Goal**: Replace the pipelines table with a responsive card grid with skeleton loaders and a polished empty state.

**Independent Test**: Navigate to `/`. Verify 2-column card grid renders (or 1-column on narrow screen), cards show name + badge + subscriber count + timestamp, hover lift effect works, clicking a card navigates to detail page, skeleton loaders appear on first load, empty state shows with CTA when no pipelines exist.

- [X] T024 [US2] Redesign the list view in `dashboard/src/pages/PipelineListPage.tsx` — replace the existing table markup with a card grid; page header: `<div className="sm:flex sm:items-center sm:justify-between mb-6">` with title `text-2xl font-bold text-gray-900` "Pipelines", subtitle `text-sm text-gray-500 mt-1` "Manage your webhook pipelines", and "New Pipeline" primary Button; card grid: `<div className="grid grid-cols-1 sm:grid-cols-2 gap-5">`; each card: `<Link>` with `className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer block"`; card content: top row with pipeline name (`font-semibold text-gray-900 truncate`) and `Badge variant={actionType}`; bottom row with `Users size={14}` icon + subscriber count and `Clock size={14}` icon + `formatRelative(createdAt)`; `ChevronRight size={16} className="text-gray-400 mt-3 ml-auto"` at bottom-right; loading state: replace `<Spinner />` with 4x `<SkeletonCard />`; empty state: `<EmptyState icon={Zap} heading="No pipelines yet" body="Create your first pipeline to start routing webhooks." action={<Button onClick={openCreate}>New Pipeline</Button>} />`; remove old `<Spinner>` import and replace throughout

**Checkpoint**: Pipeline list renders as a card grid. Skeleton loaders appear on load. Empty state shows with CTA. Clicking a card navigates correctly.

---

## Phase 5: User Story 3 — Create Pipeline Slide-Over Form (Priority: P3)

**Goal**: Replace the inline expand-in-place create form with a right-anchored slide-over panel.

**Independent Test**: Click "New Pipeline", verify slide-over animates from right with backdrop. Enter invalid JSON in config, blur the field, verify inline error appears. Submit a valid form, verify panel closes, success toast appears, and new card is in the grid. Press Cancel/backdrop, verify panel closes without creating.

- [X] T025 [US3] Replace the inline create form in `dashboard/src/pages/PipelineListPage.tsx` with a `SlideOver` component — remove the `showCreateForm` conditional block and the inline `<div className="bg-white p-6...">` form; keep the form fields (Name, Action Type select, Action Config textarea, Subscriber URLs textarea) but render them as `children` of `<SlideOver open={showCreateForm} onClose={() => setShowCreateForm(false)} title="New Pipeline">`; add real-time JSON validation on the Action Config textarea: `onBlur` handler attempts `JSON.parse` and sets `formConfigError` state if invalid; show inline `<p className="text-xs text-red-600 mt-1">{formConfigError}</p>` below the textarea; also validate on submit before the API call; pass footer: `<div className="flex justify-end gap-3"><Button variant="secondary" onClick={closeAndReset}>Cancel</Button><Button type="submit" loading={formLoading}>Create Pipeline</Button></div>`; import `useToast` and call `addToast('Pipeline created', 'success')` on success and `addToast(err.message, 'error')` on API error (replace `setFormError`)

**Checkpoint**: Create form opens as slide-over. JSON validation works inline. Success/error toasts appear. Slide-over closes on success or cancel.

---

## Phase 6: User Story 4 — Pipeline Detail Page Redesign (Priority: P4)

**Goal**: Restructure the pipeline detail page with a header section, tabbed navigation, syntax-highlighted config, and a proper confirm dialog for delete.

**Independent Test**: Navigate to any pipeline detail page. Verify header renders with name, badge, and three buttons. Verify clicking Copy Webhook URL shows a success toast. Verify tab switching works (Overview/Subscribers/Jobs). Verify Overview tab shows syntax-highlighted JSON. Verify clicking Delete opens ConfirmDialog (not window.confirm), and on confirm the pipeline is deleted with a toast.

- [X] T026 [US4] Redesign the header section of `dashboard/src/pages/PipelineDetailPage.tsx` — replace the current layout with: breadcrumb `<Link to="/" className="text-sm text-gray-500 hover:text-gray-700">← Pipelines</Link>`; header card `bg-white rounded-xl border border-gray-200 p-6 mb-6`; inside: pipeline name (`text-2xl font-bold text-gray-900`) and `Badge variant={actionType}` on the same row; below: button row with three Button components: (1) "Copy Webhook URL" with `Copy` icon from lucide-react — calls existing `copySourceUrl`, replace the old inline "Copied" state with `useToast` (`addToast('Webhook URL copied', 'success')`); (2) "Edit" button with `Pencil` icon — disabled for now with `title="Edit coming soon"` or opens a pre-filled SlideOver using the same form as create with PATCH method; (3) "Delete" button (`variant="danger"`) with `Trash2` icon — sets `showConfirmDelete=true` state; replace `window.confirm` in `handleDelete` with `<ConfirmDialog open={showConfirmDelete} title="Delete Pipeline" message="This will permanently delete the pipeline and all its jobs. This cannot be undone." onConfirm={handleDelete} onCancel={() => setShowConfirmDelete(false)} loading={isDeleting} />`; after successful delete: `addToast('Pipeline deleted', 'success')` then `navigate('/')`
- [X] T027 [US4] Add `Tabs` component and tab content to `dashboard/src/pages/PipelineDetailPage.tsx` — add `activeTab` state (default `'overview'`); render `<Tabs tabs={[{key:'overview',label:'Overview'},{key:'subscribers',label:'Subscribers'},{key:'jobs',label:'Jobs'}]} activeTab={activeTab} onChange={setActiveTab} />` below the header card; Overview tab content: `<CodeBlock code={JSON.stringify(pipeline.actionConfig, null, 2)} />`; Subscribers tab content: ordered list of subscriber URLs (if any) or `<EmptyState icon={Users} heading="No subscribers" body="Add subscriber URLs when creating or editing the pipeline." />`; Jobs tab content: move the existing job history table (with SkeletonRow loaders and EmptyState) into this tab; replace `<Spinner />` with `4x <SkeletonRow columns={4} />` while loading; replace existing `<EmptyState>` with redesigned version using `Briefcase` icon, heading "No jobs yet", body "Jobs will appear here once webhooks are received."

**Checkpoint**: Pipeline detail has header with three functional buttons. Tabs switch content. JSON config is syntax-highlighted. Delete uses ConfirmDialog. Copy uses toast.

---

## Phase 7: User Story 5 — Job Detail Timeline & Status Badges (Priority: P5)

**Goal**: Replace the delivery attempts table with a timeline view where failed rows have a red tint and rows expand to show details.

**Independent Test**: Navigate to any job detail page. Verify attempts render as a timeline list (not a table). Verify failed attempts have a red left-border tint. Click an attempt row to expand it and verify request/response details appear. Verify all status badges throughout the app are pill-shaped with the correct colors.

- [X] T028 [US5] Redesign the delivery attempts section of `dashboard/src/pages/JobDetailPage.tsx` — replace the `<table>` delivery attempts section with a timeline list; each attempt: `<div key={attempt.id} className={`rounded-xl border p-4 cursor-pointer transition-colors ${attempt.outcome === 'FAILED' || attempt.outcome === 'failed' ? 'bg-red-50 border-red-200 border-l-4 border-l-red-400' : 'bg-white border-gray-200 hover:bg-gray-50'}`} onClick={() => toggleExpanded(attempt.id)}`; collapsed view: row with attempt number, `Badge variant={attempt.outcome}`, HTTP status (`font-mono text-sm`), and `formatRelative(attempt.attemptedAt)`; expanded view (when `expandedIds.has(attempt.id)`): additional section below the collapsed row showing subscriber URL, HTTP status detail, and `responseSnippet` in a `<pre className="text-xs font-mono bg-gray-100 rounded p-3 mt-2 overflow-x-auto whitespace-pre-wrap">`; use `Set<string>` state for `expandedIds` toggled by click; remove the old `<table>` and `React.Fragment` delivery attempt markup; replace `<Spinner />` with `<div className="space-y-3">{[1,2,3].map(i => <SkeletonRow key={i} columns={4} />)}</div>` while loading; replace old `<EmptyState message=...>` with `<EmptyState icon={CheckCircle2} heading="No delivery attempts" body="No delivery attempts recorded yet." />`
- [X] T029 [US5] Redesign the job summary card in `dashboard/src/pages/JobDetailPage.tsx` — replace the existing `ring-1` card with `bg-white rounded-xl border border-gray-200 p-6 mb-6`; header row: job ID truncated to 8 chars in `font-mono` + `Badge variant={job.status}` on same line; below: `text-sm text-gray-500` with received and updated timestamps using `Clock` icon from lucide-react; error message box (if status FAILED): `bg-red-50 border border-red-200 rounded-lg p-4 mb-4 flex gap-3`with `AlertCircle` icon; keep existing `PayloadViewer` component but update its container to `bg-white rounded-xl border border-gray-100` with header `bg-gray-50 border-b rounded-t-xl`; update back link to use `ChevronLeft` icon from lucide-react

**Checkpoint**: Job detail shows timeline with expandable rows. Failed attempts have red tint. Job summary card uses new design. All status badges are pills with correct colors.

---

## Phase 8: User Story 6 — Account Page Settings Layout & Toast Integration (Priority: P6)

**Goal**: Restructure the Account page into a settings-style three-section layout and replace all `window.confirm`/`alert` calls with toasts and ConfirmDialog.

**Independent Test**: Navigate to `/account`. Verify three distinct section cards render (API Keys, Create Key, Audit Log). Create a key and verify success toast + one-time key in CodeBlock. Revoke a key via ConfirmDialog and verify toast. Check that all destructive actions across the app now use ConfirmDialog instead of `window.confirm`.

- [X] T030 [US6] Redesign `dashboard/src/pages/AccountPage.tsx` — replace the existing tab-based layout with a vertical three-section settings layout; each section: `<section className="bg-white rounded-xl border border-gray-200 p-6 mb-6">`; Section 1 "API Keys": heading `text-lg font-semibold text-gray-900` + subtitle `text-sm text-gray-500 mt-1 mb-4`; existing keys table (Name, Prefix, Last Used column from `ApiKey.lastUsedAt`, Created, Revoke button); `Revoke` button: `variant="ghost"` with `Trash2` icon — now sets `revokingKeyId` state and shows `<ConfirmDialog>` instead of `window.confirm`; on revoke success: `addToast('API key revoked', 'success')`; on error: `addToast(err.message, 'error')`; Section 2 "Create New Key": name input + "Create Key" Button; on success: `addToast('Key created — save it now!', 'success')` and display the new key inside `<CodeBlock code={newKey} />` (JSON-highlighting of a plain string still works) with a Copy button that calls `addToast('Key copied', 'success')` and a Dismiss button; Section 3 "Audit Log": inline (no tab switching needed) — paginated audit events table with event type `Badge`, timestamp, metadata in `<details>`; update `ApiKey` interface to include `lastUsedAt: string | null`
- [X] T031 [US6] Update `dashboard/src/pages/PipelineDetailPage.tsx` to replace the `window.alert(err.message)` call in `handleDelete` catch block with `addToast(err.message, 'error')` — ensures all error feedback uses toasts consistently

**Checkpoint**: Account page has three section cards. All confirm dialogs use ConfirmDialog component. All success/error feedback uses toasts. `window.confirm` and `alert` are fully eliminated from the codebase.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Minor visual polish, Login page update, and final build validation.

- [X] T032 [P] Polish `dashboard/src/pages/LoginPage.tsx` — update the "Sign In" button to use the redesigned `Button` component with `variant="primary" className="w-full"`; verify Inter font is visible (the `@import` from T003 handles this); update the card to `rounded-2xl shadow-lg border border-gray-100 bg-white p-10`; the indigo focus rings on inputs will be visible once Button redesign is in place
- [X] T033 [P] Minor style update `dashboard/src/components/Pagination.tsx` — update Previous/Next button `className` to use the indigo color scheme: active page indicator or button hover should use `text-indigo-600` and `hover:bg-indigo-50`; keep the same props interface (`page`, `totalPages`, `onPageChange`)
- [X] T034 Run `npm run build:dashboard` from repo root and verify zero TypeScript errors — fix any type errors from the `EmptyState` prop change (old `message` prop → new `heading`/`body` props), `Badge` variant renaming, or missing Lucide icon types; then run `docker compose up -d --build` and open `http://localhost:4000/dashboard/login` to do a final visual verification against the quickstart checklist in `specs/006-dashboard-ui-redesign/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately; T002, T003, T004 run in parallel with T001
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user story page work
  - Toast system (T005→T006→T007→T008→T009) is sequential within itself
  - Component redesigns (T010–T019) can all run in parallel with each other AND with the toast system track
- **Phase 3 (US1)**: Depends on Phase 2 — T020 and T021 can be parallel; T022 depends on T021; T023 depends on T020
- **Phase 4 (US2)**: Depends on Phase 2 (specifically T010 Badge, T012 EmptyState, T014 SkeletonCard)
- **Phase 5 (US3)**: Depends on Phase 2 (T016 SlideOver, T006 useToast) and Phase 4 (T024)
- **Phase 6 (US4)**: Depends on Phase 2 (T017 Tabs, T018 CodeBlock, T019 ConfirmDialog, T006 useToast)
- **Phase 7 (US5)**: Depends on Phase 2 (T010 Badge, T012 EmptyState, T015 SkeletonRow)
- **Phase 8 (US6)**: Depends on Phase 2 (T019 ConfirmDialog, T018 CodeBlock, T006 useToast) and all prior pages
- **Phase 9 (Polish)**: Depends on all prior phases; T032 and T033 can run in parallel

### User Story Dependencies

- **US1 (P1)**: Requires Phase 2. Independent of US2–US6.
- **US2 (P2)**: Requires Phase 2. Independent of US1 (layout shell is separate from list page content).
- **US3 (P3)**: Requires Phase 2 + US2 (modifies same file as US2).
- **US4 (P4)**: Requires Phase 2. Independent of US1–US3.
- **US5 (P5)**: Requires Phase 2. Independent of US1–US4.
- **US6 (P6)**: Requires Phase 2. Best done after US3–US5 to ensure toasts are integrated app-wide.

### Parallel Opportunities

- T002, T003, T004 (Phase 1) run in parallel with each other after T001
- T010–T019 (Phase 2 components) all run in parallel with each other and with T005–T009
- T020 and T021 (Phase 3 US1) run in parallel; T022 depends on T021; T023 depends on T020
- T026 and T027 are sequential (same file, PipelineDetailPage)
- T028 and T029 are sequential (same file, JobDetailPage)
- T032 and T033 run in parallel (different files)

---

## Parallel Example: Phase 2 Component Redesigns

```text
# These 10 tasks can all run simultaneously (different files):
T010 — Redesign Badge.tsx
T011 — Redesign Button.tsx
T012 — Redesign EmptyState.tsx
T013 — Redesign ErrorState.tsx
T014 — Create SkeletonCard.tsx
T015 — Create SkeletonRow.tsx
T016 — Create SlideOver.tsx
T017 — Create Tabs.tsx
T018 — Create CodeBlock.tsx
T019 — Create ConfirmDialog.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) — install dependencies, update config
2. Complete Phase 2 (Foundational) — toast system + redesigned shared components
3. Complete Phase 3 (US1) — sidebar + layout
4. **STOP and VALIDATE**: Open `http://localhost:5173/dashboard/` (dev) or `http://localhost:4000/dashboard/` (Docker), verify sidebar appears on all pages, navigation works, Inter font is loading
5. Continue to US2+ once sidebar is confirmed

### Incremental Delivery

1. Phase 1 + 2 → new component library ready
2. Phase 3 (US1) → new layout shell ✅ — first visual checkpoint
3. Phase 4 (US2) → card grid pipelines list ✅
4. Phase 5 (US3) → slide-over create form ✅
5. Phase 6 (US4) → tabbed pipeline detail ✅
6. Phase 7 (US5) → timeline job detail ✅
7. Phase 8 (US6) → settings account page ✅ — full redesign complete
8. Phase 9 → polish + build validation ✅

---

## Notes

- Spec 005 was fully implemented — this spec redesigns on top of a working foundation
- Do NOT change any API call patterns, endpoint URLs, or `useApi` / `AuthContext` logic
- `window.confirm` and `window.alert` must be fully replaced — they are not present in the target design
- `any` is prohibited in new code — use proper TypeScript types for all props and API responses
- The `EmptyState` prop interface changes (`message` → `heading`/`body`/`icon`) — update all callers during T034 typecheck
- Badge `status` prop renamed to `variant` — verify all existing call sites still compile (T034)
- Commit after each phase checkpoint to enable easy rollback if needed
