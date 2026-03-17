import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { EnricherError, httpEnricherAction } from '../../../src/actions/http-enricher.action.js';

describe('httpEnricherAction', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetAllMocks();
  });

  function mockResponse(body: unknown, status = 200) {
    mockFetch.mockResolvedValueOnce({
      ok: status >= 200 && status < 300,
      status,
      json: vi.fn().mockResolvedValueOnce(body),
    });
  }

  it('merges response into payload at root level', async () => {
    mockResponse({ extra: 'data', score: 99 });
    const result = await httpEnricherAction.execute(
      { original: 'value' },
      { actionType: 'http_enricher', url: 'https://example.com/enrich' },
    );
    expect(result).toEqual({ original: 'value', extra: 'data', score: 99 });
  });

  it('merges response into payload at mergeKey', async () => {
    mockResponse({ enriched: true, rank: 1 });
    const result = await httpEnricherAction.execute(
      { id: 1 },
      { actionType: 'http_enricher', url: 'https://example.com/enrich', mergeKey: 'meta' },
    );
    expect(result).toEqual({ id: 1, meta: { enriched: true, rank: 1 } });
  });

  it('throws EnricherError on non-2xx response', async () => {
    mockResponse({ error: 'Not Found' }, 404);
    await expect(
      httpEnricherAction.execute(
        { id: 1 },
        { actionType: 'http_enricher', url: 'https://example.com/enrich' },
      ),
    ).rejects.toThrow(EnricherError);
  });

  it('throws EnricherError on network error', async () => {
    mockFetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    await expect(
      httpEnricherAction.execute(
        { id: 1 },
        { actionType: 'http_enricher', url: 'https://example.com/enrich' },
      ),
    ).rejects.toThrow(EnricherError);
  });
});
