/**
 * Property-Based Tests for Encryption
 * Feature: platform-improvements, Property 13: Encryption round-trip
 *
 * Validates: Requirements 4.4
 * For any text string and valid encryption key,
 * decryptApiKey(encryptApiKey(text)) === text.
 *
 * Uses fast-check with minimum 100 iterations.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import { encryptApiKey, decryptApiKey } from './encryption';

const NUM_RUNS = 100;

// ── Setup ───────────────────────────────────────────────────────────

beforeAll(() => {
  // Set a valid 64-char hex key (32 bytes) for AES-256-GCM
  process.env.ENCRYPTION_KEY =
    'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2a3b4c5d6a7b8c9d0e1f2';
});

// ── Generators ──────────────────────────────────────────────────────

/** Generate arbitrary non-empty strings that represent API keys or secrets */
const plaintextArb = fc.string({ minLength: 1, maxLength: 500 });

/** Generate ASCII-safe strings (common for API keys) */
const asciiPlaintextArb = fc.stringOf(
  fc.char().filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) <= 126),
  { minLength: 1, maxLength: 200 },
);

// ── Property 13: Encryption Round-Trip ──────────────────────────────

describe('Feature: platform-improvements, Property 13: Encryption round-trip', () => {
  it('decryptApiKey(encryptApiKey(text)) returns the original text', () => {
    fc.assert(
      fc.property(plaintextArb, (plaintext) => {
        const encrypted = encryptApiKey(plaintext);
        const decrypted = decryptApiKey(encrypted);
        expect(decrypted).toBe(plaintext);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('encrypting the same text twice produces different ciphertexts (random IV)', () => {
    fc.assert(
      fc.property(asciiPlaintextArb, (plaintext) => {
        const encrypted1 = encryptApiKey(plaintext);
        const encrypted2 = encryptApiKey(plaintext);
        // Different IVs should produce different ciphertexts
        expect(encrypted1).not.toBe(encrypted2);
        // But both should decrypt to the same value
        expect(decryptApiKey(encrypted1)).toBe(plaintext);
        expect(decryptApiKey(encrypted2)).toBe(plaintext);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
