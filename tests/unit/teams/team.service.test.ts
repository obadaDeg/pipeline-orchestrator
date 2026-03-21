import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the db module before importing service
vi.mock('../../../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

import * as teamService from '../../../src/services/team.service.js';
import { db } from '../../../src/db/index.js';

const mockDb = db as {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
};

// Helper to build a fluent chain that resolves to `rows`
function chain(rows: unknown[]) {
  const obj: Record<string, unknown> = {};
  const methods = ['from', 'where', 'innerJoin', 'values', 'returning', 'set'];
  methods.forEach((m) => { obj[m] = vi.fn(() => obj); });
  obj['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  // Make it thenable AND iterable-result via await
  Object.defineProperty(obj, Symbol.iterator, { value: () => rows[Symbol.iterator]() });
  return obj;
}

const OWNER_ID = 'owner-uuid';
const TEAM_ID = 'team-uuid';
const MEMBER_ID = 'member-uuid';

const TEAM_ROW = {
  id: TEAM_ID,
  name: 'Test Team',
  ownerUserId: OWNER_ID,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('getUserTeamIds', () => {
  afterEach(() => vi.resetAllMocks());

  it('returns union of owned and member team IDs without duplicates', async () => {
    const owned = [{ id: 'team-1' }];
    const memberships = [{ id: 'team-2' }];

    mockDb.select
      .mockReturnValueOnce(chain(owned))   // owned teams query
      .mockReturnValueOnce(chain(memberships)); // membership query

    const result = await teamService.getUserTeamIds(OWNER_ID);
    expect(result).toEqual(['team-1', 'team-2']);
  });

  it('deduplicates if user is both owner and has a membership row for the same team', async () => {
    const owned = [{ id: 'team-1' }];
    const memberships = [{ id: 'team-1' }];

    mockDb.select
      .mockReturnValueOnce(chain(owned))
      .mockReturnValueOnce(chain(memberships));

    const result = await teamService.getUserTeamIds(OWNER_ID);
    expect(result).toEqual(['team-1']);
  });

  it('returns empty array when user has no teams', async () => {
    mockDb.select
      .mockReturnValueOnce(chain([]))
      .mockReturnValueOnce(chain([]));

    const result = await teamService.getUserTeamIds(OWNER_ID);
    expect(result).toEqual([]);
  });
});

describe('createTeam', () => {
  afterEach(() => vi.resetAllMocks());

  it('inserts a team row and returns it with empty members', async () => {
    mockDb.insert.mockReturnValue(chain([TEAM_ROW]));

    const result = await teamService.createTeam(OWNER_ID, 'Test Team');

    expect(result).toMatchObject({ id: TEAM_ID, name: 'Test Team', ownerUserId: OWNER_ID, members: [] });
  });
});

describe('deleteTeam', () => {
  afterEach(() => vi.resetAllMocks());

  it('throws 404 when team does not exist', async () => {
    mockDb.select.mockReturnValue(chain([]));

    await expect(teamService.deleteTeam(TEAM_ID, OWNER_ID)).rejects.toMatchObject({
      statusCode: 404,
      code: 'TEAM_NOT_FOUND',
    });
  });

  it('throws 404 when requester is not the owner', async () => {
    mockDb.select.mockReturnValue(chain([TEAM_ROW]));

    await expect(teamService.deleteTeam(TEAM_ID, 'other-user')).rejects.toMatchObject({
      statusCode: 404,
      code: 'TEAM_NOT_FOUND',
    });
  });

  it('transfers team pipelines to owner and deletes the team', async () => {
    mockDb.select.mockReturnValue(chain([TEAM_ROW]));
    mockDb.insert.mockReturnValue(chain([])); // for emitAuditEvent after transaction

    const txUpdate = { set: vi.fn().mockReturnThis(), where: vi.fn().mockResolvedValue(undefined) };
    const txDelete = { where: vi.fn().mockResolvedValue(undefined) };
    mockDb.transaction.mockImplementation(async (fn: (tx: unknown) => Promise<void>) => {
      await fn({ update: vi.fn(() => txUpdate), delete: vi.fn(() => txDelete) });
    });

    await teamService.deleteTeam(TEAM_ID, OWNER_ID);

    expect(mockDb.transaction).toHaveBeenCalledOnce();
  });
});

describe('addMember', () => {
  afterEach(() => vi.resetAllMocks());

  it('throws 404 when target user email is not registered', async () => {
    // requireTeamOwner -> team found
    mockDb.select
      .mockReturnValueOnce(chain([TEAM_ROW]))   // team lookup in requireTeamOwner
      .mockReturnValueOnce(chain([]));           // user lookup by email

    await expect(
      teamService.addMember(TEAM_ID, OWNER_ID, 'unknown@example.com'),
    ).rejects.toMatchObject({ statusCode: 404, code: 'USER_NOT_FOUND' });
  });

  it('throws 422 when user is already a member', async () => {
    const memberUser = { id: MEMBER_ID, email: 'member@example.com' };
    const existingMembership = { id: 'mem-1', teamId: TEAM_ID, userId: MEMBER_ID, createdAt: new Date() };

    mockDb.select
      .mockReturnValueOnce(chain([TEAM_ROW]))         // requireTeamOwner
      .mockReturnValueOnce(chain([memberUser]))        // user lookup
      .mockReturnValueOnce(chain([existingMembership])); // memberships list

    await expect(
      teamService.addMember(TEAM_ID, OWNER_ID, 'member@example.com'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'ALREADY_A_MEMBER' });
  });

  it('throws 422 when target user is the team owner', async () => {
    const ownerUser = { id: OWNER_ID, email: 'owner@example.com' };

    mockDb.select
      .mockReturnValueOnce(chain([TEAM_ROW]))   // requireTeamOwner
      .mockReturnValueOnce(chain([ownerUser])); // user lookup

    await expect(
      teamService.addMember(TEAM_ID, OWNER_ID, 'owner@example.com'),
    ).rejects.toMatchObject({ statusCode: 422, code: 'ALREADY_A_MEMBER' });
  });
});

describe('removeMember', () => {
  afterEach(() => vi.resetAllMocks());

  it('throws 422 when attempting to remove the team owner', async () => {
    mockDb.select.mockReturnValue(chain([TEAM_ROW]));

    await expect(
      teamService.removeMember(TEAM_ID, OWNER_ID, OWNER_ID),
    ).rejects.toMatchObject({ statusCode: 422, code: 'CANNOT_REMOVE_OWNER' });
  });

  it('throws 404 when target user is not a member', async () => {
    mockDb.select
      .mockReturnValueOnce(chain([TEAM_ROW]))  // requireTeamOwner
      .mockReturnValueOnce(chain([]));          // memberships list

    await expect(
      teamService.removeMember(TEAM_ID, OWNER_ID, 'nonmember-uuid'),
    ).rejects.toMatchObject({ statusCode: 404, code: 'MEMBER_NOT_FOUND' });
  });
});
