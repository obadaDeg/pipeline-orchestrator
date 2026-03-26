# Tasks: Webhook Simulator

**Input**: Design documents from `/specs/014-webhook-simulator/`
**Prerequisites**: plan.md ✅ | spec.md ✅ | research.md ✅ | data-model.md ✅ | contracts/ ✅ | quickstart.md ✅

**Tests**: Not requested — DX/tooling feature.

**Organization**: US1 (fire template) and US2 (edit payload) are both P1 — backend is foundational and blocks both. US3 (all 6 templates) and US4 (view job link) are P2 enhancements to the same `SimulatorTab.tsx` component.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: User story label (US1–US4)

---

## Phase 1: Setup

**Purpose**: Read files that will be modified — required before any Edit calls.

- [x] T001 Read `src/api/controllers/pipelines.controller.ts` in full to note existing handler structure and imports before adding `fireSimulation`
- [x] T002 [P] Read `src/api/routes/pipelines.router.ts` in full to note existing route registrations and middleware imports before adding `POST /:id/fire-simulation`
- [x] T003 [P] Read `src/api/schemas/pipeline.schema.ts` in full to note existing schema exports before adding `FireSimulationBodySchema`
- [x] T004 [P] Read `dashboard/src/pages/PipelineDetailPage.tsx` in full to note the `TABS` array structure, `activeTab` state, and render block pattern before adding the simulator tab entry

**Checkpoint**: All files to be modified have been read — safe to proceed with edits

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Backend endpoint — MUST be complete before any frontend work can be validated end-to-end.

**⚠️ CRITICAL**: US1 frontend cannot be tested until this phase is complete.

- [x] T005 Add `FireSimulationBodySchema` and `FireSimulationBody` type to `src/api/schemas/pipeline.schema.ts` — append after the last existing export: `export const FireSimulationBodySchema = z.object({ payload: z.record(z.unknown()) }); export type FireSimulationBody = z.infer<typeof FireSimulationBodySchema>;`

- [x] T006 [P] Create `src/services/simulation.service.ts` — export `simulateWebhook(pipelineId: string, payload: Record<string, unknown>): Promise<{ jobId: string }>` that: (1) queries `pipelines` table for `sourceId` where `id = pipelineId`, throws `NotFoundError` if absent; (2) serializes payload with `JSON.stringify(payload)` → `rawBody`; (3) queries `pipelineSigningSecrets` for a secret on this pipeline by `pipelineId` (the table has a unique-index on `pipelineId` — one row = active secret, no row = unsigned); (4) if a row is found: computes `timestamp = Math.floor(Date.now() / 1000).toString()` and `signatureHeader = 'sha256=' + createHmac('sha256', secret.secretValue).update(\`${timestamp}.${rawBody}\`).digest('hex')`, sets `timestampHeader = timestamp`; (5) calls `ingestWebhook(pipeline.sourceId, rawBody, signatureHeader, timestampHeader)` (pass `undefined` for both header args if no secret) and returns its result.

- [x] T007 Add `fireSimulation` handler to `src/api/controllers/pipelines.controller.ts` — import `simulateWebhook` from `../../services/simulation.service.js` and `FireSimulationBody` from `../../api/schemas/pipeline.schema.js`; add: `export async function fireSimulation(req, res, next) { try { const { payload } = req.body as FireSimulationBody; const result = await simulateWebhook(req.params.id, payload); res.status(202).json(successResponse(result)); } catch (err) { next(err); } }` (depends on T005, T006, and T001 read)

- [x] T008 Add `POST /:id/fire-simulation` route to `src/api/routes/pipelines.router.ts` — import `fireSimulation` from `../controllers/pipelines.controller.js` and `FireSimulationBodySchema` from `../schemas/pipeline.schema.js`; add `router.post('/:id/fire-simulation', authenticate, validate(FireSimulationBodySchema), fireSimulation);` after the existing `/:id/signing-secret` route (depends on T007 and T002 read)

**Checkpoint**: `POST /pipelines/:id/fire-simulation` endpoint is live. Verify with `curl` from quickstart.md.

---

## Phase 3: User Story 1 — Fire a Template Payload (Priority: P1) 🎯 MVP

**US1 Goal**: Developer selects a template, clicks Fire Webhook, sees 202 Accepted, and a real job appears in the Jobs tab.

**Independent Test**: Open any pipeline → Simulator tab → select GitHub — push → click Fire Webhook → confirm `202 Accepted — job created` is shown and a new job appears in the Jobs tab within seconds.

