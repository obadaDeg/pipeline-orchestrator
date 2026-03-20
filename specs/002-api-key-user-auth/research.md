# Research: API Key Authentication & User-Scoped Flow Ownership

**Feature**: 002-api-key-user-auth
**Date**: 2026-03-20
**Status**: Complete

---

## Decision 1: Authentication Mechanism — API Key vs JWT

**Decision**: API Key authentication

**Rationale**: The platform is explicitly API-only (no browser UI). JWTs solve session management for stateful browser clients — they carry claims in the token so the server need not look up the user on every request. However, they introduce refresh token complexity, short expiry windows, and revocation challenges (JWTs are valid until expiry unless you maintain a blocklist, which defeats their statelessness advantage). API keys are a better fit here because:
- Each key is a long-lived opaque credential that the developer controls
- Revocation is immediate — one DB row update
- No token refresh dance needed
- Industry standard for developer-facing APIs (GitHub, Stripe, Zapier, Twilio all use API keys for programmatic access)
- Simpler to implement and reason about

**Alternatives considered**:
- JWT with short-lived access token + refresh token: Better for UI sessions; overkill for API-only with server-side revocation needs
- OAuth2: Suitable when third-party apps need delegated access; not needed at this stage

---

## Decision 2: Password Hashing Algorithm

**Decision**: `argon2id` via the `argon2` npm package

**Rationale**: OWASP Password Storage Cheat Sheet (2024) recommends argon2id as the first choice for new systems. It provides memory-hard hashing that resists GPU/ASIC brute-force attacks. The `argon2` Node.js package wraps the reference C implementation. Recommended parameters: `memoryCost: 65536` (64 MB), `timeCost: 3`, `parallelism: 4`.

**Alternatives considered**:
- bcrypt: Still acceptable per OWASP (second choice). Has a 72-byte input limit and does not benefit from memory hardness. Not chosen because argon2id is strictly stronger.
- scrypt: Third OWASP choice. argon2id is preferred for new implementations.

---

## Decision 3: API Key Storage Strategy

**Decision**: Store SHA-256 hash of the full key; store first 8 characters of the raw key as a display prefix

**Rationale**:
- The full API key is a secret and MUST NOT be stored in plaintext (same principle as passwords)
- SHA-256 (not bcrypt/argon2) is appropriate here because the key itself is already cryptographically random (high entropy), so dictionary/rainbow-table attacks are not viable — SHA-256 lookup is O(1) with a DB index
- A short display prefix (e.g., `wh_abc12345...`) lets users identify which key to revoke without revealing the full secret
- Key format: `wh_` prefix + 32 URL-safe base64 random bytes = ~45 character key (cryptographically secure via `crypto.randomBytes`)

**Key format example**: `wh_V3rYs3cur3ranD0mStr1ngHere0123456789AbCdEf`

**Alternatives considered**:
- Store plaintext: REJECTED — violates security fundamentals; DB breach exposes all keys
- Hash with bcrypt/argon2: Unnecessarily slow for high-entropy random tokens; SHA-256 is sufficient and fast for lookup
- Encrypted storage: More complex than hashing; hash is sufficient since only the hash is needed for lookup

---

## Decision 4: Express Auth Middleware Pattern

**Decision**: Single `authenticate` middleware that reads `Authorization: Bearer <key>` header, hashes the provided key with SHA-256, looks up the hash in `api_keys` table (joined to `users`), and attaches `req.user` to the request context

**Rationale**: Consistent with the existing middleware pattern in the project (`validate-request.ts`, `error-handler.ts`). The middleware either calls `next()` with `req.user` populated, or calls `next(new UnauthorizedError(...))` which the existing error handler will catch and return as `401`.

**Key implementation details**:
- Hash the incoming key with SHA-256 before DB lookup (constant-time comparison not needed — hash lookup is inherently safe)
- Update `api_keys.last_used_at` on successful auth (can be async fire-and-forget to avoid latency)
- Return `401` for any invalid/revoked/missing key; never distinguish between "key not found" and "key revoked" in the response (prevents enumeration)
- Record `AUTH_FAILED` audit event on failure

---

## Decision 5: Team Invitation Model

**Decision**: Immediate membership on invite (no pending/accept flow)

**Rationale**: For an API-only platform without email infrastructure, a pending-invite flow requiring email confirmation adds significant complexity (email delivery service, token expiry, invitation acceptance endpoint). Since the spec targets API access, the simpler model — invite by email, immediately add if user exists, error if user not found — delivers the core value without the infrastructure overhead.

**Alternatives considered**:
- Pending invite with email confirmation link: Better UX for consumer products; requires email delivery infrastructure. Deferred to future iteration.

---

## Decision 6: Login / Key Recovery Endpoint

**Decision**: Add `POST /auth/login` endpoint that validates email+password and creates + returns a new API key

**Rationale**: The spec's US4 scenario 3 states "Given a user with no active API keys, When they generate a new key, Then they regain full API access." But key generation requires authentication — creating a chicken-and-egg problem. A password-authenticated login endpoint resolves this. It creates a new key (incrementing toward the 10-key limit, or returning an error if the limit is reached with a prompt to revoke old keys).

**Scope note**: This endpoint is a necessary addition not explicitly listed in the spec's FRs. It will be added as FR-024 in an implementation-driven spec update.
