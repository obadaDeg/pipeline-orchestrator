# Implementation Plan: Dashboard UI

**Branch**: `005-dashboard-ui` | **Date**: 2026-03-22 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/005-dashboard-ui/spec.md`

## Summary

Build a React 18 + TypeScript SPA served from the existing Express server under `/dashboard`. The dashboard consumes the existing REST API with no new backend endpoints. It provides three core views: pipeline overview (list + create), job monitoring (paginated history + delivery attempt drill-down), and account management (API key CRUD + audit log). Authentication uses the existing `POST /auth/login` endpoint; the API key is stored in `localStorage` and sent as a Bearer token.

## Technical Context

**Language/Version**: TypeScript 5.4 (backend) + TypeScript 5.4 with JSX (frontend)
**Primary Dependencies**: React 18, React Router v6, TailwindCSS, Vite 5 (frontend); Express 4.x (backend, existing)
**Storage**: No new storage — existing PostgreSQL via existing REST API
**Testing**: Vitest (existing unit/integration tests unaffected); no frontend unit tests in scope
**Target Platform**: Modern browser (Chrome/Firefox/Edge latest); served from Node.js 20 Docker container
**Project Type**: SPA frontend added to existing web service
**Performance Goals**: Dashboard pages load in < 2 seconds; no new backend performance requirements
**Constraints**: Zero new backend endpoints; UI served from same origin as API; `docker compose up` must still work
**Scale/Scope**: Single-user dashboard; no real-time updates; pagination for lists > 20 items

## Constitution Check

| # | Principle | Status | Notes |
|---|-----------|--------|-------|
| I | Asynchronous Processing | ✅ PASS | Dashboard is read-only UI; no changes to ingestion path |
| II | Reliability & Retry | ✅ PASS | Dashboard displays retry state; no changes to retry logic |
| III | Clean Separation of Concerns | ✅ PASS | Frontend lives in `dashboard/` completely separate from `src/`; Express still handles all API routing |
| IV | TypeScript Type Safety | ✅ PASS | Dashboard uses TypeScript strict mode with explicit API response types |
| V | Infrastructure Reproducibility | ✅ PASS | Dockerfile extended to 3-stage build; `docker compose up` still starts everything |
| VI | Code Quality Standards | ✅ PASS | Component-per-file, named constants, no `any`, consistent naming |
| VII | Testing Standards | ✅ PASS | No existing tests modified; new frontend code is view-layer only |
| VIII | API Consistency | ✅ PASS | Dashboard consumes existing API — no new endpoints, no response shape changes |
| IX | Performance Requirements | ✅ PASS | No changes to webhook ingestion path or database indexes |

**All 9 gates pass. No violations to justify.**

## Project Structure

### Documentation (this feature)

```text
specs/005-dashboard-ui/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── contracts/           # Phase 1 output — UI screen contracts
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (additions to repository root)

```text
dashboard/                        # NEW — React SPA (independent npm project)
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── index.html                    # Vite entry point
└── src/
    ├── main.tsx                  # React root mount
    ├── App.tsx                   # Router setup + AuthProvider
    ├── index.css                 # Tailwind directives
    ├── context/
    │   └── AuthContext.tsx       # API key storage + login/logout
    ├── hooks/
    │   └── useApi.ts             # fetch wrapper with Bearer token + 401 handler
    ├── components/               # Shared primitives
    │   ├── Badge.tsx             # Status badge (PENDING/COMPLETED/FAILED/etc.)
    │   ├── Button.tsx
    │   ├── EmptyState.tsx
    │   ├── ErrorState.tsx
    │   ├── Layout.tsx            # Nav + page wrapper
    │   ├── Pagination.tsx
    │   └── Spinner.tsx
    └── pages/
        ├── LoginPage.tsx
        ├── PipelineListPage.tsx
        ├── PipelineDetailPage.tsx
        ├── JobDetailPage.tsx
        └── AccountPage.tsx

public/dashboard/                 # NEW — Vite build output (git-ignored)
```

**Existing files modified**:

```text
src/api/server.ts                 # Add express.static + SPA catch-all after all API routes
Dockerfile                        # Extend to 3-stage build (add frontend-builder stage)
.dockerignore                     # Add dashboard/node_modules/, public/dashboard/
.gitignore                        # Add public/dashboard/ (build output)
package.json                      # Add build:dashboard and dev:dashboard scripts
README.md                         # Add Dashboard section
```

**Structure Decision**: Frontend at `dashboard/` (root-level, isolated from `src/`). Vite outputs to `public/dashboard/`. Express serves `/dashboard` as static mount with SPA catch-all for unmatched sub-paths. API routes are unaffected.

## Implementation Details

### Express static wiring

In `src/api/server.ts`, after all existing route registrations and before the error handler:

```typescript
import path from 'node:path';

// Serve dashboard SPA (after all API routes)
app.use('/dashboard', express.static(path.join(process.cwd(), 'public/dashboard')));
app.get('/dashboard/*', (_req, res) => {
  res.sendFile(path.join(process.cwd(), 'public/dashboard/index.html'));
});
```

### Dockerfile (3-stage)

```dockerfile
# Stage 1: backend builder
FROM node:20-slim AS backend-builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# Stage 2: frontend builder
FROM node:20-slim AS frontend-builder
WORKDIR /app/dashboard
COPY dashboard/package*.json ./
RUN npm ci
COPY dashboard/ .
RUN npm run build

# Stage 3: runtime
FROM node:20-slim AS runtime
WORKDIR /app
RUN groupadd -r appgroup && useradd -r -g appgroup appuser
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=backend-builder /app/dist ./dist
COPY --from=frontend-builder /app/dashboard/dist ./public/dashboard
COPY drizzle ./drizzle
USER appuser
EXPOSE 3000
CMD ["node", "dist/api/index.js"]
```

### React Router routes

```
basename="/dashboard"

/login              → LoginPage (public)
/                   → PipelineListPage (protected)
/pipelines/:id      → PipelineDetailPage (protected)
/jobs/:id           → JobDetailPage (protected)
/account            → AccountPage (protected)
```

### API surface consumed (all existing)

| Endpoint | Used by |
|----------|---------|
| `POST /auth/login` | LoginPage |
| `GET /pipelines` | PipelineListPage |
| `POST /pipelines` | PipelineListPage (create form) |
| `DELETE /pipelines/:id` | PipelineDetailPage |
| `GET /pipelines/:id/jobs` | PipelineDetailPage |
| `GET /jobs/:id` | JobDetailPage |
| `GET /jobs/:id/delivery-attempts` | JobDetailPage |
| `GET /auth/keys` | AccountPage |
| `POST /auth/keys` | AccountPage |
| `DELETE /auth/keys/:id` | AccountPage |
| `GET /auth/audit-log` | AccountPage |
