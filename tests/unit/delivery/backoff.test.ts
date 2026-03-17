import { describe, expect, it } from 'vitest';
import { calculateBackoff, sleep } from '../../../src/delivery/backoff.js';

describe('calculateBackoff', () => {
  const BASE_MS = 1000;
  const MAX_JITTER = 0.25;

  it('returns approximately baseMs for attempt 1', () => {
    const result = calculateBackoff(1, BASE_MS);
    expect(result).toBeGreaterThanOrEqual(BASE_MS);
    expect(result).toBeLessThanOrEqual(Math.ceil(BASE_MS * (1 + MAX_JITTER)));
  });

  it('returns approximately 2 * baseMs for attempt 2', () => {
    const result = calculateBackoff(2, BASE_MS);
    expect(result).toBeGreaterThanOrEqual(BASE_MS * 2);
    expect(result).toBeLessThanOrEqual(Math.ceil(BASE_MS * 2 * (1 + MAX_JITTER)));
  });

  it('returns approximately 4 * baseMs for attempt 3', () => {
    const result = calculateBackoff(3, BASE_MS);
    expect(result).toBeGreaterThanOrEqual(BASE_MS * 4);
    expect(result).toBeLessThanOrEqual(Math.ceil(BASE_MS * 4 * (1 + MAX_JITTER)));
  });

  it('each result is within 25% jitter of the base exponential', () => {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const exponential = BASE_MS * Math.pow(2, attempt - 1);
      const result = calculateBackoff(attempt, BASE_MS);
      expect(result).toBeGreaterThanOrEqual(exponential);
      expect(result).toBeLessThanOrEqual(Math.ceil(exponential * (1 + MAX_JITTER)));
    }
  });
});

describe('sleep', () => {
  it('resolves immediately for 0ms', async () => {
    const start = Date.now();
    await sleep(0);
    expect(Date.now() - start).toBeLessThan(50);
  });
});
