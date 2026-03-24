# Data Model: Delivery Attempts Tab & Per-Pipeline Rate Limiting

## Schema Changes

Both changes are additive — no existing columns are modified or removed.

---

### 1. `delivery_attempts` — add `response_time_ms`

**New column**: `response_time_ms INTEGER NULL`

| Column | Type | Nullable | Default | Description |
|---|---|---|---|---|
| `response_time_ms` | INTEGER | YES | NULL | Milliseconds from request sent to response received. NULL when the request timed out or a network error occurred before a response arrived. |

**Why nullable**: A timeout or connection failure produces no response and therefore no measurable round-trip time. FR-006 requires a dash to be shown in this case — nullable is the correct representation.

**Where populated**: `src/delivery/http-client.ts` — wrap the `fetch` call with `Date.now()` before and after to compute duration. Pass `responseTimeMs` back in the `DeliveryResult` interface. The delivery engine persists it when inserting the `delivery_attempts` row.

**Existing columns (unchanged)**:
- `id` UUID PK
- `job_id` UUID FK → `jobs.id` CASCADE DELETE
- `subscriber_id` UUID FK → `subscribers.id` SET NULL
- `subscriber_url` TEXT NOT NULL
- `http_status` INTEGER NULL
- `response_snippet` TEXT NULL
- `attempt_number` INTEGER NOT NULL
- `outcome` ENUM(`SUCCESS`, `FAILED`) NOT NULL
- `attempted_at` TIMESTAMPTZ NOT NULL DEFAULT now()

---

### 2. `pipelines` — add `rate_limit_per_minute`

**New column**: `rate_limit_per_minute INTEGER NULL`

| Column | Type | Nullable | Constraint | Default (DB) | Default (App) | Description |
|---|---|---|---|---|---|---|
| `rate_limit_per_minute` | INTEGER | YES | CHECK > 0 AND ≤ 1000 | NULL | 60 | Per-minute ingest cap for this pipeline's source URL. NULL = use system default (60 req/min). |

**Validation**:
- Value MUST be a positive integer between 1 and 1000 inclusive.
- NULL is valid and means "use system default".
- The Zod schema for pipeline create/update adds `rateLimitPerMinute: z.number().int().min(1).max(1000).nullable().optional()`.

**Existing columns (unchanged)**:
- `id` UUID PK
- `name` TEXT NOT NULL
- `source_id` UUID NOT NULL UNIQUE (the public ingest URL token)
- `action_type` ENUM NOT NULL
- `action_config` JSONB NOT NULL
- `owner_user_id` UUID NULL FK → `users.id`
- `owner_team_id` UUID NULL FK → `teams.id`
- `created_at` TIMESTAMPTZ NOT NULL
- `updated_at` TIMESTAMPTZ NOT NULL

---

## Rate Limit State (Redis — not PostgreSQL)

Rate limit counters are ephemeral and do not live in the primary database.

**Key**: `ratelimit:{sourceId}:{windowStartSec}`
- `sourceId`: the pipeline's `source_id` UUID
- `windowStartSec`: Unix timestamp of the current 60-second window start (`Math.floor(epochSec / 60) * 60`)

**Value**: Integer counter, incremented once per accepted request.
**TTL**: 61 seconds (set on first INCR of a new window; +1 for clock skew).
**Eviction**: Automatic via TTL — no manual cleanup needed.

**Example**:
```
ratelimit:a3f7d2c1-...:1711270200  →  "47"  (TTL: 38s)
```

---

## Entity Relationships (unchanged)

```
pipelines ──< jobs ──< delivery_attempts
pipelines ──< subscribers
```

No new relationships introduced.
