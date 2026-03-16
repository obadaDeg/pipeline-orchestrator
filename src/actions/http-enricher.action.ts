import { config } from '../config.js';
import { AppError } from '../lib/errors.js';
import { ActionConfig, ActionTransformer, HttpEnricherConfig } from './types.js';

export class EnricherError extends AppError {
  constructor(message: string) {
    super(500, 'ENRICHER_ERROR', message);
    this.name = 'EnricherError';
  }
}

export const httpEnricherAction: ActionTransformer = {
  async execute(payload: unknown, actionConfig: ActionConfig): Promise<unknown> {
    const { url, mergeKey } = actionConfig as HttpEnricherConfig;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(config.DELIVERY_TIMEOUT_MS),
      });
    } catch (err) {
      throw new EnricherError(
        `Network error: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }

    if (!response.ok) {
      throw new EnricherError(`Enricher URL returned non-2xx status: ${response.status}`);
    }

    let responseData: unknown;
    try {
      responseData = await response.json();
    } catch {
      throw new EnricherError('Enricher response could not be parsed as JSON');
    }

    // Merge response into payload
    const baseObj =
      typeof payload === 'object' && payload !== null
        ? (payload as Record<string, unknown>)
        : {};

    if (mergeKey) {
      return { ...baseObj, [mergeKey]: responseData };
    }

    if (typeof responseData !== 'object' || responseData === null) {
      throw new EnricherError('Enricher response must be a JSON object for root-level merge');
    }

    return { ...baseObj, ...(responseData as Record<string, unknown>) };
  },
};
