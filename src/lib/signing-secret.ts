import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const SECRET_PREFIX = 'whsec_';
const SECRET_RANDOM_BYTES = 32;
const SECRET_HINT_LENGTH = 6;

/** Tolerance for past timestamps: 5 minutes. */
export const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000;
/** Tolerance for future timestamps: 1 minute (clock skew allowance). */
export const FUTURE_TOLERANCE_MS = 60 * 1000;

export interface GeneratedSecret {
  /** The full raw secret — returned to the owner once. Stored in DB for HMAC verification. */
  secret: string;
  /** First N characters of the raw secret — stored separately for display identification. */
  secretHint: string;
}

/**
 * Generate a cryptographically secure webhook signing secret.
 * Format: `whsec_<32-random-bytes-as-base64url>` (~49 characters total).
 */
export function generateSigningSecret(): GeneratedSecret {
  const random = randomBytes(SECRET_RANDOM_BYTES).toString('base64url');
  const secret = `${SECRET_PREFIX}${random}`;
  return {
    secret,
    secretHint: secret.slice(0, SECRET_HINT_LENGTH),
  };
}

/**
 * Verify an HMAC-SHA256 webhook signature.
 *
 * The signed message is: `${timestamp}.${rawBody}`
 * The expected header format is: `sha256=<hex-digest>`
 *
 * Uses timing-safe comparison to prevent timing side-channel attacks.
 *
 * @returns `true` if the signature is valid, `false` otherwise.
 */
export function verifyHmac(
  secret: string,
  timestamp: string,
  rawBody: string,
  signatureHeader: string,
): boolean {
  if (!signatureHeader.startsWith('sha256=')) {
    return false;
  }

  const providedHex = signatureHeader.slice('sha256='.length);
  const expectedHex = createHmac('sha256', secret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  // Both must be the same length for timingSafeEqual
  if (providedHex.length !== expectedHex.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(providedHex, 'hex'), Buffer.from(expectedHex, 'hex'));
}
