# Feature Specification: Code Editor Inputs

**Feature Branch**: `010-code-editor-inputs`
**Created**: 2026-03-24
**Status**: Draft
**Input**: User description: "I want you to create a UI feature for the code related parts and inputs, to treat it as a code editor not as a normal text area, where tabs and shortcuts become comfortable to write code, json or whatever"

## Overview

Dashboard users who configure pipelines must write structured data (JSON) in plain text areas. These areas behave like ordinary form fields — pressing Tab moves focus to the next element, there is no syntax highlighting while typing, and common editing shortcuts do not behave like a code editor. This creates friction and increases configuration errors. This feature replaces those plain text areas with embedded code editor inputs that feel natural to developers.

## Clarifications

### Session 2026-03-24

- Q: Should the editor automatically pretty-print / format the JSON when the user pastes content? → A: Yes — auto-format pasted content to pretty-printed JSON (2-space indent).
- Q: Should the code editor grow taller as content grows, or keep a fixed height? → A: Auto-grows with content up to a maximum of ~20 rows, then scrolls vertically.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — JSON Config Editing Feels Like a Code Editor (Priority: P1)

When a user creates or edits a pipeline, the Action Config field is a code editor rather than a plain text area. Pressing Tab inserts indentation, syntax is highlighted as the user types, brackets and quotes auto-close, and Enter inside a block auto-indents the next line.

**Why this priority**: The Action Config field is mandatory and contains structured JSON. Mistakes in this field cause pipeline creation to fail. Improving this input has the highest immediate impact on user productivity and error reduction.

**Independent Test**: Open the Create Pipeline slide-over, focus the Action Config field → type `{`, observe auto-closing `}` → press Enter, observe indented new line → press Tab, observe spaces inserted (not focus change) → type a key string, observe syntax coloring. The form can be submitted and the pipeline created normally.

**Acceptance Scenarios**:

1. **Given** the Create Pipeline form is open, **When** the user focuses the Action Config field and presses Tab, **Then** spaces are inserted at the cursor position and focus does NOT move to the next form element.
2. **Given** the user types `{`, **When** the character is entered, **Then** the closing `}` is automatically inserted and the cursor is placed between them.
3. **Given** the user types a JSON string, **When** they continue typing, **Then** keys, values, strings, and numbers are rendered in distinct colors.
4. **Given** the user presses Enter inside an open block, **When** the new line is created, **Then** it is indented one level deeper than the surrounding context.
5. **Given** the form contains an invalid JSON value, **When** the user submits, **Then** the existing validation error message still appears (editor does not break validation).
6. **Given** the user pastes minified JSON (e.g., `{"key":"value"}`), **When** the paste completes, **Then** the content is automatically expanded to pretty-printed JSON with 2-space indentation. If the pasted content is not valid JSON, it is inserted as-is.

---

### User Story 2 — Keyboard Shortcuts Work as Expected (Priority: P2)

Common editor keyboard shortcuts (select all, undo, redo) function correctly inside the code editor inputs, matching the behavior developers expect from tools like VS Code.

**Why this priority**: Without correct shortcut handling, Ctrl+A selects the whole page instead of the editor content, and Ctrl+Z may affect the browser history instead of the editor undo stack. These surprises break flow even if syntax highlighting is present.

**Independent Test**: Focus the Action Config field → press Ctrl+A, observe only the editor content is selected → type some JSON → press Ctrl+Z, observe the last character is undone inside the editor → press Ctrl+Shift+Z, observe redo works.

**Acceptance Scenarios**:

1. **Given** the editor has content, **When** the user presses Ctrl+A (Cmd+A on Mac), **Then** all text inside the editor is selected without affecting the rest of the page.
2. **Given** the user has typed characters in the editor, **When** they press Ctrl+Z, **Then** the last typed character or action is undone within the editor.
3. **Given** an undo has been performed, **When** the user presses Ctrl+Shift+Z (or Ctrl+Y), **Then** the action is redone.

---

### User Story 3 — Read-Only Code Display Uses Consistent Styling (Priority: P3)

The existing read-only code block (used in the Pipeline Overview tab to display the current action config) visually matches the new editable code editor — same font, background, and color scheme — so the UI feels cohesive.

