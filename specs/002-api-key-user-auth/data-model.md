# Data Model: API Key Authentication & User-Scoped Flow Ownership

**Feature**: 002-api-key-user-auth
**Date**: 2026-03-20

---

## New Tables

### `users`

Stores registered user accounts.

| Column          | Type                        | Constraints                          | Notes                          |
|-----------------|-----------------------------|--------------------------------------|--------------------------------|
| `id`            | `uuid`                      | PK, default `gen_random_uuid()`      |                                |
| `email`         | `text`                      | NOT NULL, UNIQUE                     | Lowercased before storage      |
| `password_hash` | `text`                      | NOT NULL                             | argon2id hash                  |
| `created_at`    | `timestamp with time zone`  | NOT NULL, default `now()`            |                                |
| `updated_at`    | `timestamp with time zone`  | NOT NULL, default `now()`            |                                |

**Indexes**:
- `UNIQUE idx_users_email` on `email`

---

### `api_keys`

Stores API key credentials. The raw key is never stored — only its SHA-256 hash.

| Column         | Type                        | Constraints                              | Notes                                         |
|----------------|-----------------------------|------------------------------------------|-----------------------------------------------|
| `id`           | `uuid`                      | PK, default `gen_random_uuid()`          |                                               |
| `user_id`      | `uuid`                      | NOT NULL, FK → `users.id` ON DELETE CASCADE |                                            |
| `name`         | `text`                      | NOT NULL                                 | User-provided label (e.g., "Production")      |
| `key_hash`     | `text`                      | NOT NULL, UNIQUE                         | SHA-256 hex digest of the full raw key        |
| `key_prefix`   | `text`                      | NOT NULL                                 | First 8 chars of raw key, for display only    |
| `last_used_at` | `timestamp with time zone`  | nullable                                 | Updated asynchronously on successful auth     |
| `revoked_at`   | `timestamp with time zone`  | nullable                                 | NULL = active; non-null = revoked             |
| `created_at`   | `timestamp with time zone`  | NOT NULL, default `now()`                |                                               |

