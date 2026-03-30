/**
 * MetricsCollector — API latency, error rates, Web Vitals, structured logging,
 * and cache hit rate monitoring.
 *
 * Requirements: 34.1, 34.3, 34.5, 34.6, 19.5
 *
 * @module lib/monitoring/metrics-collector
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface APIMetricEntry {
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  timestamp: number;
}

export interface PercentileStats {
  p50: number;
  p95: number;
  p99: number;
  count: number;
  errorRate: number;
  requestsPerSecond: number;
}

export interface WebVitalEntry {
  name: 'LCP' | 'FID' | 'CLS';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
  pathname?: string;
}

export interface StructuredLogEntry {
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  requestId: string;
  timestamp: string;
  service?: string;
  endpoint?: string;
  method?: string;
  statusCode?: number;
  latencyMs?: number;
  userId?: string;
  workspaceId?: string;
  metadata?: Record<string, unknown>;
}

export interface RateLimitMetrics {
  totalRequests: number;
  limitedRequests: number;
  limitRate: number;
}

export interface CacheHitRateMetrics {
  hits: number;
  misses: number;
  errors: number;
  hitRate: number;
}

export interface MetricsSummary {
  api: Record<string, PercentileStats>;
  webVitals: {
    LCP: PercentileStats | null;
    FID: PercentileStats | null;
    CLS: PercentileStats | null;
  };
  rateLimit: RateLimitMetrics;
  cache: CacheHitRateMetrics;
  collectedAt: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Max entries to keep in memory per metric type before rotation */
const MAX_API_ENTRIES = 10_000;
const MAX_WEBVITAL_ENTRIES = 5_000;

// ─── MetricsCollector class ─────────────────────────────────────────────────

export class MetricsCollector {
  private apiMetrics: APIMetricEntry[] = [];
  private webVitals: WebVitalEntry[] = [];
  private rateLimitTotal = 0;
  private rateLimitBlocked = 0;
  private cacheHits = 0;
  private cacheMisses = 0;
  private cacheErrors = 0;

  // ── API Latency Metrics (Req 34.1) ──────────────────────────────────────

  /**
   * Record an API request metric.
   * Requirement 34.1: latency per endpoint (p50, p95, p99), error rates, rps.
   */
  recordAPIMetric(entry: APIMetricEntry): void {
    this.apiMetrics.push(entry);
    if (this.apiMetrics.length > MAX_API_ENTRIES) {
      this.apiMetrics = this.apiMetrics.slice(-MAX_API_ENTRIES);
    }
  }

  /**
   * Get percentile stats for a specific endpoint or all endpoints.
   * Requirement 34.1: p50, p95, p99 latency, error rate, rps.
   */
  getAPIStats(endpoint?: string, windowMs = 60_000): Record<string, PercentileStats> {
    const cutoff = Date.now() - windowMs;
    const recent = this.apiMetrics.filter((m) => m.timestamp >= cutoff);

    // Group by endpoint
    const grouped = new Map<string, APIMetricEntry[]>();
    for (const entry of recent) {
      if (endpoint && entry.endpoint !== endpoint) continue;
      const key = `${entry.method} ${entry.endpoint}`;
      const list = grouped.get(key) ?? [];
      list.push(entry);
      grouped.set(key, list);
    }

    const result: Record<string, PercentileStats> = {};
    const windowSeconds = windowMs / 1000;

    for (const [key, entries] of grouped) {
      const latencies = entries.map((e) => e.latencyMs).sort((a, b) => a - b);
      const errors = entries.filter((e) => e.statusCode >= 400).length;

      result[key] = {
        p50: percentile(latencies, 0.5),
        p95: percentile(latencies, 0.95),
        p99: percentile(latencies, 0.99),
        count: entries.length,
        errorRate: entries.length > 0 ? errors / entries.length : 0,
        requestsPerSecond: entries.length / windowSeconds,
      };
    }

    return result;
  }

  // ── Rate Limiting Metrics (Req 34.1) ────────────────────────────────────

  /**
   * Record a rate limit event.
   * Requirement 34.1: rate limiting usage.
   */
  recordRateLimitEvent(blocked: boolean): void {
    this.rateLimitTotal++;
    if (blocked) this.rateLimitBlocked++;
  }

  getRateLimitMetrics(): RateLimitMetrics {
    return {
      totalRequests: this.rateLimitTotal,
      limitedRequests: this.rateLimitBlocked,
      limitRate: this.rateLimitTotal > 0
        ? this.rateLimitBlocked / this.rateLimitTotal
        : 0,
    };
  }

  // ── Web Vitals (Req 34.6) ──────────────────────────────────────────────

  /**
   * Record a Web Vital metric from the frontend.
   * Requirement 34.6: LCP, FID, CLS collection.
   */
  recordWebVital(entry: WebVitalEntry): void {
    this.webVitals.push(entry);
    if (this.webVitals.length > MAX_WEBVITAL_ENTRIES) {
      this.webVitals = this.webVitals.slice(-MAX_WEBVITAL_ENTRIES);
    }
  }

