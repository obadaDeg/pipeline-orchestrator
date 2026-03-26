# Research: Real-World Integration Examples

**Feature**: 013-real-world-integrations
**Date**: 2026-03-25

---

## Decision 1: Delivery Payload Format

**Decision**: The delivery engine sends `processedPayload` directly as the HTTP body — no envelope wrapper, no signature header.

**Findings from codebase**:
- `src/delivery/http-client.ts`: `deliverPayload()` sends `body: JSON.stringify(body)` with only `Content-Type: application/json`
- `src/worker/job-consumer.ts`: calls `runDelivery(jobId, subs, processedPayload)` — passes processed payload only
- No `x-delivery-signature`, no `jobId`, no `status` in the delivery POST

**Implication for subscriber server**: `examples/subscriber-server/index.mjs` reads `payload.jobId`, `payload.status`, `payload.result`, `payload.payload` — none of which will be populated. All fallback to `'unknown'` / empty. The subscriber server needs updating to fall back to displaying the raw received JSON body when envelope fields are absent.

**Rationale for NOT changing the delivery engine**: Wrapping the delivery in an envelope is a planned future architectural improvement (documented in `docs/FUTURE.md`). This feature is documentation-focused; delivery engine changes are out of scope.

**Alternatives considered**:
- Wrap delivery in `{jobId, processedPayload}` — deferred to future improvement
- Change subscriber server to NOT expect envelope — chosen approach for this feature

---

## Decision 2: Outbound Delivery Signature (x-delivery-signature)

**Decision**: The `SUBSCRIBER_SECRET` feature in the subscriber server is forward-compatible placeholder code. It MUST NOT be used with the current delivery engine, which does not send `x-delivery-signature`.

**Findings**: `http-client.ts` sends no signature header. If `SUBSCRIBER_SECRET` is set on the subscriber server, every delivery would return `401 Unauthorized` because the header is always missing. The integration guide must warn against setting `SUBSCRIBER_SECRET` when using the current system.

**Alternatives considered**:
- Add outbound signing to the delivery engine — deferred to future work (`docs/FUTURE.md`, item 5)

---

## Decision 3: GitHub Token Scope

**Decision**: The integration guide MUST instruct `admin:repo_hook` scope for the GitHub Personal Access Token.

**Rationale**: Managing webhooks (list, create, delete) requires only `admin:repo_hook`. The `repo` scope grants full repository read/write access and violates the principle of least privilege. The guide should note that `repo` also works as a fallback for users who already have such a token.

**GitHub API reference**: `POST /repos/{owner}/{repo}/hooks` requires `admin:repo_hook` or `write:repo_hook` (classic PAT) or `contents:write` (fine-grained PAT with admin:webhooks).

---

## Decision 4: GitHub Signature Scheme — Unsigned Mode

**Decision**: The GitHub integration uses unsigned mode — the target pipeline must have no inbound signing secret configured.

**Findings**:
- GitHub signs with `X-Hub-Signature-256: sha256=HMAC(secret, body)` — body-only, different header
- The pipeline signing service reads `X-Webhook-Signature: sha256=HMAC(secret, timestamp.body)` and `X-Webhook-Timestamp`
- These schemes are structurally incompatible

**Implication**: The GitHub Events pipeline used in the demo must have no signing secret configured (or the signing secret must be removed/disabled). The integration guide must document this explicitly.

**Alternatives considered**:
- Extend ingest to accept `X-Hub-Signature-256` — out of scope, requires backend changes
- Document the mismatch as a known limitation — chosen approach

---

## Decision 5: webhook.site Integration

**Decision**: webhook.site works out of the box as a subscriber. Docker containers have outbound internet access by default, so the worker can POST to public `https://webhook.site/...` URLs without any special configuration.

**Behavior**:
- Open `https://webhook.site` in browser → unique URL auto-generated (no registration required)
- Register that URL as a subscriber via `POST /pipelines/:id/subscribers`
- Send a webhook to the pipeline → worker delivers processed payload to webhook.site
- Deliveries appear in webhook.site browser dashboard in real time with full headers + body

**Limitation**: webhook.site free tier URLs are temporary and public. Not suitable for production, only for demo/testing.

---

## Decision 6: Tunnel Verification

**Decision**: Tunnel can be verified using `GET /stats` or `GET /pipelines` with the API key.

**Finding**: No `/health` endpoint exists in the API server (`src/api/server.ts` mounts `/webhooks`, `/auth`, `/pipelines`, `/jobs`, `/stats`, `/teams`). Use `curl https://xxxx.ngrok-free.app/stats -H "Authorization: Bearer $API_KEY"` to verify the tunnel is forwarding correctly.

**Alternatives considered**:
- Add `/health` endpoint — unnecessary complexity for this feature; using existing endpoints is sufficient

---

## Decision 7: Integration Guide Location

**Decision**: Expand `docs/DEMO.md`. Add a new "webhook.site" section and update the existing GitHub integration section to reflect unsigned mode and correct token scope. No new file.

**Rationale**: `docs/DEMO.md` already covers sections 1–12 including a comprehensive GitHub integration section (section 12). The webhook.site scenario fits naturally as an additional section in the same document. Keeping everything in one place reduces navigation friction for demo prep.

---

## Summary of Code Changes Required

| File | Change |
|------|--------|
| `examples/subscriber-server/index.mjs` | Fall back to displaying raw JSON body when envelope fields (`result`, `payload`) are absent |
| `examples/github-integration/setup.mjs` | Update JSDoc to mention unsigned mode and `admin:repo_hook` token scope |
| `docs/DEMO.md` | Add webhook.site section; update GitHub section for unsigned mode + token scope; update tunnel verification command |
