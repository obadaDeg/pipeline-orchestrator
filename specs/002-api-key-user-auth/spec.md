# Feature Specification: API Key Authentication & User-Scoped Flow Ownership

**Feature Branch**: `002-api-key-user-auth`
**Created**: 2026-03-20
**Status**: Draft
**Input**: User description: "Implement authentication mechanism for multi-user webhook platform where flows belong to specific users or groups, similar to Zapier. Support API key authentication for programmatic access so developers can use the API directly."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Developer Registers and Obtains API Key (Priority: P1)

A developer wants to start using the webhook platform programmatically. They register for an account, receive an API key, and immediately use that key to authenticate all subsequent API calls — no browser session required.

**Why this priority**: This is the foundational capability. Without identity and credential issuance, no other feature can be used. It is also the critical path for the "API-only" use case the platform targets.

**Independent Test**: Can be fully tested by registering a new account via the API, generating an API key, making an authenticated request with that key, and confirming access is granted. Delivers end-to-end value independently.

**Acceptance Scenarios**:

1. **Given** an unregistered email address, **When** a user submits valid registration details, **Then** an account is created and an initial API key is issued automatically.
2. **Given** a registered user, **When** they make an API request with a valid API key in the request header, **Then** the request is authenticated and processed.
3. **Given** an API request with no key or an invalid key, **When** the system evaluates the request, **Then** the request is rejected with a clear "unauthorized" response.
4. **Given** a registered user, **When** they request additional API keys, **Then** each new key is unique, labeled with a user-provided name, and independently usable.

---

### User Story 2 - User Manages Flow Ownership (Priority: P2)

A registered user creates webhook flows. Each flow is automatically associated with their account. They can view, update, and delete only the flows they own, and cannot access or interfere with flows owned by other users.

**Why this priority**: Isolation of data between users is a core security and product requirement. Without this, the platform cannot be used by multiple customers simultaneously.

**Independent Test**: Can be fully tested by creating two separate accounts, having each create flows, then attempting cross-account access. Delivers meaningful multi-tenancy value independently.

**Acceptance Scenarios**:

1. **Given** an authenticated user, **When** they create a webhook flow, **Then** the flow is automatically associated with their account and only they can manage it.
2. **Given** user A and user B both have flows, **When** user A requests a list of flows, **Then** only user A's flows are returned — user B's flows are never visible.
3. **Given** user A attempts to trigger, modify, or delete user B's flow using any API endpoint, **Then** the system returns a "not found" or "forbidden" response, never exposing that the flow exists.

---

### User Story 3 - Team Shares Flow Ownership (Priority: P3)

A team lead creates a team (workspace), invites colleagues, and transfers or creates flows under the team. All team members can view and manage those shared flows, but users outside the team cannot access them.

**Why this priority**: Teams and shared ownership reflect real organizational use — one person rarely owns all flows in a business context. However, the core platform works without teams, making this a valuable but non-blocking addition.

**Independent Test**: Can be fully tested by creating a team, inviting a second user, creating a flow under the team, and confirming both users can manage it while a third (non-member) user cannot.

**Acceptance Scenarios**:

1. **Given** a team exists, **When** a member creates a flow within that team, **Then** all current team members can view and manage that flow.
2. **Given** a team with two members, **When** one member is removed from the team, **Then** they lose access to team flows immediately.
3. **Given** a user not belonging to a team, **When** they attempt to access a team's flows, **Then** the request is denied.
4. **Given** a team owner, **When** they invite a new user by email, **Then** the invited user receives access to all team flows upon accepting the invitation.

---

### User Story 4 - User Revokes and Rotates API Keys (Priority: P4)

A user discovers that an API key has been compromised or no longer needed. They can revoke it immediately, and all requests using that key are denied from that moment. They can generate a replacement key without disrupting other active keys.

**Why this priority**: Security lifecycle management is essential for production usage. Users must be able to respond quickly to credential exposure without losing all platform access.

**Independent Test**: Can be fully tested by creating two keys, revoking one, confirming the revoked key is rejected while the other still works.

**Acceptance Scenarios**:

1. **Given** a user has an active API key, **When** they revoke it, **Then** any subsequent request using that key is immediately rejected.
2. **Given** a user revokes one of multiple keys, **When** they make requests with the remaining active keys, **Then** those requests succeed normally.
3. **Given** a user with no active API keys, **When** they generate a new key, **Then** they regain full API access.

---

### Edge Cases

