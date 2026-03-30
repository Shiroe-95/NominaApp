/**
 * Unit tests for CacheLayer service.
 *
 * Tests the cache-aside pattern, TTL config, graceful degradation,
 * invalidation, and metrics tracking.
 *
 * Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RedisCacheLayer, DEFAULT_CACHE_CONFIG, type CacheLayer } from './cache-layer';

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

function mockUpstashResponse(result: unknown) {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    json: () => Promise.resolve({ result }),
  });
}

function mockUpstashError() {
  mockFetch.mockRejectedValueOnce(new Error('Redis connection failed'));
}

describe('RedisCacheLayer', () => {
  let cache: RedisCacheLayer;

  beforeEach(() => {
    cache = new RedisCacheLayer('test');
    mockFetch.mockReset();
    setUpstashEnv();
  });

  afterEach(() => {
    clearUpstashEnv();
  });

  describe('DEFAULT_CACHE_CONFIG', () => {
    it('has correct TTL values per data type', () => {
      expect(DEFAULT_CACHE_CONFIG.rules.ttlSeconds).toBe(3600);
      expect(DEFAULT_CACHE_CONFIG.dashboard.ttlSeconds).toBe(300);
      expect(DEFAULT_CACHE_CONFIG.providers.ttlSeconds).toBe(900);
      expect(DEFAULT_CACHE_CONFIG.userProfile.ttlSeconds).toBe(600);
    });
  });

  describe('get', () => {
    it('returns parsed value on cache hit', async () => {
      const data = { name: 'test', value: 42 };
      mockUpstashResponse(JSON.stringify(data));

      const result = await cache.get<typeof data>('my-key');
      expect(result).toEqual(data);
      expect(mockFetch).toHaveBeenCalledOnce();
    });

    it('returns null on cache miss', async () => {
      mockUpstashResponse(null);

      const result = await cache.get('missing-key');
      expect(result).toBeNull();
    });

    it('returns null when Redis is unavailable (graceful degradation)', async () => {
      clearUpstashEnv();

      const result = await cache.get('any-key');
      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('returns null on Redis error (graceful degradation)', async () => {
      mockUpstashError();

      const result = await cache.get('any-key');
      expect(result).toBeNull();
    });
  });

  describe('set', () => {
    it('stores value with TTL via SET EX command', async () => {
      mockUpstashResponse('OK');

      await cache.set('my-key', { data: 'hello' }, 300);

      expect(mockFetch).toHaveBeenCalledOnce();
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual(['SET', 'test:my-key', JSON.stringify({ data: 'hello' }), 'EX', '300']);
    });

    it('silently skips when Redis is unavailable', async () => {
      clearUpstashEnv();

      await expect(cache.set('key', 'value', 60)).resolves.toBeUndefined();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not throw on Redis error', async () => {
      mockUpstashError();

      await expect(cache.set('key', 'value', 60)).resolves.toBeUndefined();
    });
  });

  describe('invalidate', () => {
    it('deletes exact key when no wildcard', async () => {
      mockUpstashResponse(1); // DEL returns count

      await cache.invalidate('rules:co:2024');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual(['DEL', 'test:rules:co:2024']);
    });

    it('scans and deletes matching keys for wildcard pattern', async () => {
      // SCAN returns [cursor, keys]
      mockUpstashResponse(['0', ['test:rules:co:2024', 'test:rules:co:2025']]);
      // DEL
      mockUpstashResponse(2);

      await cache.invalidate('rules:co:*');

      expect(mockFetch).toHaveBeenCalledTimes(2);
      const scanBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(scanBody[0]).toBe('SCAN');
      expect(scanBody[3]).toBe('test:rules:co:*');
    });

    it('silently skips when Redis is unavailable', async () => {
      clearUpstashEnv();

      await expect(cache.invalidate('key')).resolves.toBeUndefined();
    });
  });

  describe('getOrFetch', () => {
    it('returns cached value without calling fetcher on hit', async () => {
      const data = { id: 1, name: 'cached' };
      mockUpstashResponse(JSON.stringify(data));

      const fetcher = vi.fn().mockResolvedValue({ id: 1, name: 'fresh' });
      const result = await cache.getOrFetch('key', fetcher, 300);

      expect(result).toEqual(data);
      expect(fetcher).not.toHaveBeenCalled();
    });

    it('calls fetcher and caches result on miss', async () => {
      // GET returns null (miss)
      mockUpstashResponse(null);
      // SET for caching the fetched value
      mockUpstashResponse('OK');

      const freshData = { id: 2, name: 'fresh' };
      const fetcher = vi.fn().mockResolvedValue(freshData);

      const result = await cache.getOrFetch('key', fetcher, 600);

      expect(result).toEqual(freshData);
      expect(fetcher).toHaveBeenCalledOnce();
    });

    it('returns fetcher result when Redis is unavailable', async () => {
      clearUpstashEnv();

      const freshData = { id: 3, name: 'direct' };
      const fetcher = vi.fn().mockResolvedValue(freshData);

      const result = await cache.getOrFetch('key', fetcher, 300);

      expect(result).toEqual(freshData);
      expect(fetcher).toHaveBeenCalledOnce();
    });

    it('returns fetcher result when Redis errors on get', async () => {
      mockUpstashError();

      const freshData = { id: 4, name: 'fallback' };
      const fetcher = vi.fn().mockResolvedValue(freshData);

      // Mock the SET that follows (fire-and-forget)
      mockUpstashResponse('OK');

      const result = await cache.getOrFetch('key', fetcher, 300);

      expect(result).toEqual(freshData);
      expect(fetcher).toHaveBeenCalledOnce();
    });
  });

  describe('metrics', () => {
    it('tracks hits and misses', async () => {
      // Hit
      mockUpstashResponse(JSON.stringify('value'));
      await cache.get('hit-key');

      // Miss
      mockUpstashResponse(null);
      await cache.get('miss-key');

      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(1);
      expect(metrics.misses).toBe(1);
      expect(metrics.operationCount).toBe(2);
    });

    it('tracks errors', async () => {
      mockUpstashError();
      await cache.get('error-key');

      const metrics = cache.getMetrics();
      expect(metrics.errors).toBe(1);
    });

    it('tracks latency', async () => {
      mockUpstashResponse(JSON.stringify('value'));
      await cache.get('key');

      const metrics = cache.getMetrics();
      expect(metrics.totalLatencyMs).toBeGreaterThanOrEqual(0);
      expect(metrics.operationCount).toBe(1);
    });

    it('resets metrics', async () => {
      mockUpstashResponse(JSON.stringify('value'));
      await cache.get('key');

      cache.resetMetrics();
      const metrics = cache.getMetrics();
      expect(metrics.hits).toBe(0);
      expect(metrics.misses).toBe(0);
      expect(metrics.errors).toBe(0);
      expect(metrics.totalLatencyMs).toBe(0);
      expect(metrics.operationCount).toBe(0);
    });
  });

  describe('key prefixing', () => {
    it('prefixes keys with the configured prefix', async () => {
      const customCache = new RedisCacheLayer('myapp');
      mockUpstashResponse(null);

      await customCache.get('some-key');

      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body).toEqual(['GET', 'myapp:some-key']);
    });
  });

  describe('CacheLayer interface', () => {
    it('RedisCacheLayer satisfies CacheLayer interface', () => {
      const layer: CacheLayer = new RedisCacheLayer();
      expect(layer.get).toBeDefined();
      expect(layer.set).toBeDefined();
      expect(layer.invalidate).toBeDefined();
      expect(layer.getOrFetch).toBeDefined();
      expect(layer.getMetrics).toBeDefined();
    });
  });
});
