import { ActionConfig, ActionTransformer, PayloadFilterConfig } from './types.js';

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

function evaluateCondition(
  fieldValue: unknown,
  operator: 'eq' | 'ne' | 'contains',
  value: unknown,
): boolean {
  switch (operator) {
    case 'eq':
      return fieldValue === value;
    case 'ne':
      return fieldValue !== value;
    case 'contains':
      return typeof fieldValue === 'string' && typeof value === 'string'
        ? fieldValue.includes(value)
        : false;
  }
}

export const payloadFilterAction: ActionTransformer = {
  async execute(payload: unknown, config: ActionConfig): Promise<unknown | null> {
    const { field, operator, value } = config as PayloadFilterConfig;
    const obj = parsePayload(payload);

    if (obj === null) return null; // non-JSON payload → filter out

    const fieldValue = getNestedValue(obj, field);
    const passes = evaluateCondition(fieldValue, operator, value);

    return passes ? payload : null; // null = no delivery
  },
};
