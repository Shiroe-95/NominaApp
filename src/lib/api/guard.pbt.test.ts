/**
 * Property-Based Tests for API Error Handler
 * Feature: platform-improvements
 *
 * Properties 16-19: Standard error format, X-Request-Id, 500 no stack, Zod 400
 *
 * Uses fast-check with minimum 100 iterations.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';
import {
  createApiError,
  withApiHandler,
  apiErrorResponse,
  type ApiErrorResponse,
} from './guard';

const NUM_RUNS = 100;

// UUID v4 regex
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Generators ──────────────────────────────────────────────────────

const errorCodeArb = fc.constantFrom(
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
);

const messageArb = fc.string({ minLength: 1, maxLength: 200 });

const detailsArb = fc.oneof(
  fc.constant(undefined),
  fc.dictionary(
    fc.string({ minLength: 1, maxLength: 30 }).filter((s: string) => s.trim().length > 0),
    fc.oneof(
      fc.string({ maxLength: 100 }),
      fc.integer(),
      fc.boolean(),
      fc.constant(null),
    ),
    { minKeys: 1, maxKeys: 5 },
  ),
);

// ── Property 16: createApiError produces valid format ───────────────

describe('Feature: platform-improvements, Property 16: API Error format estándar y createApiError', () => {
  /**
   * Validates: Requirements 6.1, 6.8
   *
   * For any error code, message, and optional details, createApiError must produce
   * an object with { error: string, code: string, details?: object, requestId: string(uuid) }.
   */
  it('createApiError always produces a valid ApiErrorResponse with UUID v4 requestId', () => {
    fc.assert(
      fc.property(errorCodeArb, messageArb, detailsArb, (code: string, message: string, details: Record<string, unknown> | undefined) => {
        const result = createApiError(code, message, details);

        // Must have required fields
        expect(typeof result.error).toBe('string');
        expect(result.error).toBe(message);
        expect(typeof result.code).toBe('string');
        expect(result.code).toBe(code);
        expect(typeof result.requestId).toBe('string');
        expect(result.requestId).toMatch(UUID_V4_REGEX);

        // details is optional
        if (details !== undefined) {
          expect(result.details).toEqual(details);
        } else {
          expect(result.details).toBeUndefined();
        }

        // No extra fields beyond the standard format
        const keys = Object.keys(result);
        const allowedKeys = ['error', 'code', 'requestId', 'details'];
        for (const key of keys) {
          expect(allowedKeys).toContain(key);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ── Property 17: X-Request-Id present in all responses ──────────────

describe('Feature: platform-improvements, Property 17: X-Request-Id presente en todas las respuestas API', () => {
  /**
   * Validates: Requirements 6.2
   *
   * For any API response (success or error), the X-Request-Id header must be
   * present and contain a valid UUID v4.
   */
  it('withApiHandler adds X-Request-Id UUID v4 header to all success responses', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 200, max: 299 }),
        fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string({ maxLength: 50 }), { maxKeys: 3 }),
        async (status: number, body: Record<string, string>) => {
          const handler = withApiHandler(async (_req, { requestId }) => {
            return NextResponse.json(body, { status });
          });

          const req = new Request('http://localhost/api/test');
          const response = await handler(req);

          const requestId = response.headers.get('X-Request-Id');
          expect(requestId).not.toBeNull();
          expect(requestId).toMatch(UUID_V4_REGEX);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('withApiHandler adds X-Request-Id UUID v4 header to all error responses', () => {
    fc.assert(
      fc.property(messageArb, async (errorMessage: string) => {
        const handler = withApiHandler(async () => {
          throw new Error(errorMessage);
        });

        const req = new Request('http://localhost/api/test');
        const response = await handler(req);

        const requestId = response.headers.get('X-Request-Id');
        expect(requestId).not.toBeNull();
        expect(requestId).toMatch(UUID_V4_REGEX);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});


// ── Property 18: 500 errors don't contain stack traces ──────────────

describe('Feature: platform-improvements, Property 18: Excepciones no controladas retornan 500 sin stack traces', () => {
  /**
   * Validates: Requirements 6.3
   *
   * For any unhandled exception in an API handler, the response must have
   * HTTP 500, standard error format, and must NOT contain stack traces or
   * internal server details.
   */
  it('unhandled exceptions return 500 with standard format and no stack traces', () => {
    fc.assert(
      fc.property(messageArb, async (errorMessage: string) => {
        const handler = withApiHandler(async () => {
          const err = new Error(errorMessage);
          err.stack = `Error: ${errorMessage}\n    at Object.<anonymous> (/app/src/lib/api/guard.ts:42:11)\n    at Module._compile (node:internal/modules/cjs/loader:1376:14)`;
          throw err;
        });

        const req = new Request('http://localhost/api/test');
        const response = await handler(req);

        // Must be 500
        expect(response.status).toBe(500);

        // Must have standard format
        const body = await response.json() as ApiErrorResponse;
        expect(body.code).toBe('INTERNAL_ERROR');
        expect(body.error).toBe('An internal error occurred');
        expect(body.requestId).toMatch(UUID_V4_REGEX);

        // Must NOT contain stack traces or internal details
        const bodyStr = JSON.stringify(body);
        expect(bodyStr).not.toContain('at Object');
        expect(bodyStr).not.toContain('at Module');
        expect(bodyStr).not.toContain('.ts:');
        expect(bodyStr).not.toContain('.js:');
        expect(bodyStr).not.toContain('node:internal');
        expect(bodyStr).not.toContain(errorMessage); // Original error message not exposed

        // X-Request-Id header present
        expect(response.headers.get('X-Request-Id')).toMatch(UUID_V4_REGEX);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ── Property 19: Zod validation errors return 400 with field details ─

describe('Feature: platform-improvements, Property 19: Validación Zod retorna 400 con detalles de campos', () => {
  /**
   * Validates: Requirements 6.4
   *
   * For any body invalid according to a Zod schema, the response must be
   * HTTP 400 with code "VALIDATION_ERROR" and the details field must contain
   * the specific invalid fields.
   */
  it('Zod validation errors produce 400 VALIDATION_ERROR with field details', () => {
    // Generate schemas with required fields and invalid data
    const fieldNameArb = fc.constantFrom('name', 'email', 'age', 'count', 'status', 'type');
    const invalidValueArb = fc.oneof(
      fc.constant(undefined),
      fc.constant(null),
      fc.constant(''),
      fc.constant(-1),
    );

    fc.assert(
      fc.property(
        fc.array(fieldNameArb, { minLength: 1, maxLength: 4 }),
        invalidValueArb,
        async (fields: string[], invalidValue: unknown) => {
          // Build a Zod schema that requires these fields as non-empty strings
          const shape: Record<string, z.ZodTypeAny> = {};
          for (const field of fields) {
            shape[field] = z.string().min(1);
          }
          const schema = z.object(shape);

          // Create a handler that throws a ZodError by parsing invalid data
          const handler = withApiHandler(async () => {
            const invalidBody: Record<string, unknown> = {};
            for (const field of fields) {
              invalidBody[field] = invalidValue;
            }
            schema.parse(invalidBody); // This will throw ZodError
            return NextResponse.json({ ok: true });
          });

          const req = new Request('http://localhost/api/test', {
            method: 'POST',
            body: JSON.stringify({}),
          });
          const response = await handler(req);

          // Must be 400
          expect(response.status).toBe(400);

          // Must have standard format with VALIDATION_ERROR code
          const body = await response.json() as ApiErrorResponse;
          expect(body.code).toBe('VALIDATION_ERROR');
          expect(body.error).toBe('Request validation failed');
          expect(body.requestId).toMatch(UUID_V4_REGEX);

          // Must have field details
          expect(body.details).toBeDefined();
          expect(body.details!.fields).toBeDefined();
          expect(Array.isArray(body.details!.fields)).toBe(true);

          const fieldErrors = body.details!.fields as Array<{ path: string; message: string; code: string }>;
          expect(fieldErrors.length).toBeGreaterThan(0);

          // Each field error must have path, message, and code
          for (const fieldError of fieldErrors) {
            expect(typeof fieldError.path).toBe('string');
            expect(typeof fieldError.message).toBe('string');
            expect(typeof fieldError.code).toBe('string');
          }

          // X-Request-Id header present
          expect(response.headers.get('X-Request-Id')).toMatch(UUID_V4_REGEX);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
