# Contract: Subscriber Delivery Payload

**Direction**: Pipeline Orchestrator Worker → Subscriber URL
**Method**: `POST`
**Content-Type**: `application/json`

---

## Request

### Headers

| Header | Value | Required |
|--------|-------|----------|
| `Content-Type` | `application/json` | Yes |

No signature header is sent by the current delivery engine. The `x-delivery-signature` header is a planned future addition (see `docs/FUTURE.md`).

### Body

The body is the **processed payload** — the direct output of the pipeline's action transformer. The shape depends on the pipeline's configured action:

**`field_extractor` action** (maps fields from input to output):
```json
{
  "event": "push",
  "repo": "owner/repo-name",
  "ref": "refs/heads/main"
}
```

**`payload_filter` action** (passes through unchanged or filtered):
```json
{
  "type": "charge.succeeded",
  "amount": 4999,
  "currency": "usd"
}
```

**`http_enricher` action** (original payload merged with enrichment data):
```json
{
  "original": "field",
  "enriched": "field from external HTTP call"
}
```

---

## Expected Response

| Status Code | Meaning |
|-------------|---------|
| `2xx` | Delivery successful — no retry |
| `4xx` / `5xx` | Delivery failed — retried with exponential backoff |
| Timeout / Network error | Delivery failed — retried with exponential backoff |

**Timeout**: Configurable via `DELIVERY_TIMEOUT_MS` env var.
**Max retries**: Configurable via `DELIVERY_MAX_RETRIES` env var.

---

## Subscriber Server Contract

The `examples/subscriber-server/index.mjs` subscriber server accepts this payload and:
1. Prints a formatted delivery summary to the terminal
2. Returns `200 OK` with `{"ok": true, "received": "<ISO timestamp>"}`

If `SUBSCRIBER_SECRET` is set, the server expects `x-delivery-signature: sha256=<hmac>` — but **do not set this** when using the current delivery engine, as it does not send this header. All deliveries would be rejected with `401`.

---

## GitHub Webhook Inbound Contract

Requests from GitHub arrive at `POST /webhooks/:sourceId` with:

| Header | Value |
|--------|-------|
| `Content-Type` | `application/json` |
| `X-GitHub-Event` | `push` / `pull_request` / `release` |
| `X-GitHub-Delivery` | UUID (delivery ID from GitHub) |
| `X-Hub-Signature-256` | `sha256=<hmac>` (if webhook has a secret configured) |

The pipeline must have **no inbound signing secret** configured, so all GitHub requests are accepted. The `X-Hub-Signature-256` header is ignored by the pipeline — it uses `X-Webhook-Signature` instead, which GitHub does not send.
