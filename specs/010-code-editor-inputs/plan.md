# Implementation Plan: Code Editor Inputs

**Branch**: `010-code-editor-inputs` | **Date**: 2026-03-24 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/010-code-editor-inputs/spec.md`

## Summary

Replace the plain `<textarea>` used for the Action Config JSON field in the pipeline creation form with a reusable `CodeEditorInput` component backed by CodeMirror 6 (`@uiw/react-codemirror`). The component provides real-time JSON syntax highlighting, Tab-inserts-spaces, auto-close brackets, auto-grow height (5–20 rows), auto-format on paste, and correct keyboard shortcut scoping. The existing read-only `CodeBlock` component is updated to match the new editor's visual theme.

## Technical Context

**Language/Version**: TypeScript 5.4 (strict mode)
**Primary Dependencies**:
- `@uiw/react-codemirror` ^4.x (CodeMirror 6 React wrapper — NEW)
- `@codemirror/lang-json` (JSON syntax highlighting — NEW)
- `@codemirror/autocomplete` (closeBrackets extension — NEW)
- `@codemirror/commands` (indentWithTab keymap — NEW)
- `@uiw/codemirror-theme-github` (githubLight theme — NEW)
- React 18.3, TailwindCSS 3.4, Vite 5 (existing)
**Storage**: N/A — frontend only, no backend changes
**Testing**: Vitest + @testing-library/react (existing)
**Target Platform**: Modern browsers (Chrome, Firefox, Safari, Edge) — same as existing dashboard
**Project Type**: Dashboard web application (React SPA)
**Performance Goals**: Editor interactive within 500 ms of form opening (SC-004)
**Constraints**: Bundle addition ≤ 100 KB gzipped for the full editor feature set (D-001)
**Scale/Scope**: 1 new component (`CodeEditorInput`), 2 modified components (`CodeBlock`, `PipelineListPage`)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Asynchronous Processing | ✅ N/A | Frontend-only feature; no webhook ingestion changes |
| II. Reliability & Retry | ✅ N/A | No delivery or retry logic touched |
| III. Clean Separation of Concerns | ✅ Pass | New `CodeEditorInput` is a self-contained UI component; no cross-layer coupling |
| IV. TypeScript Type Safety | ✅ Pass | Component props must be fully typed; `any` prohibited |
| V. Infrastructure Reproducibility | ✅ N/A | No new services or Docker changes |
| VI. Code Quality Standards | ✅ Pass | Component under 40 lines of logic; constants for min/max rows |
| VII. Testing Standards | ✅ Pass | Unit test for `CodeEditorInput` rendering and Tab behaviour required |
| VIII. API Consistency | ✅ N/A | No new API endpoints |
| IX. Performance Requirements | ✅ Pass | 500 ms initialisation target in SC-004; bundle size constrained to ≤ 100 KB gzipped |

**Post-design re-check**: All gates still pass after Phase 1 design.

## Project Structure

### Documentation (this feature)

```text
specs/010-code-editor-inputs/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── contracts/
│   └── ui-components.md ← Phase 1 output
├── quickstart.md        ← Phase 1 output
└── tasks.md             ← Phase 2 output (/speckit.tasks)
```

### Source Code Changes

```text
dashboard/
├── package.json                          ← add 5 new devDependencies
└── src/
    ├── components/
    │   ├── CodeEditorInput.tsx           ← NEW: reusable code editor component
    │   ├── CodeEditorInput.test.tsx      ← NEW: unit tests
    │   └── CodeBlock.tsx                 ← MODIFY: update theme to match editor
    └── pages/
        └── PipelineListPage.tsx          ← MODIFY: replace <textarea> with <CodeEditorInput>
```

No backend files are touched. No new routes, schema changes, or environment variables.

## Complexity Tracking

No constitution violations. No complexity justification required.

## Key Technical Decisions

### KTD-001: Library — @uiw/react-codemirror

CodeMirror 6 via the `@uiw/react-codemirror` React wrapper. Provides all required features in ~76 KB gzipped. See [research.md D-001](research.md).

### KTD-002: Auto-Format on Paste

`onPaste` React event handler on a `<div>` wrapping the `<CodeMirror>` element. Intercepts clipboard text, attempts `JSON.parse` → `JSON.stringify(…, null, 2)`, falls back to raw paste for non-JSON. See [research.md D-003](research.md).

### KTD-003: Auto-Grow Height

CSS `minHeight` / `maxHeight` on the container + `height="auto"` on the `<CodeMirror>` element. Min = 120 px (≈5 rows), max = 480 px (≈20 rows), then `overflow-y: scroll`. See [research.md D-004](research.md).

### KTD-004: Theme

`githubLight` from `@uiw/codemirror-theme-github` for the editor. `CodeBlock` CSS updated to use the same token colours via CSS custom properties. See [research.md D-006](research.md).

### KTD-005: Fallback

If `@uiw/react-codemirror` fails to render (e.g., SSR / unsupported env), an `ErrorBoundary` wrapping `CodeEditorInput` renders a styled plain `<textarea>` instead.
