# UI Component Contracts: Code Editor Inputs (010)

## CodeEditorInput

**File**: `dashboard/src/components/CodeEditorInput.tsx`
**Type**: New reusable component

### Props Interface

```typescript
interface CodeEditorInputProps {
  /** Current string value (controlled) */
  value: string;
  /** Called with the new string value on every change */
  onChange: (value: string) => void;
  /** Language for syntax highlighting — defaults to 'json' */
  language?: 'json';
  /** Minimum visible height in rows — defaults to 5 */
  minRows?: number;
  /** Maximum visible height in rows before scrolling — defaults to 20 */
  maxRows?: number;
  /** Whether to auto-format pasted content — defaults to true */
  formatOnPaste?: boolean;
  /** Additional class names applied to the outer container */
  className?: string;
  /** Passed to the underlying editor for ARIA labelling */
  id?: string;
  /** Whether the field is required (form attribute) */
  required?: boolean;
}
```

### Behaviour Contract

| Trigger | Behaviour |
|---|---|
| User presses Tab | Inserts 2 spaces at cursor; focus stays in editor |
| User presses Enter inside block | New line indented one level deeper |
| User types `{`, `[`, `"` | Closing counterpart auto-inserted; cursor placed between |
| User pastes valid JSON string | Content pretty-printed (2-space indent) and set as value |
| User pastes non-JSON string | Content inserted as-is |
| User presses Ctrl+A / Cmd+A | Selects all editor content; does not select page |
| User presses Ctrl+Z / Cmd+Z | Undoes last action within editor undo stack |
| User presses Ctrl+Shift+Z | Redoes last undone action within editor |
| Content height < minRows × LINE_HEIGHT | Editor expands to minRows height |
| Content height > maxRows × LINE_HEIGHT | Editor stays at maxRows height; scrolls internally |
| Editor library fails to mount | ErrorBoundary renders a styled plain `<textarea>` fallback |

### Visual Contract

- Background: same as `CodeBlock` (`#f6f8fa` — GitHub light grey)
- Font: `font-mono`, 14 px, matching `CodeBlock`
- Token colours: `githubLight` theme (strings = green, numbers = blue, keys = navy, punctuation = grey)
- Focus ring: `ring-2 ring-indigo-500` (matching other form fields in the dashboard)
- Border: `border border-gray-300 rounded-md` (matching other form fields)

---

## CodeBlock (updated)

**File**: `dashboard/src/components/CodeBlock.tsx`
**Type**: Modified existing component

### Change

The background colour, font family, font size, and token colours MUST be updated to match the `githubLight` theme used by `CodeEditorInput`. The component remains read-only; no interactive behaviour is added.

No props changes — existing interface is preserved.

---

## Fallback Textarea

When `CodeEditorInput`'s ErrorBoundary catches a render error, it renders:

```typescript
<textarea
  value={value}
  onChange={(e) => onChange(e.target.value)}
  className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
  rows={minRows}
/>
```

This preserves full form functionality with identical styling to the original textarea that is being replaced.
