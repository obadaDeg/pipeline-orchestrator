# API Contracts: Dashboard API Parity & Bug Fixes

**Feature**: 008-dashboard-api-parity
**Date**: 2026-03-23

All responses use the standard envelope: `{ data: <payload> }` for success, `{ error: { code, message } }` for errors.
All authenticated endpoints require `Authorization: Bearer <api-key>` header.
All list endpoints support `?page=<number>&?limit=<number>` (default: page=1, limit=20, max limit=100).

---

## New Endpoints

### GET /jobs

List jobs across all pipelines accessible to the authenticated user.

**Auth**: Required

**Query parameters**:
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number (1-based) |
| `limit` | integer | 20 | Items per page (max 100) |
| `pipelineId` | UUID | — | Optional filter to a single pipeline |

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "pipelineId": "uuid",
        "status": "PENDING | PROCESSING | COMPLETED | FAILED",
        "createdAt": "ISO 8601 timestamp"
      }
    ],
    "total": 47,
    "page": 1,
    "limit": 20
  }
}
```

**Scoping**: Only jobs belonging to pipelines where `ownerUserId = authenticatedUserId` OR `ownerTeamId` is a team the user belongs to are returned.

**Errors**:
- `401 Unauthorized` — missing or invalid API key

---

### GET /teams

List all teams the authenticated user owns or is a member of.

**Auth**: Required

**Response 200**:
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "string",
        "ownerUserId": "uuid",
        "memberCount": 3,
        "isOwner": true,
        "createdAt": "ISO 8601 timestamp"
      }
    ]
  }
}
```

**Notes**: No pagination — users are not expected to belong to a large number of teams. `isOwner` indicates whether the authenticated user is the team owner (vs. a member).

**Errors**:
- `401 Unauthorized`

---

## Modified Endpoints

### GET /jobs/:id/delivery-attempts *(pagination fix)*

Previously returned `{ data: { items: [...] } }` with no pagination metadata. Now returns full pagination shape.

**Auth**: Required

**Query parameters**:
| Param | Type | Default | Description |
|---|---|---|---|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Items per page (max 100) |

**Response 200** (updated shape):
```json
{
  "data": {
    "items": [
      {
        "id": "uuid",
        "jobId": "uuid",
        "subscriberId": "uuid | null",
        "subscriberUrl": "string",
        "httpStatus": 200,
        "responseSnippet": "string | null",
        "attemptNumber": 1,
        "outcome": "SUCCESS | FAILED",
        "attemptedAt": "ISO 8601 timestamp"
      }
    ],
    "total": 12,
    "page": 1,
    "limit": 50
  }
}
```

**Breaking change**: `total`, `page`, and `limit` are newly added fields. Callers that previously consumed only `items` are unaffected. The dashboard `JobDetailPage` already expects this shape.

---

## Existing Endpoints (Newly Surfaced in Dashboard)

These endpoints already exist and are functional. They are documented here for completeness and to define the exact shapes the new dashboard UI components will consume.

---

### POST /pipelines/:id/signing-secret

Generate a new signing secret (or rotate the existing one). The raw secret is returned exactly once.

**Auth**: Required (pipeline owner only)

**Body**: none

**Response 201**:
```json
{
  "data": {
    "secret": "64-character hex string (256-bit)",
    "hint": "abc123",
    "createdAt": "ISO 8601 timestamp"
  }
}
```

**Behaviour**: If a signing secret already exists, it is atomically replaced. The prior secret is immediately invalidated. The `secret` field is never returned again after this response.

**Errors**:
- `401 Unauthorized`
- `403 Forbidden` — caller is not the pipeline owner
- `404 Not Found` — pipeline does not exist

---

### GET /pipelines/:id/signing-secret

Get the status of the signing secret for a pipeline (does not reveal the raw secret).

**Auth**: Required (pipeline owner only)

**Response 200**:
```json
{
  "data": {
    "active": true,
    "hint": "abc123",
    "createdAt": "ISO 8601 timestamp"
  }
}
```

