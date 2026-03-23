# Quickstart: Dashboard UI Redesign

How to develop, build, and verify the redesigned dashboard.

---

## Prerequisites

- Node.js 20 LTS
- Docker Desktop running (for API backend)
- Repo cloned on branch `006-dashboard-ui-redesign`

---

## Local Development (hot-reload)

```bash
# 1. Start the API backend (port 3000 inside Docker, 4000 on host)
docker compose up -d postgres redis api worker

# 2. Install dashboard dependencies (first time or after package.json changes)
cd dashboard && npm install

# 3. Start Vite dev server (port 5173, proxies API calls to localhost:3000)
npm run dev
# → http://localhost:5173/dashboard/login
```

The Vite proxy (`vite.config.ts`) forwards `/auth`, `/pipelines`, `/jobs`, `/teams`, `/webhooks` to `http://localhost:3000`.

---

## New Dependencies

After installing, confirm these are present in `dashboard/node_modules`:

```bash
# Lucide React — icon library
npm install lucide-react

# highlight.js — JSON syntax highlighting only
npm install highlight.js
```

---

## Integration Scenarios

### Scenario 1 — Login and view pipeline list

1. Navigate to `http://localhost:5173/dashboard/login`
2. Enter credentials (register first if needed: `POST /auth/register`)
3. **Expected**: Redirect to `/`, sidebar visible with "Pipelines" active, card grid loads with skeleton loaders then real cards

### Scenario 2 — Create a pipeline via slide-over

1. Click "New Pipeline" button (top-right of pipelines page)
2. **Expected**: Slide-over panel animates in from right with backdrop
3. Enter name "Test Pipeline", leave action type as "Field Extractor", enter `{"mapping": {"id": "user.id"}}` in config
4. Click "Create Pipeline"
5. **Expected**: Panel closes, success toast appears top-right, new card appears in grid

### Scenario 3 — View pipeline detail with tabs

1. Click any pipeline card
2. **Expected**: Detail page loads with header (name, badge, action buttons) and three tabs
3. Click "Overview" tab — **Expected**: JSON config rendered in syntax-highlighted code block
4. Click "Subscribers" tab — **Expected**: List of subscriber URLs or empty state
5. Click "Jobs" tab — **Expected**: Jobs table with status badges

### Scenario 4 — View job detail timeline

1. From a pipeline's Jobs tab, click a job
2. **Expected**: Job summary card at top, "Delivery Attempts" timeline below
3. Click an attempt row — **Expected**: Row expands to show request/response detail
4. If a failed attempt exists — **Expected**: Row has red left border tint

### Scenario 5 — Copy webhook URL

1. On a pipeline detail page, click "Copy Webhook URL"
2. **Expected**: Toast appears "Webhook URL copied", clipboard contains `http://localhost:4000/webhooks/{pipelineId}`

### Scenario 6 — Delete a pipeline

1. On a pipeline detail page, click "Delete"
2. **Expected**: ConfirmDialog appears with pipeline name
3. Click "Delete" in dialog
4. **Expected**: Redirected to pipelines list, success toast "Pipeline deleted", card no longer in grid

### Scenario 7 — Account page: create and revoke API key

1. Click "Account" in sidebar
2. Enter key name "Test Key", click "Create Key"
3. **Expected**: New key row added to table, full key value shown once in a code block with copy button
4. Click "Revoke" on any key, confirm
5. **Expected**: Key removed from table, success toast

### Scenario 8 — Toast stacking

1. Rapidly create two pipelines back-to-back
2. **Expected**: Two success toasts visible simultaneously, stacked vertically, each auto-dismissing after 4 seconds

---

## Production Build

```bash
# From repo root
npm run build:dashboard
# → outputs to public/dashboard/

# Or as part of full Docker build
docker compose up -d --build
# → http://localhost:4000/dashboard/login
```

---

## Visual Verification Checklist

- [ ] Sidebar is 240px wide, fixed, visible on all authenticated pages
- [ ] Active nav item has indigo highlight
- [ ] Pipeline cards render in 2-column grid (desktop), 1-column (mobile)
- [ ] Skeleton loaders appear during data fetch (try throttling network in DevTools)
- [ ] Slide-over animates from right with backdrop
- [ ] All status badges are pill-shaped and correctly color-coded
- [ ] JSON config is syntax-highlighted (not plain text)
- [ ] Success/error toasts appear top-right and auto-dismiss after 4s
- [ ] Delete confirmation dialog appears before any delete action
- [ ] Font is Inter throughout (check DevTools → Computed → font-family)
