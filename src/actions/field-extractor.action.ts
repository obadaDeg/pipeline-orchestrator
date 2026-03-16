import { ActionConfig, ActionTransformer, FieldExtractorConfig } from './types.js';

function getNestedValue(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function parsePayload(payload: unknown): Record<string, unknown> | null {
  if (typeof payload === 'object' && payload !== null) {
    return payload as Record<string, unknown>;
  }
  if (typeof payload === 'string') {
    try {
      const parsed = JSON.parse(payload);
      if (typeof parsed === 'object' && parsed !== null) return parsed as Record<string, unknown>;
    } catch {
      // not valid JSON
    }
  }
  return null;
}

export const fieldExtractorAction: ActionTransformer = {
  async execute(payload: unknown, config: ActionConfig): Promise<unknown> {
    const { mapping } = config as FieldExtractorConfig;
    const obj = parsePayload(payload);

    if (obj === null) return {};

    const result: Record<string, unknown> = {};
    for (const [outputKey, sourcePath] of Object.entries(mapping)) {
      result[outputKey] = getNestedValue(obj, sourcePath);
    }
    return result;
  },
};
