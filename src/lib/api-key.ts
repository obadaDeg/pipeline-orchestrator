import { createHash, randomBytes } from 'node:crypto';

const KEY_PREFIX = 'wh_';
const KEY_RANDOM_BYTES = 32;
const KEY_DISPLAY_PREFIX_LENGTH = 8;

export interface GeneratedApiKey {
  /** The full raw key — returned to the user once and never stored. */
  key: string;
  /** SHA-256 hex digest of the full key — stored in the database for lookup. */
  keyHash: string;
  /** First N characters of the raw key — stored for display identification. */
  keyPrefix: string;
}

/**
 * Generate a cryptographically secure API key.
 * Format: `wh_<32-random-bytes-as-base64url>` (~46 characters total).
 */
export function generateApiKey(): GeneratedApiKey {
  const random = randomBytes(KEY_RANDOM_BYTES).toString('base64url');
  const key = `${KEY_PREFIX}${random}`;
  return {
    key,
    keyHash: hashApiKey(key),
    keyPrefix: getKeyPrefix(key),
  };
}

/**
 * Compute the SHA-256 hex digest of an API key.
 * Used for database lookups — high-entropy random keys make SHA-256 safe
 * (no need for a slow adaptive hash like argon2 here).
 */
export function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Extract the display prefix from a key (first N characters).
 * Stored in the database so users can identify which key to revoke.
 */
export function getKeyPrefix(key: string): string {
  return key.slice(0, KEY_DISPLAY_PREFIX_LENGTH);
}
