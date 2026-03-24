# Quickstart: Demo Seed Data & Webhook Inbound URL

## Demo Credentials

| Field | Value |
|-------|-------|
| Email | `demo@example.com` |
| Password | `Password123!` |
| Member account | `member@example.com` / `Password123!` |

---

## Seeding the Database

### 1. Start the stack

```bash
docker compose up -d
```

### 2. Run the seed

```bash
npm run db:seed
```

The seed is idempotent — safe to run multiple times. It prints a summary of created/skipped records.

### 3. Log in

Navigate to `http://localhost:5173` (or wherever the dashboard is running) and sign in with the demo credentials above.

---

## Demo Walkthrough

### Webhook URL (US1)

1. Log in and open any pipeline (e.g., "GitHub Events").
2. In the Overview tab, find the **Webhook URL** row.
3. Click **Copy** — the URL is now in your clipboard.
4. Send a test POST to it:
   ```bash
   curl -X POST <pasted-url> \
     -H "Content-Type: application/json" \
     -d '{"event": "push", "repo": "demo"}'
   ```
5. Refresh the Jobs tab on the pipeline — a new job appears.

### Demo Data (US2)

After seeding, you can demonstrate:

| Feature | Where |
|---------|-------|
| Pipelines list | `/pipelines` — 3 pipelines, each a different action type |
| Jobs list | `/jobs` — 12 jobs, mix of COMPLETED and FAILED |
| Delivery attempts | Open any job → delivery attempts listed with HTTP status |
| Teams | `/teams` — Acme Platform, Acme Data; each with 2 members |
| Signing secret | Open "GitHub Events" → Security tab → Active status with hint |
| API keys | Account page → 2 keys pre-created |

---

## Environment Variables

| Variable | Required | Default | Purpose |
|----------|----------|---------|---------|
| `VITE_PUBLIC_URL` | No | `window.location.origin` | Override the public base URL shown in webhook URLs |

Set `VITE_PUBLIC_URL` in `dashboard/.env.local` if running the API behind a reverse proxy or on a non-standard port.
