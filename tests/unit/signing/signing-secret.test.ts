import { describe, expect, it } from 'vitest';
import {
  FUTURE_TOLERANCE_MS,
  TIMESTAMP_TOLERANCE_MS,
  generateSigningSecret,
  verifyHmac,
} from '../../../src/lib/signing-secret.js';
import { createHmac } from 'node:crypto';

describe('generateSigningSecret', () => {
  it('returns a secret with the whsec_ prefix', () => {
    const { secret } = generateSigningSecret();
    expect(secret).toMatch(/^whsec_/);
  });

  it('returns a secret of reasonable length', () => {
    const { secret } = generateSigningSecret();
    // prefix (6) + 32 bytes base64url (~43 chars) = ~49 chars
    expect(secret.length).toBeGreaterThanOrEqual(40);
  });

  it('returns a secretHint equal to the first 6 characters', () => {
    const { secret, secretHint } = generateSigningSecret();
    expect(secretHint).toBe(secret.slice(0, 6));
  });

  it('generates unique secrets on each call', () => {
    const a = generateSigningSecret();
    const b = generateSigningSecret();
    expect(a.secret).not.toBe(b.secret);
  });
});

describe('TIMESTAMP constants', () => {
  it('TIMESTAMP_TOLERANCE_MS is 5 minutes', () => {
    expect(TIMESTAMP_TOLERANCE_MS).toBe(5 * 60 * 1000);
  });

  it('FUTURE_TOLERANCE_MS is 1 minute', () => {
    expect(FUTURE_TOLERANCE_MS).toBe(60 * 1000);
  });
});

describe('verifyHmac', () => {
  const secret = 'whsec_testsecret';
  const timestamp = '1700000000';
  const body = '{"event":"test"}';

  function makeSignature(s: string, t: string, b: string): string {
    return 'sha256=' + createHmac('sha256', s).update(`${t}.${b}`).digest('hex');
  }

  it('returns true for a valid signature', () => {
    const sig = makeSignature(secret, timestamp, body);
    expect(verifyHmac(secret, timestamp, body, sig)).toBe(true);
  });

  it('returns false when signature header lacks sha256= prefix', () => {
    const raw = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
    expect(verifyHmac(secret, timestamp, body, raw)).toBe(false);
  });

  it('returns false when the body is tampered', () => {
    const sig = makeSignature(secret, timestamp, body);
    expect(verifyHmac(secret, timestamp, '{"event":"hacked"}', sig)).toBe(false);
  });

  it('returns false when the timestamp is tampered', () => {
    const sig = makeSignature(secret, timestamp, body);
    expect(verifyHmac(secret, '9999999999', body, sig)).toBe(false);
  });

  it('returns false when the secret is wrong', () => {
    const sig = makeSignature('whsec_wrong', timestamp, body);
    expect(verifyHmac(secret, timestamp, body, sig)).toBe(false);
  });

  it('accepts an empty body with a valid signature', () => {
    const sig = makeSignature(secret, timestamp, '');
    expect(verifyHmac(secret, timestamp, '', sig)).toBe(true);
  });
});
