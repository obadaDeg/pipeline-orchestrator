import { NextFunction, Request, Response } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/services/auth.service.js', () => ({
  validateApiKey: vi.fn(),
}));

import { authenticate } from '../../../src/api/middleware/authenticate.js';
import * as authService from '../../../src/services/auth.service.js';

const mockValidateApiKey = vi.mocked(authService.validateApiKey);

function makeReq(authHeader?: string): Partial<Request> {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  };
}

function makeNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

describe('authenticate middleware', () => {
  const res = {} as Response;

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('calls next(UnauthorizedError) when Authorization header is absent', async () => {
    const req = makeReq();
    const next = makeNext();

    await authenticate(req as Request, res, next);

    expect(next).toHaveBeenCalledOnce();
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });

  it('calls next(UnauthorizedError) when header does not start with "Bearer "', async () => {
    const req = makeReq('Token abc123');
    const next = makeNext();

    await authenticate(req as Request, res, next);

    expect(next).toHaveBeenCalledOnce();
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });

  it('calls next(UnauthorizedError) when key is not found (validateApiKey returns null)', async () => {
    mockValidateApiKey.mockResolvedValueOnce(null);
    const req = makeReq('Bearer wh_unknown_key');
    const next = makeNext();

    await authenticate(req as Request, res, next);

    expect(next).toHaveBeenCalledOnce();
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });

  it('attaches req.user and calls next() with no argument on a valid key', async () => {
    const user = { id: 'user-uuid', email: 'alice@example.com' };
    mockValidateApiKey.mockResolvedValueOnce(user);
    const req = makeReq('Bearer wh_validkey123');
    const next = makeNext();

    await authenticate(req as Request, res, next);

    expect(req.user).toEqual(user);
    expect(next).toHaveBeenCalledWith();
  });

  it('calls next(UnauthorizedError) when validateApiKey throws', async () => {
    mockValidateApiKey.mockRejectedValueOnce(new Error('DB connection lost'));
    const req = makeReq('Bearer wh_somekey');
    const next = makeNext();

    await authenticate(req as Request, res, next);

    expect(next).toHaveBeenCalledOnce();
    const err = (next as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err).toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });
  });

  it('returns the same 401 error whether key is revoked or nonexistent (no enumeration)', async () => {
    mockValidateApiKey.mockResolvedValueOnce(null); // nonexistent
    const next1 = makeNext();
    await authenticate(makeReq('Bearer wh_nonexistent') as Request, res, next1);

    mockValidateApiKey.mockResolvedValueOnce(null); // revoked (service returns null for both)
    const next2 = makeNext();
    await authenticate(makeReq('Bearer wh_revoked') as Request, res, next2);

    const err1 = (next1 as ReturnType<typeof vi.fn>).mock.calls[0][0];
    const err2 = (next2 as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(err1.code).toBe(err2.code);
    expect(err1.statusCode).toBe(err2.statusCode);
  });
});
