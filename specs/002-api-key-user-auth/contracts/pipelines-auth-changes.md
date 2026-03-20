# API Contract: Pipeline Endpoint Changes (Auth Extension)

**Feature**: 002-api-key-user-auth
**Affects**: All existing `/pipelines` endpoints
**Change type**: Non-breaking additions + new auth enforcement

---

## Summary of Changes

All pipeline endpoints now require authentication. Responses are automatically scoped to the authenticated user's ownership context — personal pipelines and all pipelines owned by teams the user belongs to.

---

## POST /pipelines 🔒 (modified)

Creates a pipeline. Now accepts an optional `teamId` to assign ownership to a team.

**New optional field in request body**:
```json
{
  "name": "My Pipeline",
  "actionType": "field_extractor",
  "actionConfig": { ... },
  "subscribers": [...],
  "teamId": "uuid-optional"
}
```

**Behaviour**:
- If `teamId` is omitted: pipeline is owned by the authenticated user personally
- If `teamId` is provided: pipeline is owned by the specified team. The authenticated user MUST be a member (or owner) of that team — otherwise `403 FORBIDDEN`

---

## GET /pipelines 🔒 (modified)

Returns only pipelines accessible to the authenticated user:
- Pipelines where `owner_user_id = req.user.id`
- Pipelines where `owner_team_id` is in any team the user is a member of (or owns)

Legacy pipelines with no owner (`owner_user_id IS NULL AND owner_team_id IS NULL`) are excluded from scoped responses.

**No change to response shape.**

---

## GET /pipelines/:id 🔒 (modified)

Returns `404 NOT_FOUND` (not `403`) if the pipeline exists but is not accessible to the authenticated user. This prevents enumeration of other users' pipeline IDs.

---

## PATCH /pipelines/:id 🔒 (modified)

Same ownership check as GET. Returns `404` if not accessible.

**New optional field**:
- `teamId` — transfer pipeline ownership to a team. Authenticated user must be a member of the target team.

---

## DELETE /pipelines/:id 🔒 (modified)

Same ownership check as GET. Returns `404` if not accessible.

---

## GET /pipelines/:id/jobs 🔒 (modified)

Same ownership check as GET pipeline.

---

## POST /webhook/:sourceId (unchanged — no auth required)

The webhook ingestion endpoint remains unauthenticated. It is addressed by `sourceId`, which is already a cryptographically random UUID that acts as an implicit bearer token for senders.

---

## New Error Codes for Pipeline Endpoints

| Status | Code | Condition |
|--------|------|-----------|
| `401` | `UNAUTHORIZED` | No API key or invalid API key provided |
| `404` | `NOT_FOUND` | Resource not found OR not accessible to this user |
