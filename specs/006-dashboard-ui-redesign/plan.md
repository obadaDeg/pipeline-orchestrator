# Implementation Plan: Dashboard UI Redesign

**Branch**: `006-dashboard-ui-redesign` | **Date**: 2026-03-23 | **Spec**: [spec.md](spec.md)

## Summary

Redesign the Pipeline Orchestrator React dashboard from a plain functional UI to a professional, visually engaging SPA on par with tools like Linear or Zapier. The redesign introduces a fixed left sidebar, card-grid pipeline list, right-anchored slide-over form, toast notification system, skeleton loaders, tabbed pipeline detail, timeline job view, and a settings-style account page — all within the existing React 18 + TailwindCSS 3 stack. Two new dependencies are added: **Lucide React** (icons) and **highlight.js** (JSON syntax highlighting, JSON language pack only). No backend changes whatsoever.

## Technical Context

**Language/Version**: TypeScript 5.4 with JSX (React 18.3)
**Primary Dependencies**: React 18, React Router v6, TailwindCSS 3.4, Vite 5, Lucide React (new), highlight.js (new — JSON language only, ~5KB)
**Storage**: N/A — pure frontend; consumes existing REST API via `useApi` hook unchanged
**Testing**: No frontend unit tests required by spec; existing backend tests unaffected
**Target Platform**: Modern browser (Chrome, Firefox, Safari, Edge — ES2020+)
**Project Type**: SPA frontend redesign confined entirely to `dashboard/` subdirectory
**Performance Goals**: Above-fold content visible within 1 second on broadband; highlight.js import scoped to JSON language pack only to limit bundle impact
**Constraints**: No backend changes; no new CSS framework; mobile sidebar is stretch goal; existing `useApi`, `AuthContext`, and React Router structure are preserved
**Scale/Scope**: 6 pages, ~15 new or redesigned components, 2 new React contexts (ToastContext)

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Asynchronous Processing | ✅ N/A | Pure frontend — no webhook ingestion logic involved |
| II. Reliability & Retry | ✅ N/A | Pure frontend — Delivery Engine unchanged |
| III. Clean Separation of Concerns | ✅ PASS | Components are purely presentational; no backend boundaries crossed; `useApi` hook unchanged |
| IV. TypeScript Type Safety | ✅ PASS | Strict TypeScript throughout; all new component props fully typed; `any` prohibited |
| V. Infrastructure Reproducibility | ✅ PASS | `npm run build:dashboard` produces static output integrated into multi-stage Dockerfile; `docker compose up` unaffected |
| VI. Code Quality Standards | ✅ PASS | Single-responsibility components; named constants for colors/labels; no dead imports; no magic strings |
| VII. Testing Standards | ✅ N/A | No new backend logic; existing backend tests unaffected; frontend tests not in spec scope |
| VIII. API Consistency | ✅ N/A | No API changes; frontend consumes existing `{ data: ... }` envelope via unchanged `useApi` |
| IX. Performance Requirements | ✅ N/A | Backend performance unchanged; frontend bundle kept lean (highlight.js JSON-only) |

All applicable principles pass. Principles I, II, VII, VIII, IX are not applicable to a pure frontend redesign.

## Project Structure

### Documentation (this feature)

```text
specs/006-dashboard-ui-redesign/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (component prop model)
├── contracts/
│   └── screens.md       # Phase 1 output (screen-level component contracts)
├── quickstart.md        # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks — not created here)
```

### Source Code (repository root)

```text
dashboard/
├── package.json                       # Add: lucide-react, highlight.js
├── tailwind.config.ts                 # Extend: Inter font family, custom palette tokens
├── src/
│   ├── index.css                      # Add: Inter @import, highlight.js theme CSS
│   ├── App.tsx                        # Wrap with ToastProvider; otherwise unchanged
│   ├── main.tsx                       # Unchanged
│   ├── context/
│   │   ├── AuthContext.tsx            # Unchanged
│   │   └── ToastContext.tsx           # NEW — toast state: addToast / removeToast / toasts[]
│   ├── hooks/
│   │   ├── useApi.ts                  # Unchanged
│   │   └── useToast.ts                # NEW — convenience hook wrapping useContext(ToastContext)
│   ├── components/
│   │   ├── Layout.tsx                 # REDESIGN — sidebar shell + main content area (ml-60)
│   │   ├── Sidebar.tsx                # NEW — fixed 240px nav: logo, links+icons, user email, logout
│   │   ├── Badge.tsx                  # REDESIGN — pill badges for action types + statuses
│   │   ├── Button.tsx                 # REDESIGN — primary / secondary / danger variants
│   │   ├── SkeletonCard.tsx           # NEW — card-shaped animate-pulse placeholder
│   │   ├── SkeletonRow.tsx            # NEW — table-row animate-pulse placeholder
│   │   ├── SlideOver.tsx              # NEW — right-anchored panel, backdrop, sticky footer, Tailwind transitions
│   │   ├── Toast.tsx                  # NEW — single toast with type (success/error), auto-dismiss
│   │   ├── ToastContainer.tsx         # NEW — fixed top-right stack renderer
│   │   ├── EmptyState.tsx             # REDESIGN — centered icon + heading + body + optional CTA button
│   │   ├── ErrorState.tsx             # REDESIGN — consistent error display with retry
│   │   ├── Pagination.tsx             # Minor style polish — same API
│   │   ├── Tabs.tsx                   # NEW — tab bar + controlled panel switcher
│   │   ├── CodeBlock.tsx              # NEW — highlight.js JSON renderer via useEffect + ref
│   │   └── ConfirmDialog.tsx          # NEW — modal confirm dialog for destructive actions
│   ├── pages/
│   │   ├── LoginPage.tsx              # Minor polish: Inter font, indigo button, centered card
│   │   ├── PipelineListPage.tsx       # FULL REDESIGN — card grid, skeleton loaders, slide-over create form
│   │   ├── PipelineDetailPage.tsx     # FULL REDESIGN — header section + tabbed content + CodeBlock
│   │   ├── JobDetailPage.tsx          # FULL REDESIGN — timeline delivery attempts, expandable rows
│   │   └── AccountPage.tsx            # FULL REDESIGN — settings layout: key table, create form, audit log
│   └── utils/
│       └── time.ts                    # Unchanged
```

**Structure Decision**: Single-project frontend (`dashboard/` subdirectory). All changes confined to `dashboard/` — no files outside this directory are modified.

## Complexity Tracking

> No Constitution Check violations requiring justification.
