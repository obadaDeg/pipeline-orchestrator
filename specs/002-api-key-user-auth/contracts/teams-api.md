# API Contract: Team Management

**Feature**: 002-api-key-user-auth
**Base path**: `/teams`
**Auth**: All endpoints require 🔒 `Authorization: Bearer <api-key>`

All responses follow the project envelope: `{ data: ... }` on success, `{ error: { code, message } }` on failure.

---

## POST /teams 🔒

Create a new team. The authenticated user becomes the team owner.

**Request body**:
```json
{
  "name": "Acme Corp"
}
```

**Response `201 Created`**:
```json
{
  "data": {
    "id": "uuid",
    "name": "Acme Corp",
    "ownerUserId": "uuid",
    "createdAt": "2026-03-20T10:00:00Z"
  }
}
```

**Error responses**:

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | Missing name |

---

## GET /teams/:id 🔒

Get team details including member list. Requires the authenticated user to be the team owner or a member.

**Response `200 OK`**:
```json
{
  "data": {
    "id": "uuid",
    "name": "Acme Corp",
    "ownerUserId": "uuid",
    "members": [
      { "userId": "uuid", "email": "bob@example.com", "joinedAt": "2026-03-20T10:00:00Z" }
    ],
    "createdAt": "2026-03-20T10:00:00Z"
  }
}
```

**Error responses**:

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `NOT_FOUND` | Team does not exist or user is not a member |

---

## DELETE /teams/:id 🔒

Delete a team. All team-owned pipelines are transferred to the team owner's personal account. Only the team owner may perform this action.

**Response `200 OK`**:
```json
{
  "data": {
    "id": "uuid",
    "pipelinesTransferred": 3
  }
}
```

**Error responses**:

| Status | Code | Condition |
|--------|------|-----------|
| `403` | `FORBIDDEN` | Authenticated user is not the team owner |
| `404` | `NOT_FOUND` | Team does not exist |

---

## POST /teams/:id/members 🔒

Invite a registered user to the team by email. Only the team owner may perform this action. If the email is not registered, the request fails — there is no pending invite flow.

**Request body**:
```json
{
  "email": "bob@example.com"
}
```

**Response `201 Created`**:
```json
{
  "data": {
    "userId": "uuid",
    "teamId": "uuid",
    "email": "bob@example.com",
    "joinedAt": "2026-03-20T10:00:00Z"
  }
}
```

**Error responses**:

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | Missing email |
| `403` | `FORBIDDEN` | Authenticated user is not the team owner |
| `404` | `NOT_FOUND` | Team does not exist |
| `422` | `USER_NOT_FOUND` | No registered user with that email |
| `422` | `ALREADY_A_MEMBER` | User is already a member of this team |

---

## DELETE /teams/:id/members/:userId 🔒

Remove a member from the team. Only the team owner may perform this action. The owner cannot remove themselves via this endpoint — use `DELETE /teams/:id` to disband the team.

**Response `200 OK`**:
```json
{
  "data": {
    "userId": "uuid",
    "teamId": "uuid"
  }
}
```

**Error responses**:

| Status | Code | Condition |
|--------|------|-----------|
| `403` | `FORBIDDEN` | Authenticated user is not the team owner |
| `404` | `NOT_FOUND` | Team or member not found |
| `422` | `CANNOT_REMOVE_OWNER` | Attempt to remove the team owner |
