# Implementation Plan: Webhook Simulator

**Branch**: `014-webhook-simulator` | **Date**: 2026-03-26 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/014-webhook-simulator/spec.md`

---

## Summary

Add a Simulator tab to the pipeline detail page that lets developers fire realistic webhook payloads through a real pipeline without any external tools. A new `POST /pipelines/:id/fire-simulation` backend endpoint computes HMAC signatures server-side (so the raw secret never leaves the server), calls `ingestWebhook()` directly, and returns a `jobId`. The frontend provides 6 pre-built payload templates (GitHub push/PR/release, Stripe charge/payment_intent, Custom blank) via a reusable CodeMirror JSON editor with real-time linting.

---

## Technical Context

**Language/Version**: TypeScript 5.4 strict mode, Node.js 20 LTS (backend) + React 18.3 / TypeScript (frontend)
**Primary Dependencies**: Express 4.x, Drizzle ORM 0.30, Zod 3.x (backend); React Router v6, TailwindCSS 3.4, `@uiw/react-codemirror` (frontend — already installed)
**Storage**: PostgreSQL — no schema changes. Reads `pipelineSigningSecrets.secretValue` and `pipelines.sourceId` from existing tables.
**Testing**: No new tests requested for this feature (tooling/DX feature)
**Target Platform**: Web service (Express API) + SPA dashboard (Vite/React)
**Project Type**: Web application (backend REST API + frontend SPA)
**Performance Goals**: Simulation endpoint follows the same `<200ms` p95 ingest contract (all heavy work deferred to worker)
**Constraints**: Raw signing secret MUST NOT be exposed to the browser or logged. No new npm dependencies.
**Scale/Scope**: Single new endpoint, single new service, single new React component, two modified files per layer.

---

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Asynchronous Processing | ✅ PASS | Simulation calls `ingestWebhook()` directly — job is inserted as `PENDING` and enqueued on the broker. No synchronous processing in the HTTP lifecycle. |
| II. Reliability & Retry | ✅ PASS | No change to the job state machine or delivery engine. The simulated job goes through the same `PENDING → PROCESSING → COMPLETED/FAILED` lifecycle as any real job. |
| III. Clean Separation of Concerns | ✅ PASS | New `simulation.service.ts` keeps simulation logic separate from the ingest path. The simulation service calls the ingest service — it does not bypass the broker. |
| IV. TypeScript Type Safety | ✅ PASS | All new code written in TypeScript strict mode. No `any` without justification. `FireSimulationBodySchema` typed via Zod inference. |
| V. Infrastructure Reproducibility | ✅ PASS | No new containers, no new environment variables required. Feature works with the existing `docker compose up` stack. |
| VI. Code Quality Standards | ✅ PASS | `simulateWebhook()` is a single-responsibility function ≤40 lines. HMAC logic reuses existing `signing-secret.ts` constants. Named constants used for header names. |
| VII. Testing Standards | ✅ PASS (N/A) | No new processing action types introduced. Existing tests unaffected. Tests not requested for this DX feature. |
| VIII. API Consistency | ✅ PASS | Response uses `successResponse()` wrapper → `{ data: { jobId } }`. Error codes follow existing patterns (`NOT_FOUND`, `VALIDATION_ERROR`). Path is lowercase hyphen-separated. |
| IX. Performance Requirements | ✅ PASS | `simulateWebhook()` does one DB read (signing secret) + one service call (`ingestWebhook()`). Total overhead is one extra SELECT before the standard ingest path. Well within 200ms p95. |

**Constitution Check**: All 9 principles pass. No Complexity Tracking entries required.

---

## Project Structure

### Documentation (this feature)

```text
specs/014-webhook-simulator/
├── plan.md              # This file
├── research.md          # Phase 0 — 7 decisions (service call, HMAC, service placement, tab, editor, templates, schema)
├── data-model.md        # Phase 1 — no new DB entities; documents Job + PipelineSigningSecret references
├── quickstart.md        # Phase 1 — 6 test scenarios (happy path, signed, edit, invalid JSON, Stripe, blank)
├── contracts/
│   └── simulation-endpoint.md  # Phase 1 — POST /pipelines/:id/fire-simulation contract
├── checklists/
│   └── requirements.md  # All 13 items ✅
└── tasks.md             # Phase 2 output (/speckit.tasks command — NOT created here)
```

### Source Code (repository root)

```text
src/
├── services/
│   ├── simulation.service.ts          # NEW — simulateWebhook(pipelineId, payload)
│   ├── ingestion.service.ts           # UNCHANGED — ingestWebhook() called by simulation
│   └── signing.service.ts             # UNCHANGED — raw secret fetched directly in simulation.service
├── api/
│   ├── controllers/
│   │   └── pipelines.controller.ts    # MODIFIED — add fireSimulation() handler
│   ├── routes/
│   │   └── pipelines.router.ts        # MODIFIED — add POST /:id/fire-simulation route
│   └── schemas/
│       └── pipeline.schema.ts         # MODIFIED — add FireSimulationBodySchema