**Why this priority**: Lower priority since it is purely cosmetic and the read-only block already uses syntax highlighting. It should be addressed after the editable editor is in place.

**Independent Test**: Open any pipeline's Overview tab → compare the displayed action config block with the Action Config editor in the Create Pipeline form. Font, background color, and token colors should be identical or near-identical.

**Acceptance Scenarios**:

1. **Given** a pipeline is open on the Overview tab, **When** the user also opens the Create Pipeline form, **Then** the code block and the code editor use the same visual theme (colors, font family, font size).

---

### Edge Cases

- What happens if the user pastes content larger than the 20-row cap? The editor reaches its maximum height and scrolls vertically within its bounds without overflowing the form layout.
- What happens when the editor library fails to initialise? The field must degrade gracefully to a plain textarea so the form remains usable.
- What happens if the user pastes non-UTF-8 or binary content? The editor displays the content as-is; validation catches invalid JSON at submit time.
- What happens on mobile / touch devices where keyboard shortcuts are unavailable? Tab-insertion and auto-close are progressive enhancements; the field remains operable without them.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The Action Config input in the pipeline creation form MUST behave as a code editor: Tab inserts indentation, Enter inside a block auto-indents, and opening brackets and quotes auto-close. When the user pastes content, the editor MUST automatically pretty-print it as indented JSON (2-space indent) if the pasted content is valid JSON.
- **FR-002**: The code editor MUST apply syntax highlighting for JSON as the user types, with distinct visual treatment for strings, numbers, booleans, null, keys, and punctuation.
- **FR-003**: Pressing Tab inside the code editor MUST insert spaces (2-space indentation) and MUST NOT move browser focus to the next focusable element.
- **FR-004**: Standard editing keyboard shortcuts — select-all, undo, redo — MUST operate within the editor scope and MUST NOT trigger unintended browser-level actions.
- **FR-005**: The code editor MUST be a controlled input: its current text content MUST be readable and submittable by the surrounding form in the same way a plain textarea value would be.
- **FR-006**: If the code editor component fails to initialise, the input MUST fall back to a styled plain textarea so the form remains fully functional.
- **FR-007**: The read-only code display on the Pipeline Overview tab MUST use the same visual theme as the editable code editor inputs.
- **FR-008**: The code editor MUST be keyboard-accessible: it MUST receive focus via Tab navigation when the editor itself is not active, and MUST display a visible focus indicator.
- **FR-009**: The code editor MUST auto-grow in height as content increases, starting at a minimum of 5 visible rows and capping at a maximum of 20 rows, after which it MUST scroll vertically within its bounds.

### Key Entities

- **CodeEditorInput**: A reusable editable component accepting a string value and an onChange callback, with a language prop (defaulting to `json`). Replaces plain textareas wherever code is entered.
- **CodeBlock**: The existing read-only display component whose visual theme is updated to match CodeEditorInput.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: All code-input fields in the dashboard that currently use a plain textarea for structured data are replaced with the code editor input.
- **SC-002**: Users can enter and edit valid JSON action configs without Tab causing focus loss — verifiable in manual and automated interaction tests.
- **SC-003**: The Action Config form field continues to pass all existing form validation tests after the editor replacement — zero regression in the test suite.
- **SC-004**: The code editor is interactive within 500 ms of the containing form opening on a standard development machine.
- **SC-005**: On environments where the editor fails to load, the form remains submittable with a plain-text fallback — verified by simulating a load failure.

## Assumptions

- The feature targets the dashboard frontend only — no backend changes are required.
- Only JSON is in scope for syntax highlighting in this iteration. Other languages (YAML, shell) are out of scope.
- The subscriber URL textarea is plain text (not code) and is excluded from this feature.
- Indentation width defaults to 2 spaces, matching the existing JSON display in CodeBlock.
- A lightweight embedded editor component will be used to keep bundle size small — the exact library choice is a planning-phase decision.
- The dashboard currently uses a light color theme; dark mode is out of scope for this iteration.

## Out of Scope

- Dark mode / theme switching for the editor.
- Language support beyond JSON in this iteration.
- Inline linting squiggles or error markers inside the editor (validation remains form-level).
- Full IDE features: file tree, multi-cursor, code completion / IntelliSense.
- The subscriber URL textarea (plain text, not code).
