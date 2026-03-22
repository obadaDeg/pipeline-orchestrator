import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('../../../src/lib/signing-secret.js', () => ({
  generateSigningSecret: vi.fn(),
  verifyHmac: vi.fn(),
  TIMESTAMP_TOLERANCE_MS: 300000,
  FUTURE_TOLERANCE_MS: 60000,
}));

import * as dbModule from '../../../src/db/index.js';
import * as signingSecretLib from '../../../src/lib/signing-secret.js';
import {
  createOrRotateSecret,
  getSecretStatus,
  revokeSecret,
  verifyWebhookSignature,
} from '../../../src/services/signing.service.js';

const mockDb = vi.mocked(dbModule.db);
const mockGenerate = vi.mocked(signingSecretLib.generateSigningSecret);
const mockVerifyHmac = vi.mocked(signingSecretLib.verifyHmac);

afterEach(() => {
  vi.resetAllMocks();
});

// ─── createOrRotateSecret ──────────────────────────────────────────────────────

describe('createOrRotateSecret', () => {
  function makeTxMock(returnedRow: object) {
    const deleteMock = vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) });
    const insertMock = vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([returnedRow]) }),
    });
    const tx = { delete: deleteMock, insert: insertMock };
    mockDb.transaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb(tx));
    return tx;
  }

  it('deletes the old secret and inserts a new one inside a transaction', async () => {
    mockGenerate.mockReturnValue({ secret: 'whsec_newraw', secretHint: 'whsec_' });
    makeTxMock({ secretHint: 'whsec_', createdAt: new Date('2026-03-21') });

    const result = await createOrRotateSecret('pipeline-123');

    expect(result.secret).toBe('whsec_newraw');
    expect(result.hint).toBe('whsec_');
    expect(result.createdAt).toEqual(new Date('2026-03-21'));
  });

  it('calls delete before insert on every invocation (rotation replaces previous secret)', async () => {
    // First call
    mockGenerate.mockReturnValueOnce({ secret: 'whsec_first', secretHint: 'whsec_' });
    const tx1 = makeTxMock({ secretHint: 'whsec_', createdAt: new Date('2026-03-21T10:00:00Z') });
    const first = await createOrRotateSecret('pipeline-123');

    // Second call (rotation)
    mockGenerate.mockReturnValueOnce({ secret: 'whsec_second', secretHint: 'whsec_' });
    const tx2 = makeTxMock({ secretHint: 'whsec_', createdAt: new Date('2026-03-21T10:05:00Z') });
    const second = await createOrRotateSecret('pipeline-123');

    // Secrets must differ
    expect(first.secret).not.toBe(second.secret);
    expect(first.secret).toBe('whsec_first');
    expect(second.secret).toBe('whsec_second');

    // Both calls must have invoked delete (ensuring the old row is cleared)
    expect(tx1.delete).toHaveBeenCalledOnce();
    expect(tx2.delete).toHaveBeenCalledOnce();
  });
});

// ─── getSecretStatus ───────────────────────────────────────────────────────────

describe('getSecretStatus', () => {
  function mockSelect(rows: unknown[]) {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    } as unknown as ReturnType<typeof mockDb.select>);
  }

  it('returns active=true with hint when a secret row exists', async () => {
    mockSelect([{ secretHint: 'whsec_', createdAt: new Date('2026-03-21') }]);
    const result = await getSecretStatus('pipeline-123');
    expect(result).toEqual({ active: true, hint: 'whsec_', createdAt: new Date('2026-03-21') });
  });

  it('returns active=false with nulls when no row exists', async () => {
    mockSelect([]);
    const result = await getSecretStatus('pipeline-123');
    expect(result).toEqual({ active: false, hint: null, createdAt: null });
  });
});

// ─── verifyWebhookSignature ────────────────────────────────────────────────────

