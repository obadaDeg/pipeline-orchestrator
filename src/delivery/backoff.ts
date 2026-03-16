/**
 * Calculate exponential backoff with up to 25% random jitter.
 * Formula: base * 2^(attemptNumber - 1) + jitter
 *
 * @param attemptNumber - 1-indexed attempt number
 * @param baseMs - base delay in milliseconds
 */
export function calculateBackoff(attemptNumber: number, baseMs: number): number {
  const exponential = baseMs * Math.pow(2, attemptNumber - 1);
  const jitter = exponential * 0.25 * Math.random();
  return Math.round(exponential + jitter);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
