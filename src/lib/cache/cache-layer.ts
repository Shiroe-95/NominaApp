/**
 * CacheLayer — Cache-aside pattern with Upstash Redis and graceful degradation.
 *
 * Uses the Upstash REST API directly (same pattern as rate-limit.ts).
 * Falls back to direct DB/fetcher calls when Redis is unavailable.
 *
 * Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7
 *
 * @module lib/cache/cache-layer
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CacheConfig {
  rules: { ttlSeconds: number };
  dashboard: { ttlSeconds: number };
  providers: { ttlSeconds: number };
  userProfile: { ttlSeconds: number };
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  errors: number;
  totalLatencyMs: number;
  operationCount: number;
}

export interface CacheLayer {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds: number): Promise<void>;
  invalidate(pattern: string): Promise<void>;
  getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number): Promise<T>;
  getMetrics(): CacheMetrics;
  resetMetrics(): void;
}

// ─── Default TTL config ─────────────────────────────────────────────────────

export const DEFAULT_CACHE_CONFIG: CacheConfig = {
  rules: { ttlSeconds: 3600 },       // 1 hour
  dashboard: { ttlSeconds: 300 },     // 5 minutes
  providers: { ttlSeconds: 900 },     // 15 minutes
  userProfile: { ttlSeconds: 600 },   // 10 minutes
};

// ─── Upstash Redis REST client ──────────────────────────────────────────────

interface UpstashConfig {
  url: string;
  token: string;
}

function getUpstashConfig(): UpstashConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return { url, token };
  return null;
}

async function upstashCommand(
  config: UpstashConfig,
  command: string[],
): Promise<{ result: unknown }> {
  const res = await fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Upstash error: ${res.status}`);
  return res.json() as Promise<{ result: unknown }>;
}

// ─── Implementation ─────────────────────────────────────────────────────────

export class RedisCacheLayer implements CacheLayer {
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    errors: 0,
    totalLatencyMs: 0,
    operationCount: 0,
  };

  private readonly keyPrefix: string;

  constructor(keyPrefix = 'cache') {
    this.keyPrefix = keyPrefix;
  }

  private fullKey(key: string): string {
    return `${this.keyPrefix}:${key}`;
  }

  private trackLatency(startMs: number): void {
    this.metrics.totalLatencyMs += Date.now() - startMs;
    this.metrics.operationCount++;
  }

  /**
   * Get a value from cache. Returns null on miss or Redis unavailability.
   * Requirement 22.4 (cache-aside: check cache first)
   */
  async get<T>(key: string): Promise<T | null> {
    const start = Date.now();
    const config = getUpstashConfig();

    if (!config) {
      // Requirement 22.5: graceful degradation — no Redis, return null
      this.metrics.misses++;
      this.trackLatency(start);
      return null;
    }

    try {
      const { result } = await upstashCommand(config, ['GET', this.fullKey(key)]);

      if (result === null || result === undefined) {
        this.metrics.misses++;
        this.trackLatency(start);
        return null;
      }

      this.metrics.hits++;
      this.trackLatency(start);
      return JSON.parse(result as string) as T;
    } catch {
      // Requirement 22.5: fallback — treat Redis errors as cache miss
      this.metrics.errors++;
      this.metrics.misses++;
      this.trackLatency(start);
      return null;
    }
  }

  /**
   * Store a value in cache with TTL.
   * Requirement 22.7 (configurable TTL per data type)
   */
  async set<T>(key: string, value: T, ttlSeconds: number): Promise<void> {
    const start = Date.now();
    const config = getUpstashConfig();

    if (!config) {
      // Requirement 22.5: graceful degradation — silently skip
      this.trackLatency(start);
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      await upstashCommand(config, ['SET', this.fullKey(key), serialized, 'EX', String(ttlSeconds)]);
      this.trackLatency(start);
    } catch {
      // Requirement 22.5: don't throw on Redis failure
      this.metrics.errors++;
      this.trackLatency(start);
    }
  }

  /**
   * Invalidate cache entries matching a pattern.
   * Requirement 22.3 (immediate invalidation on data update)
   */
  async invalidate(pattern: string): Promise<void> {
    const start = Date.now();
    const config = getUpstashConfig();

    if (!config) {
      this.trackLatency(start);
      return;
    }

    try {
      const fullPattern = this.fullKey(pattern);

      // If pattern contains wildcard, scan and delete matching keys
      if (fullPattern.includes('*')) {
        let cursor = '0';
        do {
          const scanResult = await upstashCommand(config, ['SCAN', cursor, 'MATCH', fullPattern, 'COUNT', '100']);
          const result = scanResult.result as [string, string[]];
          cursor = result[0];
          const keys = result[1];
          if (keys.length > 0) {
            await upstashCommand(config, ['DEL', ...keys]);
          }
        } while (cursor !== '0');
      } else {
        // Exact key deletion
        await upstashCommand(config, ['DEL', fullPattern]);
      }

      this.trackLatency(start);
    } catch {
      this.metrics.errors++;
      this.trackLatency(start);
    }
  }

  /**
   * Cache-aside: get from cache, or fetch and store.
   * Requirement 22.4 (cache-aside pattern)
   */
  async getOrFetch<T>(key: string, fetcher: () => Promise<T>, ttlSeconds: number): Promise<T> {
    // Try cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    // Cache miss — fetch from source
    const value = await fetcher();

    // Store in cache (fire-and-forget, don't block on cache write)
    this.set(key, value, ttlSeconds).catch(() => {
      // Silently ignore cache write failures
    });

    return value;
  }

  /**
   * Get current cache metrics for monitoring.
   * Requirement 22.6 (hit rate and latency metrics)
   */
  getMetrics(): CacheMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics counters.
   */
  resetMetrics(): void {
    this.metrics = {
      hits: 0,
      misses: 0,
      errors: 0,
      totalLatencyMs: 0,
      operationCount: 0,
    };
  }
}

// ─── Singleton export ───────────────────────────────────────────────────────

export const cacheLayer = new RedisCacheLayer();
