/**
 * Property-Based Tests for TwoLevelCache
 * Feature: platform-improvements
 *
 * Tests Properties 5, 6, 7, 8, 9, 10 from the design document.
 * Uses fast-check with minimum 100 iterations per property.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { TwoLevelCache, DEFAULT_TWO_LEVEL_CONFIG } from './two-level-cache';
import { RedisCacheLayer } from './cache-layer';
import type { RuleStatus } from '@/lib/payroll/country-rules-schema';
import { SUPPORTED_COUNTRY_CODES, RULE_STATUSES } from '@/lib/payroll/country-rules-schema';

const NUM_RUNS = 100;

// ─── Mock fetch for Upstash REST API ────────────────────────────────────────

const mockFetch = vi.fn();
global.fetch = mockFetch;

function setUpstashEnv() {
  process.env.UPSTASH_REDIS_REST_URL = 'https://fake-redis.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'fake-token';
}

function clearUpstashEnv() {
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
}

// Simple in-memory store to simulate Redis behavior for L2
const redisStore = new Map<string, { value: string; expiresAt: number }>();

function mockRedisForL2() {
  mockFetch.mockImplementation(async (_url: string, options: { body: string }) => {
    const cmd = JSON.parse(options.body) as string[];
    const command = cmd[0];

    if (command === 'GET') {
      const entry = redisStore.get(cmd[1]);
      if (entry && entry.expiresAt > Date.now()) {
        return { ok: true, json: () => Promise.resolve({ result: entry.value }) };
      }
      return { ok: true, json: () => Promise.resolve({ result: null }) };
    }

    if (command === 'SET') {
      const ttlMs = parseInt(cmd[4]) * 1000;
      redisStore.set(cmd[1], { value: cmd[2], expiresAt: Date.now() + ttlMs });
      return { ok: true, json: () => Promise.resolve({ result: 'OK' }) };
    }

    if (command === 'DEL') {
      for (let i = 1; i < cmd.length; i++) {
        redisStore.delete(cmd[i]);
      }
      return { ok: true, json: () => Promise.resolve({ result: cmd.length - 1 }) };
    }

    if (command === 'SCAN') {
      return { ok: true, json: () => Promise.resolve({ result: ['0', []] }) };
    }

    return { ok: true, json: () => Promise.resolve({ result: null }) };
  });
}

// ─── Generators ─────────────────────────────────────────────────────────────

const countryCodeArb = fc.constantFrom(...SUPPORTED_COUNTRY_CODES);
const yearArb = fc.integer({ min: 2020, max: 2030 });
const ruleStatusArb = fc.constantFrom(...RULE_STATUSES);

interface TestRule {
  country_code: string;
  rule_year: number;
  label: string;
  required_fields: string[];
  required_calculations: string[];
  checks: string[];
  status: RuleStatus;
}

const ruleDataArb: fc.Arbitrary<TestRule> = fc.record({
  country_code: countryCodeArb,
  rule_year: yearArb,
  label: fc.string({ minLength: 1, maxLength: 100 }),
  required_fields: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 1, maxLength: 5 }),
  required_calculations: fc.array(fc.string({ minLength: 1, maxLength: 30 }), { minLength: 0, maxLength: 5 }),
  checks: fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 0, maxLength: 5 }),
  status: ruleStatusArb,
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('TwoLevelCache PBT', () => {
  let cache: TwoLevelCache;

  beforeEach(() => {
    redisStore.clear();
    mockFetch.mockReset();
    setUpstashEnv();
    mockRedisForL2();
    cache = new TwoLevelCache(new RedisCacheLayer('test-rules'));
  });

  afterEach(() => {
    clearUpstashEnv();
  });

  /**
   * Property 5: Cache round-trip with composite key country+year
   *
   * For any valid rule with country and year, storing it in cache with
   * key `{country}:{year}` and then retrieving it must produce an
   * equivalent object to the original.
   *
   * **Validates: Requirements 2.1**
   */
  it('Property 5: round-trip with composite key country+year', () => {
    fc.assert(
      fc.asyncProperty(ruleDataArb, async (rule: TestRule) => {
        const key = TwoLevelCache.buildKey(rule.country_code, rule.rule_year);
        const ttl = cache.getTtlForStatus(rule.status);

        await cache.set(key, rule, ttl);
        const retrieved = await cache.get(key);

        expect(retrieved).toEqual(rule);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 6: Cache assigns correct TTL by rule status
   *
   * For any rule, if status is "active" TTL must be 3600s,
   * if "pending_review" or "draft" TTL must be 300s.
   *
   * **Validates: Requirements 2.2**
   */
  it('Property 6: correct TTL by rule status', () => {
    fc.assert(
      fc.property(ruleStatusArb, (status: RuleStatus) => {
        const ttl = cache.getTtlForStatus(status);

        if (status === 'active') {
          expect(ttl).toBe(3600);
        } else {
          // pending_review or draft
          expect(ttl).toBe(300);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 7: Cache invalidates entry on rule update
   *
   * For any cached rule, if the rule is updated (invalidated),
   * a subsequent get must return null (cache miss).
   *
   * **Validates: Requirements 2.3**
   */
  it('Property 7: invalidation on rule update', () => {
    fc.assert(
      fc.asyncProperty(ruleDataArb, async (rule: TestRule) => {
        const key = TwoLevelCache.buildKey(rule.country_code, rule.rule_year);
        const ttl = cache.getTtlForStatus(rule.status);

        // Store the rule
        await cache.set(key, rule, ttl);

        // Verify it's cached
        const beforeInvalidation = await cache.get(key);
        expect(beforeInvalidation).toEqual(rule);

        // Invalidate (simulating rule update)
        await cache.invalidate(key);

        // Must be a cache miss now
        const afterInvalidation = await cache.get(key);
        expect(afterInvalidation).toBeNull();
      }),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 8: L1 and L2 consistency
   *
   * For any value stored in the 2-level cache, it must be retrievable
   * from L1 (memory) first, and if L1 doesn't have it, from L2 (Redis),
   * producing the same value in both cases.
   *
   * **Validates: Requirements 2.4**
   */
  it('Property 8: L1 and L2 consistency', () => {
    fc.assert(
      fc.asyncProperty(ruleDataArb, async (rule: TestRule) => {
        const key = TwoLevelCache.buildKey(rule.country_code, rule.rule_year);
        const ttl = cache.getTtlForStatus(rule.status);

        // Store in both levels
        await cache.set(key, rule, ttl);

        // Read from L1 (should be a hit)
        const fromL1 = await cache.get(key);
        expect(fromL1).toEqual(rule);

        // Remove from L1 only to force L2 read
        cache.getL1Map().delete(key);

        // Read from L2 (should be promoted back to L1)
        const fromL2 = await cache.get(key);
        expect(fromL2).toEqual(rule);

        // Both should be equal
        expect(fromL1).toEqual(fromL2);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 9: Cache metrics reflect operations
   *
   * For any sequence of get/set operations, the metrics reported
   * (hits + misses + errors) must equal the total number of get operations.
   *
   * **Validates: Requirements 2.6**
   */
  it('Property 9: metrics reflect operations (hits + misses = total ops)', () => {
    fc.assert(
      fc.asyncProperty(
        fc.array(ruleDataArb, { minLength: 1, maxLength: 20 }),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 20 }),
        async (rules: TestRule[], readBeforeWrite: boolean[]) => {
          // Fresh cache for each run
          redisStore.clear();
          mockFetch.mockReset();
          setUpstashEnv();
          mockRedisForL2();
          const testCache = new TwoLevelCache(new RedisCacheLayer('test-metrics'));

          let getOps = 0;

          for (let i = 0; i < rules.length; i++) {
            const rule = rules[i];
            const key = TwoLevelCache.buildKey(rule.country_code, rule.rule_year);
            const ttl = testCache.getTtlForStatus(rule.status);

            // Optionally read before write (will be a miss)
            if (readBeforeWrite[i % readBeforeWrite.length]) {
              await testCache.get(key);
              getOps++;
            }

            // Write
            await testCache.set(key, rule, ttl);

            // Read (should be a hit)
            await testCache.get(key);
            getOps++;
          }

          const metrics = testCache.getLevelMetrics();
          const l1Total = metrics.l1.hits + metrics.l1.misses + metrics.l1.errors;

          // L1 operations should equal the number of get operations
          expect(l1Total).toBe(getOps);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  /**
   * Property 10: LRU eviction when exceeding 200 entries in L1
   *
   * For any sequence of insertions exceeding 200 entries in L1,
   * L1 size must never exceed 200, and the evicted entry must be
   * the least recently accessed.
   *
   * **Validates: Requirements 2.7**
   */
  it('Property 10: LRU eviction at 200 entries', () => {
    fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 201, max: 250 }),
        async (totalEntries: number) => {
          // Fresh cache with small max for faster testing
          const maxEntries = 200;
          const testCache = new TwoLevelCache(
            new RedisCacheLayer('test-lru'),
            { maxMemoryEntries: maxEntries },
          );

          // Insert entries with unique keys
          for (let i = 0; i < totalEntries; i++) {
            const key = `LRU:${i}`;
            await testCache.set(key, { index: i }, 3600);
          }

          // L1 size must never exceed maxMemoryEntries
          expect(testCache.getL1Size()).toBeLessThanOrEqual(maxEntries);
          expect(testCache.getL1Size()).toBe(maxEntries);

          // The earliest entries (least recently accessed) should be evicted
          // The last `maxEntries` entries should still be in L1
          const l1Map = testCache.getL1Map();
          for (let i = totalEntries - maxEntries; i < totalEntries; i++) {
            expect(l1Map.has(`LRU:${i}`)).toBe(true);
          }

          // The first entries should have been evicted
          for (let i = 0; i < totalEntries - maxEntries; i++) {
            expect(l1Map.has(`LRU:${i}`)).toBe(false);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
