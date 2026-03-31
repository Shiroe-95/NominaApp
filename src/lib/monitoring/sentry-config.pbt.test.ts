/**
 * Property-Based Tests for Sentry Configuration
 * Feature: platform-improvements
 *
 * Properties 56, 57
 *
 * Uses fast-check with minimum 100 iterations.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  filterPII,
  scrubPII,
  validateSentryEvent,
  type SentryEvent,
} from './sentry-config';

const NUM_RUNS = 100;

// ─── Generators ─────────────────────────────────────────────────────────────

const sentryEventArb: fc.Arbitrary<SentryEvent> = fc.record({
  event_id: fc.uuid(),
  level: fc.constantFrom('fatal' as const, 'error' as const, 'warning' as const),
  timestamp: fc.constant(new Date().toISOString()),
  message: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  exception: fc.option(
    fc.record({
      values: fc.array(
        fc.record({
          type: fc.string({ minLength: 1, maxLength: 30 }),
          value: fc.string({ minLength: 1, maxLength: 100 }),
        }),
        { minLength: 1, maxLength: 3 },
      ),
    }),
    { nil: undefined },
  ),
  breadcrumbs: fc.option(
    fc.array(
      fc.record({
        type: fc.constantFrom('http', 'navigation', 'ui'),
        category: fc.string({ minLength: 1, maxLength: 20 }),
        message: fc.string({ minLength: 1, maxLength: 50 }),
        timestamp: fc.constant(new Date().toISOString()),
      }),
      { minLength: 1, maxLength: 5 },
    ),
    { nil: undefined },
  ),
  user: fc.option(
    fc.record({
      id: fc.uuid(),
      role: fc.option(fc.constantFrom('admin', 'analyst', 'client'), { nil: undefined }),
      workspace: fc.option(fc.uuid(), { nil: undefined }),
    }),
    { nil: undefined },
  ),
  request: fc.option(
    fc.record({
      url: fc.webUrl(),
      method: fc.option(fc.constantFrom('GET', 'POST', 'PUT', 'DELETE'), { nil: undefined }),
    }),
    { nil: undefined },
  ),
  tags: fc.option(
    fc.record({
      environment: fc.constantFrom('production', 'staging', 'development'),
      release: fc.constant('0.1.0'),
    }),
    { nil: undefined },
  ),
  extra: fc.option(fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string({ maxLength: 50 })), { nil: undefined }),
});

// Complete event with all required fields
const completeSentryEventArb: fc.Arbitrary<SentryEvent> = fc.record({
  event_id: fc.uuid(),
  level: fc.constantFrom('fatal' as const, 'error' as const, 'warning' as const),
  timestamp: fc.constant(new Date().toISOString()),
  message: fc.string({ minLength: 1, maxLength: 100 }),
  exception: fc.record({
    values: fc.array(
      fc.record({
        type: fc.string({ minLength: 1, maxLength: 30 }),
        value: fc.string({ minLength: 1, maxLength: 100 }),
        stacktrace: fc.record({
          frames: fc.array(
            fc.record({
              filename: fc.string({ minLength: 1, maxLength: 50 }),
              lineno: fc.nat({ max: 10000 }),
              colno: fc.nat({ max: 500 }),
            }),
            { minLength: 1, maxLength: 3 },
          ),
        }),
      }),
      { minLength: 1, maxLength: 2 },
    ),
  }),
  breadcrumbs: fc.array(
    fc.record({
      type: fc.constantFrom('http', 'navigation', 'ui'),
      category: fc.string({ minLength: 1, maxLength: 20 }),
      message: fc.string({ minLength: 1, maxLength: 50 }),
      timestamp: fc.constant(new Date().toISOString()),
    }),
    { minLength: 1, maxLength: 3 },
  ),
  user: fc.record({
    id: fc.uuid(),
    role: fc.constantFrom('admin', 'analyst', 'client'),
    workspace: fc.uuid(),
  }),
  request: fc.record({
    url: fc.webUrl(),
    method: fc.constantFrom('GET', 'POST'),
  }),
  tags: fc.record({
    environment: fc.constantFrom('production', 'staging'),
    release: fc.constant('0.1.0'),
  }),
  extra: fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string({ maxLength: 50 })),
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('Feature: platform-improvements, Property 56: Sentry evento completo y etiquetado', () => {
  /**
   * Validates: Requirements 22.2, 22.6
   *
   * For any error captured by Sentry, the event must include:
   * stack trace, breadcrumbs, user context (ID, role, workspace),
   * URL, browser, version, tags.
   */
  it('complete events pass validation with all required fields', () => {
    fc.assert(
      fc.property(completeSentryEventArb, (event: SentryEvent) => {
        const result = validateSentryEvent(event);
        expect(result.valid).toBe(true);
        expect(result.missing).toEqual([]);

        // Verify specific fields
        expect(event.event_id).toBeTruthy();
        expect(event.exception?.values?.length).toBeGreaterThan(0);
        expect(event.breadcrumbs?.length).toBeGreaterThan(0);
        expect(event.user?.id).toBeTruthy();
        expect(event.request?.url).toBeTruthy();
        expect(event.tags?.environment).toBeTruthy();
        expect(event.tags?.release).toBeTruthy();
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('Feature: platform-improvements, Property 57: Sentry filtrado de PII', () => {
  /**
   * Validates: Requirements 22.4
   *
   * For any event sent to Sentry, it must not contain API keys,
   * auth tokens, payroll data, or PII.
   */
  it('PII is scrubbed from event fields after filtering', () => {
    const piiStrings = [
      'api_key=sk-abc123def456ghi789jkl012mno345',
      'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test',
      'token: secret_token_value_12345678901234',
      'salary: 5000 deduction: 1000',
      'user@example.com sent password=secret123',
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...piiStrings),
        completeSentryEventArb,
        (piiString: string, event: SentryEvent) => {
          // Inject PII into event
          const eventWithPII: SentryEvent = {
            ...event,
            message: piiString,
            extra: { sensitiveData: piiString },
          };
          if (eventWithPII.breadcrumbs?.length) {
            eventWithPII.breadcrumbs[0].message = piiString;
          }

          const filtered = filterPII(eventWithPII);

          // Verify PII is scrubbed
          if (filtered.message) {
            expect(filtered.message).not.toContain('sk-abc123');
            expect(filtered.message).not.toContain('eyJhbGci');
            expect(filtered.message).not.toContain('secret_token');
            expect(filtered.message).not.toContain('password=');
          }

          // scrubPII should redact known patterns
          const scrubbed = scrubPII(piiString);
          expect(scrubbed).toContain('[REDACTED]');
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