- What happens when a user's account is deactivated while they have active API keys? (Keys should be immediately invalidated.)
- What happens when a team is deleted while it owns flows? (Flows are transferred to the team owner's personal account — FR-023.)
- What happens when an API key is used from an unexpected source after a period of inactivity?
- How does the system respond to rapid creation of many API keys (abuse prevention)?
- What happens when two team members simultaneously modify the same flow?

## Requirements *(mandatory)*

### Functional Requirements

**Account & Identity**

- **FR-001**: System MUST allow users to register with a unique email address and secure password.
- **FR-002**: System MUST validate email uniqueness at registration and return a clear error if the email is already in use.
- **FR-003**: System MUST issue at least one API key automatically upon successful account registration.
- **FR-004**: Users MUST be able to generate additional named API keys at any time, up to a maximum of 10 active API keys per account.
- **FR-005**: System MUST allow users to list all their active API keys, showing name, creation date, and last-used date, but never the full key value after initial creation.
- **FR-006**: System MUST allow users to revoke any of their API keys, with immediate effect.

**Authentication**

- **FR-007**: System MUST authenticate all API requests via a credential supplied in the request header (no session cookies required).
- **FR-008**: System MUST reject unauthenticated requests with a standardized error response indicating the request is unauthorized.
- **FR-009**: System MUST reject requests using revoked or invalid credentials with the same unauthorized response (no information leakage about why the key is invalid).

**Flow Ownership & Isolation**

- **FR-010**: System MUST associate every webhook flow with exactly one owner — either an individual user or a team.
- **FR-011**: When a user creates a flow, the system MUST automatically assign ownership to that user's account unless a team context is explicitly specified.
- **FR-012**: Users MUST only be able to view, modify, trigger, or delete flows they own or that belong to a team they are a member of.
- **FR-013**: Flow listing endpoints MUST return only flows accessible to the authenticated user; cross-user flows must never appear in results.

**Team Management**

- **FR-014**: Users MUST be able to create a team (workspace) and become its owner.
- **FR-015**: Team owners MUST be able to invite other registered users to their team by email.
- **FR-016**: Team owners MUST be able to remove members from their team.
- **FR-017**: Team members MUST be able to view, create, edit, and delete flows owned by their team. Only the team owner MUST be able to invite new members or remove existing members from the team.
- **FR-018**: When a user is removed from a team, their access to all team-owned flows MUST be revoked immediately.
- **FR-023**: When a team is deleted, all flows owned by that team MUST be automatically transferred to the team owner's personal account.

**Audit & Observability**

- **FR-019**: System MUST record a security audit event whenever an API key is created, including the key name, owning user, and timestamp.
- **FR-020**: System MUST record a security audit event whenever an API key is revoked, including which key, by whom, and timestamp.
- **FR-021**: System MUST record a security audit event for every failed authentication attempt, including timestamp and a masked credential identifier (never the full key value).
- **FR-022**: Users MUST be able to retrieve their own audit log entries via the API.

### Key Entities

- **User**: A registered individual with a unique identity, credentials, and one or more API keys. Can own flows directly or as part of a team.
- **API Key**: A unique, opaque credential tied to a specific user. Has a name, creation timestamp, last-used timestamp, and active/revoked status.
- **Team**: A named group of users that can collectively own flows. Has one owner and zero or more members.
- **Team Membership**: The relationship between a user and a team, including their role within the team.
- **Flow**: A webhook pipeline (existing entity). Now has an owner field pointing to either a user or a team.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A new developer can register, obtain a credential, and successfully make their first authenticated API call in under 5 minutes, with no prior knowledge of the system.
- **SC-002**: 100% of API requests without a valid credential are rejected before reaching any business logic — no unauthenticated data is ever returned.
- **SC-003**: Revoking an API key takes effect within 1 second — no requests using a revoked key succeed after that window.
- **SC-004**: Users can only access flows belonging to their account or their teams; cross-user data leakage rate is 0%.
- **SC-005**: The system supports at least 10,000 authenticated users, each with up to 10 active API keys, without degradation in authentication response times.
- **SC-006**: Team membership changes (add/remove) are reflected in access control within 1 second of the change.

## Clarifications

### Session 2026-03-20

- Q: What permissions do team members have relative to the team owner? → A: Members can view, create, edit, and delete team flows. Only the owner can invite or remove members (Option A).
- Q: Should the system log security events (key creation, revocation, failed auth)? → A: Yes — log all three event types with timestamps; users can retrieve their own audit log via the API (Option A).
- Q: What happens to team-owned flows when a team is deleted? → A: Flows are transferred to the team owner's personal account (Option B).
- Q: What is the maximum number of API keys per user account? → A: 10 active API keys per account.

## Assumptions

- The platform is API-only at this stage; there is no web UI for authentication. All interactions (registration, key management, flow management) happen via the API.
- User registration is self-service and open — anyone with a valid email can sign up. Invite-only or admin-approval models are out of scope for this feature.
- Password-based registration is the primary identity mechanism. Social login (Google, GitHub, etc.) and SSO are out of scope for this feature.
- API keys do not expire automatically; expiry is controlled through explicit revocation.
- A user can belong to multiple teams simultaneously.
- Teams have a two-tier membership model: owner and member. Owners manage team membership; members collaborate on flows. Both tiers can view, create, edit, and delete team flows.
- Existing flows created before this feature launches will require a data migration to assign ownership; migration strategy is out of scope for this specification.
- Rate limiting and abuse prevention on credential generation are assumed standard web service defaults and are not specified further here.
