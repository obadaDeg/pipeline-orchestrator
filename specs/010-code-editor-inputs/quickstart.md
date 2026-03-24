# Quickstart: Code Editor Inputs (010)

## End-to-End Test Scenarios

### Scenario 1 — Create a Pipeline with the Code Editor (P1 MVP)

**Setup**: Dashboard running (`npm run dev:dashboard`), user logged in.

1. Click **New Pipeline** → slide-over opens.
2. Fill in Name: `Test Editor`.
3. Select Action Type: `field_extractor`.
4. Focus the **Action Config** field — it renders as a code editor (syntax colours visible, monospace font, not a plain grey textarea).
5. Type `{` → observe `{}` auto-inserted, cursor between braces.
6. Press Enter → new line indented by 2 spaces.
7. Type `"mapping"` → observe key rendered in a distinct colour.
8. Press Tab → 2 spaces inserted; focus remains in the editor.
9. Clear the field, paste `{"mapping":{"event":"event"}}` (minified) → observe auto-formatting to:
   ```json
   {
     "mapping": {
       "event": "event"
     }
   }
   ```
10. Submit the form → pipeline created successfully; no validation errors caused by the editor.

**Pass criteria**: Steps 4–9 all match expected behaviour; pipeline is created.

---

### Scenario 2 — Keyboard Shortcuts Stay Inside Editor (P2)

1. Open Create Pipeline form.
2. Type some JSON in the Action Config editor.
3. Press **Ctrl+A** (or Cmd+A on Mac) → only the editor text is selected (page title, other inputs are NOT selected).
4. Type a character → selected text is replaced.
5. Press **Ctrl+Z** → last typed character is undone (not a browser back-navigation).
6. Press **Ctrl+Shift+Z** → character reappears (redo works).

**Pass criteria**: All three shortcuts operate within the editor scope.

---

### Scenario 3 — Large Payload Auto-Scrolls (Edge Case)

1. Open Create Pipeline form.
2. Paste a JSON object with 30+ lines.
3. Observe the editor grows to approximately 20 rows of height, then stops growing.
4. A vertical scrollbar appears inside the editor; the form below it is still visible.

**Pass criteria**: Editor does not push the rest of the form off-screen; scrollbar appears at ~20 rows.

---

### Scenario 4 — Theme Consistency (P3)

1. Create any pipeline and open its detail page.
2. Go to the **Overview** tab — the action config is displayed in the `CodeBlock`.
3. Open **New Pipeline** — view the Action Config `CodeEditorInput`.
4. Compare: same background colour, same font family and size, same token colours.

**Pass criteria**: Both components look visually consistent.

---

### Scenario 5 — Fallback on Library Failure (FR-006)

*Manual test only — simulate by temporarily breaking the CodeMirror import.*

1. Introduce a syntax error in `CodeEditorInput.tsx` that causes the component to throw on mount.
2. Open the Create Pipeline form.
3. Observe that a plain styled `<textarea>` is rendered in place of the editor.
4. Type JSON into the textarea and submit — pipeline is created successfully.

**Pass criteria**: Form is still submittable; no blank white box or unhandled error UI.
