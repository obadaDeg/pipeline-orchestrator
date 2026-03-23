import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/db/index.js', () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  },
}));

vi.mock('../../../src/services/team.service.js', () => ({
  getUserTeamIds: vi.fn(),
}));

import * as jobService from '../../../src/services/job.service.js';
import { db } from '../../../src/db/index.js';
import { getUserTeamIds } from '../../../src/services/team.service.js';

const mockDb = db as {
  select: ReturnType<typeof vi.fn>;
};

const mockGetUserTeamIds = getUserTeamIds as ReturnType<typeof vi.fn>;

const USER_ID = 'user-uuid';
const PIPELINE_ID = 'pipe-uuid';
const JOB_ID = 'job-uuid';

function chain(rows: unknown[]) {
  const obj: Record<string, unknown> = {};
  ['from', 'where', 'orderBy', 'limit', 'offset', 'innerJoin', 'groupBy'].forEach((m) => {
    obj[m] = vi.fn(() => obj);
  });
  obj['then'] = (resolve: (v: unknown) => unknown) => Promise.resolve(rows).then(resolve);
  return obj;
}

describe('listJobs', () => {
  afterEach(() => vi.resetAllMocks());

  it('returns empty result when user has no accessible pipelines', async () => {
    mockGetUserTeamIds.mockResolvedValue([]);
    // owned pipelines query
    mockDb.select.mockReturnValueOnce(chain([]));

    const result = await jobService.listJobs(USER_ID, { page: 1, limit: 20, offset: 0 });

    expect(result).toEqual({ items: [], total: 0 });
  });

  it('returns jobs from user-owned pipelines', async () => {
    mockGetUserTeamIds.mockResolvedValue([]);
    const pipelineRow = { id: PIPELINE_ID };
    const jobRow = { id: JOB_ID, pipelineId: PIPELINE_ID, status: 'COMPLETED', createdAt: new Date() };

    mockDb.select
      .mockReturnValueOnce(chain([pipelineRow]))          // owned pipelines
      .mockReturnValueOnce(chain([{ total: 1 }]))         // count query
      .mockReturnValueOnce(chain([jobRow]));               // jobs query

    const result = await jobService.listJobs(USER_ID, { page: 1, limit: 20, offset: 0 });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: JOB_ID });
  });

  it('filters to specific pipelineId when provided and accessible', async () => {
    mockGetUserTeamIds.mockResolvedValue([]);
    const pipelineRow = { id: PIPELINE_ID };
    const jobRow = { id: JOB_ID, pipelineId: PIPELINE_ID, status: 'COMPLETED', createdAt: new Date() };

    mockDb.select
      .mockReturnValueOnce(chain([pipelineRow]))  // owned pipelines
      .mockReturnValueOnce(chain([{ total: 1 }])) // count
      .mockReturnValueOnce(chain([jobRow]));        // jobs

    const result = await jobService.listJobs(USER_ID, {
      page: 1, limit: 20, offset: 0, pipelineId: PIPELINE_ID,
    });

    expect(result.total).toBe(1);
    expect(result.items[0].pipelineId).toBe(PIPELINE_ID);
  });

  it('returns empty when pipelineId is not accessible to user', async () => {
    mockGetUserTeamIds.mockResolvedValue([]);
    mockDb.select.mockReturnValueOnce(chain([{ id: 'other-pipe' }])); // owned pipelines (different ID)

    const result = await jobService.listJobs(USER_ID, {
      page: 1, limit: 20, offset: 0, pipelineId: 'not-accessible-pipe',
    });

    expect(result).toEqual({ items: [], total: 0 });
  });
});

describe('getDeliveryAttempts', () => {
  afterEach(() => vi.resetAllMocks());

  it('throws NOT_FOUND when job does not exist', async () => {
    mockDb.select.mockReturnValueOnce(chain([]));

    await expect(
      jobService.getDeliveryAttempts(JOB_ID, { limit: 50, offset: 0 }),
    ).rejects.toMatchObject({ statusCode: 404, code: 'JOB_NOT_FOUND' });
  });

  it('returns items and total for a valid job', async () => {
    const jobRow = { id: JOB_ID, pipelineId: PIPELINE_ID, status: 'COMPLETED' };
    const attemptRow = { id: 'da-1', jobId: JOB_ID, outcome: 'SUCCESS', attemptNumber: 1 };

    mockDb.select
      .mockReturnValueOnce(chain([jobRow]))           // job lookup
      .mockReturnValueOnce(chain([{ total: 1 }]))     // count query
      .mockReturnValueOnce(chain([attemptRow]));       // attempts query

    const result = await jobService.getDeliveryAttempts(JOB_ID, { limit: 50, offset: 0 });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: 'da-1' });
  });

  it('applies offset correctly', async () => {
    const jobRow = { id: JOB_ID };
    mockDb.select
      .mockReturnValueOnce(chain([jobRow]))
      .mockReturnValueOnce(chain([{ total: 5 }]))
      .mockReturnValueOnce(chain([])); // offset skipped all results

    const result = await jobService.getDeliveryAttempts(JOB_ID, { limit: 10, offset: 10 });
    expect(result.total).toBe(5);
    expect(result.items).toHaveLength(0);
  });
});
