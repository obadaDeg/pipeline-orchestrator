# Data Model: Real-World Integration Examples

**Feature**: 013-real-world-integrations
**Date**: 2026-03-25

---

## No New Entities

This feature introduces **no new database entities or schema changes**. It is a documentation and tooling feature that operates entirely on top of the existing data model.

---

## Relevant Existing Entities (Reference)

### Delivery Payload (subscriber receives)

The payload POSTed to subscriber URLs by the delivery engine is the **processed payload** — the direct output of the pipeline's action transformer. It is NOT wrapped in an envelope.

```json
// Example: field_extractor action on a GitHub push event
{
  "event": "push",
  "repo": "owner/repo-name",
  "ref": "refs/heads/main",
  "author": "username"
}
```

**Headers sent with delivery**:
- `Content-Type: application/json`

**Headers NOT sent** (documented explicitly to prevent confusion):
- `x-delivery-signature` — NOT sent by current delivery engine (future work)
- `x-job-id` — NOT sent

---

### Subscriber (existing entity)

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Subscriber identifier |
| `pipelineId` | UUID | Parent pipeline |
| `url` | string | Delivery target URL (e.g., webhook.site URL, `http://host.docker.internal:5050`) |
| `createdAt` | timestamp | Creation time |

---

### GitHub Webhook Registration (external, not stored)

The GitHub webhook is registered on the external GitHub platform and is **not stored** in the Pipeline Orchestrator database. The only persistent artifact is the hook ID returned by the GitHub API, which the user must retain for cleanup.

| Field | Source | Description |
|-------|--------|-------------|
| Hook ID | GitHub API response | Used to delete the webhook later |
| Target URL | `$TUNNEL_URL/webhooks/$PIPELINE_SOURCE_ID` | Constructed by setup script |
| Events | `push`, `pull_request`, `release` | Fixed in setup script |
| Secret | Empty (unsigned mode) | Pipeline runs without inbound signing |