describe('verifyWebhookSignature', () => {
  function mockSelectSecret(rows: unknown[]) {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    } as unknown as ReturnType<typeof mockDb.select>);
  }

  it('is a no-op when the pipeline has no signing secret', async () => {
    mockSelectSecret([]);
    await expect(
      verifyWebhookSignature('pipeline-123', undefined, undefined, 'body'),
    ).resolves.toBeUndefined();
    expect(mockVerifyHmac).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedError when signature header is missing', async () => {
    mockSelectSecret([{ secretValue: 'whsec_abc' }]);
    await expect(
      verifyWebhookSignature('pipeline-123', undefined, '1700000000', 'body'),
    ).rejects.toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });

  it('throws UnauthorizedError when timestamp header is missing', async () => {
    mockSelectSecret([{ secretValue: 'whsec_abc' }]);
    await expect(
      verifyWebhookSignature('pipeline-123', 'sha256=abc', undefined, 'body'),
    ).rejects.toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });

  it('throws UnauthorizedError when HMAC verification fails', async () => {
    mockSelectSecret([{ secretValue: 'whsec_abc' }]);
    mockVerifyHmac.mockReturnValue(false);
    await expect(
      verifyWebhookSignature('pipeline-123', 'sha256=bad', '1700000000', 'body'),
    ).rejects.toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });

  it('resolves when HMAC verification passes', async () => {
    mockSelectSecret([{ secretValue: 'whsec_abc' }]);
    mockVerifyHmac.mockReturnValue(true);
    const freshTs = String(Math.floor(Date.now() / 1000));
    await expect(
      verifyWebhookSignature('pipeline-123', 'sha256=valid', freshTs, 'body'),
    ).resolves.toBeUndefined();
  });

  it('throws UnauthorizedError when timestamp is not a valid number', async () => {
    mockSelectSecret([{ secretValue: 'whsec_abc' }]);
    await expect(
      verifyWebhookSignature('pipeline-123', 'sha256=valid', 'not-a-number', 'body'),
    ).rejects.toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });

  it('throws UnauthorizedError when timestamp is more than 5 minutes in the past', async () => {
    mockSelectSecret([{ secretValue: 'whsec_abc' }]);
    const oldTs = String(Math.floor((Date.now() - 6 * 60 * 1000) / 1000)); // 6 min ago
    await expect(
      verifyWebhookSignature('pipeline-123', 'sha256=valid', oldTs, 'body'),
    ).rejects.toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });

  it('accepts a timestamp just within the 5-minute past window', async () => {
    mockSelectSecret([{ secretValue: 'whsec_abc' }]);
    mockVerifyHmac.mockReturnValue(true);
    const recentTs = String(Math.floor((Date.now() - 4 * 60 * 1000) / 1000)); // 4 min ago
    await expect(
      verifyWebhookSignature('pipeline-123', 'sha256=valid', recentTs, 'body'),
    ).resolves.toBeUndefined();
  });

  it('throws UnauthorizedError when timestamp is more than 1 minute in the future', async () => {
    mockSelectSecret([{ secretValue: 'whsec_abc' }]);
    const futureTs = String(Math.floor((Date.now() + 2 * 60 * 1000) / 1000)); // 2 min ahead
    await expect(
      verifyWebhookSignature('pipeline-123', 'sha256=valid', futureTs, 'body'),
    ).rejects.toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });

  it('accepts a timestamp within the 1-minute future grace window', async () => {
    mockSelectSecret([{ secretValue: 'whsec_abc' }]);
    mockVerifyHmac.mockReturnValue(true);
    const slightlyAheadTs = String(Math.floor((Date.now() + 30 * 1000) / 1000)); // 30s ahead
    await expect(
      verifyWebhookSignature('pipeline-123', 'sha256=valid', slightlyAheadTs, 'body'),
    ).resolves.toBeUndefined();
  });
});

// ─── revokeSecret ─────────────────────────────────────────────────────────────

describe('revokeSecret', () => {
  it('resolves when a row is deleted', async () => {
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'row-1' }]),
      }),
    } as unknown as ReturnType<typeof mockDb.delete>);

    await expect(revokeSecret('pipeline-123')).resolves.toBeUndefined();
  });

  it('throws 422 NO_ACTIVE_SECRET when no row exists', async () => {
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    } as unknown as ReturnType<typeof mockDb.delete>);

    await expect(revokeSecret('pipeline-123')).rejects.toMatchObject({
      statusCode: 422,
      code: 'NO_ACTIVE_SECRET',
    });
  });

  it('pipeline reverts to open mode — verifyWebhookSignature is a no-op after revocation', async () => {
    // After revoking, the DB has no row → select returns []
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    } as unknown as ReturnType<typeof mockDb.select>);

    // Should pass without checking HMAC (no secret configured)
    await expect(
      verifyWebhookSignature('pipeline-123', undefined, undefined, 'body'),
    ).resolves.toBeUndefined();
    expect(mockVerifyHmac).not.toHaveBeenCalled();
  });
});
