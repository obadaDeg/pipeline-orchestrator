# Tasks: Real-World Integration Examples

**Input**: Design documents from `/specs/013-real-world-integrations/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅ | quickstart.md ✅

**Tests**: Not requested — this is a documentation and tooling feature.

**Organization**: Tasks grouped by user story. US1 (GitHub) depends on US2 (Tunnel) — handled in the same phase. US3 (webhook.site) and US4 (subscriber server) are independent.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1–US4)

---

## Phase 1: Setup

**Purpose**: Read current state to establish insertion context before any changes.

- [x] T001 Read `docs/DEMO.md` in full to note current section count, section titles, and the Quick Reference table at the end — used to plan insertion points in T005, T006, T007

**Checkpoint**: Current DEMO.md structure understood — section numbering known

---

## Phase 2: Foundation (Blocking Prerequisites)

**Purpose**: Fix example scripts so all downstream documentation is accurate. Both tasks touch different files and can be done in parallel.

**⚠️ CRITICAL**: T002 and T003 must be complete before writing any documentation that references these scripts, so the documented behavior matches the actual code.

- [x] T002 [P] Fix `examples/subscriber-server/index.mjs` — after the existing `payload.result` and `payload.payload` display blocks (lines ~111–119), add a fallback block: if neither `payload.result` nor `payload.payload` is truthy, call `prettyPrint(payload, 4)` under a `Received Payload:` header (same style as `Processed Result:` header). This makes the server display the actual processed payload delivered by the current worker (which sends processed payload directly, not a wrapped envelope). Also add a startup warning: if `SECRET` is set, print a `⚠ SUBSCRIBER_SECRET is set but the current delivery engine does not send x-delivery-signature — all deliveries will be rejected with 401` message in yellow after the existing signature status line.

- [x] T003 [P] Update JSDoc header in `examples/github-integration/setup.mjs` (lines 1–18) — replace `repo:write` scope mention with `admin:repo_hook` scope (minimum required for webhook management). Add a note in the `@prerequisites` block: "The target pipeline must have no inbound signing secret configured (unsigned mode). GitHub sends `X-Hub-Signature-256` which the pipeline does not verify — the pipeline's own `X-Webhook-Signature` scheme is different."

**Checkpoint**: Subscriber server correctly displays any delivery payload. Setup script JSDoc is accurate.

---

## Phase 3: User Story 1 + User Story 2 — GitHub Integration & Public Tunnel (Priority: P1) 🎯 MVP

**US1 Goal**: Developer can run the GitHub integration end-to-end (tunnel → subscriber → webhook registration → push → COMPLETED job in dashboard).

**US2 Goal**: Developer can expose localhost:4000 via a tunnel and verify it is working before proceeding to GitHub setup.

**Independent Test**: Start the system, run `ngrok http 4000`, confirm the public URL returns a valid response from `GET /stats`, register a GitHub webhook using `setup.mjs` with `admin:repo_hook` token and no signing secret on the pipeline, push a commit, and confirm a COMPLETED job appears in the dashboard.

- [x] T004 [US1] [US2] Update the GitHub Integration section in `docs/DEMO.md` (current section 12, "Real GitHub Integration") with these specific changes:
  1. **Tunnel verification** (Step 1 — "Install ngrok and expose the API"): After the `ngrok http 4000` command, replace any reference to `GET /health` (which does not exist) with a verification step: `curl https://xxxx.ngrok-free.app/stats -H "Authorization: Bearer $API_KEY"` — should return a JSON stats response.
  2. **Unsigned mode requirement** (beginning of Step 3 — "Register the GitHub webhook"): Add a callout box or bold note: "The pipeline must have no inbound signing secret configured (unsigned mode). GitHub signs with `X-Hub-Signature-256` which the pipeline does not read — it uses `X-Webhook-Signature` instead."
  3. **Token scope** (Step 3 prose): Change "You need a GitHub Personal Access Token with `repo` scope" to "`admin:repo_hook` scope (minimum required for webhook management; `repo` also works but grants broader access than necessary)".
  4. **WEBHOOK_SECRET step**: In the Step 3 bash commands, remove or comment out the `SECRET=$(psql ...)` and `WEBHOOK_SECRET=$SECRET` lines from the `node examples/github-integration/setup.mjs` invocation. Replace with a note: "No signing secret is passed — the pipeline runs in unsigned mode. GitHub's HMAC scheme (`X-Hub-Signature-256`) is incompatible with the pipeline's `X-Webhook-Signature` scheme."
  5. **Subscriber server note**: In Step 2 ("Start the subscriber server"), add: "Do not set `SUBSCRIBER_SECRET` — the delivery engine does not send `x-delivery-signature`. Deliveries will be rejected if the secret is set."