**Indexes**:
- `UNIQUE idx_api_keys_key_hash` on `key_hash` (primary lookup path during auth)
- `idx_api_keys_user_id` on `user_id` (for listing a user's keys)

**Business rules**:
- A user may have at most **10 active** (non-revoked) API keys at a time
- Revocation is soft-delete: set `revoked_at`, never hard-delete
- `key_hash` = `SHA-256(rawKey)` stored as hex string

---

### `teams`

Represents a shared workspace that can own pipelines.

| Column          | Type                        | Constraints                               | Notes                               |
|-----------------|-----------------------------|-------------------------------------------|-------------------------------------|
| `id`            | `uuid`                      | PK, default `gen_random_uuid()`           |                                     |
| `name`          | `text`                      | NOT NULL                                  |                                     |
| `owner_user_id` | `uuid`                      | NOT NULL, FK → `users.id` ON DELETE RESTRICT | Team cannot exist without an owner |
| `created_at`    | `timestamp with time zone`  | NOT NULL, default `now()`                 |                                     |
| `updated_at`    | `timestamp with time zone`  | NOT NULL, default `now()`                 |                                     |

**Indexes**:
- `idx_teams_owner_user_id` on `owner_user_id`

**Business rules**:
- On team deletion: all pipelines with `owner_team_id = this team` are reassigned to `owner_user_id = team.owner_user_id` (and `owner_team_id` set to NULL)
- Team owner is implicitly a member (no explicit `team_memberships` row required, but queries must union both)

---

### `team_memberships`

Junction table linking users to teams (non-owner members).

| Column       | Type                        | Constraints                                    | Notes                                   |
|--------------|-----------------------------|------------------------------------------------|-----------------------------------------|
| `id`         | `uuid`                      | PK, default `gen_random_uuid()`                |                                         |
| `team_id`    | `uuid`                      | NOT NULL, FK → `teams.id` ON DELETE CASCADE    |                                         |
| `user_id`    | `uuid`                      | NOT NULL, FK → `users.id` ON DELETE CASCADE    |                                         |
| `created_at` | `timestamp with time zone`  | NOT NULL, default `now()`                      |                                         |

**Indexes**:
- `UNIQUE idx_team_memberships_team_user` on `(team_id, user_id)`
- `idx_team_memberships_user_id` on `user_id` (for "which teams does this user belong to?")

**Business rules**:
- The team owner is NOT stored here (ownership is via `teams.owner_user_id`)
- Removing a membership row immediately revokes the user's access to all team pipelines

---

### `audit_events`

Immutable log of security-relevant events.

| Column       | Type                        | Constraints                                 | Notes                                             |
|--------------|-----------------------------|---------------------------------------------|---------------------------------------------------|
| `id`         | `uuid`                      | PK, default `gen_random_uuid()`             |                                                   |
| `user_id`    | `uuid`                      | nullable, FK → `users.id` ON DELETE SET NULL | NULL for pre-auth failures (user unknown)         |
| `event_type` | `audit_event_type` (enum)   | NOT NULL                                    | See enum values below                             |
| `metadata`   | `jsonb`                     | NOT NULL, default `{}`                      | Event-specific context (key prefix, IP, etc.)     |
| `created_at` | `timestamp with time zone`  | NOT NULL, default `now()`                   |                                                   |

**Enum `audit_event_type`**:
```
KEY_CREATED
KEY_REVOKED
AUTH_FAILED
TEAM_CREATED
TEAM_DELETED
TEAM_MEMBER_ADDED
TEAM_MEMBER_REMOVED
USER_REGISTERED
```

**Indexes**:
- `idx_audit_events_user_id` on `user_id`
- `idx_audit_events_created_at` on `created_at`
- `idx_audit_events_event_type` on `event_type`

**Business rules**:
- Audit events are append-only — no updates or deletes
- `metadata` for `AUTH_FAILED` includes the key prefix (first 8 chars) if recognizable, or `"unknown"` if no key was provided

---

## Modified Tables

### `pipelines` (existing — extended)

Add ownership columns to the existing `pipelines` table.

| New Column       | Type   | Constraints                               | Notes                                                    |
|------------------|--------|-------------------------------------------|----------------------------------------------------------|
| `owner_user_id`  | `uuid` | nullable, FK → `users.id` ON DELETE SET NULL | NULL until auth feature is deployed + migrated         |
| `owner_team_id`  | `uuid` | nullable, FK → `teams.id` ON DELETE SET NULL | Non-null only when pipeline belongs to a team          |

**Business rules**:
- Exactly one of `owner_user_id` or `owner_team_id` should be non-null for authenticated pipelines
- Pipelines created before auth launch will have both NULL (treated as "legacy/unowned"); migration strategy is out of scope for this spec but must be addressed before auth is enforced
- A CHECK constraint MAY enforce mutual exclusivity: `CHECK (owner_user_id IS NULL OR owner_team_id IS NULL)`

**Indexes**:
- `idx_pipelines_owner_user_id` on `owner_user_id`
- `idx_pipelines_owner_team_id` on `owner_team_id`

---

## Entity Relationship Summary

```
users ──< api_keys          (one user → many keys)
users ──< team_memberships  (one user → many team memberships)
users ──< teams             (one user → many owned teams, via owner_user_id)
teams ──< team_memberships  (one team → many member records)
users ──< pipelines         (one user → many personal pipelines, via owner_user_id)
teams ──< pipelines         (one team → many team pipelines, via owner_team_id)
users ──< audit_events      (one user → many audit records)
```

---

## Migration Notes

1. Add `users`, `api_keys`, `teams`, `team_memberships`, `audit_events` tables
2. Add `owner_user_id` and `owner_team_id` columns to `pipelines` (nullable, no default)
3. Existing pipeline rows will have NULL owners — auth enforcement should be gated behind a feature flag or enforced only for new pipelines until migration is complete
