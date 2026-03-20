# Quickstart: API Key Authentication

**Feature**: 002-api-key-user-auth

This guide covers how to register, authenticate, manage API keys, and use team workspaces via the API.

---

## 1. Register and get your first API key

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "supersecret123"}'
```

**Response**:
```json
{
  "data": {
    "user": { "id": "...", "email": "alice@example.com" },
    "apiKey": {
      "id": "...",
      "name": "Default",
      "key": "wh_V3rYs3cur3ranD0mStr1ng...",
      "keyPrefix": "wh_V3rYs3"
    }
  }
}
```

> Save the `key` value now — it is only shown once.

---

## 2. Authenticate all requests

Pass your API key as a Bearer token in every request:

```bash
export API_KEY="wh_V3rYs3cur3ranD0mStr1ng..."

curl http://localhost:3000/pipelines \
  -H "Authorization: Bearer $API_KEY"
```

---

## 3. Create a pipeline (personal)

```bash
curl -X POST http://localhost:3000/pipelines \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My Pipeline",
    "actionType": "field_extractor",
    "actionConfig": { "fields": ["event", "userId"] },
    "subscribers": [{ "url": "https://my-service.example.com/hook" }]
  }'
```

---

## 4. Create a team and share pipelines

```bash
# Create a team
curl -X POST http://localhost:3000/teams \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "Acme Corp"}'

# Invite a colleague (must already be registered)
curl -X POST http://localhost:3000/teams/{teamId}/members \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "bob@example.com"}'

# Create a pipeline owned by the team
curl -X POST http://localhost:3000/pipelines \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Team Pipeline",
    "actionType": "payload_filter",
    "actionConfig": { "conditions": [] },
    "subscribers": [],
    "teamId": "{teamId}"
  }'
```

---

## 5. Manage API keys

```bash
# List your keys (metadata only — no full key value)
curl http://localhost:3000/auth/keys \
  -H "Authorization: Bearer $API_KEY"

# Create a new named key
curl -X POST http://localhost:3000/auth/keys \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "CI/CD Pipeline"}'

# Revoke a key
curl -X DELETE http://localhost:3000/auth/keys/{keyId} \
  -H "Authorization: Bearer $API_KEY"
```

---

## 6. Recover access (all keys lost/revoked)

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "supersecret123"}'
```

Returns a new API key. Requires having fewer than 10 active keys.

---

## 7. View your security audit log

```bash
curl "http://localhost:3000/auth/audit-log?page=1&limit=20" \
  -H "Authorization: Bearer $API_KEY"
```
