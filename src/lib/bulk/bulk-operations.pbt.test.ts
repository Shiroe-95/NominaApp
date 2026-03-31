/**
 * Property-Based Tests for Bulk Operations — Partial Failure Handling
 *
 * Feature: platform-improvements
 * Property: 46 (partial failure handling)
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { processBulkResults, validateBulkInvariant, getRetryIds } from './bulk-operations';

// ─── Generators ─────────────────────────────────────────────────────────────

const idArb = fc.uuid();

// ─── Property 46: Bulk operations partial failure handling ──────────────────

describe('Property 46: Bulk operations manejo de fallos parciales', () => {
  /**
   * **Validates: Requirements 17.4**
   *
   * For any bulk operation where some records fail:
   * - Successful records must be completed
   * - Failed records must be reported with error detail
   * - successful.length + failed.length === total
   */
  it('successful + failed === total for any mix of results', () => {
    fc.assert(
      fc.property(
        fc.array(idArb, { minLength: 1, maxLength: 50 }),
        (ids: string[]) => {
          return fc.assert(
            fc.property(
              fc.array(fc.boolean(), { minLength: ids.length, maxLength: ids.length }),
              (successes: boolean[]) => {
                const results = new Map<string, { success: boolean; data?: string; error?: string }>();
                for (let i = 0; i < ids.length; i++) {
                  results.set(ids[i], {
                    success: successes[i],
                    data: successes[i] ? 'ok' : undefined,
                    error: successes[i] ? undefined : `Error for ${ids[i]}`,
                  });
                }

                const result = processBulkResults(ids, results);

                expect(validateBulkInvariant(result)).toBe(true);
                expect(result.successful.length + result.failed.length).toBe(result.total);
                expect(result.total).toBe(ids.length);

                for (const item of result.successful) {
                  expect(item.error).toBeUndefined();
                }
                for (const item of result.failed) {
                  expect(item.error).toBeTruthy();
                }
              },
            ),
            { numRuns: 10 },
          );
        },
      ),
      { numRuns: 10 },
    );
  });

  it('all successful when no failures', () => {
    fc.assert(
      fc.property(
        fc.array(idArb, { minLength: 1, maxLength: 30 }),
        (ids: string[]) => {
          const results = new Map<string, { success: boolean; data?: string }>();
          for (const id of ids) {
            results.set(id, { success: true, data: 'ok' });
          }

          const result = processBulkResults(ids, results);
          expect(result.successful.length).toBe(ids.length);
          expect(result.failed.length).toBe(0);
          expect(validateBulkInvariant(result)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('all failed when every item fails', () => {
    fc.assert(
      fc.property(
        fc.array(idArb, { minLength: 1, maxLength: 30 }),
        (ids: string[]) => {
          const results = new Map<string, { success: boolean; error: string }>();
          for (const id of ids) {
            results.set(id, { success: false, error: 'fail' });
          }

          const result = processBulkResults(ids, results);
          expect(result.successful.length).toBe(0);
          expect(result.failed.length).toBe(ids.length);
          expect(validateBulkInvariant(result)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('retry IDs match exactly the failed items', () => {
    fc.assert(
      fc.property(
        fc.array(idArb, { minLength: 1, maxLength: 30 }),
        fc.array(fc.boolean(), { minLength: 1, maxLength: 30 }),
        (ids: string[], successes: boolean[]) => {
          const len = Math.min(ids.length, successes.length);
          const trimmedIds = ids.slice(0, len);
          const trimmedSuccesses = successes.slice(0, len);

          const results = new Map<string, { success: boolean; error?: string }>();
          for (let i = 0; i < len; i++) {
            results.set(trimmedIds[i], {
              success: trimmedSuccesses[i],
              error: trimmedSuccesses[i] ? undefined : 'fail',
            });
          }

          const result = processBulkResults(trimmedIds, results);
          const retryIds = getRetryIds(result);

          expect(retryIds.length).toBe(result.failed.length);
          for (const retryId of retryIds) {
            expect(result.failed.some((f) => f.id === retryId)).toBe(true);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('missing results are treated as failures', () => {
    fc.assert(
      fc.property(
        fc.array(idArb, { minLength: 2, maxLength: 20 }),
        (ids: string[]) => {
          const results = new Map<string, { success: boolean }>();
          const half = Math.floor(ids.length / 2);
          for (let i = 0; i < half; i++) {
            results.set(ids[i], { success: true });
          }

          const result = processBulkResults(ids, results);
          expect(validateBulkInvariant(result)).toBe(true);
          expect(result.successful.length).toBe(half);
          expect(result.failed.length).toBe(ids.length - half);
        },
      ),
      { numRuns: 100 },
    );
  });
});
