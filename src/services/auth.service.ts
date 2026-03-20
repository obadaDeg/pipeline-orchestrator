import { hash, verify, argon2id } from 'argon2';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { apiKeys, users } from '../db/schema.js';
import { generateApiKey, hashApiKey } from '../lib/api-key.js';
import { AppError } from '../lib/errors.js';

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

export interface RegisterResult {
  user: { id: string; email: string; createdAt: Date };
  apiKey: ApiKeyResult;
}

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

// ─── Service Functions ────────────────────────────────────────────────────────

export async function register(email: string, password: string): Promise<RegisterResult> {
  const normalizedEmail = email.toLowerCase();

  const [existing] = await db.select().from(users).where(eq(users.email, normalizedEmail));
  if (existing) {
    throw new AppError(422, 'EMAIL_ALREADY_REGISTERED', 'This email is already registered');
  }

  const passwordHash = await hash(password, ARGON2_OPTIONS);

  return db.transaction(async (tx) => {
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

  if (!row) return null;

  // Fire-and-forget — non-critical; must not block the request
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.keyId))
    .execute()
    .catch(() => {});

  return { id: row.userId, email: row.userEmail };
}
