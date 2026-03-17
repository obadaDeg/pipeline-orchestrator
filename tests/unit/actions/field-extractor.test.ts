import { describe, it, expect } from 'vitest';
import { fieldExtractorAction } from '../../../src/actions/field-extractor.action.js';

describe('fieldExtractorAction', () => {
  it('extracts a basic top-level field', async () => {
    const result = await fieldExtractorAction.execute(
      { name: 'Alice' },
      { actionType: 'field_extractor', mapping: { output: 'name' } },
    );
    expect(result).toEqual({ output: 'Alice' });
  });

  it('extracts nested field via dot-notation path', async () => {
    const result = await fieldExtractorAction.execute(
      { user: { id: 42 } },
      { actionType: 'field_extractor', mapping: { userId: 'user.id' } },
    );
    expect(result).toEqual({ userId: 42 });
  });

  it('returns undefined for a missing source path', async () => {
    const result = (await fieldExtractorAction.execute(
      { a: 1 },
      { actionType: 'field_extractor', mapping: { x: 'b.c' } },
    )) as Record<string, unknown>;
    expect(result.x).toBeUndefined();
  });

  it('maps multiple fields simultaneously', async () => {
    const result = await fieldExtractorAction.execute(
      { a: 1, b: 2, c: 3 },
      { actionType: 'field_extractor', mapping: { x: 'a', y: 'b' } },
    );
    expect(result).toEqual({ x: 1, y: 2 });
  });

  it('returns empty object for non-JSON string input', async () => {
    const result = await fieldExtractorAction.execute(
      'not valid json',
      { actionType: 'field_extractor', mapping: { x: 'a' } },
    );
    expect(result).toEqual({});
  });

  it('parses a JSON string payload before extracting', async () => {
    const result = await fieldExtractorAction.execute(
      '{"event":"order.created","id":"123"}',
      { actionType: 'field_extractor', mapping: { ev: 'event', id: 'id' } },
    );
    expect(result).toEqual({ ev: 'order.created', id: '123' });
  });
});
