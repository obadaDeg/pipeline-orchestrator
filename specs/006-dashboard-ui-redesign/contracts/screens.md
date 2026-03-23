# Screen Contracts: Dashboard UI Redesign

Visual and behavioral contracts for each screen. These define what a screen must render, what interactions it must support, and what feedback it must provide — verified against the spec acceptance scenarios.

---

## Global Shell (all authenticated screens)

**Component**: `Layout` + `Sidebar` + `ToastContainer`

| Contract | Requirement |
|----------|-------------|
| Sidebar visible | Fixed left sidebar (w-60) rendered on every authenticated page |
| Active nav item | Link matching current route has `bg-indigo-50 text-indigo-700 border-l-2 border-indigo-600` or equivalent active style |
| Hover state | Non-active nav links show `hover:bg-gray-100` on cursor enter |
| User identity | Logged-in user email rendered at sidebar bottom |
| Logout | Clicking logout clears session and navigates to `/login` |
| Toast container | Fixed `top-4 right-4 z-50 flex flex-col gap-2` — renders all active toasts |
| Content area | `ml-60 min-h-screen bg-gray-50 p-8` — main scrollable area |

---

## Login Page

**Route**: `/login`

| Contract | Requirement |
|----------|-------------|
| Layout | Centered card on `bg-gray-50` full-screen; `max-w-md`, `shadow-lg`, `rounded-xl` |
| Font | Inter font applied |
| Primary button | Indigo background, full-width, loading state with spinner |
| Error display | Red-bordered inline error below form fields |
| No sidebar | Sidebar must NOT appear on the login page |

---

## Pipeline List Page

**Route**: `/` (authenticated)

| Contract | Requirement |
|----------|-------------|
| Page header | Title "Pipelines" (text-2xl font-bold) + subtitle + "New Pipeline" primary button top-right |
| Card grid | `grid grid-cols-1 sm:grid-cols-2 gap-5` |
| Card anatomy | Name (font-semibold), action type Badge (pill), subscriber count + Users icon, relative timestamp + Clock icon, ChevronRight icon |
| Card hover | `hover:shadow-md transition-shadow duration-200` |
| Card click | Entire card is a Link to `/pipelines/:id` |
| Skeleton state | 4 SkeletonCard components shown while fetching |
| Empty state | EmptyState with icon, heading "No pipelines yet", body "Create your first pipeline to start routing webhooks.", "New Pipeline" CTA |
| Error state | ErrorState with retry button |
| Pagination | Pagination component below cards when total > limit |
| Badge colors | field_extractor=blue, payload_filter=amber, http_enricher=violet |

**Create Pipeline Slide-Over**:

| Contract | Requirement |
|----------|-------------|
| Trigger | "New Pipeline" button opens SlideOver |
| Backdrop | `fixed inset-0 bg-black/40 z-40` — clicking backdrop closes panel |
| Panel | `fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col` |
| Animation | `translate-x-full` → `translate-x-0` transition on open; reverse on close |
| Fields | Name (text, required), Action Type (select), Action Config (textarea, JSON validation), Subscriber URLs (textarea, one per line) |
| JSON validation | Inline error below Action Config on blur and on submit attempt if invalid |
| Sticky footer | `border-t p-4 flex justify-end gap-3` with Cancel (secondary) + Create Pipeline (primary, loading state) |
| Success | Panel closes + success toast "Pipeline created" + card appears in grid |
| Error | Inline form error + error toast |

---

## Pipeline Detail Page

**Route**: `/pipelines/:id` (authenticated)

| Contract | Requirement |
|----------|-------------|
| Breadcrumb | `Pipelines / {pipeline.name}` link trail at top |
| Header section | `bg-white rounded-xl border border-gray-200 p-6 mb-6` — name (text-2xl), action type Badge, button row |
| Button: Copy Webhook URL | Copies `{origin}/webhooks/{pipeline.id}` to clipboard; success toast "Webhook URL copied" |
| Button: Edit | Opens edit slide-over or inline edit mode (same SlideOver component, pre-filled) |
| Button: Delete | Opens ConfirmDialog; on confirm → DELETE /pipelines/:id → redirect to `/` + success toast "Pipeline deleted" |
| Tabs | `['overview', 'subscribers', 'jobs']` — Tabs component below header |
| Overview tab | CodeBlock rendering `JSON.stringify(pipeline.actionConfig, null, 2)` with highlight.js |
| Subscribers tab | Ordered list of subscriber URLs; EmptyState if none |
| Jobs tab | Table: status badge, created date, link to job detail; SkeletonRow × 3 while loading; EmptyState if none |

---

## Job Detail Page

**Route**: `/jobs/:id` (authenticated)

| Contract | Requirement |
|----------|-------------|
| Breadcrumb | `Pipelines / {pipelineName} / Job {jobId.slice(0,8)}` |
| Job summary card | `bg-white rounded-xl border p-6` — job ID, status Badge, pipeline name, payload preview, created/updated timestamps |
| Timeline header | "Delivery Attempts" section heading |
| Timeline list | Vertical list; each entry: attempt number, subscriber URL, status Badge, timestamp |
| Failed row tint | `bg-red-50 border-l-4 border-red-400` for failed attempts |
| Expandable rows | Click row → reveals request URL, request headers (code block), request body, response status, response headers, response body |
| Skeleton state | SkeletonRow × 3 while fetching |
| Empty state | EmptyState "No delivery attempts recorded yet" |

---

## Account Page

**Route**: `/account` (authenticated)

| Contract | Requirement |
|----------|-------------|
| Page structure | Three `<section>` blocks with `bg-white rounded-xl border p-6 mb-6` cards |
| Section 1: API Keys | Table: Name, Prefix, Last Used, Created, Revoke button (danger/ghost); EmptyState if no keys |
| Section 2: Create Key | Name input + "Create Key" button; on success → success toast + new key row with revealed key value (one-time display) |
| Section 3: Audit Log | Paginated table of audit events: event type badge, metadata summary, timestamp |
| Revoke confirmation | ConfirmDialog before DELETE /auth/keys/:id |
| One-time key reveal | After creation, show full key in a highlighted `<code>` block with copy button; after dismiss key value is gone |

---

## Design Tokens (referenced across all contracts)

| Token | Value | Usage |
|-------|-------|-------|
| Primary | `indigo-600` (#4F46E5) | Buttons, active sidebar, focus rings |
| Primary hover | `indigo-700` | Button hover state |
| Primary light | `indigo-50` | Active nav background |
| Surface | `white` | Cards, panels, sidebar |
| Background | `gray-50` | Page background |
| Border | `gray-200` | Card borders, dividers |
| Text primary | `gray-900` | Headings, body text |
| Text secondary | `gray-500` | Metadata, labels |
| Text muted | `gray-400` | Placeholder text |
| Radius (card) | `rounded-xl` (12px) | Cards, panels |
| Radius (input) | `rounded-md` (6px) | Inputs, selects |
| Radius (badge) | `rounded-full` | All badges |
| Spacing unit | `4px` (Tailwind base) | 8px grid = gap-2 |
| Font | Inter | All text via Tailwind config |
| Transition | `duration-200 ease-in-out` | Hover effects, slide-over |
