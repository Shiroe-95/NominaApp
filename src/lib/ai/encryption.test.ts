import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { encryptApiKey, decryptApiKey } from './encryption';

// Use a fixed 64-char hex key for tests (32 bytes)
const TEST_KEY = 'a'.repeat(64);

describe('encryption', () => {
  const originalEnv = process.env.ENCRYPTION_KEY;

  beforeAll(() => {
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });

  afterAll(() => {
    if (originalEnv !== undefined) {
      process.env.ENCRYPTION_KEY = originalEnv;
    } else {
      delete process.env.ENCRYPTION_KEY;
    }
  });

  it('round-trips a simple API key', () => {
    const key = 'sk-test-1234567890abcdef';
    const encrypted = encryptApiKey(key);
    expect(decryptApiKey(encrypted)).toBe(key);
  });

  it('produces different ciphertext for the same plaintext (random IV)', () => {
    const key = 'sk-test-1234567890abcdef';
    const a = encryptApiKey(key);
    const b = encryptApiKey(key);
    expect(a).not.toBe(b);
  });

  it('output is valid base64', () => {
    const encrypted = encryptApiKey('some-api-key-value');
    expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
    // Re-encoding should match (no invalid chars)
    const buf = Buffer.from(encrypted, 'base64');
    expect(buf.toString('base64')).toBe(encrypted);
  });

  it('throws when ENCRYPTION_KEY is missing', () => {
    const saved = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => encryptApiKey('test')).toThrow('ENCRYPTION_KEY');
    process.env.ENCRYPTION_KEY = saved;
  });

  it('handles non-hex ENCRYPTION_KEY by hashing it', () => {
    const saved = process.env.ENCRYPTION_KEY;
    process.env.ENCRYPTION_KEY = 'my-secret-passphrase';
    const encrypted = encryptApiKey('sk-key-12345');
    expect(decryptApiKey(encrypted)).toBe('sk-key-12345');
    process.env.ENCRYPTION_KEY = saved;
  });

  it('fails to decrypt with wrong key', () => {
    const encrypted = encryptApiKey('sk-secret');
    process.env.ENCRYPTION_KEY = 'b'.repeat(64);
    expect(() => decryptApiKey(encrypted)).toThrow();
    process.env.ENCRYPTION_KEY = TEST_KEY;
  });
});
