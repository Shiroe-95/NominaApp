/**
 * TwoLevelCache — 2-level cache wrapping RedisCacheLayer with an in-memory L1 Map.
 *
 * L1: In-process Map with LRU eviction (max 200 entries by default).
 * L2: RedisCacheLayer (Upstash Redis) for distributed cache.
 *
 * Features:
 *  - Composite cache key: `{country}:{year}`
 *  - TTL by rule status: active=3600s, pending_review/draft=300s
 *  - Immediate invalidation on rule update (L1 + L2)
 *  - Graceful degradation: operates with L1 only if Redis unavailable
 *  - Per-level metrics: hit rate, miss rate, latency
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 *
 * @module lib/cache/two-level-cache
 */

import { RedisCacheLayer, type CacheLayer, type CacheMetrics } from './cache-layer';
import type { RuleStatus } from '@/lib/payroll/country-rules-schema';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TwoLevelCacheConfig {
  maxMemoryEntries: number;
  ttlByStatus: {
    active: number;
    pending_review: number;
    draft: number;
  };
}

export interface L1CacheEntry<T = unknown> {
  value: T;
  expiry: number;       // timestamp ms
  accessedAt: number;   // for LRU eviction
  key: string;
}

export interface TwoLevelMetrics {
  l1: CacheMetrics;
  l2: CacheMetrics;
}

// ─── Default config ─────────────────────────────────────────────────────────

export const DEFAULT_TWO_LEVEL_CONFIG: TwoLevelCacheConfig = {
  maxMemoryEntries: 200,
  ttlByStatus: {
    active: 3600,
    pending_review: 300,
    draft: 300,
  },
};

// ─── Implementation ─────────────────────────────────────────────────────────

export class TwoLevelCache implements CacheLayer {
  private l1: Map<string, L1CacheEntry>;
  private l2: RedisCacheLayer;
  private config: TwoLevelCacheConfig;

  private l1Metrics: CacheMetrics = {
    hits: 0, misses: 0, errors: 0, totalLatencyMs: 0, operationCount: 0,
  };

  constructor(
    l2?: RedisCacheLayer,
    config?: Partial<TwoLevelCacheConfig>,
  ) {
    this.l1 = new Map();
    this.l2 = l2 ?? new RedisCacheLayer('rules');
    this.config = { ...DEFAULT_TWO_LEVEL_CONFIG, ...config };
  }

  // ─── Public API ─────────────────────────────────────────────────────────

  /**
   * Build a composite cache key from country code and year.
   */
  static buildKey(country: string, year: number): string {
    return `${country}:${year}`;
  }

  /**
   * Get TTL in seconds based on rule status.
   */
  getTtlForStatus(status: RuleStatus): number {
    return this.config.ttlByStatus[status] ?? this.config.ttlByStatus.draft;
  }

  /**
   * Get a value from cache. Checks L1 first, then L2.
   * Requirement 2.4: L1 + L2 consistency.
   * Requirement 2.5: graceful degradation if Redis unavailable.
   */
  async get<T>(key: string): Promise<T | null> {
    // Try L1 first
    const l1Start = Date.now();
    const l1Entry = this.l1.get(key);

    if (l1Entry) {
      // Check TTL expiry
      if (l1Entry.expiry > Date.now()) {
        // L1 hit — update access time for LRU
        l1Entry.accessedAt = Date.now();
        this.l1Metrics.hits++;
        this.l1Metrics.totalLatencyMs += Date.now() - l1Start;
        this.l1Metrics.operationCount++;
        return l1Entry.value as T;
      }
      // Expired — remove from L1
      this.l1.delete(key);
    }

    this.l1Metrics.misses++;
    this.l1Metrics.totalLatencyMs += Date.now() - l1Start;
    this.l1Metrics.operationCount++;

    // Try L2 (Redis)
    try {
      const l2Value = await this.l2.get<T>(key);
      if (l2Value !== null) {
        // Promote to L1 with a default TTL (we don't know the original TTL,
        // use active TTL as safe default for promoted entries)
        this.setL1(key, l2Value, this.config.ttlByStatus.active);
        return l2Value;
      }
    } catch {
      // Graceful degradation: L2 failure is not fatal
    }

    return null;
  }

