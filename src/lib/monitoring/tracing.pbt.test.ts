/**
 * Property-Based Tests for Distributed Tracing
 * Feature: platform-improvements
 *
 * Properties 58, 59, 60
 *
 * Uses fast-check with minimum 100 iterations.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { TraceManager, isValidUUIDv4 } from './tracing';

const NUM_RUNS = 100;

// ─── Generators ─────────────────────────────────────────────────────────────

const operationArb = fc.constantFrom(
  'auth', 'validation', 'supabase.query', 'ai.invoke',
  'serialization', 'webhook.send', 'request', 'db.read',
);

const logLevelArb = fc.constantFrom('info' as const, 'warn' as const, 'error' as const, 'debug' as const);

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Feature: platform-improvements, Property 58: Trace ID único por request', () => {
  let manager: TraceManager;

  beforeEach(() => {
    manager = new TraceManager();
  });

  /**
   * Validates: Requirements 23.1
   *
   * For any incoming request, the system must generate a unique UUID v4 trace ID.
   * Two distinct requests must never share the same trace ID.
   */
  it('generates unique UUID v4 trace IDs for each request', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 20 }),
        (count: number) => {
          const traceIds = new Set<string>();

          for (let i = 0; i < count; i++) {
            const trace = manager.startTrace();
            expect(isValidUUIDv4(trace.traceId)).toBe(true);
            traceIds.add(trace.traceId);
            manager.endTrace(trace.traceId);
          }

          // All trace IDs must be unique
          expect(traceIds.size).toBe(count);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Feature: platform-improvements, Property 59: Trace ID presente en todos los logs', () => {
  let manager: TraceManager;

  beforeEach(() => {
    manager = new TraceManager();
  });

  /**
   * Validates: Requirements 23.3
   *
   * For any log entry generated during request processing,
   * the trace ID must be present in the entry.
   */
  it('every log entry contains the trace ID of its request', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            level: logLevelArb,
            message: fc.string({ minLength: 1, maxLength: 50 }),
          }),
          { minLength: 1, maxLength: 10 },
        ),
        (logEntries: Array<{ level: 'info' | 'warn' | 'error' | 'debug'; message: string }>) => {
          const trace = manager.startTrace();
          const traceId = trace.traceId;

          for (const entry of logEntries) {
            manager.addLog(traceId, entry.level, entry.message);
          }

          const context = manager.getTrace(traceId);
          expect(context).toBeDefined();
          expect(context!.logs.length).toBe(logEntries.length);

          for (const log of context!.logs) {
            expect(log.traceId).toBe(traceId);
            expect(isValidUUIDv4(log.traceId)).toBe(true);
          }

          manager.endTrace(traceId);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Feature: platform-improvements, Property 60: Spans creados para operaciones críticas', () => {
  let manager: TraceManager;

  beforeEach(() => {
    manager = new TraceManager();
  });

  /**
   * Validates: Requirements 23.4, 23.5
   *
   * For any request involving critical operations, a span must be created
   * with operation name, duration, and status. Child spans for multi-agent
   * orchestration must include tokens consumed.
   */
  it('creates spans with operation name, duration, and status for critical operations', () => {
    fc.assert(
      fc.property(
        fc.array(operationArb, { minLength: 1, maxLength: 6 }),
        fc.array(fc.record({
          agentName: fc.string({ minLength: 1, maxLength: 20 }),
          tokens: fc.nat({ max: 10000 }),
        }), { minLength: 0, maxLength: 3 }),
        (operations: string[], agents: Array<{ agentName: string; tokens: number }>) => {
          const trace = manager.startTrace();
          const traceId = trace.traceId;
          const rootSpan = manager.startSpan(traceId, 'request');

          // Create spans for critical operations
          for (const op of operations) {
            const span = manager.startSpan(traceId, op, rootSpan.spanId);
            expect(span.operation).toBe(op);
            expect(span.traceId).toBe(traceId);
            expect(isValidUUIDv4(span.spanId)).toBe(true);
            manager.endSpan(span, 'ok');
            expect(span.duration).toBeGreaterThanOrEqual(0);
            expect(span.status).toBe('ok');
          }

          // Create child spans for multi-agent orchestration
          for (const agent of agents) {
            const agentSpan = manager.startSpan(traceId, `agent:${agent.agentName}`, rootSpan.spanId);
            manager.endSpan(agentSpan, 'ok', { tokens: agent.tokens, result: 'success' });
            expect(agentSpan.metadata?.tokens).toBe(agent.tokens);
            expect(agentSpan.parentSpanId).toBe(rootSpan.spanId);
          }

          manager.endSpan(rootSpan, 'ok');
          const summary = manager.endTrace(traceId);

          expect(summary).toBeDefined();
          expect(summary!.traceId).toBe(traceId);
          // 1 root + operations + agents
          expect(summary!.spanCount).toBe(1 + operations.length + agents.length);
          expect(summary!.operations.length).toBe(1 + operations.length + agents.length);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
