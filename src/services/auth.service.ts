import { hash, verify, argon2id } from 'argon2';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { apiKeys, auditEvents, users } from '../db/schema.js';
import { generateApiKey, getKeyPrefix, hashApiKey } from '../lib/api-key.js';
import { AppError, NotFoundError } from '../lib/errors.js';

const MAX_ACTIVE_KEYS = 10;

const ARGON2_OPTIONS = {
  type: argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
}

export interface ApiKeyResult {
  id: string;
  name: string;
  key: string;
  keyPrefix: string;
  createdAt: Date;
}

export interface ApiKeyListItem {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export interface RegisterResult {
  user: { id: string; email: string; createdAt: Date };
  apiKey: ApiKeyResult;
}

type AuditEventType = typeof auditEvents.$inferInsert['eventType'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function insertApiKey(userId: string, name: string): Promise<ApiKeyResult> {
  const { key, keyHash, keyPrefix } = generateApiKey();
  const [row] = await db
    .insert(apiKeys)
    .values({ userId, name, keyHash, keyPrefix })
    .returning();
  return { id: row.id, name: row.name, key, keyPrefix: row.keyPrefix, createdAt: row.createdAt };
}

async function countActiveKeys(userId: string): Promise<number> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)));
  return n;
}

// ─── Audit Events ─────────────────────────────────────────────────────────────

export async function emitAuditEvent(
  userId: string | null,
  eventType: AuditEventType,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await db.insert(auditEvents).values({ userId, eventType, metadata });
}

export async function getUserAuditLog(
  userId: string,
  page: number,
  limit: number,
): Promise<{ items: (typeof auditEvents.$inferSelect)[]; total: number; page: number; limit: number }> {
  const offset = (page - 1) * limit;
  const filter = eq(auditEvents.userId, userId);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(auditEvents)
    .where(filter);

  const items = await db
    .select()
    .from(auditEvents)
    .where(filter)
    .orderBy(desc(auditEvents.createdAt))
    .limit(limit)
    .offset(offset);

  return { items, total, page, limit };
}

// ─── Service Functions ────────────────────────────────────────────────────────

export async function register(email: string, password: string): Promise<RegisterResult> {
  const normalizedEmail = email.toLowerCase();

  const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail));
  if (existing) {
    throw new AppError(422, 'EMAIL_ALREADY_REGISTERED', 'This email is already registered');
  }

  const passwordHash = await hash(password, ARGON2_OPTIONS);

  const result = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email: normalizedEmail, passwordHash })
      .returning();

    const { key, keyHash, keyPrefix } = generateApiKey();
    const [apiKey] = await tx
      .insert(apiKeys)
      .values({ userId: user.id, name: 'Default', keyHash, keyPrefix })
      .returning();

    return {
      user: { id: user.id, email: user.email, createdAt: user.createdAt },
      apiKey: { id: apiKey.id, name: apiKey.name, key, keyPrefix: apiKey.keyPrefix, createdAt: apiKey.createdAt },
    };
  });

  await emitAuditEvent(result.user.id, 'USER_REGISTERED', { email: normalizedEmail });

  return result;
}

export async function login(
  email: string,
  password: string,
): Promise<{ apiKey: ApiKeyResult }> {
  const normalizedEmail = email.toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail));

  // Always run argon2 verify — return the same error regardless of which check failed
  // to avoid leaking whether an email is registered (minimal timing side-channel)
  const valid = user ? await verify(user.passwordHash, password) : false;
  if (!user || !valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const activeCount = await countActiveKeys(user.id);
  if (activeCount >= MAX_ACTIVE_KEYS) {
    throw new AppError(422, 'API_KEY_LIMIT_REACHED', 'Maximum of 10 active API keys reached — revoke one first');
  }

  const keyName = `Login ${new Date().toISOString().slice(0, 10)}`;
  const apiKey = await insertApiKey(user.id, keyName);
  return { apiKey };
}

/**
 * Validate a raw API key and return the authenticated user, or null if invalid/revoked.
 * Also schedules a fire-and-forget update of last_used_at.
 * Emits AUTH_FAILED (fire-and-forget) on failure to avoid blocking the request.
 */
export async function validateApiKey(rawKey: string): Promise<AuthUser | null> {
  const keyHash = hashApiKey(rawKey);

  const [row] = await db
    .select({
      keyId: apiKeys.id,
      userId: users.id,
      userEmail: users.email,
    })
    .from(apiKeys)
    .innerJoin(users, eq(apiKeys.userId, users.id))
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)));

  if (!row) {
    // Fire-and-forget — AUTH_FAILED must not block the 401 response
    emitAuditEvent(null, 'AUTH_FAILED', { keyPrefix: getKeyPrefix(rawKey) }).catch(() => {});
    return null;
  }

  // Fire-and-forget — non-critical; must not block the request
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.keyId))
    .execute()
    .catch(() => {});

  return { id: row.userId, email: row.userEmail };
}

export async function createApiKey(userId: string, name: string): Promise<ApiKeyResult> {
  const activeCount = await countActiveKeys(userId);
  if (activeCount >= MAX_ACTIVE_KEYS) {
    throw new AppError(422, 'API_KEY_LIMIT_REACHED', 'Maximum of 10 active API keys reached — revoke one first');
  }

  const result = await insertApiKey(userId, name);
  await emitAuditEvent(userId, 'KEY_CREATED', { keyId: result.id, keyPrefix: result.keyPrefix, name });
  return result;
}

export async function revokeApiKey(userId: string, keyId: string): Promise<void> {
  const [key] = await db.select().from(apiKeys).where(eq(apiKeys.id, keyId));

  if (!key || key.userId !== userId) {
    throw new NotFoundError('API_KEY_NOT_FOUND', 'API key not found');
  }

  if (key.revokedAt !== null) {
    throw new AppError(422, 'API_KEY_ALREADY_REVOKED', 'This API key has already been revoked');
  }

  await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, keyId));
  await emitAuditEvent(userId, 'KEY_REVOKED', { keyId, keyPrefix: key.keyPrefix, name: key.name });
}

export async function listApiKeys(userId: string): Promise<ApiKeyListItem[]> {
  const rows = await db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId))
    .orderBy(desc(apiKeys.createdAt));

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    keyPrefix: r.keyPrefix,
    createdAt: r.createdAt,
    lastUsedAt: r.lastUsedAt,
    revokedAt: r.revokedAt,
  }));
}
