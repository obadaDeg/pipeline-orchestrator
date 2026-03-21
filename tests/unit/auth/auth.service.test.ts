import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

// Mock api-key lib so we control generated values
vi.mock('../../../src/lib/api-key.js', () => ({
  generateApiKey: vi.fn(() => ({
    key: 'wh_testkey1234567890abcdef',
    keyHash: 'deadbeef'.repeat(8),
    keyPrefix: 'wh_testke',
  })),
  hashApiKey: vi.fn((k: string) => k + '_hashed'),
  getKeyPrefix: vi.fn((k: string) => k.slice(0, 8)),
}));

import { createApiKey, listApiKeys, revokeApiKey } from '../../../src/services/auth.service.js';
import { db } from '../../../src/db/index.js';

const mockDb = db as {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

const USER_ID = 'user-uuid';
const KEY_ID = 'key-uuid';

// Fluent chain helper — resolves to `rows` when awaited
function chain(rows: unknown[]) {
  const obj: Record<string, unknown> = {};
  ['from', 'where', 'values', 'returning', 'set', 'orderBy'].forEach((m) => {
    obj[m] = vi.fn(() => obj);
  });
  obj['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  return obj;
}

// count chain returns a single object with n field
function countChain(n: number) {
  return chain([{ n }]);
}

const ACTIVE_KEY_ROW = {
  id: KEY_ID,
  userId: USER_ID,
  name: 'My Key',
  keyHash: 'hash',
  keyPrefix: 'wh_testke',
  lastUsedAt: null,
  revokedAt: null,
  createdAt: new Date('2026-01-01'),
};

describe('createApiKey', () => {
  afterEach(() => vi.resetAllMocks());

  it('creates and returns a key when under the 10-key limit', async () => {
    mockDb.select.mockReturnValue(countChain(3)); // active key count = 3
    mockDb.insert.mockReturnValue(
      chain([{ id: KEY_ID, name: 'New Key', keyPrefix: 'wh_testke', createdAt: new Date('2026-01-01') }]),
    );

    const result = await createApiKey(USER_ID, 'New Key');

    expect(result).toMatchObject({ id: KEY_ID, name: 'New Key', keyPrefix: 'wh_testke' });
    expect(result.key).toMatch(/^wh_/);
  });

  it('throws API_KEY_LIMIT_REACHED when user already has 10 active keys', async () => {
    mockDb.select.mockReturnValue(countChain(10));

    await expect(createApiKey(USER_ID, 'Another Key')).rejects.toMatchObject({
      statusCode: 422,
      code: 'API_KEY_LIMIT_REACHED',
    });

    expect(mockDb.insert).not.toHaveBeenCalled();
  });
});

describe('revokeApiKey', () => {
  afterEach(() => vi.resetAllMocks());

  it('sets revokedAt on the key when it belongs to the user', async () => {
    mockDb.select.mockReturnValue(chain([ACTIVE_KEY_ROW]));
    mockDb.update.mockReturnValue(chain([]));
    mockDb.insert.mockReturnValue(chain([])); // for emitAuditEvent

    await revokeApiKey(USER_ID, KEY_ID);

    expect(mockDb.update).toHaveBeenCalled();
  });

  it('throws API_KEY_NOT_FOUND when key does not exist', async () => {
    mockDb.select.mockReturnValue(chain([]));

    await expect(revokeApiKey(USER_ID, KEY_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'API_KEY_NOT_FOUND',
    });
  });

  it('throws API_KEY_NOT_FOUND when key belongs to a different user', async () => {
    mockDb.select.mockReturnValue(chain([{ ...ACTIVE_KEY_ROW, userId: 'other-user' }]));

    await expect(revokeApiKey(USER_ID, KEY_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'API_KEY_NOT_FOUND',
    });
  });

  it('throws API_KEY_ALREADY_REVOKED when key is already revoked', async () => {
    mockDb.select.mockReturnValue(chain([{ ...ACTIVE_KEY_ROW, revokedAt: new Date('2026-01-02') }]));

    await expect(revokeApiKey(USER_ID, KEY_ID)).rejects.toMatchObject({
      statusCode: 422,
      code: 'API_KEY_ALREADY_REVOKED',
    });
  });
});

describe('listApiKeys', () => {
  afterEach(() => vi.resetAllMocks());

  it('returns all keys for the user without keyHash', async () => {
    const rows = [
      ACTIVE_KEY_ROW,
      { ...ACTIVE_KEY_ROW, id: 'key-2', name: 'Key 2', revokedAt: new Date('2026-01-05') },
    ];
    mockDb.select.mockReturnValue(chain(rows));

    const result = await listApiKeys(USER_ID);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ id: KEY_ID, name: 'My Key', keyPrefix: 'wh_testke' });
    // keyHash must never appear in the response
    expect(result[0]).not.toHaveProperty('keyHash');
    expect(result[1].revokedAt).toBeInstanceOf(Date);
  });

  it('returns an empty array when user has no keys', async () => {
    mockDb.select.mockReturnValue(chain([]));
    const result = await listApiKeys(USER_ID);
    expect(result).toEqual([]);
  });
});
