/**
 * Property-Based Tests for Workspace Data Filtering and RLS Isolation
 *
 * Feature: platform-improvements
 * Properties: 39 (workspace filtering), 40 (RLS isolation)
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { filterByWorkspace, verifyRLSIsolation } from './workspace-filter';
import type { WorkspaceScoped } from './workspace-filter';

// ─── Generators ─────────────────────────────────────────────────────────────

const workspaceIdArb = fc.uuid();

const workspaceScopedRecordArb = (workspaceId: fc.Arbitrary<string> = workspaceIdArb) =>
  fc.record({
    workspace_id: workspaceId,
    id: fc.uuid(),
    name: fc.string({ minLength: 1, maxLength: 20 }),
  });

const mixedRecordsArb = (wsA: string, wsB: string) =>
  fc.array(
    fc.oneof(
      workspaceScopedRecordArb(fc.constant(wsA)),
      workspaceScopedRecordArb(fc.constant(wsB)),
    ),
    { minLength: 0, maxLength: 30 },
  );

// ─── Property 39: Dashboard filters data by active workspace ────────────────

describe('Property 39: Dashboard filtra datos por workspace activo', () => {
  /**
   * **Validates: Requirements 15.5**
   *
   * For any active workspace, all metrics and data must belong
   * exclusively to that workspace_id.
   */
  it('filterByWorkspace returns only records matching the workspace_id', () => {
    fc.assert(
      fc.property(
        workspaceIdArb,
        workspaceIdArb,
        fc.array(workspaceScopedRecordArb(), { minLength: 0, maxLength: 30 }),
        (targetWs, _otherWs, records) => {
          const filtered = filterByWorkspace(records, targetWs);

          // All returned records must belong to the target workspace
          for (const record of filtered) {
            expect(record.workspace_id).toBe(targetWs);
          }

          // Count must match the number of records with that workspace_id
          const expectedCount = records.filter((r) => r.workspace_id === targetWs).length;
          expect(filtered.length).toBe(expectedCount);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('filterByWorkspace returns empty array for empty workspace_id', () => {
    fc.assert(
      fc.property(
        fc.array(workspaceScopedRecordArb(), { minLength: 0, maxLength: 10 }),
        (records) => {
          const filtered = filterByWorkspace(records, '');
          expect(filtered.length).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ─── Property 40: Workspace RLS isolation ───────────────────────────────────

describe('Property 40: Workspace RLS aislamiento de datos', () => {
  /**
   * **Validates: Requirements 15.7**
   *
   * For any pair of workspaces, a query from the context of one workspace
   * must never return data belonging to the other workspace.
   */
  it('data from workspace A never appears in workspace B filtered results', () => {
    fc.assert(
      fc.property(
        workspaceIdArb,
        workspaceIdArb,
        (wsA, wsB) => {
          // Ensure distinct workspaces for meaningful test
          fc.pre(wsA !== wsB);

          return fc.assert(
            fc.property(
              mixedRecordsArb(wsA, wsB),
              (records) => {
                const filteredA = filterByWorkspace(records, wsA);
                const filteredB = filterByWorkspace(records, wsB);

                // No record from A's results should have B's workspace_id
                for (const record of filteredA) {
                  expect(record.workspace_id).not.toBe(wsB);
                }

                // No record from B's results should have A's workspace_id
                for (const record of filteredB) {
                  expect(record.workspace_id).not.toBe(wsA);
                }

                // Verify using the isolation checker
                const isolation = verifyRLSIsolation(records, wsA, wsB);
                expect(isolation.isolated).toBe(true);
                expect(isolation.violations.length).toBe(0);
              },
            ),
            { numRuns: 20 },
          );
        },
      ),
      { numRuns: 5 },
    );
  });
});