**Checkpoint**: A developer following section 12 of DEMO.md can go from zero to a real GitHub push job in the dashboard. Unsigned mode is clearly documented. Token scope is `admin:repo_hook`.

---

## Phase 4: User Story 3 — webhook.site as a Subscriber (Priority: P2)

**US3 Goal**: Developer can use webhook.site as a zero-setup subscriber to inspect processed deliveries in their browser without running any local server.

**Independent Test**: Open webhook.site, copy the unique URL, register it as a subscriber on the Stripe Payments pipeline, send a test webhook via `POST /webhooks/:sourceId`, and confirm the processed payload appears in the webhook.site browser dashboard within 2 seconds.

- [x] T005 [US3] Insert a new section into `docs/DEMO.md` between the current section 11 ("Create Your Own Pipeline") and section 12 ("Real GitHub Integration"). Renumber the current section 12 to section 13. The new section 12 should be titled "**12. webhook.site as a Subscriber (Zero-Setup)**" and contain:
  1. **Introduction**: One sentence — "webhook.site gives you a unique public URL that displays incoming HTTP requests in your browser — no account or server setup required."
  2. **Step 1 — Get a webhook.site URL**: Open `https://webhook.site` in your browser. A unique URL is auto-generated (e.g., `https://webhook.site/abcd-1234-efgh-5678`). Copy it.
  3. **Step 2 — Register as a subscriber** (curl example registering the webhook.site URL on the Stripe Payments pipeline using `$STRIPE_SOURCE_ID` from section 3 and `$API_KEY` from section 1).
  4. **Step 3 — Send a test webhook** (curl example sending a payload to `POST /webhooks/$STRIPE_SOURCE_ID`).
  5. **Step 4 — View in browser**: After 1–2 seconds, refresh the webhook.site tab. The processed payload (filtered `charge.succeeded` fields via the `payload_filter` action) appears as a new request with full headers and body.
  6. **Note**: "webhook.site free URLs are temporary and public. Use for demo/testing only."
  7. **Dashboard**: Mention that the same job appears in the dashboard (Stripe Payments → Jobs tab) with `COMPLETED` status.

  Update the **Quick Reference** table at the bottom of DEMO.md to add a row: `| webhook.site subscriber | Open https://webhook.site, copy URL, register as subscriber |`

**Checkpoint**: A developer can verify processed deliveries without running any local server, directly in their browser.

---

## Phase 5: User Story 4 — Local Subscriber Server (Priority: P2)

**US4 Goal**: Developer can run the local subscriber server, receive processed deliveries in their terminal, and see the processed payload displayed in color.

**Independent Test**: Run `node examples/subscriber-server/index.mjs`, register `http://host.docker.internal:5050` as a subscriber, send a webhook, and confirm the processed payload appears in the terminal output.

