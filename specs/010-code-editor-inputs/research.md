# Research: Code Editor Inputs (010)

**Date**: 2026-03-24
**Branch**: `010-code-editor-inputs`

---

## D-001: Editor Library Choice

**Decision**: Use `@uiw/react-codemirror` (CodeMirror 6 React wrapper)

**Rationale**:
- Modular and tree-shakeable — only needed language packs and extensions are bundled
- Full feature set required by spec: real-time syntax highlighting, Tab-inserts-spaces, auto-close brackets/quotes, proper undo/redo stack, auto-grow height, keyboard shortcut containment
- First-class React controlled-component API (`value` + `onChange` props)
- ~76 KB gzipped for the minimal JSON editor configuration (far below Monaco's ~4 MB)
- Actively maintained, widely adopted in the React ecosystem

**Alternatives considered**:

| Option | Bundle (gz) | Features | Verdict |
|---|---|---|---|
| `@uiw/react-codemirror` | ~76 KB | Full (tab, auto-close, highlight, undo, auto-grow) | **Selected** |
| `react-simple-code-editor` + Prism | ~15 KB | Highlight only — no tab handling, no undo stack | Too limited |
| `@monaco-editor/react` | ~4 MB | VS Code full feature set | Overkill; prohibitive bundle size |
| Custom textarea overlay | 0 KB | Manual implementation — brittle, no proper undo | Not feasible |

---

## D-002: Minimal Package Set

The following `@codemirror/*` packages cover all requirements:

| Package | Purpose |
|---|---|
| `@uiw/react-codemirror` | React wrapper + core editor (includes history/undo, keymaps, selection) |
| `@codemirror/lang-json` | JSON syntax highlighting and tokeniser |
| `@codemirror/autocomplete` | `closeBrackets()` extension — auto-closes `{}`, `[]`, `""` |
| `@codemirror/commands` | `indentWithTab` keymap — Tab inserts 2 spaces, not focus change |

The project currently has **no CodeMirror packages** installed. All four packages above must be added to `dashboard/package.json` dependencies.

---

## D-003: Auto-Format on Paste

**Decision**: Use a `div` wrapper with an `onPaste` React handler that intercepts clipboard content, attempts `JSON.parse` → `JSON.stringify(…, null, 2)`, then updates the controlled value.

**Rationale**: CodeMirror 6 does not provide a built-in paste formatter. The `onPaste` wrapper approach is the cleanest pattern — it prevents the default paste, formats if valid JSON, and falls back to raw paste for invalid content. It does not depend on editor internals.

**Implementation pattern**:
```
onPaste handler:
  1. event.preventDefault()
  2. read clipboardData.getData('text/plain')
  3. try JSON.parse(text) → JSON.stringify(parsed, null, 2) → call onChange(formatted)
  4. catch → call onChange(text) [raw paste for non-JSON content]
```

---

## D-004: Auto-Grow Height

**Decision**: CSS-only approach — set `minHeight` and `maxHeight` on the editor container; the editor fills its container naturally.

- Minimum: `5 * LINE_HEIGHT` ≈ `120px`
- Maximum: `20 * LINE_HEIGHT` ≈ `480px`
- `overflow-y: auto` kicks in above the maximum

**Rationale**: CodeMirror 6 renders content into a scrollable container by default. Setting `height="auto"` on the `<CodeMirror>` component tells it to size to content. A CSS max-height on the wrapper then caps growth and enables scrolling. No JavaScript height detection is needed.

---

## D-005: Controlled Component Integration

`@uiw/react-codemirror` accepts `value` (string) and `onChange` (string → void) props directly, matching a plain `<textarea>`'s API. Replacing a textarea with `<CodeEditorInput>` requires only swapping the JSX element — the surrounding form state management remains unchanged.

---

## D-006: Theme Alignment with Existing CodeBlock

The existing `CodeBlock` component uses `highlight.js` with its default theme (CSS class-based). `@uiw/react-codemirror` uses a separate theming system.

**Decision**: Style both components with shared CSS custom properties (colors, font family, background) defined on `.cm-editor` and mirrored in the `<pre>` + `<code>` elements of `CodeBlock`. This avoids importing highlight.js into the editor or CodeMirror into the read-only block.

The `githubLight` theme available from `@uiw/codemirror-theme-github` closely matches the existing highlight.js `github` style and is already in the `@uiw/react-codemirror` package family.

---

## D-007: Accessibility

`@uiw/react-codemirror` renders a `contenteditable` div with `role="textbox"` and `aria-multiline="true"`. Tab navigation to/from the editor is handled via the `tabIndex` prop. A visible focus ring is applied via `.cm-focused` CSS class (standard CodeMirror behaviour).