If no secret is configured:
```json
{
  "data": {
    "active": false,
    "hint": null,
    "createdAt": null
  }
}
```

---

### DELETE /pipelines/:id/signing-secret

Revoke the signing secret. The pipeline returns to unsigned mode.

**Auth**: Required (pipeline owner only)

**Response**: `204 No Content`

**Errors**:
- `422 Unprocessable Entity` — no active signing secret exists
- `403 Forbidden` — caller is not the pipeline owner

---

### PATCH /pipelines/:id

Update a pipeline's name and/or description.

**Auth**: Required (pipeline owner only)

**Body**:
```json
{
  "name": "Updated Pipeline Name",
  "description": "Optional updated description"
}
```
Both fields are optional; at least one must be present.

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "name": "Updated Pipeline Name",
    "description": "Optional updated description",
    "sourceId": "uuid",
    "actionType": "field_extractor",
    "actionConfig": {},
    "ownerUserId": "uuid",
    "ownerTeamId": null,
    "createdAt": "ISO 8601 timestamp",
    "updatedAt": "ISO 8601 timestamp"
  }
}
```

**Errors**:
- `400 Bad Request` — empty name
- `403 Forbidden` — caller is not the pipeline owner
- `404 Not Found`

---

### POST /auth/register

Create a new user account. Returns an auto-created "Default" API key.

**Auth**: None

**Body**:
```json
{
  "email": "user@example.com",
  "password": "minimum 8 characters"
}
```

**Response 201**:
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "createdAt": "ISO 8601 timestamp"
    },
    "apiKey": {
      "id": "uuid",
      "name": "Default",
      "key": "hex string (returned once only)",
      "keyPrefix": "first 8 chars",
      "createdAt": "ISO 8601 timestamp"
    }
  }
}
```

**Post-registration flow**: The dashboard extracts `apiKey.key` and `user.email` and calls `AuthContext.login()` to store credentials and redirect to the dashboard.

**Errors**:
- `409 Conflict` — email already registered
- `422 Unprocessable Entity` — invalid email or password too short

---

### POST /teams

Create a new team owned by the authenticated user.

**Auth**: Required

**Body**:
```json
{ "name": "My Team" }
```

**Response 201**:
```json
{
  "data": {
    "id": "uuid",
    "name": "My Team",
    "ownerUserId": "uuid",
    "createdAt": "ISO 8601 timestamp"
  }
}
```

---

### GET /teams/:id

Get a team's full detail including member list.

**Auth**: Required (owner or member)

**Response 200**:
```json
{
  "data": {
    "id": "uuid",
    "name": "My Team",
    "ownerUserId": "uuid",
    "members": [
      {
        "userId": "uuid",
        "email": "member@example.com",
        "addedAt": "ISO 8601 timestamp"
      }
    ],
    "createdAt": "ISO 8601 timestamp"
  }
}
```

---

### POST /teams/:id/members

Add a user to a team by email address.

**Auth**: Required (team owner only)

**Body**:
```json
{ "email": "newmember@example.com" }
```

**Response 201**:
```json
{
  "data": {
    "teamId": "uuid",
    "userId": "uuid",
    "addedAt": "ISO 8601 timestamp"
  }
}
```

**Errors**:
- `404 Not Found` — no user registered with that email
- `409 Conflict` — user is already a member
- `403 Forbidden` — caller is not the team owner

---

### DELETE /teams/:id/members/:userId

Remove a member from a team.

**Auth**: Required (team owner only)

**Response**: `204 No Content`

**Errors**:
- `404 Not Found` — membership does not exist
- `403 Forbidden` — caller is not the team owner

---

### DELETE /teams/:id

Delete a team entirely. All team memberships are cascade-deleted. Pipelines owned by the team become ownerless (ownerTeamId set to null).

**Auth**: Required (team owner only)

**Response**: `204 No Content`
