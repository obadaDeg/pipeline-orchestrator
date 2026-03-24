import { config } from '../config.js';

export interface DeliveryResult {
  httpStatus: number | null;
  responseSnippet: string | null;
  responseTimeMs: number | null;
  success: boolean;
}

export async function deliverPayload(url: string, body: unknown): Promise<DeliveryResult> {
  const start = Date.now();
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(config.DELIVERY_TIMEOUT_MS),
    });

    const responseTimeMs = Date.now() - start;
    const text = await response.text();
    const responseSnippet = text.length > 0 ? text.slice(0, 500) : null;

    return {
      httpStatus: response.status,
      responseSnippet,
      responseTimeMs,
      success: response.ok,
    };
  } catch {
    // Network error, timeout, or AbortError
    return { httpStatus: null, responseSnippet: null, responseTimeMs: null, success: false };
  }
}
