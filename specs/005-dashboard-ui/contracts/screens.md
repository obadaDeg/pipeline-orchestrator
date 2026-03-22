# UI Screen Contracts: Dashboard

All screens are served under `http://localhost:4000/dashboard/` (production) or `http://localhost:5173/` (dev with Vite proxy).

---

## Screen 1: Login (`/dashboard/login`)

**Access**: Public (no auth required)
**Redirect**: Authenticated users visiting `/dashboard/login` are redirected to `/dashboard/`

### Layout
- Centered card (max-width 400px)
- App title: "Pipeline Orchestrator"
- Email input (type=email, required)
- Password input (type=password, required)
- Submit button: "Sign In"
- Error message area (shown on 401 / network error)

### Behaviour
| Action | Result |
|--------|--------|
| Submit valid credentials | Call `POST /auth/login` → store `data.apiKey.key` in localStorage → navigate to `/dashboard/` |
| Submit invalid credentials | Show error: "Invalid email or password" |
| Submit while loading | Button disabled, spinner shown |

### API call
```
POST /auth/login
{ "email": string, "password": string }
→ { data: { apiKey: { key: string } } }
```

---

## Screen 2: Pipeline List (`/dashboard/`)

**Access**: Protected
**Title**: "Pipelines"

### Layout
- Page heading + "New Pipeline" button (top right)
- Table columns: Name | Action Type | Subscribers | Created
- Empty state: "No pipelines yet. Create your first one."
- "New Pipeline" opens an inline form or modal (see below)

### Table row
- **Name**: clickable link → navigates to `/dashboard/pipelines/:id`
- **Action Type**: badge (`field_extractor` / `payload_filter` / `http_enricher`)
- **Subscribers**: count of `subscriberUrls`
- **Created**: relative timestamp (e.g., "2 hours ago")

### Create Pipeline form
Fields:
- Name (text, required)
- Action Type (select: `field_extractor` | `payload_filter` | `http_enricher`)
- Action Config (JSON textarea, required)
- Subscriber URLs (textarea, one URL per line, optional)

On submit: `POST /pipelines` → refresh list → close form.

### API calls
```
GET /pipelines?page=1&limit=20
→ { data: { items: Pipeline[], total, page, limit } }

POST /pipelines
{ name, actionType, actionConfig, subscriberUrls? }
→ { data: { id, name, sourceUrl, ... } }
```

---

## Screen 3: Pipeline Detail (`/dashboard/pipelines/:id`)

**Access**: Protected
**Title**: Pipeline name (loaded from API)

### Layout
- Back link: "← Pipelines"
- Pipeline metadata card: Name, Action Type, Source URL (copyable), Created, Subscriber URLs
- "Delete Pipeline" button (danger, with confirm dialog)
- Section heading: "Jobs" with total count
- Paginated job table (reverse-chronological)

### Job table columns
- Status badge (PENDING / PROCESSING / COMPLETED / FAILED)
- Job ID (truncated to 8 chars, monospace)
- Received (relative timestamp)
- Payload preview (first 80 chars of raw payload)
- Each row is clickable → `/dashboard/jobs/:id`

### Delete pipeline
Confirmation dialog: "Are you sure? This cannot be undone." → `DELETE /pipelines/:id` → navigate to `/dashboard/`

### API calls
```
GET /pipelines/:id
→ { data: Pipeline }

GET /pipelines/:id/jobs?page=1&limit=20
→ { data: { items: Job[], total, page, limit } }

DELETE /pipelines/:id
→ 204
```

---

## Screen 4: Job Detail (`/dashboard/jobs/:id`)

**Access**: Protected
**Title**: "Job [id truncated]"

### Layout
- Back link: "← [Pipeline Name]"
- Status badge (large) + timestamps (received / updated)
- Two-column section:
  - Left: "Raw Payload" (JSON pretty-printed, max-height scrollable, truncated > 10KB with "Show full" toggle)
  - Right: "Processed Payload" (same treatment; "—" if null)
- Error message box (shown if job status is FAILED)
- Section: "Delivery Attempts" table

### Delivery attempts table columns
- # (attempt number, 1-indexed)
- Outcome badge (SUCCESS / FAILED)
- HTTP Status (e.g., 200, 500, —)
- Timestamp (relative)
- Error detail (collapsed; expand on click)

### API calls
```
GET /jobs/:id
→ { data: Job }

GET /jobs/:id/delivery-attempts?page=1&limit=50
→ { data: { items: DeliveryAttempt[], total, page, limit } }
```

---

## Screen 5: Account (`/dashboard/account`)

**Access**: Protected
**Title**: "Account"

### Layout
Two tabs: **API Keys** | **Audit Log**

#### API Keys tab
- Table: Name | Prefix | Created | Actions
- "New Key" button → opens create form
- Each row has a "Revoke" button (danger, with confirm)
- After key creation: one-time modal showing full key with "Copy" button and warning "This key will not be shown again"

#### Audit Log tab
- Table: Event | Timestamp | Details (JSON collapsed)
- Paginated (20 per page)

### API calls
```
GET /auth/keys
→ { data: { items: ApiKey[] } }

POST /auth/keys
{ "name": string }
→ { data: { id, name, key, keyPrefix, createdAt } }

DELETE /auth/keys/:id
→ 204

GET /auth/audit-log?page=1&limit=20
→ { data: { items: AuditEvent[], total, page, limit } }
```

---

## Shared Components

### Badge
Colours by value:
| Value | Colour |
|-------|--------|
| COMPLETED / SUCCESS | green |
| FAILED | red |
| PROCESSING | blue |
| PENDING | yellow |
| field_extractor | purple |
| payload_filter | indigo |
| http_enricher | teal |

### ErrorState
Full-width box: "Something went wrong: [message]" with a "Retry" button.

### EmptyState
Centred icon + message + optional CTA button.

### Pagination
Previous / Next buttons + "Page X of Y" label. Disabled when at bounds.

### Layout (nav)
Top navigation bar:
- Left: "Pipeline Orchestrator" logo link → `/dashboard/`
- Right: "Pipelines" | "Account" | "Sign Out" links
