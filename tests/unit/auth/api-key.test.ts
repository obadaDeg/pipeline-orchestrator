import { describe, expect, it } from 'vitest';
import { generateApiKey, getKeyPrefix, hashApiKey } from '../../../src/lib/api-key.js';

describe('generateApiKey', () => {
  it('produces a key with the wh_ prefix', () => {
    const { key } = generateApiKey();
    expect(key).toMatch(/^wh_/);
  });

  it('produces a key of reasonable length (>= 40 characters)', () => {
    const { key } = generateApiKey();
    expect(key.length).toBeGreaterThanOrEqual(40);
  });

  it('produces a unique key on each call', () => {
    const a = generateApiKey();
    const b = generateApiKey();
    expect(a.key).not.toBe(b.key);
    expect(a.keyHash).not.toBe(b.keyHash);
  });

  it('returns keyHash as a 64-character hex string', () => {
    const { keyHash } = generateApiKey();
    expect(keyHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('returns keyPrefix matching first 8 characters of the key', () => {
    const { key, keyPrefix } = generateApiKey();
    expect(keyPrefix).toBe(key.slice(0, 8));
  });

  it('keyHash matches hashApiKey(key)', () => {
    const { key, keyHash } = generateApiKey();
    expect(hashApiKey(key)).toBe(keyHash);
  });
});

describe('hashApiKey', () => {
  it('is deterministic — same key always produces same hash', () => {
    const key = 'wh_testkey123456789';
    expect(hashApiKey(key)).toBe(hashApiKey(key));
  });

  it('produces a 64-character lowercase hex string', () => {
    const hash = hashApiKey('wh_anything');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('different keys produce different hashes', () => {
    expect(hashApiKey('wh_key_one')).not.toBe(hashApiKey('wh_key_two'));
  });
});

describe('getKeyPrefix', () => {
  it('returns the first 8 characters', () => {
    expect(getKeyPrefix('wh_ABCDEFGHIJ')).toBe('wh_ABCDE');
  });

  it('works on keys shorter than 8 characters (edge case)', () => {
    expect(getKeyPrefix('abc')).toBe('abc');
  });
});
