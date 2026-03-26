# Research: Webhook Simulator

**Feature**: 014-webhook-simulator
**Date**: 2026-03-26

---

## Decision 1: Simulation Endpoint Architecture

**Decision**: `POST /pipelines/:id/fire-simulation` calls `ingestWebhook()` from `ingestion.service.ts` directly — no internal HTTP round-trip.

**Findings**:
- `src/services/ingestion.service.ts` exports `ingestWebhook(sourceId, rawBody, signatureHeader?, timestampHeader?)` — the complete ingest pipeline (pipeline lookup, rate limit, signature check, job insert, queue enqueue).
- The simulation endpoint can: (1) look up the pipeline by `id` to get `sourceId`, (2) compute HMAC if a signing secret exists, (3) call `ingestWebhook()` directly. Returns `{ jobId }`.
- Avoids HTTP overhead, avoids needing to know the tunnel/host URL, and reuses all existing validation logic.

**Rationale**: Direct service call is cleaner than making an internal HTTP request and is idiomatic for this Express/service-layer architecture.

**Alternatives considered**:
- `fetch()` to `localhost:4000/webhooks/:sourceId` internally — rejected: fragile (requires knowing own URL), adds HTTP overhead, doesn't work in all environments.

---

## Decision 2: HMAC Signing Computation

**Decision**: Compute HMAC in the simulation service by fetching `pipelineSigningSecrets.secretValue` directly from DB.

**Findings from `src/lib/signing-secret.ts`**:
- Signature format: `sha256=<createHmac('sha256', secret).update(\`\${timestamp}.\${rawBody}\`).digest('hex')>`
- Timestamp: `Math.floor(Date.now() / 1000).toString()` (seconds, not milliseconds)
- Headers: `X-Webhook-Signature` (sig) + `X-Webhook-Timestamp` (timestamp)
- `verifyHmac()` already exists — the simulation service uses the same signing formula in reverse

**Findings from `src/services/signing.service.ts`**:
- `getSecretStatus()` only returns `hint` — not the raw secret (by design)
- Raw secret is in `pipelineSigningSecrets.secretValue` — accessible from service layer
- No existing "get raw secret" export — simulation service queries DB directly for the secret value

**Rationale**: The raw secret never leaves the server. The simulation service queries it at call time, uses it to compute HMAC, and discards it. The frontend never sees it.

---

## Decision 3: Simulation Service Placement

**Decision**: New `src/services/simulation.service.ts` with a single `simulateWebhook(pipelineId, payload)` function.

**Rationale**: Keeps `ingestion.service.ts` focused on the ingest path. Simulation is a different concern (development tooling, not production ingest). Separation makes both easier to test.

**Function signature**:
```typescript
export async function simulateWebhook(
  pipelineId: string,
  payload: unknown,
): Promise<{ jobId: string }>
```

---

## Decision 4: Frontend Tab Structure

**Decision**: Add `simulator` to the existing `TABS` array in `PipelineDetailPage.tsx` and render a new `SimulatorTab` component.

**Findings from `dashboard/src/pages/PipelineDetailPage.tsx`**:
```typescript
const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'subscribers', label: 'Subscribers' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'security', label: 'Security' },
];
// activeTab state + {activeTab === 'X' && <Content />} pattern
```

New entry: `{ key: 'simulator', label: 'Simulator' }` — added after 'security'.

**Component**: `dashboard/src/components/SimulatorTab.tsx` receives `{ pipelineId: string }` prop.

---

## Decision 5: Editor Component Reuse

**Decision**: Reuse `CodeEditorInput` (`dashboard/src/components/CodeEditorInput.tsx`) for the payload editor.

**Findings**:
- Props: `value`, `onChange`, `language?: 'json'`, `minRows?`, `maxRows?`, `placeholder?`
- Already includes JSON linting via `jsonParseLinter` — real-time invalid JSON detection is built in
- The `onChange` callback fires on every keystroke with the current editor string value
- Valid JSON check: `JSON.parse(value)` — if it throws, disable Fire button

**Rationale**: Zero new dependencies. Consistent UX with the action config editor the developer already knows.

---

## Decision 6: Payload Templates

**Decision**: 6 static templates defined as TypeScript constants in `SimulatorTab.tsx`.

**Templates and realistic payloads**:

```typescript
// GitHub push
{
  ref: 'refs/heads/main',
  repository: { full_name: 'owner/repo', name: 'repo' },
  pusher: { name: 'developer' },
  commits: [{ id: 'abc123', message: 'feat: add feature', author: { name: 'developer' } }],
  head_commit: { id: 'abc123', message: 'feat: add feature' }
}

// GitHub pull_request opened
{
  action: 'opened',
  number: 42,
  pull_request: { title: 'feat: add feature', state: 'open', user: { login: 'developer' },
    head: { ref: 'feat/my-feature' }, base: { ref: 'main' } },
  repository: { full_name: 'owner/repo' }
}

// GitHub release published
{
  action: 'published',
  release: { tag_name: 'v1.0.0', name: 'Release v1.0.0', draft: false, prerelease: false,
    author: { login: 'developer' } },
  repository: { full_name: 'owner/repo' }
}

// Stripe charge.succeeded
{
  type: 'charge.succeeded',
  data: { object: { id: 'ch_demo', amount: 4999, currency: 'usd', customer: 'cus_demo',
    status: 'succeeded' } }
}

// Stripe payment_intent.created
{
  type: 'payment_intent.created',
  data: { object: { id: 'pi_demo', amount: 2000, currency: 'usd', status: 'requires_payment_method',
    customer: 'cus_demo' } }
}

// Custom (blank)
{}
```

---

## Decision 7: Request Body Schema

**Decision**: `FireSimulationBodySchema` in `src/api/schemas/pipeline.schema.ts`.

```typescript
export const FireSimulationBodySchema = z.object({
  payload: z.record(z.unknown()),
});
```

Accepts any JSON object. Validation of the payload's shape is the pipeline action's responsibility (not the simulation endpoint's).

---

## Summary of New Files / Changes

| File | Type | Change |
|------|------|--------|
| `src/services/simulation.service.ts` | New | `simulateWebhook()` — looks up pipeline, computes HMAC if needed, calls `ingestWebhook()` |
| `src/api/controllers/pipelines.controller.ts` | Modified | Add `fireSimulation` handler |
| `src/api/routes/pipelines.router.ts` | Modified | Add `POST /:id/fire-simulation` |
| `src/api/schemas/pipeline.schema.ts` | Modified | Add `FireSimulationBodySchema` |
| `dashboard/src/components/SimulatorTab.tsx` | New | Full simulator UI — dropdown, editor, fire button, response display |
| `dashboard/src/pages/PipelineDetailPage.tsx` | Modified | Add `simulator` to `TABS`, render `SimulatorTab` |
