# Quickstart: Dashboard UI

## Running the dashboard

### Option A — Full stack (Docker)

```bash
docker compose up -d --build
```

Open [http://localhost:4000/dashboard/login](http://localhost:4000/dashboard/login)

---

### Option B — Dev mode (hot reload)

```bash
# Terminal 1 — backend
docker compose up -d postgres redis
npm run db:migrate
npm run dev          # API on :3000

# Terminal 2 — frontend
npm run dev:dashboard   # Vite on :5173, proxies /api → :3000
```

Open [http://localhost:5173/](http://localhost:5173/)

---

## End-to-end walkthrough

### 1. Register + login

```bash
# Register (if first time)
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "demo@example.com", "password": "password123"}'
```

Open the dashboard, enter email + password, click Sign In. You are redirected to the pipeline list.

---

### 2. Create a pipeline

Click **New Pipeline** and fill in:

| Field | Value |
|-------|-------|
| Name | `Order Events` |
| Action Type | `field_extractor` |
| Action Config | `{"mapping":{"orderId":"id","type":"event"}}` |
| Subscriber URLs | `https://webhook.site/your-unique-url` |

Click Create. The new pipeline appears in the list.

---

### 3. Send a webhook

Copy the **Source URL** from the pipeline detail page, then:

```bash
curl -X POST http://localhost:3000/webhooks/<sourceId> \
  -H "Content-Type: application/json" \
  -d '{"event": "order.created", "id": "42"}'
# → 202 Accepted
```

---

### 4. Monitor the job

Navigate to the pipeline detail page. The new job appears in the list with status **PENDING**, then transitions to **COMPLETED** within seconds.

Click the job row. You see:
- **Raw Payload**: `{"event":"order.created","id":"42"}`
- **Processed Payload**: `{"orderId":"42","type":"order.created"}`
- **Delivery Attempts**: 1 row, outcome `SUCCESS`, HTTP status `200`

---

### 5. Manage API keys

Navigate to **Account → API Keys**. Click **New Key**, name it `CI/CD`, copy the full key from the one-time modal. The new key appears in the list with its prefix hint.

Click **Revoke** on any key — it disappears immediately.

---

### 6. View audit log

Navigate to **Account → Audit Log**. Recent events are listed:
- `USER_REGISTERED` — account creation
- `KEY_CREATED` — key just created
- Any `SIGNATURE_FAILED` events if signing is enabled on a pipeline
