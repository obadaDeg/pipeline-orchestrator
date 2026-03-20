# API Contract: Authentication & Key Management

**Feature**: 002-api-key-user-auth
**Base path**: `/auth`
**Auth**: Endpoints marked 🔒 require `Authorization: Bearer <api-key>` header

All responses follow the project envelope: `{ data: ... }` on success, `{ error: { code, message } }` on failure.

---

## POST /auth/register

Register a new user account. Automatically issues the first API key.

**Auth**: None required

**Request body**:
```json
{
  "email": "alice@example.com",
  "password": "minimum 8 characters"
}
```

**Response `201 Created`**:
```json
{
  "data": {
    "user": {
      "id": "uuid",
      "email": "alice@example.com",
      "createdAt": "2026-03-20T10:00:00Z"
    },
    "apiKey": {
      "id": "uuid",
      "name": "Default",
      "key": "wh_V3rYs3cur3ranD0mStr1ngHere0123456789AbCd",
      "keyPrefix": "wh_V3rYs3",
      "createdAt": "2026-03-20T10:00:00Z"
    }
  }
}
```

> ⚠️ The `key` field is only returned **once** at creation. Store it securely.

**Error responses**:

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | Missing/invalid fields |
| `422` | `EMAIL_ALREADY_REGISTERED` | Email already in use |

---

## POST /auth/login

Authenticate with email + password and generate a new API key. Use this to recover access when all keys are lost or revoked.

**Auth**: None required

**Request body**:
```json
{
  "email": "alice@example.com",
  "password": "your password"
}
```

**Response `201 Created`**:
```json
{
  "data": {
    "apiKey": {
      "id": "uuid",
      "name": "Login 2026-03-20",
      "key": "wh_NewK3yG3neratedOnLogin0123456789AbCdEfGh",
      "keyPrefix": "wh_NewK3y",
      "createdAt": "2026-03-20T10:00:00Z"
    }
  }
}
```

> ⚠️ The `key` field is only returned **once**. Store it securely.

**Error responses**:

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | Missing/invalid fields |
| `401` | `INVALID_CREDENTIALS` | Wrong email or password |
| `422` | `API_KEY_LIMIT_REACHED` | Already at 10 active keys — revoke one first |

---

## GET /auth/keys 🔒

List all API keys belonging to the authenticated user. The full key value is never returned here.

**Response `200 OK`**:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Production",
      "keyPrefix": "wh_V3rYs3",
      "createdAt": "2026-03-20T10:00:00Z",
      "lastUsedAt": "2026-03-20T11:30:00Z",
      "revokedAt": null
    }
  ]
}
```

---

## POST /auth/keys 🔒

Generate a new named API key for the authenticated user.

**Request body**:
```json
{
  "name": "Staging"
}
```

**Response `201 Created`**:
```json
{
  "data": {
    "id": "uuid",
    "name": "Staging",
    "key": "wh_Stag1ngK3yV4lu3Here0123456789AbCdEfGhIj",
    "keyPrefix": "wh_Stag1n",
    "createdAt": "2026-03-20T10:00:00Z"
  }
}
```

> ⚠️ The `key` field is only returned **once**. Store it securely.

**Error responses**:

| Status | Code | Condition |
|--------|------|-----------|
| `400` | `VALIDATION_ERROR` | Missing name |
| `422` | `API_KEY_LIMIT_REACHED` | Already at 10 active keys |

---

## DELETE /auth/keys/:id 🔒

Revoke an API key. Immediately invalidates the key for all future requests.

**Response `200 OK`**:
```json
{
  "data": {
    "id": "uuid",
    "revokedAt": "2026-03-20T12:00:00Z"
  }
}
```

**Error responses**:

| Status | Code | Condition |
|--------|------|-----------|
| `404` | `NOT_FOUND` | Key not found or does not belong to user |
| `422` | `KEY_ALREADY_REVOKED` | Key was already revoked |

---

## GET /auth/audit-log 🔒

Retrieve the authenticated user's security audit log. Paginated.

**Query params**: `page` (default: 1), `limit` (default: 20, max: 100)

**Response `200 OK`**:
```json
{
  "data": [
    {
      "id": "uuid",
      "eventType": "KEY_CREATED",
      "metadata": { "keyPrefix": "wh_V3rYs3", "keyName": "Production" },
      "createdAt": "2026-03-20T10:00:00Z"
    },
    {
      "id": "uuid",
      "eventType": "AUTH_FAILED",
      "metadata": { "keyPrefix": "wh_unknow" },
      "createdAt": "2026-03-20T11:00:00Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 2
  }
}
```
