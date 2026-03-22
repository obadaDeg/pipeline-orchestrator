import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pipelineSigningSecrets } from '../db/schema.js';
import { AppError, UnauthorizedError } from '../lib/errors.js';
import {
  FUTURE_TOLERANCE_MS,
  TIMESTAMP_TOLERANCE_MS,
  generateSigningSecret,
  verifyHmac,
} from '../lib/signing-secret.js';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface SecretCreatedResult {
  /** Full raw secret — returned once and never stored again after this response. */
  secret: string;
  hint: string;
  createdAt: Date;
}

export interface SecretStatusResult {
  active: boolean;
  hint: string | null;
  createdAt: Date | null;
}

// ─── Service functions ─────────────────────────────────────────────────────────

/**
 * Generate a new signing secret for the given pipeline.
 * If a secret already exists it is replaced (rotated) — the old secret is
 * immediately invalidated inside a transaction.
 */
export async function createOrRotateSecret(pipelineId: string): Promise<SecretCreatedResult> {
  const { secret, secretHint } = generateSigningSecret();

  const [row] = await db.transaction(async (tx) => {
    await tx
      .delete(pipelineSigningSecrets)
      .where(eq(pipelineSigningSecrets.pipelineId, pipelineId));

    return tx
      .insert(pipelineSigningSecrets)
      .values({ pipelineId, secretValue: secret, secretHint })
      .returning();
  });

  return { secret, hint: row.secretHint, createdAt: row.createdAt };
}

/**
 * Return whether the pipeline has an active signing secret and its display hint.
 * The raw secret is never returned here.
 */
export async function getSecretStatus(pipelineId: string): Promise<SecretStatusResult> {
  const [row] = await db
    .select({
      secretHint: pipelineSigningSecrets.secretHint,
      createdAt: pipelineSigningSecrets.createdAt,
    })
    .from(pipelineSigningSecrets)
    .where(eq(pipelineSigningSecrets.pipelineId, pipelineId))
    .limit(1);

  if (!row) return { active: false, hint: null, createdAt: null };
  return { active: true, hint: row.secretHint, createdAt: row.createdAt };
}

/**
 * Verify the HMAC-SHA256 signature of an incoming webhook.
 *
 * - No active secret → no-op (opt-in enforcement; pipeline accepts all requests).
 * - Active secret present → both headers MUST be present and the HMAC MUST match.
 *
 * Timestamp tolerance (replay prevention) is enforced in Phase 3 (US2).
 */
export async function verifyWebhookSignature(
  pipelineId: string,
  signatureHeader: string | undefined,
  timestampHeader: string | undefined,
  rawBody: string,
): Promise<void> {
  const [row] = await db
    .select({ secretValue: pipelineSigningSecrets.secretValue })
    .from(pipelineSigningSecrets)
    .where(eq(pipelineSigningSecrets.pipelineId, pipelineId))
    .limit(1);

  // No secret configured — accept all requests.
  if (!row) return;

  // Secret is configured — both headers are required.
  if (!signatureHeader || !timestampHeader) {
    throw new UnauthorizedError('Webhook signature verification failed');
  }

  // Validate timestamp to prevent replay attacks.
  const timestampMs = parseInt(timestampHeader, 10) * 1000;
  if (isNaN(timestampMs)) {
    throw new UnauthorizedError('Webhook signature verification failed');
  }

  const drift = Date.now() - timestampMs;
  if (drift > TIMESTAMP_TOLERANCE_MS || drift < -FUTURE_TOLERANCE_MS) {
    throw new UnauthorizedError('Webhook signature verification failed');
  }

  const valid = verifyHmac(row.secretValue, timestampHeader, rawBody, signatureHeader);
  if (!valid) {
    throw new UnauthorizedError('Webhook signature verification failed');
  }
}

/**
 * Remove the signing secret for the given pipeline.
 * The pipeline immediately reverts to open (accept-all) mode.
 *
 * @throws AppError(422) if no active secret exists for this pipeline.
 */
export async function revokeSecret(pipelineId: string): Promise<void> {
  const deleted = await db
    .delete(pipelineSigningSecrets)
    .where(eq(pipelineSigningSecrets.pipelineId, pipelineId))
    .returning({ id: pipelineSigningSecrets.id });

  if (deleted.length === 0) {
    throw new AppError(422, 'NO_ACTIVE_SECRET', 'This pipeline does not have an active signing secret');
  }
}
