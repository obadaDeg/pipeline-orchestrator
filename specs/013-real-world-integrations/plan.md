# Implementation Plan: Real-World Integration Examples

**Branch**: `013-real-world-integrations` | **Date**: 2026-03-25 | **Spec**: [spec.md](spec.md)

## Summary

Expand `docs/DEMO.md` with a webhook.site section and polish the existing GitHub integration section to reflect unsigned mode and the correct GitHub token scope. Fix `examples/subscriber-server/index.mjs` to display the actual delivered payload when envelope fields are absent. Update `examples/github-integration/setup.mjs` comments. No new API endpoints, no schema changes.

## Technical Context

**Language/Version**: JavaScript ES Modules (`.mjs`) for example scripts; Markdown for documentation
**Primary Dependencies**: Node.js built-in `http`, `crypto` modules (subscriber server — zero new deps)
**Storage**: N/A — no database changes
**Testing**: N/A — no automated tests for documentation/example scripts
**Target Platform**: Node.js 20 LTS (example scripts); any browser (webhook.site)
**Project Type**: Documentation update + example tooling polish
**Performance Goals**: N/A — subscriber server is demo/dev tool, not production
**Constraints**: No changes to the production API, worker, or database schema
**Scale/Scope**: 3 files modified, 1 section added to DEMO.md

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Asynchronous Processing | ✅ Not applicable | No ingest path changes |
| II. Reliability & Retry | ✅ Not applicable | No delivery engine changes |
| III. Clean Separation of Concerns | ✅ Not applicable | No production code structure changes |
| IV. TypeScript Type Safety | ✅ Not applicable | Example scripts are `.mjs` (JS); outside production TypeScript codebase |
| V. Infrastructure Reproducibility | ✅ Not applicable | No Docker/CI changes |
| VI. Code Quality Standards | ✅ Applies (minor) | Subscriber server fix must not swallow errors; no magic strings |
| VII. Testing Standards | ✅ Not applicable | No new production logic added |
| VIII. API Consistency | ✅ Not applicable | No new API endpoints |
| IX. Performance Requirements | ✅ Not applicable | No production performance-sensitive paths touched |

**Gate result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/013-real-world-integrations/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── delivery-payload.md   # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Files Changed (repository root)

```text
docs/
└── DEMO.md                           # Add webhook.site section; update GitHub section

examples/
├── subscriber-server/
│   └── index.mjs                     # Fix payload display fallback
└── github-integration/
    └── setup.mjs                     # Update JSDoc comments (unsigned mode, token scope)
```

**Structure Decision**: Single-project layout. All changes are documentation and example scripts — no production src/ changes.

## Complexity Tracking

No constitution violations. Table not required.

---

## Phase 0: Research Findings

See [research.md](research.md) for full details.

### Key Decisions

1. **Delivery payload format**: The worker sends `processedPayload` directly — no envelope, no signature header. The subscriber server must be updated to display the raw JSON when envelope fields are absent.

2. **Outbound delivery signature**: `SUBSCRIBER_SECRET` in the subscriber server is a forward-compatible placeholder. Users must NOT set it with the current delivery engine (deliveries would all return 401). Document this prominently.

3. **GitHub token scope**: `admin:repo_hook` (minimum required). `repo` is overly broad.

4. **GitHub unsigned mode**: The pipeline must have no inbound signing secret. `X-Hub-Signature-256` and `X-Webhook-Signature` are structurally incompatible.

5. **webhook.site**: Works out of the box — Docker containers have outbound internet access. No configuration needed.

6. **Tunnel verification**: No `/health` endpoint exists. Use `GET /stats` to confirm tunnel forwarding.

---

## Phase 1: Design

### Component 1 — `examples/subscriber-server/index.mjs` (patch)

**Problem**: The server reads `payload.jobId`, `payload.status`, `payload.result`, `payload.payload` — none of which are present in the actual delivery (worker sends processed payload directly). Everything displays as "unknown" and no content is shown.

**Fix**: After attempting to read the envelope fields, fall back to pretty-printing the entire received JSON object if `payload.result` and `payload.payload` are both absent. This makes the server useful for any delivery format.

**Specific change**:
```js
// After the existing payload.result and payload.payload blocks:
if (!payload.result && !payload.payload) {
  console.log(`\n  ${c.bold}${c.magenta}Received Payload:${c.reset}`);
  prettyPrint(payload, 4);
}
```

Also add a note about `SUBSCRIBER_SECRET` in the startup log:
- If `SUBSCRIBER_SECRET` is set, warn that the current delivery engine does not send `x-delivery-signature` and all deliveries will be rejected.

### Component 2 — `examples/github-integration/setup.mjs` (JSDoc update)

**Changes**:
- Update the `@prerequisites` comment to specify `admin:repo_hook` token scope (not `repo`)
- Add a note that the target pipeline must be configured WITHOUT an inbound signing secret (unsigned mode)
- Clarify that `WEBHOOK_SECRET` configures the GitHub-side secret (not used for pipeline verification)

### Component 3 — `docs/DEMO.md` (expand)

**New section** (insert after current section 11, before section 12 or as its own section):

**Section: webhook.site as a Subscriber**
- Step 1: Open webhook.site, copy the unique URL
- Step 2: Register as a subscriber via API (with example curl)
- Step 3: Send a test webhook via a pipeline source URL
- Step 4: Watch the processed payload appear in the browser dashboard

**Updated section: GitHub Integration** (current section 12):
- Add note at the top: "The GitHub pipeline must have no inbound signing secret configured (unsigned mode)"
- Change token scope instruction from `repo` to `admin:repo_hook`
- Update tunnel verification from `curl https://xxxx.ngrok-free.app/health` (which doesn't exist) to `curl https://xxxx.ngrok-free.app/stats -H "Authorization: Bearer $API_KEY"`
- Remove or clarify the `WEBHOOK_SECRET=$SECRET` step — note that passing a secret configures GitHub's HMAC (which the pipeline ignores)
- Ensure subscriber server startup notes that `SUBSCRIBER_SECRET` should NOT be set

---

## Implementation Order

1. `examples/subscriber-server/index.mjs` — fix payload display (quick code change)
2. `examples/github-integration/setup.mjs` — update JSDoc (comment-only change)
3. `docs/DEMO.md` — add webhook.site section + update GitHub section (documentation work)

All changes are independent and can be done in any order. No dependencies between them.

---

## Post-Design Constitution Re-Check

All principles still pass. No production code changes; no new dependencies; no schema changes.