- [x] T009 [US1] Create `dashboard/src/components/SimulatorTab.tsx` — component receives `{ pipelineId: string }` prop; defines a `TEMPLATES` constant array with 6 entries each having `{ key, label, payload }` fields (see payloads below); renders: (a) a `<select>` dropdown bound to `selectedKey` state, mapped from `TEMPLATES`; (b) a `CodeEditorInput` with `value={editorValue}` (initialized to `JSON.stringify(TEMPLATES[0].payload, null, 2)`), `onChange={setEditorValue}`, `language="json"`, `minRows={10}`, `maxRows={30}`; (c) a "Fire Webhook" `<button>` that calls `handleFire()`; (d) a response area showing `responseState.message` when set. The `handleFire()` async function: POSTs to `/api/pipelines/${pipelineId}/fire-simulation` with `Content-Type: application/json` body `{ payload: JSON.parse(editorValue) }`, sets `responseState` to `{ status: response.status, message: status === 202 ? '202 Accepted — job created' : \`${status} — ${body.error?.message ?? 'Error'}\` }`. Template payloads: GitHub push `{ ref: 'refs/heads/main', repository: { full_name: 'owner/repo', name: 'repo' }, pusher: { name: 'developer' }, commits: [{ id: 'abc123', message: 'feat: add feature', author: { name: 'developer' } }], head_commit: { id: 'abc123', message: 'feat: add feature' } }`; GitHub pull_request `{ action: 'opened', number: 42, pull_request: { title: 'feat: add feature', state: 'open', user: { login: 'developer' }, head: { ref: 'feat/my-feature' }, base: { ref: 'main' } }, repository: { full_name: 'owner/repo' } }`; GitHub release `{ action: 'published', release: { tag_name: 'v1.0.0', name: 'Release v1.0.0', draft: false, prerelease: false, author: { login: 'developer' } }, repository: { full_name: 'owner/repo' } }`; Stripe charge.succeeded `{ type: 'charge.succeeded', data: { object: { id: 'ch_demo', amount: 4999, currency: 'usd', customer: 'cus_demo', status: 'succeeded' } } }`; Stripe payment_intent.created `{ type: 'payment_intent.created', data: { object: { id: 'pi_demo', amount: 2000, currency: 'usd', status: 'requires_payment_method', customer: 'cus_demo' } } }`; Custom blank `{}`.

- [x] T010 [US1] Update `dashboard/src/pages/PipelineDetailPage.tsx` — (1) add `import { SimulatorTab } from '../components/SimulatorTab.tsx';`; (2) add `{ key: 'simulator', label: 'Simulator' }` to the `TABS` array after the `'security'` entry; (3) add `{activeTab === 'simulator' && <SimulatorTab pipelineId={pipeline.id} />}` render block after the security tab render block. (depends on T009 and T004 read)

**Checkpoint**: Fire Webhook works end-to-end. 202 response visible in simulator UI. New job appears in Jobs tab.

---

## Phase 4: User Story 2 — Edit Payload Before Firing (Priority: P1)

**US2 Goal**: Developer modifies the JSON payload; invalid JSON disables the Fire button; switching templates resets the editor (with confirmation if content was modified).

**Independent Test**: Load GitHub push template → change `"owner/repo"` to `"myorg/myrepo"` → fire → confirm job raw payload shows `"myorg/myrepo"`. Then: delete closing `}` → confirm Fire button is disabled.

- [x] T011 [US2] Update `dashboard/src/components/SimulatorTab.tsx` to add JSON validation and dirty tracking: (1) add `isValidJson` state (boolean, default `true`); (2) in `CodeEditorInput` `onChange`, wrap `JSON.parse(value)` in try/catch — set `isValidJson = true` on success, `isValidJson = false` on catch; (3) add `disabled={!isValidJson || isLoading}` to the Fire button; (4) add `isLoading` state (boolean, default `false`) — set to `true` at start of `handleFire()`, set to `false` in finally block; (5) update Fire button label to show `'Firing…'` when `isLoading`; (6) in template dropdown `onChange` handler: if `editorValue !== JSON.stringify(currentTemplate.payload, null, 2)` (i.e., content is dirty), call `window.confirm('Reset editor to new template? Your edits will be lost.')` — if confirmed, reset `editorValue` to `JSON.stringify(newTemplate.payload, null, 2)` and `isValidJson = true`; if not confirmed, revert `selectedKey` to the previous value. (depends on T009)

**Checkpoint**: Fire button is disabled on invalid JSON. Edited values appear in job raw payload. Template switch confirms when content is dirty.

---

## Phase 5: User Story 3 — Switch Between Templates (Priority: P2)

**US3 Goal**: All 6 templates load correctly with distinct, valid JSON payloads.

**Independent Test**: Cycle through all 6 template options in the dropdown and confirm each loads a distinct, valid JSON payload in the editor (button stays enabled).

*Note: All 6 templates are already defined in T009. This phase verifies the dropdown label text is accurate and adds the template labels to the dropdown options.*

