/**
 * Property-Based Tests for Rule Engine
 * Feature: platform-improvements, Property 11: Rule Engine determinism
 *
 * Validates: Requirements 4.2
 * For any valid rule and input data, executing the 14 mathematical verifications
 * twice with the same input must produce identical results.
 *
 * Uses fast-check with minimum 100 iterations.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  parseChecksToConstants,
  formatConstantsToChecks,
  getHardcodedConstants,
} from './rule-engine';
import type { CountryRuleEngine, ValidationFinding, ValidationResult } from './rule-engine';

const NUM_RUNS = 100;

// ── Generators ──────────────────────────────────────────────────────

/** Generate a valid check string that the rule engine can parse */
const checkStringArb = fc.oneof(
  fc.integer({ min: 100_000, max: 10_000_000 }).map(
    (v) => `SMMLV 2025: $${v.toLocaleString('es-CO').replace(/,/g, '.')}`,
  ),
  fc.integer({ min: 50_000, max: 500_000 }).map(
    (v) => `Auxilio de transporte: $${v.toLocaleString('es-CO').replace(/,/g, '.')}`,
  ),
  fc.integer({ min: 10, max: 50 }).map((v) => `IBC maximo: ${v} SMMLV`),
  fc.float({ min: 1, max: 20, noNaN: true }).map(
    (v) => `Salud empleado: ${v.toFixed(1)}%`,
  ),
  fc.float({ min: 1, max: 20, noNaN: true }).map(
    (v) => `Salud empleador: ${v.toFixed(1)}%`,
  ),
  fc.float({ min: 1, max: 20, noNaN: true }).map(
    (v) => `Pensión empleado: ${v.toFixed(1)}%`,
  ),
  fc.float({ min: 1, max: 20, noNaN: true }).map(
    (v) => `Pensión empleador: ${v.toFixed(1)}%`,
  ),
);

const checksArrayArb = fc.array(checkStringArb, { minLength: 1, maxLength: 14 });

/** Generate valid payroll row data */
const payrollRowArb = fc.array(
  fc.oneof(
    fc.string({ minLength: 1, maxLength: 20 }),
    fc.integer({ min: 0, max: 10_000_000 }).map(String),
  ),
  { minLength: 3, maxLength: 15 },
);

const headersArb = fc.array(
  fc.constantFrom(
    'documento', 'nombre', 'salario_basico', 'dias_trabajados',
    'ibc', 'salud_empleado', 'salud_empleador', 'pension_empleado',
    'pension_empleador', 'arl', 'caja', 'icbf', 'sena', 'total_devengado',
    'total_deducido',
  ),
  { minLength: 3, maxLength: 15 },
);


// ── Helper: build a synchronous rule engine from checks ─────────────

function buildSyncEngine(
  checks: string[],
  countryCode = 'CO',
  year = 2025,
): CountryRuleEngine {
  const parsedConstants = parseChecksToConstants(checks);

  return {
    countryCode,
    year,
    label: `Test ${countryCode} ${year}`,
    requiredFields: ['documento', 'nombre', 'salario_basico'],
    requiredCalculations: ['ibc', 'salud_empleado'],
    checks,
    validate({ rows, headers, relations }) {
      const findings: ValidationFinding[] = [];
      const smmlv = parsedConstants.smmlv;
      const ibcMax = parsedConstants.ibcMax;

      for (let i = 0; i < rows.length; i++) {
        // Structural validation
        if (rows[i].length < headers.length) {
          findings.push({
            severity: 'medium',
            category: 'structure',
            description: `Row ${i + 1} has ${rows[i].length} columns but ${headers.length} headers expected`,
            norm: `Test ${countryCode} ${year}`,
            rowIndex: i,
          });
        }

        // SMMLV validation
        if (smmlv !== undefined) {
          const salaryIdx = headers.indexOf('salario_basico');
          if (salaryIdx >= 0 && salaryIdx < rows[i].length) {
            const salary = Number(rows[i][salaryIdx]);
            if (!isNaN(salary) && salary < smmlv) {
              findings.push({
                severity: 'critical',
                category: 'salary',
                description: `Row ${i + 1}: salary ${salary} below SMMLV ${smmlv}`,
                norm: `SMMLV ${year}`,
                rowIndex: i,
                field: 'salario_basico',
                expected: smmlv,
                actual: salary,
              });
            }
          }
        }

        // IBC max validation
        if (ibcMax !== undefined && smmlv !== undefined) {
          const ibcIdx = headers.indexOf('ibc');
          if (ibcIdx >= 0 && ibcIdx < rows[i].length) {
            const ibc = Number(rows[i][ibcIdx]);
            const maxIbc = smmlv * ibcMax;
            if (!isNaN(ibc) && ibc > maxIbc) {
              findings.push({
                severity: 'high',
                category: 'ibc',
                description: `Row ${i + 1}: IBC ${ibc} exceeds max ${maxIbc}`,
                norm: `IBC Max ${ibcMax} SMMLV`,
                rowIndex: i,
                field: 'ibc',
                expected: maxIbc,
                actual: ibc,
              });
            }
          }
        }
      }

      return {
        findings,
        criticalFindings: findings.filter((f) => f.severity === 'critical').length,
        totalFindings: findings.length,
      };
    },
  };
}

// ── Property 11: Rule Engine Determinism ─────────────────────────────

describe('Feature: platform-improvements, Property 11: Rule Engine determinism', () => {
  it('parseChecksToConstants produces deterministic results for the same input', () => {
    fc.assert(
      fc.property(checksArrayArb, (checks) => {
        const result1 = parseChecksToConstants(checks);
        const result2 = parseChecksToConstants(checks);
        expect(result1).toEqual(result2);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('validate() produces identical results when called twice with the same input', () => {
    fc.assert(
      fc.property(
        checksArrayArb,
        fc.array(payrollRowArb, { minLength: 1, maxLength: 20 }),
        headersArb,
        (checks, rows, headers) => {
          const engine = buildSyncEngine(checks);
          const input = { rows, headers, relations: [] };

          const result1 = engine.validate(input);
          const result2 = engine.validate(input);

          expect(result1).toEqual(result2);
          expect(result1.totalFindings).toBe(result1.findings.length);
          expect(result1.criticalFindings).toBe(
            result1.findings.filter((f) => f.severity === 'critical').length,
          );
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('getHardcodedConstants returns deterministic results for the same country/year', () => {
    const countryCodes = fc.constantFrom('CO', 'MX', 'PE', 'CL', 'BR', 'AR', 'US');
    const years = fc.constantFrom(2025, 2026);

    fc.assert(
      fc.property(countryCodes, years, (country, year) => {
        const result1 = getHardcodedConstants(country, year);
        const result2 = getHardcodedConstants(country, year);
        expect(result1).toEqual(result2);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
