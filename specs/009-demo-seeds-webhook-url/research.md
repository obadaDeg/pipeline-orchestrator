# Research: Demo Seed Data & Webhook Inbound URL

## Decision Log

### D-001: Webhook URL — Backend Change Required?

**Decision**: No backend change needed.

**Rationale**: `GET /pipelines/:id` already returns a `sourceUrl` field (the full inbound URL, computed from `sourceId` via `buildSourceUrl()`). The dashboard's `Pipeline` interface just needs to include this field and render it.

**Alternatives considered**: Exposing raw `sourceId` and constructing the URL on the frontend — rejected because the URL is already fully formed on the backend and consuming it directly avoids duplicating the URL-building logic.

---

### D-002: VITE_PUBLIC_URL — Still Needed?

**Decision**: Not needed for the URL display (sourceUrl comes fully formed from the API). `VITE_PUBLIC_URL` is still useful as a Docker build arg for environments where the API and frontend are on different origins, but it is not required for the webhook URL feature itself.

**Rationale**: Since `sourceUrl` is computed server-side and returned in the API response, the frontend does not need to construct it. The clarification decision to use `VITE_PUBLIC_URL` is retained as an optional env var for the Docker setup documentation.

---

### D-003: Seed Script Location & Runner

**Decision**: `src/db/seed.ts` — compiled and run via `npm run db:seed` (mirrors existing `db:migrate` convention).

**Rationale**: Seed lives alongside schema and migration files. `db:seed` matches the established `db:` script namespace in `package.json`. The migrator Docker service already runs `dist/db/migrate.js` — seeding follows the same pattern.

**Alternatives considered**:
- Standalone shell script — rejected, TypeScript gives type-safe access to schema and Drizzle ORM
- Separate `scripts/` directory — rejected, `src/db/` is the established home for database tooling

---

### D-004: Seed Password Hashing

**Decision**: Use `argon2` (`hash(password, { type: argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 })`) — identical options to `auth.service.ts`.

**Rationale**: The demo user must be loginable via the existing auth flow. Using the same hash options ensures the stored hash verifies correctly.

---

### D-005: Idempotency Strategy

**Decision**: Natural-key match + skip. Check for existing user by email, existing teams by name, existing pipelines by name. If found, skip creation and return the existing record's ID for use in downstream seed inserts.

**Rationale**: Clarified in spec (Q3). No fixed UUIDs needed — natural keys are readable and stable across re-seeds.

---

### D-006: Second Seed User for Team Membership

**Decision**: Create a second user (`member@example.com` / `Password123!`) to serve as a team member. This user is fully functional and can be used to demonstrate multi-user flows.

**Rationale**: FR-010 requires "at least one additional member" per team. A real second user makes the membership rows meaningful and lets the demo show the add/remove member flow with a real account.

---

### D-007: Jobs & Delivery Attempts — Seeded Status Mix

**Decision**: Seed 12 jobs: 8 `COMPLETED`, 4 `FAILED`, spread across the 3 pipelines. Each job gets 1–3 delivery attempts. Failed jobs get attempts with 5xx status codes.

**Rationale**: SC-005 requires demonstrating jobs and delivery attempts. A mix of statuses makes the Jobs page visually interesting and lets the demo show error handling.
