/**
 * Distributed Tracing — Trace ID generation, span creation, log correlation.
 *
 * Provides:
 * - Middleware that generates UUID v4 trace ID and propagates via X-Request-Id
 * - Span creation for critical operations (auth, validation, DB, AI, serialization, webhooks)
 * - Child spans for multi-agent orchestration (name, duration, tokens, result)
 * - Trace ID inclusion in all logs during request processing
 * - Integration with Sentry Performance
 *
 * Requirements: 23.1–23.6
 * Properties: 58, 59, 60
 *
 * @module lib/monitoring/tracing
 */

import { randomUUID } from 'crypto';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  operation: string;
  startTime: number;
  duration: number;
  metadata?: Record<string, unknown>;
  status: 'ok' | 'error';
}

export interface TraceContext {
  traceId: string;
  spans: TraceSpan[];
  logs: TraceLogEntry[];
  startTime: number;
}

export interface TraceLogEntry {
  traceId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  timestamp: string;
  spanId?: string;
}

export interface TraceSummary {
  traceId: string;
  totalDuration: number;
  spanCount: number;
  status: 'ok' | 'error';
  operations: string[];
  startTime: string;
}

// ─── UUID v4 validation ─────────────────────────────────────────────────────

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUIDv4(id: string): boolean {
  return UUID_V4_REGEX.test(id);
}

// ─── Trace Manager ──────────────────────────────────────────────────────────

/**
 * Manages distributed traces for API requests.
 * Property 58: Each request gets a unique UUID v4 trace ID.
 */
export class TraceManager {
  private activeTraces: Map<string, TraceContext> = new Map();
  private completedTraces: TraceSummary[] = [];
  private maxCompletedTraces = 50;

  /**
   * Creates a new trace for an incoming request.
   * Generates a UUID v4 trace ID.
   * Property 58: Trace ID is unique UUID v4.
   */
  startTrace(existingTraceId?: string): TraceContext {
    const traceId = existingTraceId ?? randomUUID();
    const context: TraceContext = {
      traceId,
      spans: [],
      logs: [],
      startTime: Date.now(),
    };
    this.activeTraces.set(traceId, context);
    return context;
  }

  /**
   * Creates a span for a critical operation within a trace.
   * Property 60: Spans created for auth, validation, DB, AI, serialization, webhooks.
   */
  startSpan(traceId: string, operation: string, parentSpanId?: string): TraceSpan {
    const span: TraceSpan = {
      traceId,
      spanId: randomUUID(),
      parentSpanId,
      operation,
      startTime: Date.now(),
      duration: 0,
      status: 'ok',
    };

    const context = this.activeTraces.get(traceId);
    if (context) {
      context.spans.push(span);
    }

    return span;
  }

  /**
   * Ends a span, recording its duration and optional metadata.
   */
  endSpan(span: TraceSpan, status: 'ok' | 'error' = 'ok', metadata?: Record<string, unknown>): void {
    span.duration = Date.now() - span.startTime;
    span.status = status;
    if (metadata) span.metadata = metadata;
  }

  /**
   * Adds a log entry to a trace.
   * Property 59: All logs during request processing include the trace ID.
   */
  addLog(traceId: string, level: TraceLogEntry['level'], message: string, spanId?: string): void {
    const entry: TraceLogEntry = {
      traceId,
      level,
      message,
      timestamp: new Date().toISOString(),
      spanId,
    };

    const context = this.activeTraces.get(traceId);
    if (context) {
      context.logs.push(entry);
    }

    // Also emit to console with trace ID
    const logMsg = JSON.stringify({ traceId, level, message, spanId, timestamp: entry.timestamp });
    if (level === 'error') console.error(logMsg);
    else if (level === 'warn') console.warn(logMsg);
    else console.log(logMsg);
  }

  /**
   * Completes a trace and stores its summary.
   */
  endTrace(traceId: string): TraceSummary | null {
    const context = this.activeTraces.get(traceId);
    if (!context) return null;

    const hasError = context.spans.some((s) => s.status === 'error');
    const summary: TraceSummary = {
      traceId,
      totalDuration: Date.now() - context.startTime,
      spanCount: context.spans.length,
      status: hasError ? 'error' : 'ok',
      operations: context.spans.map((s) => s.operation),
      startTime: new Date(context.startTime).toISOString(),
    };

    this.completedTraces.unshift(summary);
    if (this.completedTraces.length > this.maxCompletedTraces) {
      this.completedTraces = this.completedTraces.slice(0, this.maxCompletedTraces);
    }

    this.activeTraces.delete(traceId);
    return summary;
  }

  /**
   * Returns the last N completed traces for the "Recent Traces" view.
   */
  getRecentTraces(limit = 50): TraceSummary[] {
    return this.completedTraces.slice(0, limit);
  }

  /**
   * Gets an active trace context.
   */
  getTrace(traceId: string): TraceContext | undefined {
    return this.activeTraces.get(traceId);
  }

  reset(): void {
    this.activeTraces.clear();
    this.completedTraces = [];
  }
}

// ─── Singleton ──────────────────────────────────────────────────────────────

export const traceManager = new TraceManager();

// ─── Middleware Helper ──────────────────────────────────────────────────────

/**
 * Extracts or generates a trace ID from request headers.
 * Uses X-Request-Id header if present, otherwise generates UUID v4.
 */
export function getOrCreateTraceId(request: Request): string {
  const existing = request.headers.get('X-Request-Id');
  if (existing && isValidUUIDv4(existing)) return existing;
  return randomUUID();
}

/**
 * Creates a tracing middleware wrapper for API route handlers.
 * Generates trace ID, creates root span, includes trace ID in response headers.
 */
export function withTracing(
  handler: (req: Request, ctx: { traceId: string; params?: Record<string, string> }) => Promise<Response>,
) {
  return async (req: Request, routeCtx?: { params?: Record<string, string> }): Promise<Response> => {
    const traceId = getOrCreateTraceId(req);
    const trace = traceManager.startTrace(traceId);
    const rootSpan = traceManager.startSpan(traceId, 'request');

    try {
      const response = await handler(req, { traceId, params: routeCtx?.params });

      traceManager.endSpan(rootSpan, 'ok', {
        method: req.method,
        url: req.url,
      });
      traceManager.endTrace(traceId);

      // Add trace ID to response headers
      const headers = new Headers(response.headers);
      headers.set('X-Request-Id', traceId);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (err) {
      traceManager.addLog(traceId, 'error', err instanceof Error ? err.message : String(err));
      traceManager.endSpan(rootSpan, 'error');
      traceManager.endTrace(traceId);
      throw err;
    }
  };
}
