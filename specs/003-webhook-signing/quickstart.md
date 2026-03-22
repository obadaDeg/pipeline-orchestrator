# Quickstart: Webhook Signature Verification

**Feature**: 003-webhook-signing
**Date**: 2026-03-21

---

## Overview

This guide walks through the three integration scenarios for webhook signature verification:

1. Enabling verification on a pipeline
2. Sending a correctly signed webhook
3. Rotating a compromised secret

---

## Prerequisites

- A running instance of the webhook platform (`docker compose up`)
- An API key obtained via `POST /auth/register` → `POST /auth/login`
- An existing pipeline ID (from `POST /pipelines`)

---

## Scenario 1: Enable Signature Verification

### Step 1 — Generate a signing secret

```http
POST /pipelines/{pipelineId}/signing-secret
Authorization: Bearer <your-api-key>
```

Response (201 — **save the `secret` value immediately**):
```json
{
  "data": {
    "secret": "whsec_3q2-9mNtXv...",
    "hint": "whsec_",
    "createdAt": "2026-03-21T10:00:00Z"
  }
}
```

The `secret` value is shown **once only**. Store it securely in your sender's environment variables.

### Step 2 — Verify the pipeline is now enforcing signatures

```http
GET /pipelines/{pipelineId}/signing-secret
Authorization: Bearer <your-api-key>
```

Response:
```json
{
  "data": {
    "active": true,
    "hint": "whsec_",
    "createdAt": "2026-03-21T10:00:00Z"
  }
}
```

### Step 3 — Test: send an unsigned webhook (should be rejected)

```http
POST /webhook/{sourceId}
Content-Type: application/json

{ "event": "test" }
```

Expected response: `401 Unauthorized`

---

## Scenario 2: Send a Correctly Signed Webhook

Your sender must compute the signature before each request.

### Signature computation (pseudo-code)

```
timestamp = current Unix time in seconds (string)
payload   = JSON.stringify(body)
message   = timestamp + "." + payload
signature = "sha256=" + HMAC-SHA256(secret, message).hex()
```

### Example (Node.js)

```js
import { createHmac } from 'node:crypto';

const secret    = process.env.WEBHOOK_SECRET; // "whsec_3q2-9mNt..."
const body      = JSON.stringify({ event: 'order.created', orderId: '123' });
const timestamp = String(Math.floor(Date.now() / 1000));
const signature = 'sha256=' + createHmac('sha256', secret)
                                .update(`${timestamp}.${body}`)
                                .digest('hex');

fetch(`https://your-platform/webhook/${sourceId}`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': signature,
    'X-Webhook-Timestamp': timestamp,
  },
  body,
});
```

Expected response: `202 Accepted` with a `jobId`.

### Common failure reasons

| Error | Cause |
|-------|-------|
| `401` — missing headers | Forgot to include `X-Webhook-Signature` or `X-Webhook-Timestamp` |
| `401` — expired timestamp | Clock skew > 5 minutes, or sending a cached/old request |
| `401` — invalid signature | Wrong secret, or body was modified after signing |

---

## Scenario 3: Rotate a Compromised Secret

```http
POST /pipelines/{pipelineId}/signing-secret
Authorization: Bearer <your-api-key>
```

This replaces the existing secret immediately. The old secret is invalidated — any requests signed with it will receive `401`. Update your sender's environment variable with the new secret value from the response.

---

## Scenario 4: Disable Signature Verification

```http
DELETE /pipelines/{pipelineId}/signing-secret
Authorization: Bearer <your-api-key>
```

Response: `204 No Content`

The pipeline reverts to open (accept-all) mode. All incoming webhooks are accepted regardless of whether they include signature headers.
