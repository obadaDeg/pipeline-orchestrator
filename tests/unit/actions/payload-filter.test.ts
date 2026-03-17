import { describe, it, expect } from 'vitest';
import { payloadFilterAction } from '../../../src/actions/payload-filter.action.js';

describe('payloadFilterAction', () => {
  it('eq operator: returns payload when condition matches', async () => {
    const payload = { status: 'active' };
    const result = await payloadFilterAction.execute(payload, {
      actionType: 'payload_filter',
      field: 'status',
      operator: 'eq',
      value: 'active',
    });
    expect(result).toBe(payload);
  });

  it('eq operator: returns null when condition does not match', async () => {
    const result = await payloadFilterAction.execute(
      { status: 'inactive' },
      { actionType: 'payload_filter', field: 'status', operator: 'eq', value: 'active' },
    );
    expect(result).toBeNull();
  });

  it('ne operator: returns payload when values differ', async () => {
    const payload = { type: 'order' };
    const result = await payloadFilterAction.execute(payload, {
      actionType: 'payload_filter',
      field: 'type',
      operator: 'ne',
      value: 'refund',
    });
    expect(result).toBe(payload);
  });

  it('ne operator: returns null when values are equal', async () => {
    const result = await payloadFilterAction.execute(
      { type: 'refund' },
      { actionType: 'payload_filter', field: 'type', operator: 'ne', value: 'refund' },
    );
    expect(result).toBeNull();
  });

  it('contains operator: returns payload when string contains value', async () => {
    const payload = { message: 'order.created.today' };
    const result = await payloadFilterAction.execute(payload, {
      actionType: 'payload_filter',
      field: 'message',
      operator: 'contains',
      value: 'order.created',
    });
    expect(result).toBe(payload);
  });

  it('contains operator: returns null when string does not contain value', async () => {
    const result = await payloadFilterAction.execute(
      { message: 'payment.failed' },
      { actionType: 'payload_filter', field: 'message', operator: 'contains', value: 'order' },
    );
    expect(result).toBeNull();
  });

  it('returns null for non-JSON string input', async () => {
    const result = await payloadFilterAction.execute('plain text', {
      actionType: 'payload_filter',
      field: 'status',
      operator: 'eq',
      value: 'active',
    });
    expect(result).toBeNull();
  });
});
