# Tasks: Code Editor Inputs

**Input**: Design documents from `/specs/010-code-editor-inputs/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, contracts/ui-components.md ✓, quickstart.md ✓

**Organization**: Three independent user stories. US1 is the MVP — US2 requires no extra code (CodeMirror handles it automatically), US3 is purely cosmetic.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

---

## Phase 1: Setup

**Purpose**: Install new dependencies so all subsequent tasks can import from them.

- [x] T001 Add `@uiw/react-codemirror`, `@codemirror/lang-json`, `@codemirror/autocomplete`, `@codemirror/commands`, and `@uiw/codemirror-theme-github` to `dashboard/package.json` dependencies and run `npm install` from the `dashboard/` directory

**Checkpoint**: `dashboard/node_modules/@uiw/react-codemirror` exists; `npm ls @uiw/react-codemirror` prints the version.

---

## Phase 2: Foundational

**Purpose**: Create the `CodeEditorInput` component shell with a working TypeScript interface and a plain-textarea ErrorBoundary fallback. All user story phases build on this shell.

**⚠️ CRITICAL**: T001 must be complete before T002 (imports won't resolve otherwise).

- [x] T002 Create `dashboard/src/components/CodeEditorInput.tsx` — define `CodeEditorInputProps` interface (`value: string`, `onChange: (v: string) => void`, `language?: 'json'`, `minRows?: number`, `maxRows?: number`, `formatOnPaste?: boolean`, `className?: string`, `id?: string`) and a class-based `ErrorBoundary` component that wraps the editor and renders a styled `<textarea>` fallback (same Tailwind classes as the current Action Config textarea: `block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500`) when an error is caught; export the `CodeEditorInput` function component (body can be a placeholder `<textarea>` for now)

**Checkpoint**: `dashboard/src/components/CodeEditorInput.tsx` compiles without TypeScript errors (`npx tsc --noEmit` from `dashboard/`).

---

## Phase 3: User Story 1 — JSON Config Editing Feels Like a Code Editor (Priority: P1) 🎯 MVP

**Goal**: Replace the plain Action Config textarea with a real code editor — syntax highlighting, Tab inserts spaces, auto-close brackets, auto-indent on Enter, auto-format on paste, auto-grow height.

**Independent Test**: Open Create Pipeline → Action Config field is a code editor → type `{`, observe `}` auto-closes → press Tab, observe 2 spaces inserted → paste minified JSON, observe auto-formatted → submit the form successfully. (Quickstart Scenario 1)

### Implementation for User Story 1

- [x] T003 [US1] Implement the CodeMirror editor body inside `CodeEditorInput` in `dashboard/src/components/CodeEditorInput.tsx` — import `CodeMirror` from `@uiw/react-codemirror`, `json` from `@codemirror/lang-json`, `closeBrackets` from `@codemirror/autocomplete`, `indentWithTab` from `@codemirror/commands`, `keymap` from `@codemirror/view`, `githubLight` from `@uiw/codemirror-theme-github`; render `<CodeMirror value={value} onChange={onChange} extensions={[json(), closeBrackets(), keymap.of([indentWithTab])]} theme={githubLight} height="auto" />`; wrap in `ErrorBoundary`

- [x] T004 [US1] Add auto-grow height to `CodeEditorInput` in `dashboard/src/components/CodeEditorInput.tsx` — compute `MIN_HEIGHT_PX = (minRows ?? 5) * 24` and `MAX_HEIGHT_PX = (maxRows ?? 20) * 24` as named constants; wrap the `<CodeMirror>` in a `<div>` with inline style `{ minHeight: MIN_HEIGHT_PX, maxHeight: MAX_HEIGHT_PX, overflowY: 'auto' }` and Tailwind classes `rounded-md border border-gray-300 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500`

- [x] T005 [US1] Add auto-format-on-paste to `CodeEditorInput` in `dashboard/src/components/CodeEditorInput.tsx` — when `formatOnPaste !== false`, attach an `onPaste` handler to the outer `<div>`: call `event.preventDefault()`, read `event.clipboardData?.getData('text/plain') ?? ''`, attempt `JSON.parse` → `JSON.stringify(parsed, null, 2)` → call `onChange(formatted)`; on `SyntaxError` fall back to `onChange(rawText)`

- [x] T006 [US1] Replace the Action Config `<textarea>` in `dashboard/src/pages/PipelineListPage.tsx` with `<CodeEditorInput>` — import `CodeEditorInput` from `'../components/CodeEditorInput'`; replace the `<textarea>` element with `<CodeEditorInput value={formActionConfig} onChange={(v) => { setFormActionConfig(v); setFormConfigError(null); }} />` and remove the `onBlur` prop (validation stays on form submit); keep the `formConfigError` error message `<p>` unchanged below the editor

**Checkpoint**: Open Create Pipeline → Action Config renders as a code editor → all steps in Quickstart Scenario 1 pass → pipeline can be created and saved. US1 complete and independently testable.

---

## Phase 4: User Story 2 — Keyboard Shortcuts Work as Expected (Priority: P2)

**Goal**: Ctrl+A, Ctrl+Z, Ctrl+Shift+Z operate within the editor scope.

**Note**: This story is satisfied automatically by CodeMirror's `minimalSetup` (included in `@uiw/react-codemirror` by default), which bundles the `history` extension (undo/redo stack) and `defaultKeymap` (select-all scoped to editor). **No additional code is required** beyond T003. This phase is verification-only.

**Independent Test**: Open Create Pipeline → follow Quickstart Scenario 2 → Ctrl+A selects only editor text, Ctrl+Z undoes within the editor, Ctrl+Shift+Z redoes.

### Verification for User Story 2

- [x] T007 [US2] Manually verify keyboard shortcut containment in the running dashboard per Quickstart Scenario 2 — confirm Ctrl+A selects only editor content (page title and other inputs are NOT selected), Ctrl+Z undoes within editor undo stack (not a browser back-navigation), Ctrl+Shift+Z redoes — document result as a comment in the PR

**Checkpoint**: All three keyboard shortcut behaviours confirmed. US2 complete.

---

## Phase 5: User Story 3 — Read-Only CodeBlock Matches Editor Theme (Priority: P3)

**Goal**: The existing `CodeBlock` component (Pipeline Overview tab) uses the same background colour, font, and token colour palette as `CodeEditorInput`.

**Independent Test**: Open any pipeline Overview tab → open Create Pipeline → compare both code displays side-by-side → background colour, font family/size, and token colours are visually consistent. (Quickstart Scenario 4)

### Implementation for User Story 3

- [x] T008 [US3] Update `dashboard/src/components/CodeBlock.tsx` — add `import { githubLight } from '@uiw/codemirror-theme-github'` is NOT needed (CodeBlock stays highlight.js based); instead update the wrapping `<pre>` className to use the githubLight background (`bg-[#f6f8fa]`) and border; update inline font size to `text-[13px]` to match CodeMirror's default — ensure the colours used by highlight.js's github theme are already matching (they are derived from the same GitHub colour palette); no functional change to highlighting logic

**Checkpoint**: Pipeline Overview tab and Create Pipeline form code displays are visually consistent. US3 complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [x] T009 [P] Add unit test file `dashboard/src/components/CodeEditorInput.test.tsx` — test 1: renders without throwing (import `CodeEditorInput`, render with `value=""` and a no-op `onChange`, assert no error thrown); test 2: calls `onChange` when value changes (use `@testing-library/user-event`); test 3: fallback textarea renders when ErrorBoundary catches — mock the import to throw and verify a `<textarea>` appears

- [x] T010 [P] Run `cd d:/Projects/Webhook/dashboard && npx tsc --noEmit` and `npx eslint src/components/CodeEditorInput.tsx src/pages/PipelineListPage.tsx src/components/CodeBlock.tsx` — fix any TypeScript or lint errors before merging

- [x] T011 Run `cd d:/Projects/Webhook/dashboard && npm test` — confirm all existing tests still pass (zero regressions from replacing the textarea)

- [ ] T012 Validate Quickstart Scenarios 1–4 manually with the running dashboard (`npm run dev:dashboard`) — confirm all pass; mark each scenario as verified in a PR comment

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — install packages first
- **Foundational (Phase 2)**: Depends on T001 (npm install must complete)
- **US1 (Phase 3)**: Depends on T002 (component shell) — T003 → T004 → T005 must run sequentially (same file); T006 can run in parallel with T005 (different file)
- **US2 (Phase 4)**: Depends on T003 being complete (editor must be mounted)
- **US3 (Phase 5)**: Independent of US1/US2 — can run in parallel after T001
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Blocking for US2 (editor must exist to test shortcuts)
- **US2 (P2)**: No code changes — depends only on US1 being deployed
- **US3 (P3)**: Fully independent of US1 and US2 — only touches `CodeBlock.tsx`

### Parallel Opportunities

- T006 (PipelineListPage) can be written while T004/T005 are being implemented — different files
- T008 (CodeBlock theme) can be worked alongside any US1 task — different file
- T009 (tests) and T010 (lint/typecheck) can run in parallel — different concerns

---

## Parallel Execution Example

```
Sequential core (same file — CodeEditorInput.tsx):
  T001 → T002 → T003 → T004 → T005

Parallel alongside T004/T005:
  T006 (PipelineListPage.tsx) — different file, no conflict
  T008 (CodeBlock.tsx) — different file, no conflict

Polish (after all stories):
  T009 [P], T010 [P] → T011 → T012
```

---

## Implementation Strategy

### MVP First (US1 only — 6 tasks)

1. T001 — install packages
2. T002 — component shell
3. T003 → T004 → T005 — build editor (same file, sequential)
4. T006 — wire into form
5. **STOP and VALIDATE**: Quickstart Scenario 1 passes — editor is live
6. Ship / demo US1 immediately

### Full Feature (all 12 tasks)

1. MVP (T001–T006) — editor live in the form
2. T007 — verify keyboard shortcuts
3. T008 — align CodeBlock theme
4. T009–T012 — tests, lint, final validation

---

## Notes

- T003–T005 are in the **same file** — run sequentially to avoid conflicts
- US2 requires **zero new code** — CodeMirror's minimalSetup covers Ctrl+A, undo/redo automatically
- US3 is cosmetic only — it can be done in 5 minutes and does not block the MVP
- `formatOnPaste` prop defaults to `true` — callers can opt out by passing `formatOnPaste={false}`
- Named constants for row heights (`MIN_HEIGHT_PX`, `MAX_HEIGHT_PX`) required by constitution principle VI
