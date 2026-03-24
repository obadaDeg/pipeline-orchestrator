# Data Model: Demo Seed Data & Webhook Inbound URL

## Schema Changes

**None.** This feature introduces no new database tables or columns. All seed data uses existing tables.

---

## Seed Dataset

### Users (2 records)

| Field | Demo User | Member User |
|-------|-----------|-------------|
| email | `demo@example.com` | `member@example.com` |
| password | `Password123!` (hashed argon2id) | `Password123!` (hashed argon2id) |
| Idempotency key | email | email |

### API Keys (2 records — demo user)

| Field | Key 1 | Key 2 |
|-------|-------|-------|
| name | `Default` | `CI/CD` |
| owner | demo user | demo user |
| Idempotency | checked by user's existing key count; skip if ≥ 2 |

### Teams (2 records)

| Field | Team 1 | Team 2 |
|-------|--------|--------|
| name | `Acme Platform` | `Acme Data` |
| ownerUserId | demo user | demo user |
| members | demo user + member user | demo user + member user |
| Idempotency key | name | name |

### Pipelines (3 records)

| Field | Pipeline 1 | Pipeline 2 | Pipeline 3 |
|-------|-----------|-----------|-----------|
| name | `GitHub Events` | `Stripe Payments` | `Slack Alerts` |
| actionType | `field_extractor` | `payload_filter` | `http_enricher` |
| ownerTeamId | Acme Platform | Acme Platform | Acme Data |
| Idempotency key | name | name | name |

### Pipeline Signing Secrets (1 record)

| Field | Value |
|-------|-------|
| pipeline | `GitHub Events` |
| secret | random 32-byte hex, generated at seed time |
| Idempotency | skip if pipeline already has an active secret |

### Jobs (12 records)

| Pipeline | Count | Status mix |
|----------|-------|-----------|
| GitHub Events | 5 | 4 COMPLETED, 1 FAILED |
| Stripe Payments | 4 | 3 COMPLETED, 1 FAILED |
| Slack Alerts | 3 | 1 COMPLETED, 2 FAILED |

Jobs use realistic `payload` JSON matching the pipeline's action type. `createdAt` values are spread over the past 7 days.

### Delivery Attempts (per job)

| Job status | Attempts | HTTP status codes |
|------------|----------|-----------------|
| COMPLETED | 1 | 200 |
| FAILED | 2–3 | 500, then 503 |

---

## Existing Entities Referenced

- **Pipeline**: `sourceUrl` field already returned by `GET /pipelines/:id` — no change needed.
- **User**, **ApiKey**, **Team**, **TeamMembership**, **Job**, **DeliveryAttempt**, **PipelineSigningSecret** — all seeded using existing schema, no modifications.