  /**
   * Get Web Vitals summary stats.
   * Requirement 34.6: Web Vitals monitoring.
   */
  getWebVitalsStats(windowMs = 300_000): MetricsSummary['webVitals'] {
    const cutoff = Date.now() - windowMs;
    const recent = this.webVitals.filter((v) => v.timestamp >= cutoff);

    const byName = (name: WebVitalEntry['name']): PercentileStats | null => {
      const entries = recent.filter((v) => v.name === name);
      if (entries.length === 0) return null;
      const values = entries.map((e) => e.value).sort((a, b) => a - b);
      const poor = entries.filter((e) => e.rating === 'poor').length;
      return {
        p50: percentile(values, 0.5),
        p95: percentile(values, 0.95),
        p99: percentile(values, 0.99),
        count: entries.length,
        errorRate: entries.length > 0 ? poor / entries.length : 0,
        requestsPerSecond: 0, // not applicable for vitals
      };
    };

    return {
      LCP: byName('LCP'),
      FID: byName('FID'),
      CLS: byName('CLS'),
    };
  }

  // ── Cache Hit Rate (Req 34.3) ──────────────────────────────────────────

  /**
   * Record a cache operation result.
   * Requirement 34.3: cache hit rate monitoring.
   */
  recordCacheEvent(result: 'hit' | 'miss' | 'error'): void {
    if (result === 'hit') this.cacheHits++;
    else if (result === 'miss') this.cacheMisses++;
    else this.cacheErrors++;
  }

  getCacheMetrics(): CacheHitRateMetrics {
    const total = this.cacheHits + this.cacheMisses;
    return {
      hits: this.cacheHits,
      misses: this.cacheMisses,
      errors: this.cacheErrors,
      hitRate: total > 0 ? this.cacheHits / total : 0,
    };
  }

  // ── Full Summary ──────────────────────────────────────────────────────

  /**
   * Get a full metrics summary for the admin observability panel.
   * Requirement 34.3: admin dashboard metrics.
   */
  getSummary(windowMs = 60_000): MetricsSummary {
    return {
      api: this.getAPIStats(undefined, windowMs),
      webVitals: this.getWebVitalsStats(windowMs),
      rateLimit: this.getRateLimitMetrics(),
      cache: this.getCacheMetrics(),
      collectedAt: new Date().toISOString(),
    };
  }

  // ── Reset ─────────────────────────────────────────────────────────────

  reset(): void {
    this.apiMetrics = [];
    this.webVitals = [];
    this.rateLimitTotal = 0;
    this.rateLimitBlocked = 0;
    this.cacheHits = 0;
    this.cacheMisses = 0;
    this.cacheErrors = 0;
  }
}

// ─── Structured Logging (Req 34.5, 19.5) ────────────────────────────────────

/**
 * Generate a correlation ID for request tracing.
 * Requirement 19.5: X-Request-Id header for traceability.
 */
export function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Create a structured JSON log entry.
 * Requirement 34.5: structured logging with correlation ID.
 * Requirement 19.5: X-Request-Id traceability.
 */
export function createStructuredLog(
  level: StructuredLogEntry['level'],
  message: string,
  requestId: string,
  extra?: Partial<Omit<StructuredLogEntry, 'level' | 'message' | 'requestId' | 'timestamp'>>,
): StructuredLogEntry {
  return {
    level,
    message,
    requestId,
    timestamp: new Date().toISOString(),
    ...extra,
  };
}

/**
 * Emit a structured log to stdout as JSON.
 * Requirement 34.5: structured JSON logging.
 */
export function emitLog(entry: StructuredLogEntry): void {
  const output = JSON.stringify(entry);
  if (entry.level === 'error') {
    console.error(output);
  } else if (entry.level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

/**
 * Convenience: log an API request with structured format.
 * Combines Req 34.1 (metrics) + Req 34.5 (structured logging) + Req 19.5 (request ID).
 */
export function logAPIRequest(
  collector: MetricsCollector,
  params: {
    requestId: string;
    endpoint: string;
    method: string;
    statusCode: number;
    latencyMs: number;
    userId?: string;
    workspaceId?: string;
  },
): void {
  // Record metric
  collector.recordAPIMetric({
    endpoint: params.endpoint,
    method: params.method,
    statusCode: params.statusCode,
    latencyMs: params.latencyMs,
    timestamp: Date.now(),
  });

  // Emit structured log
  const level = params.statusCode >= 500 ? 'error' : params.statusCode >= 400 ? 'warn' : 'info';
  emitLog(
    createStructuredLog(level, `${params.method} ${params.endpoint} ${params.statusCode}`, params.requestId, {
      endpoint: params.endpoint,
      method: params.method,
      statusCode: params.statusCode,
      latencyMs: params.latencyMs,
      userId: params.userId,
      workspaceId: params.workspaceId,
    }),
  );
}

// ─── Percentile helper ──────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil(p * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ─── Singleton export ───────────────────────────────────────────────────────

export const metricsCollector = new MetricsCollector();