  /**
   * Store a value in both L1 and L2.
   * Requirement 2.2: TTL differentiated by rule status.
   * Requirement 2.7: LRU eviction when L1 exceeds maxMemoryEntries.
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    // Set in L1
    this.setL1(key, value, ttlSeconds);

    // Set in L2 (fire-and-forget for graceful degradation)
    try {
      await this.l2.set(key, value, ttlSeconds);
    } catch {
      // Requirement 2.5: graceful degradation — L2 failure is not fatal
    }
  }

  /**
   * Store a value with TTL derived from rule status.
   */
  async setWithStatus<T>(key: string, value: T, status: RuleStatus): Promise<void> {
    const ttl = this.getTtlForStatus(status);
    await this.set(key, value, ttl);
  }

  /**
   * Invalidate a cache entry from both L1 and L2.
   * Requirement 2.3: immediate invalidation on rule update.
   */
  async invalidate(key: string): Promise<void> {
    // Invalidate L1
    this.l1.delete(key);

    // Invalidate L2
    try {
      await this.l2.invalidate(key);
    } catch {
      // Graceful degradation
    }
  }

  /**
   * Cache-aside: get from cache or fetch and store.
   */
  async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== null) return cached;

    const value = await fetcher();
    this.set(key, value, ttlSeconds).catch(() => {});
    return value;
  }

  /**
   * Get combined metrics (L1 + L2).
   * Requirement 2.6: hit rate, miss rate, latency per cache level.
   */
  getMetrics(): CacheMetrics {
    const l2Metrics = this.l2.getMetrics();
    return {
      hits: this.l1Metrics.hits + l2Metrics.hits,
      misses: this.l1Metrics.misses + l2Metrics.misses,
      errors: this.l1Metrics.errors + l2Metrics.errors,
      totalLatencyMs: this.l1Metrics.totalLatencyMs + l2Metrics.totalLatencyMs,
      operationCount: this.l1Metrics.operationCount + l2Metrics.operationCount,
    };
  }

  /**
   * Get per-level metrics for detailed monitoring.
   */
  getLevelMetrics(): TwoLevelMetrics {
    return {
      l1: { ...this.l1Metrics },
      l2: this.l2.getMetrics(),
    };
  }

  /**
   * Reset all metrics.
   */
  resetMetrics(): void {
    this.l1Metrics = {
      hits: 0, misses: 0, errors: 0, totalLatencyMs: 0, operationCount: 0,
    };
    this.l2.resetMetrics();
  }

  /**
   * Get current L1 size (for monitoring/testing).
   */
  getL1Size(): number {
    return this.l1.size;
  }

  /**
   * Get the underlying L1 map (for testing only).
   */
  getL1Map(): Map<string, L1CacheEntry> {
    return this.l1;
  }

  // ─── Private helpers ──────────────────────────────────────────────────

  /**
   * Set a value in L1 with LRU eviction.
   * Requirement 2.7: max 200 entries, evict least recently accessed.
   */
  private setL1<T>(key: string, value: T, ttlSeconds: number): void {
    const now = Date.now();
    const entry: L1CacheEntry<T> = {
      value,
      expiry: now + ttlSeconds * 1000,
      accessedAt: now,
      key,
    };

    // If key already exists, just update it (no eviction needed)
    if (this.l1.has(key)) {
      this.l1.set(key, entry as L1CacheEntry);
      return;
    }

    // Evict LRU entries if at capacity
    while (this.l1.size >= this.config.maxMemoryEntries) {
      this.evictLRU();
    }

    this.l1.set(key, entry as L1CacheEntry);
  }

  /**
   * Evict the least recently accessed entry from L1.
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.l1) {
      if (entry.accessedAt < oldestAccess) {
        oldestAccess = entry.accessedAt;
        oldestKey = key;
      }
    }

    if (oldestKey !== null) {
      this.l1.delete(oldestKey);
    }
  }
}

// ─── Singleton export ───────────────────────────────────────────────────────

export const twoLevelCache = new TwoLevelCache();
