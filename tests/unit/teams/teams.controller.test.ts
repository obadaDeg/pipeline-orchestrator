import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

vi.mock('../../../src/services/team.service.js', () => ({
  listTeams: vi.fn(),
}));

import { listTeamsHandler } from '../../../src/api/controllers/teams.controller.js';
import * as teamService from '../../../src/services/team.service.js';

const mockListTeams = teamService.listTeams as ReturnType<typeof vi.fn>;
const next: NextFunction = vi.fn();

function makeReq(userId = 'user-1'): Request {
  return { user: { id: userId }, params: {}, query: {}, body: {} } as unknown as Request;
}

function makeRes(): { res: Response; json: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const status = vi.fn().mockReturnThis();
  return { res: { status, json } as unknown as Response, json };
}

describe('listTeamsHandler', () => {
  afterEach(() => vi.resetAllMocks());

  it('returns items array from service', async () => {
    const teamItem = {
      id: 'team-1',
      name: 'Alpha',
      ownerUserId: 'user-1',
      memberCount: 2,
      isOwner: true,
      createdAt: new Date(),
    };
    mockListTeams.mockResolvedValue({ items: [teamItem] });

    const { res, json } = makeRes();
    await listTeamsHandler(makeReq(), res, next);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: [teamItem],
        }),
      }),
    );
  });

  it('response includes memberCount and isOwner fields', async () => {
    const teamItem = {
      id: 'team-1',
      name: 'Alpha',
      ownerUserId: 'user-1',
      memberCount: 3,
      isOwner: true,
      createdAt: new Date(),
    };
    mockListTeams.mockResolvedValue({ items: [teamItem] });

    const { res, json } = makeRes();
    await listTeamsHandler(makeReq(), res, next);

    const payload = json.mock.calls[0][0].data;
    expect(payload.items[0].memberCount).toBe(3);
    expect(payload.items[0].isOwner).toBe(true);
  });

  it('returns empty items array when user has no teams', async () => {
    mockListTeams.mockResolvedValue({ items: [] });

    const { res, json } = makeRes();
    await listTeamsHandler(makeReq('no-teams-user'), res, next);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ items: [] }) }),
    );
  });

  it('calls next with error when service throws', async () => {
    mockListTeams.mockRejectedValue(new Error('db error'));

    const { res } = makeRes();
    await listTeamsHandler(makeReq(), res, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});
