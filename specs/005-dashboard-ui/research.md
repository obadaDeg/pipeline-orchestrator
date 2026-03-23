# Research: Dashboard UI

**Branch**: `005-dashboard-ui` | **Date**: 2026-03-22

---

## Decision 1: Frontend Framework

**Decision**: React 18 + TypeScript + Vite

**Rationale**: React is the dominant choice for TypeScript SPAs; Vite provides fast builds with zero config for React/TS. The project already uses TypeScript 5.4 throughout — React with JSX transform is a natural extension.

**Alternatives considered**:
- **Vue 3** — equally capable, but React has a larger community and matches evaluator familiarity.
- **Vanilla TypeScript** — avoids a build step but hand-rolling a SPA router, state management, and component system adds significant complexity for a multi-page dashboard.
- **Preact** — smaller bundle; not justified for a demo project.

---

## Decision 2: Frontend Source Location

**Decision**: `dashboard/` at the project root, independent of `src/`

**Rationale**: `src/` is exclusively backend code (api, worker, db, services). Mixing frontend source into `src/` would obscure the architectural boundary. A top-level `dashboard/` directory with its own `package.json`, `tsconfig.json`, and `vite.config.ts` keeps the separation clean.

**Alternatives considered**:
- `src/dashboard/` — visually co-located but pollutes the backend tsconfig and build pipeline.

---

## Decision 3: Build Output & Express Serving

**Decision**: Vite outputs to `public/dashboard/` (project root); Express serves it via `express.static` mounted before the SPA catch-all.

**Route wiring in `src/api/server.ts`** (after all API routes, before error handler):
```
app.use('/dashboard', express.static('public/dashboard'))
app.get('/dashboard/*', (_req, res) => res.sendFile('public/dashboard/index.html'))
```

**Rationale**: The `/dashboard` prefix keeps the SPA completely separate from `/api`, `/auth`, `/pipelines`, `/jobs`, `/teams`, and `/webhooks` routes. The catch-all fires only for unmatched `/dashboard/*` paths, making React Router responsible for all in-app navigation.

---

## Decision 4: UI Approach

**Decision**: TailwindCSS (PostCSS plugin via Vite) for utility-first styling

**Rationale**: For a monitoring dashboard (tables, badges, forms), Tailwind provides enough primitives without a component library. No runtime overhead, minimal bundle size, and familiar to most TypeScript developers. A small shared `components/` directory covers Button, Badge, and Table wrappers.

**Alternatives considered**:
- **shadcn/ui** — excellent, but installs 30+ Radix packages and a CLI. Overkill for a demo.
- **Plain CSS modules** — fine for isolation but slower iteration; utility classes are faster for one-off dashboard layouts.
- **Headless UI** — for accessible modals/dropdowns if needed, can be added per-component.

---

## Decision 5: Client-Side Authentication

**Decision**: API key stored in `localStorage`, sent as `Authorization: Bearer` on every request; React Context holds the key and exposes `login/logout/setUnauthorized`.

**Auth flow**:
1. User submits email + password to `POST /auth/login`
2. Response includes `data.apiKey.key` → stored in `localStorage`
3. Custom `useApi()` hook reads key from context and injects the header on every `fetch` call
4. On `401` response, context calls `logout()` and navigates to `/dashboard/login`

**Rationale**: API keys are long-lived and not CSRF-sensitive (they must be explicitly included in headers, unlike cookies). `localStorage` is appropriate. No session management library needed.

**Alternatives considered**:
- **`httpOnly` cookie** — more secure for session tokens, but requires a dedicated `/auth/session` endpoint the backend doesn't currently provide.
- **React Query / SWR** — adds server-state caching on top, but manual `useEffect` + `fetch` is sufficient for a small dashboard.

---

## Decision 6: Client-Side Routing

**Decision**: React Router v6 with `basename="/dashboard"`

**Routes**:
| Path | Page |
|------|------|
| `/dashboard/login` | Login |
| `/dashboard/` | Pipeline list |
| `/dashboard/pipelines/:id` | Pipeline detail + job list |
| `/dashboard/jobs/:id` | Job detail + delivery attempts |
| `/dashboard/account` | API key management + audit log |

**Rationale**: `basename="/dashboard"` tells React Router that all links are prefixed, matching the Express static mount point. A `ProtectedRoute` outlet wraps all authenticated pages; unauthenticated users are redirected to `/dashboard/login`.

---

## Decision 7: Dockerfile Extension

**Decision**: Extend to a 3-stage build — `backend-builder`, `frontend-builder`, and `runtime`.

```
Stage 1 (backend-builder):  npm ci + tsc → dist/
Stage 2 (frontend-builder): dashboard/npm ci + vite build → public/dashboard/
Stage 3 (runtime):          copy dist/ + public/ + drizzle/ → single Express process
```

**Rationale**: Keeps build contexts isolated, enables Docker layer caching per stage, and produces a single runtime image with no build tools. The Express process serves both the API and the static SPA from one container.

**No additional compose service needed**: The existing `api` service handles both duties.

---

## Decision 8: Package Management

**Decision**: `dashboard/` has its own `package.json` and `node_modules`. Root `package.json` adds `build:dashboard` and `dev:dashboard` scripts.

**Root scripts added**:
```json
"build:dashboard": "cd dashboard && npm run build",
"dev:dashboard": "cd dashboard && npm run dev"
```

`npm run build` in the Dockerfile becomes: `npm run build` (tsc) + `npm run build:dashboard` (vite).

**Rationale**: Avoids polluting the root `node_modules` with frontend-only packages (react, react-dom, vite, tailwindcss). Keeps `npm audit` and dependency updates scoped.