- [x] T012 [US3] Update `dashboard/src/components/SimulatorTab.tsx` to verify the template dropdown renders the correct labels: ensure the 6 `<option>` elements use these exact labels: `'GitHub — push'`, `'GitHub — pull_request opened'`, `'GitHub — release published'`, `'Stripe — charge.succeeded'`, `'Stripe — payment_intent.created'`, `'Custom (blank)'`. Verify the `TEMPLATES` constant keys match: `github_push`, `github_pull_request`, `github_release`, `stripe_charge_succeeded`, `stripe_payment_intent_created`, `custom_blank`. (depends on T011)

**Checkpoint**: All 6 templates accessible via dropdown. Each loads a distinct, non-empty JSON payload (except Custom blank which shows `{}`).

---

## Phase 6: User Story 4 — See the Created Job Immediately (Priority: P2)

**US4 Goal**: After a successful 202 response, a "View job →" link appears that navigates directly to the Job Detail page.

**Independent Test**: Fire any template → confirm "View job →" link appears in the response area → click it → confirm navigation to the correct Job Detail page showing the simulated payload.

- [x] T013 [US4] Update `dashboard/src/components/SimulatorTab.tsx` to add job link: (1) extend `responseState` to include `jobId?: string`; (2) in `handleFire()`, when `response.status === 202`, parse `body.data.jobId` and store in `responseState.jobId`; (3) in the response display area, when `responseState.status === 202 && responseState.jobId`, render a React Router `<Link to={/jobs/${responseState.jobId}}>View job →</Link>` below the status message. Import `Link` from `react-router-dom`. (depends on T012)

**Checkpoint**: "View job →" link appears after 202. Clicking it navigates to the correct Job Detail page.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: End-to-end verification and edge case coverage.

- [x] T014 [P] Verify `simulation.service.ts` handles the `NotFoundError` for a non-existent pipeline — confirm the `fireSimulation` controller's `next(err)` call flows to the existing error handler and returns `404 NOT_FOUND` (read `src/lib/errors.ts` to confirm `NotFoundError` is already defined and handled)
- [x] T015 [P] Verify signed-pipeline simulation end-to-end using quickstart.md Scenario 2: open a pipeline with an active signing secret, open the Simulator tab, fire any template, and confirm `202 Accepted` (not `401 Unauthorized`). If `401` is returned, debug `simulation.service.ts` — confirm the `rawBody` string and the `timestamp` passed to `ingestWebhook` are consistent with what `verifyHmac()` in `signing-secret.ts` expects.

**Checkpoint**: All 4 user stories verified. Happy path, signed pipeline, and job link all working.

---

## Dependency Graph

```
T001 (read pipelines.controller.ts)
T002 (read pipelines.router.ts)         ─── parallel with T001, T003, T004
T003 (read pipeline.schema.ts)          ─── parallel with T001, T002, T004
T004 (read PipelineDetailPage.tsx)      ─── parallel with T001, T002, T003

T005 (add FireSimulationBodySchema)     ─── after T003
T006 (create simulation.service.ts)     ─── after T001, T003 (parallel with T005)
T007 (add fireSimulation handler)       ─── after T005, T006, T001
T008 (add fire-simulation route)        ─── after T007, T002

T009 (create SimulatorTab.tsx)          ─── after T008 (endpoint live for testing)
T010 (update PipelineDetailPage.tsx)    ─── after T009, T004

T011 (add JSON validation + dirty)      ─── after T010
T012 (verify template labels)           ─── after T011
T013 (add View job → link)              ─── after T012

T014 (verify 404 path)                  ─── after T008 (parallel with T015)
T015 (verify signed pipeline HMAC)      ─── after T013 (parallel with T014)
```

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational (Phase 2 complete — T005–T008)
- **US2 (P1)**: Depends on US1 (T009–T010 complete — modifies same component)
- **US3 (P2)**: Depends on US2 (T011 complete)
- **US4 (P2)**: Depends on US3 (T012 complete)

### Parallel Opportunities

```
# Phase 1 — all 4 reads in parallel
T001 | T002 | T003 | T004

# Phase 2 — T005 and T006 in parallel (different files)
T005 (schema) | T006 (new service)
then T007 → T008 (sequential, same controller then router)

# Phase 7 — both polish verifications in parallel
T014 | T015
```

---

## Implementation Strategy

### MVP (US1 + US2 — both P1)

1. Complete Phase 1: Setup (read 4 files)
2. Complete Phase 2: Foundational (backend endpoint T005–T008)
3. Complete Phase 3: US1 (create SimulatorTab + wire into PipelineDetailPage)
4. Complete Phase 4: US2 (add JSON validation + template dirty check)
5. **STOP and VALIDATE**: Fire a template, edit a value, confirm the edited value appears in the job

### Full Delivery

6. Complete Phase 5: US3 (verify template labels)
7. Complete Phase 6: US4 (View job → link)
8. Complete Phase 7: Polish (signed pipeline verification)

**Total tasks**: 15
**Parallelizable**: T001–T004 (Phase 1), T005–T006 (Phase 2), T014–T015 (Phase 7)
**Sequential chain**: T007 → T008 → T009 → T010 → T011 → T012 → T013
