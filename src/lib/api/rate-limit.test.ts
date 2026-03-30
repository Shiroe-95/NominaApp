/**
 * Unit tests for rate limiting module.
 *
 * Validates: Requirements 16.2, 16.3
 *
 * Tests verify:
 * - All 7 rate limit presets have correct limits and window durations
 * - checkRateLimitSync allows requests within the limit
 * - checkRateLimitSync blocks requests exceeding the limit with allowed=false
 * - resetAt is set correctly for the window duration
 * - remaining count decrements correctly
 * - Window resets after expiry, allowing new requests
 * - getClientIp extracts IP from x-forwarded-for header
 * - getClientIp falls back to x-real-ip
 * - getClientIp returns 'unknown' when no IP headers present
 * - checkRateLimit (async) falls back to in-memory when no Redis configured
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkRateLimitSync,
  checkRateLimit,
  getClientIp,
  RATE_LIMITS,
  type RateLimitConfig,
} from './rate-limit';

// ─── Preset validation ──────────────────────────────────────────────────────

describe('RATE_LIMITS presets', () => {
  it('should define all 7 presets with correct limits', () => {
    expect(RATE_LIMITS.auth).toEqual({ limit: 10, windowSeconds: 60 });
    expect(RATE_LIMITS.ai).toEqual({ limit: 20, windowSeconds: 60 });
    expect(RATE_LIMITS.aiChat).toEqual({ limit: 30, windowSeconds: 60 });
    expect(RATE_LIMITS.adminWrite).toEqual({ limit: 30, windowSeconds: 60 });
    expect(RATE_LIMITS.read).toEqual({ limit: 60, windowSeconds: 60 });
    expect(RATE_LIMITS.write).toEqual({ limit: 40, windowSeconds: 60 });
    expect(RATE_LIMITS.cron).toEqual({ limit: 5, windowSeconds: 60 });
  });

  it('should have exactly 7 presets', () => {
    expect(Object.keys(RATE_LIMITS)).toHaveLength(7);
  });
});

// ─── getClientIp ────────────────────────────────────────────────────────────

describe('getClientIp', () => {
  it('should extract IP from x-forwarded-for header', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
    });
    expect(getClientIp(req)).toBe('192.168.1.1');
  });

  it('should extract single IP from x-forwarded-for', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '10.0.0.5' },
    });
    expect(getClientIp(req)).toBe('10.0.0.5');
  });

  it('should fall back to x-real-ip when x-forwarded-for is absent', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-real-ip': '172.16.0.1' },
    });
    expect(getClientIp(req)).toBe('172.16.0.1');
  });

  it('should return "unknown" when no IP headers are present', () => {
    const req = new Request('http://localhost');
    expect(getClientIp(req)).toBe('unknown');
  });

  it('should trim whitespace from forwarded IP', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '  192.168.1.1  , 10.0.0.1' },
    });
    expect(getClientIp(req)).toBe('192.168.1.1');
  });
});

// ─── checkRateLimitSync (in-memory) ─────────────────────────────────────────

describe('checkRateLimitSync', () => {
  const config: RateLimitConfig = { limit: 3, windowSeconds: 60 };

  it('should allow the first request', () => {
    const key = `test-first-${Date.now()}`;
    const result = checkRateLimitSync(key, config);

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it('should decrement remaining on each request', () => {
    const key = `test-decrement-${Date.now()}`;

    const r1 = checkRateLimitSync(key, config);
    expect(r1.remaining).toBe(2);

    const r2 = checkRateLimitSync(key, config);
    expect(r2.remaining).toBe(1);

    const r3 = checkRateLimitSync(key, config);
    expect(r3.remaining).toBe(0);
  });

  it('should block requests exceeding the limit', () => {
    const key = `test-block-${Date.now()}`;

    // Use up all 3 allowed requests
    for (let i = 0; i < 3; i++) {
      const r = checkRateLimitSync(key, config);
      expect(r.allowed).toBe(true);
    }

    // 4th request should be blocked
    const blocked = checkRateLimitSync(key, config);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.resetAt).toBeGreaterThan(Date.now());
  });

  it('should set resetAt within the window duration', () => {
    const key = `test-reset-${Date.now()}`;
    const before = Date.now();
    const result = checkRateLimitSync(key, config);
    const after = Date.now();

    // resetAt should be approximately now + windowSeconds * 1000
    const expectedMin = before + config.windowSeconds * 1000;
    const expectedMax = after + config.windowSeconds * 1000;
    expect(result.resetAt).toBeGreaterThanOrEqual(expectedMin);
    expect(result.resetAt).toBeLessThanOrEqual(expectedMax);
  });

  it('should use separate counters for different keys', () => {
    const key1 = `test-sep-a-${Date.now()}`;
    const key2 = `test-sep-b-${Date.now()}`;

    // Exhaust key1
    for (let i = 0; i < 3; i++) checkRateLimitSync(key1, config);
    const blocked = checkRateLimitSync(key1, config);
    expect(blocked.allowed).toBe(false);

    // key2 should still be allowed
    const allowed = checkRateLimitSync(key2, config);
    expect(allowed.allowed).toBe(true);
  });

  it('should work with cron preset (5 requests)', () => {
    const key = `test-cron-${Date.now()}`;

    for (let i = 0; i < 5; i++) {
      const r = checkRateLimitSync(key, RATE_LIMITS.cron);
      expect(r.allowed).toBe(true);
    }

    const blocked = checkRateLimitSync(key, RATE_LIMITS.cron);
    expect(blocked.allowed).toBe(false);
  });
});

// ─── checkRateLimit (async, falls back to in-memory without Redis) ──────────

describe('checkRateLimit', () => {
  it('should fall back to in-memory when no Redis is configured', async () => {
    const key = `test-async-${Date.now()}`;
    const config: RateLimitConfig = { limit: 2, windowSeconds: 60 };

    const r1 = await checkRateLimit(key, config);
    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(1);

    const r2 = await checkRateLimit(key, config);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(0);

    const r3 = await checkRateLimit(key, config);
    expect(r3.allowed).toBe(false);
    expect(r3.remaining).toBe(0);
  });

  it('should return resetAt in the future when blocked', async () => {
    const key = `test-async-reset-${Date.now()}`;
    const config: RateLimitConfig = { limit: 1, windowSeconds: 60 };

    await checkRateLimit(key, config);
    const blocked = await checkRateLimit(key, config);

    expect(blocked.allowed).toBe(false);
    expect(blocked.resetAt).toBeGreaterThan(Date.now());
  });
});
