import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

vi.mock('../../../src/services/job.service.js', () => ({
  listJobs: vi.fn(),
  getDeliveryAttempts: vi.fn(),
}));

import { listJobs, getDeliveryAttempts } from '../../../src/api/controllers/jobs.controller.js';
import * as jobService from '../../../src/services/job.service.js';

const mockListJobs = jobService.listJobs as ReturnType<typeof vi.fn>;
const mockGetDeliveryAttempts = jobService.getDeliveryAttempts as ReturnType<typeof vi.fn>;

function makeReq(overrides: Partial<Request> = {}): Request {
  return {
    user: { id: 'user-1' },
    params: {},
    query: {},
    body: {},
    ...overrides,
  } as unknown as Request;
}

function makeRes(): { res: Response; json: ReturnType<typeof vi.fn>; status: ReturnType<typeof vi.fn> } {
  const json = vi.fn();
  const status = vi.fn().mockReturnThis();
  const res = { status, json } as unknown as Response;
  return { res, json, status };
}

const next: NextFunction = vi.fn();

describe('listJobs controller', () => {
  afterEach(() => vi.resetAllMocks());

  it('returns paginated response with items and total', async () => {
    const jobRow = { id: 'job-1', pipelineId: 'pipe-1', status: 'COMPLETED' };
    mockListJobs.mockResolvedValue({ items: [jobRow], total: 1 });

    const req = makeReq({ query: { page: '1', limit: '20' } });
    const { res, json } = makeRes();

    await listJobs(req, res, next);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: [jobRow],
          total: 1,
          page: 1,
          limit: 20,
        }),
      }),
    );
  });

  it('passes pipelineId filter to service when provided', async () => {
    mockListJobs.mockResolvedValue({ items: [], total: 0 });

    const req = makeReq({ query: { pipelineId: 'pipe-123' } });
    const { res } = makeRes();

    await listJobs(req, res, next);

    expect(mockListJobs).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ pipelineId: 'pipe-123' }),
    );
  });

  it('does not pass pipelineId when not in query', async () => {
    mockListJobs.mockResolvedValue({ items: [], total: 0 });

    const req = makeReq({ query: {} });
    const { res } = makeRes();

    await listJobs(req, res, next);

    expect(mockListJobs).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ pipelineId: undefined }),
    );
  });

  it('calls next with error when service throws', async () => {
    const err = new Error('DB failure');
    mockListJobs.mockRejectedValue(err);

    const req = makeReq();
    const { res } = makeRes();

    await listJobs(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});

describe('getDeliveryAttempts controller', () => {
  afterEach(() => vi.resetAllMocks());

  it('returns paginated envelope with items and total', async () => {
    const attemptRow = { id: 'da-1', outcome: 'SUCCESS', attemptNumber: 1 };
    mockGetDeliveryAttempts.mockResolvedValue({ items: [attemptRow], total: 1 });

    const req = makeReq({ params: { id: 'job-1' }, query: {} });
    const { res, json } = makeRes();

    await getDeliveryAttempts(req, res, next);

    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          items: [attemptRow],
          total: 1,
          page: 1,
          limit: 20,
        }),
      }),
    );
  });

  it('uses default pagination when no query params provided', async () => {
    mockGetDeliveryAttempts.mockResolvedValue({ items: [], total: 0 });

    const req = makeReq({ params: { id: 'job-1' }, query: {} });
    const { res } = makeRes();

    await getDeliveryAttempts(req, res, next);

    expect(mockGetDeliveryAttempts).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ limit: 20, offset: 0 }),
    );
  });

  it('calls next with error when service throws', async () => {
    const err = new Error('not found');
    mockGetDeliveryAttempts.mockRejectedValue(err);

    const req = makeReq({ params: { id: 'job-1' }, query: {} });
    const { res } = makeRes();

    await getDeliveryAttempts(req, res, next);

    expect(next).toHaveBeenCalledWith(err);
  });
});
