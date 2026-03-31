/**
 * Property-Based Tests for NLQ Integration
 * Feature: platform-improvements
 *
 * Property 33: NLQ respects RBAC
 * Property 34: NLQ includes data sources
 *
 * Uses fast-check with minimum 100 iterations.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  filterResponseByRBAC,
  ensureDataSources,
  hasRoleAccess,
  type UserRole,
  type RawNLQApiResponse,
  type NLQResponse,
  type NLQDataSource,
} from './nlq-response-handler';

const NUM_RUNS = 100;

// ── Generators ──────────────────────────────────────────────────────

/** Generate a valid user role */
const roleArb: fc.Arbitrary<UserRole> = fc.constantFrom(
  'admin',
  'analyst',
  'viewer',
  'editor',
);

/** Generate a valid data table name */
const tableArb = fc.constantFrom(
  'payroll_uploads',
  'country_year_rules',
  'audit_results',
  'anomalies',
  'forecasts',
  'employees',
  'companies',
);

/** Generate a workspace ID */
const workspaceIdArb = fc.uuid();

/** Generate a data source entry */
const dataSourceArb = fc.record({
  table: tableArb,
  period: fc.option(
    fc.tuple(
      fc.integer({ min: 2020, max: 2026 }),
      fc.integer({ min: 1, max: 12 }),
    ).map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`),
    { nil: undefined },
  ),
  company: fc.option(
    fc.stringOf(fc.alphanumeric(), { minLength: 3, maxLength: 20 }),
    { nil: undefined },
  ),
});

/** Generate a raw NLQ API response with data sources */
const rawNLQResponseArb: fc.Arbitrary<RawNLQApiResponse> = fc.record({
  query: fc.string({ minLength: 1, maxLength: 200 }),
  locale: fc.constantFrom('es', 'en', 'pt', 'fr', 'de'),
  workspace_id: fc.uuid(),
  payrolls_scanned: fc.integer({ min: 0, max: 50 }),
  message: fc.string({ minLength: 1, maxLength: 500 }),
  sources: fc.option(
    fc.array(dataSourceArb, { minLength: 1, maxLength: 5 }),
    { nil: undefined },
  ),
  type: fc.option(
    fc.constantFrom('table', 'metric', 'chart', 'text'),
    { nil: undefined },
  ),
  metrics: fc.option(
    fc.array(
      fc.record({
        label: fc.string({ minLength: 1, maxLength: 30 }),
        value: fc.oneof(
          fc.integer({ min: 0, max: 100_000_000 }),
          fc.string({ minLength: 1, maxLength: 20 }),
        ),
        unit: fc.option(fc.constantFrom('COP', 'USD', 'MXN', '%'), { nil: undefined }),
        trend: fc.option(
          fc.constantFrom('up' as const, 'down' as const, 'stable' as const),
          { nil: undefined },
        ),
      }),
      { minLength: 1, maxLength: 4 },
    ),
    { nil: undefined },
  ),
  table: fc.option(
    fc.record({
      headers: fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 1, maxLength: 5 }),
      rows: fc.array(
        fc.array(
          fc.oneof(fc.string({ minLength: 0, maxLength: 20 }), fc.integer({ min: 0, max: 1_000_000 })),
          { minLength: 1, maxLength: 5 },
        ),
        { minLength: 1, maxLength: 10 },
      ),
    }),
    { nil: undefined },
  ),
  chart: fc.option(
    fc.array(
      fc.record({
        label: fc.string({ minLength: 1, maxLength: 20 }),
        value: fc.integer({ min: 0, max: 100_000_000 }),
      }),
      { minLength: 1, maxLength: 8 },
    ),
    { nil: undefined },
  ),
  clarification_options: fc.option(
    fc.array(
      fc.record({
        id: fc.uuid(),
        label: fc.string({ minLength: 1, maxLength: 50 }),
        query: fc.string({ minLength: 1, maxLength: 200 }),
      }),
      { minLength: 1, maxLength: 4 },
    ),
    { nil: undefined },
  ),
});

/** RBAC access rules — mirrors the implementation */
const ROLE_ACCESS: Record<UserRole, string[]> = {
  admin: ['payroll_uploads', 'country_year_rules', 'audit_results', 'anomalies', 'forecasts', 'employees', 'companies'],
  analyst: ['payroll_uploads', 'country_year_rules', 'audit_results', 'anomalies', 'forecasts'],
  editor: ['payroll_uploads', 'audit_results'],
  viewer: ['payroll_uploads', 'audit_results'],
};

// ── Property 33: NLQ respects RBAC ─────────────────────────────────

describe('Property 33: NLQ respects RBAC', () => {
  /**
   * **Validates: Requirements 12.5**
   *
   * For any user with a given role and any NLQ query, the data returned
   * must belong exclusively to entities the user has access to per their
   * role and workspace.
   */
  it('filtered response only contains sources accessible to the user role', () => {
    fc.assert(
      fc.property(
        rawNLQResponseArb,
        roleArb,
        workspaceIdArb,
        (rawResponse, role, workspaceId) => {
          const filtered = filterResponseByRBAC(rawResponse, role, workspaceId);

          // Every source in the filtered response must be accessible by the role
          for (const source of filtered.sources) {
            expect(hasRoleAccess(role, source.table)).toBe(true);
          }

          // Every source must belong to the user's workspace
          for (const source of filtered.sources) {
            expect(source.workspace_id).toBe(workspaceId);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('viewer role never sees restricted tables', () => {
    fc.assert(
      fc.property(
        rawNLQResponseArb,
        workspaceIdArb,
        (rawResponse, workspaceId) => {
          const filtered = filterResponseByRBAC(rawResponse, 'viewer', workspaceId);

          const restrictedTables = ['anomalies', 'forecasts', 'employees', 'companies', 'country_year_rules'];
          for (const source of filtered.sources) {
            expect(restrictedTables).not.toContain(source.table);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('admin role sees all sources from the response', () => {
    fc.assert(
      fc.property(
        rawNLQResponseArb,
        workspaceIdArb,
        (rawResponse, workspaceId) => {
          const filtered = filterResponseByRBAC(rawResponse, 'admin', workspaceId);
          const originalSourceCount = (rawResponse.sources ?? []).length;

          // Admin should see all sources (all tables are accessible)
          expect(filtered.sources.length).toBe(originalSourceCount);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('hasRoleAccess is consistent with ROLE_ACCESS definition', () => {
    fc.assert(
      fc.property(
        roleArb,
        tableArb,
        (role, table) => {
          const expected = ROLE_ACCESS[role].includes(table);
          expect(hasRoleAccess(role, table)).toBe(expected);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// ── Property 34: NLQ includes data sources ──────────────────────────

describe('Property 34: NLQ includes data sources', () => {
  /**
   * **Validates: Requirements 12.6**
   *
   * For any NLQ response with data, it must include the data sources
   * used (table, period, company) as verifiable metadata.
   */
  it('every NLQ response has non-empty sources after ensureDataSources', () => {
    fc.assert(
      fc.property(
        rawNLQResponseArb,
        roleArb,
        workspaceIdArb,
        (rawResponse, role, workspaceId) => {
          const filtered = filterResponseByRBAC(rawResponse, role, workspaceId);
          const withSources = ensureDataSources(filtered, workspaceId);

          // Sources must always be present and non-empty
          expect(withSources.sources).toBeDefined();
          expect(withSources.sources.length).toBeGreaterThan(0);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('every source has a valid table name and workspace_id', () => {
    fc.assert(
      fc.property(
        rawNLQResponseArb,
        roleArb,
        workspaceIdArb,
        (rawResponse, role, workspaceId) => {
          const filtered = filterResponseByRBAC(rawResponse, role, workspaceId);
          const withSources = ensureDataSources(filtered, workspaceId);

          for (const source of withSources.sources) {
            // Table name must be a non-empty string
            expect(source.table).toBeDefined();
            expect(source.table.length).toBeGreaterThan(0);

            // Workspace ID must match the user's workspace
            expect(source.workspace_id).toBe(workspaceId);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('sources with period have valid format', () => {
    fc.assert(
      fc.property(
        rawNLQResponseArb,
        roleArb,
        workspaceIdArb,
        (rawResponse, role, workspaceId) => {
          const filtered = filterResponseByRBAC(rawResponse, role, workspaceId);

          for (const source of filtered.sources) {
            if (source.period) {
              // Period should be a non-empty string (e.g., "2024-01")
              expect(source.period.length).toBeGreaterThan(0);
            }
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('ensureDataSources adds default source when none exist', () => {
    fc.assert(
      fc.property(
        workspaceIdArb,
        (workspaceId) => {
          const emptyResponse: NLQResponse = {
            type: 'text',
            text: 'Some response',
            sources: [],
          };

          const withSources = ensureDataSources(emptyResponse, workspaceId);

          expect(withSources.sources.length).toBe(1);
          expect(withSources.sources[0].table).toBe('payroll_uploads');
          expect(withSources.sources[0].workspace_id).toBe(workspaceId);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('ensureDataSources preserves existing sources', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            table: tableArb,
            workspace_id: workspaceIdArb,
            period: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: undefined }),
            company: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: undefined }),
          }),
          { minLength: 1, maxLength: 5 },
        ),
        workspaceIdArb,
        (sources, workspaceId) => {
          const response: NLQResponse = {
            type: 'text',
            text: 'Some response',
            sources: sources as NLQDataSource[],
          };

          const result = ensureDataSources(response, workspaceId);

          // Should not modify existing sources
          expect(result.sources).toEqual(sources);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