- [x] T006 [US4] Update the subscriber server section in `docs/DEMO.md` (Step 2 "Start the subscriber server" within section 13, the renumbered GitHub Integration section) with these changes:
  1. Add a **Docker networking note** before the `curl` register command: "The worker runs inside Docker — register the subscriber as `http://host.docker.internal:5050`, NOT `http://localhost:5050`."
  2. Add a **SUBSCRIBER_SECRET warning**: "Do not set `SUBSCRIBER_SECRET` — the delivery engine does not send `x-delivery-signature`. If the secret is set, all deliveries will be rejected with `401`."
  3. Clarify the displayed output: "The terminal will show the processed payload (the `field_extractor` output — fields `event`, `repo`, `ref`). The Job ID shows as `unknown` because the delivery engine sends the processed payload directly without an envelope wrapper."

**Checkpoint**: Developer knows exactly which subscriber URL format to use, knows not to set `SUBSCRIBER_SECRET`, and understands what the terminal output will look like.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Consistency check, section numbering verification, and Quick Reference table accuracy.

- [x] T007 Re-read `docs/DEMO.md` in full after all edits and verify:
  1. Section numbers are sequential (1–13) with no gaps or duplicates after the webhook.site insertion
  2. The Quick Reference table at the bottom references the correct section numbers and URLs (stats endpoint, retry endpoint, etc.)
  3. No broken bash variable references (e.g., `$STRIPE_SOURCE_ID` is defined in section 3 before it is used in section 12)
  4. The `GH_SOURCE_ID` extraction command in the GitHub section (now section 13) no longer includes `WEBHOOK_SECRET=$SECRET` step
  5. All `ngrok-free.app` URL examples still use the `xxxx` placeholder format consistently

- [x] T008 [P] Re-read `examples/subscriber-server/index.mjs` after T002 and verify:
  1. The fallback `prettyPrint(payload, 4)` block is inside the `req.on('end', ...)` handler (not outside it)
  2. The `SUBSCRIBER_SECRET` startup warning only fires when `SECRET` is truthy
  3. No syntax errors — the file is valid JavaScript

- [x] T009 [P] Re-read `examples/github-integration/setup.mjs` after T003 and verify:
  1. The JSDoc comment accurately reflects `admin:repo_hook` scope
  2. The unsigned mode note is present and accurate
  3. The rest of the script logic is unchanged (no accidental edits to the `fetch` call or event list)

**Checkpoint**: All files are consistent. DEMO.md is coherent end-to-end. Example scripts have accurate headers.

---

## Dependency Graph

```
T001 (read DEMO.md)
  └─ T004 (update GitHub section in DEMO.md)
  └─ T005 (add webhook.site section to DEMO.md)
  └─ T006 (update subscriber section in DEMO.md)

T002 (fix subscriber-server/index.mjs)  ─┐
T003 (update setup.mjs JSDoc)           ─┤─ Independent; parallel with T001
                                          │
T004, T005, T006 (DEMO.md edits)        ─┤─ Sequential (same file); after T001
                                          │
T007 (DEMO.md consistency check)         ─┘─ After T004, T005, T006
T008 (verify subscriber-server)          ─── After T002
T009 (verify setup.mjs)                  ─── After T003
```

## Parallel Execution Opportunities

```
# Batch 1 — all independent
T001 (read DEMO.md) | T002 (fix subscriber server) | T003 (fix setup.mjs)

# Batch 2 — after T001
T004 (update GitHub section) → T005 (add webhook.site section) → T006 (update subscriber section)
[Sequential — all edit docs/DEMO.md]

# Batch 3 — polish (after Batch 2 + T002 + T003)
T007 (DEMO.md verify) | T008 (verify subscriber-server) | T009 (verify setup.mjs)
```

## Implementation Strategy

**MVP (Phase 2 + Phase 3)**: Fix the subscriber server display + update DEMO.md GitHub section. This makes the GitHub end-to-end demo work correctly with unsigned mode and correct token scope — the P1 user stories.

**Full delivery**: Add the webhook.site section (Phase 4) and subscriber server documentation update (Phase 5) to complete all P2 user stories.

**Total tasks**: 9
**Parallelizable**: T002, T003 (Phase 2), T008, T009 (Phase 6)
**Sequential**: T001 → T004 → T005 → T006 → T007 (DEMO.md editing chain)