dashboard/src/
├── components/
│   ├── SimulatorTab.tsx               # NEW — full simulator UI (templates, editor, fire button, response)
│   └── CodeEditorInput.tsx            # UNCHANGED — reused as-is
└── pages/
    └── PipelineDetailPage.tsx         # MODIFIED — add 'simulator' tab entry + SimulatorTab render block
```

**Structure Decision**: Standard single-project layout (Option 1 adapted for this monorepo). Backend in `src/`, frontend in `dashboard/src/`. New files follow the existing file-per-service and file-per-component conventions already established by features 001–013.

---

## Implementation Approach

### Backend (3 file changes)

**1. `src/services/simulation.service.ts` (NEW)**

```typescript
import { createHmac } from 'node:crypto';
import { db } from '../db/index.js';
import { pipelineSigningSecrets, pipelines } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { ingestWebhook } from './ingestion.service.js';
import { NotFoundError } from '../lib/errors.js';

const SIGNATURE_HEADER = 'X-Webhook-Signature';
const TIMESTAMP_HEADER = 'X-Webhook-Timestamp';

export async function simulateWebhook(
  pipelineId: string,
  payload: Record<string, unknown>,
): Promise<{ jobId: string }> {
  // 1. Resolve sourceId
  const [pipeline] = await db
    .select({ sourceId: pipelines.sourceId })
    .from(pipelines)
    .where(eq(pipelines.id, pipelineId))
    .limit(1);
  if (!pipeline) throw new NotFoundError('Pipeline not found');

  // 2. Serialize payload
  const rawBody = JSON.stringify(payload);

  // 3. Compute HMAC if signing secret exists
  // One row = secret active (unique index on pipelineId); no row = unsigned pipeline
  const [secret] = await db
    .select({ secretValue: pipelineSigningSecrets.secretValue })
    .from(pipelineSigningSecrets)
    .where(eq(pipelineSigningSecrets.pipelineId, pipelineId))
    .limit(1);

  let signatureHeader: string | undefined;
  let timestampHeader: string | undefined;
  if (secret) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const hmac = createHmac('sha256', secret.secretValue)
      .update(`${timestamp}.${rawBody}`)
      .digest('hex');
    signatureHeader = `sha256=${hmac}`;
    timestampHeader = timestamp;
  }

  // 4. Delegate to ingest — full pipeline runs as normal
  // Pass undefined for header args on unsigned pipelines (ingestWebhook no-ops on verify)
  return ingestWebhook(pipeline.sourceId, rawBody, signatureHeader, timestampHeader);
}
```

**2. `src/api/schemas/pipeline.schema.ts` (MODIFIED)**

Add at the end of the file:
```typescript
export const FireSimulationBodySchema = z.object({
  payload: z.record(z.unknown()),
});
export type FireSimulationBody = z.infer<typeof FireSimulationBodySchema>;
```

**3. `src/api/controllers/pipelines.controller.ts` (MODIFIED)**

Add handler:
```typescript
export async function fireSimulation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { payload } = req.body as FireSimulationBody;
    const result = await simulateWebhook(req.params.id, payload);
    res.status(202).json(successResponse(result));
  } catch (err) {
    next(err);
  }
}
```

**4. `src/api/routes/pipelines.router.ts` (MODIFIED)**

Add route with auth + validation:
```typescript
router.post('/:id/fire-simulation', authenticate, validate(FireSimulationBodySchema), fireSimulation);
```

### Frontend (2 file changes)

**5. `dashboard/src/components/SimulatorTab.tsx` (NEW)**

- Template dropdown with 6 options
- `CodeEditorInput` with `language="json"`, `minRows={10}`, `maxRows={30}`
- JSON validity check on every `onChange` → disable Fire button if `JSON.parse()` throws
- `handleFire()`: POST to `/api/pipelines/:pipelineId/fire-simulation`, set `isLoading`, show result
- Result display: `202 Accepted — job created` + "View job →" link, or error status + message

**6. `dashboard/src/pages/PipelineDetailPage.tsx` (MODIFIED)**

- Add `{ key: 'simulator', label: 'Simulator' }` to the `TABS` array after `'security'`
- Add `{activeTab === 'simulator' && <SimulatorTab pipelineId={pipeline.id} />}` render block

---

## Key Technical Decisions

See [research.md](research.md) for full rationale. Summary:

| Decision | Choice | Why |
|----------|--------|-----|
| Ingest path | Call `ingestWebhook()` directly | No HTTP overhead, no URL dependency, reuses all validation |
| HMAC computation | Server-side in `simulation.service.ts` | Raw secret never reaches the browser |
| Service placement | New `simulation.service.ts` | Keeps ingest path focused; simulation is a DX concern |
| Tab pattern | Add to existing `TABS` array | Consistent with overview/jobs/subscribers/security pattern |
| Editor | Reuse `CodeEditorInput` | Zero new dependencies; JSON linting built in |
| Templates | 6 static TypeScript constants | No backend changes needed; frontend-only concern |
| Request schema | `z.record(z.unknown())` for payload | Shape validation is the pipeline action's responsibility |

---

## Complexity Tracking

No constitution violations — table not required.
