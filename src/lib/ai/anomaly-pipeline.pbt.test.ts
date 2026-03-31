/**
 * Property-Based Tests for Anomaly Pipeline Integration
 * Feature: platform-improvements
 *
 * Property 31: Anomaly Detector compares with historical periods
 * Property 32: Anomaly Detector generates non-empty explanations
 *
 * Uses fast-check with minimum 100 iterations.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  generateExplanation,
  enhanceExplanations,
} from './anomaly-pipeline';
import {
  type AnomalyResult,
  type AnomalyCategory,
  type ConfidenceLevel,
  detectOutliers,
  detectInterPeriodVariations,
  detectRoundingPatterns,
  compareAgainstBenchmarks,
  type BenchmarkReference,
} from './agents/anomaly-detector';

const NUM_RUNS = 100;

// ── Generators ──────────────────────────────────────────────────────

/** Generate a valid anomaly category */
const categoryArb: fc.Arbitrary<AnomalyCategory> = fc.constantFrom(
  'potential_fraud',
  'systematic_error',
  'seasonal_variation',
  'legitimate_change',
);

/** Generate a valid confidence level */
const confidenceArb: fc.Arbitrary<ConfidenceLevel> = fc.constantFrom(
  'high',
  'medium',
  'low',
);

/** Generate a valid payroll row with numeric columns */
const payrollRowArb = fc.record({
  documento: fc.stringOf(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: 5, maxLength: 12 }),
  nombre: fc.string({ minLength: 2, maxLength: 30 }),
  salario: fc.integer({ min: 1_000_000, max: 50_000_000 }),
  salud: fc.integer({ min: 50_000, max: 2_000_000 }),
  pension: fc.integer({ min: 50_000, max: 2_000_000 }),
  transporte: fc.integer({ min: 0, max: 500_000 }),
});

type PayrollRow = Record<string, unknown>;

/** Generate a historical period with payroll rows */
const historicalPeriodArb = (employeeDocs: string[]) =>
  fc.record({
    year: fc.integer({ min: 2020, max: 2025 }),
    month: fc.integer({ min: 1, max: 12 }),
    rows: fc.array(
      fc.record({
        documento: fc.constantFrom(...(employeeDocs.length > 0 ? employeeDocs : ['12345'])),
        nombre: fc.string({ minLength: 2, maxLength: 20 }),
        salario: fc.integer({ min: 1_000_000, max: 50_000_000 }),
        salud: fc.integer({ min: 50_000, max: 2_000_000 }),
        pension: fc.integer({ min: 50_000, max: 2_000_000 }),
        transporte: fc.integer({ min: 0, max: 500_000 }),
      }),
      { minLength: 1, maxLength: 10 },
    ),
  });

/** Generate a valid AnomalyResult */
const anomalyResultArb: fc.Arbitrary<AnomalyResult> = fc.record({
  id: fc.uuid(),
  payrollId: fc.uuid(),
  employeeDoc: fc.option(
    fc.stringOf(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: 5, maxLength: 12 }),
    { nil: null },
  ),
  category: categoryArb,
  confidence: confidenceArb,
  description: fc.string({ minLength: 1, maxLength: 200 }),
  recommendation: fc.string({ minLength: 1, maxLength: 200 }),
  dataPoints: fc.record({
    currentValue: fc.float({ min: 1, max: 100_000_000, noNaN: true }),
    historicalAverage: fc.float({ min: 1, max: 100_000_000, noNaN: true }),
    deviation: fc.float({ min: -100, max: 100, noNaN: true }),
    periods: fc.array(
      fc.record({
        year: fc.integer({ min: 2020, max: 2025 }),
        month: fc.integer({ min: 1, max: 12 }),
        value: fc.float({ min: 1, max: 100_000_000, noNaN: true }),
      }),
      { minLength: 0, maxLength: 6 },
    ),
  }),
});

/** Generate a valid benchmark reference */
const benchmarkArb: fc.Arbitrary<BenchmarkReference> = fc.record({
  industry: fc.constantFrom('technology', 'finance', 'healthcare', 'retail'),
  countryCode: fc.constantFrom('CO', 'MX', 'AR', 'CL', 'PE'),
  companySize: fc.constantFrom('small', 'medium', 'large', 'enterprise'),
  avgCostPerEmployee: fc.float({ min: 1_000_000, max: 20_000_000, noNaN: true }),
  avgContributionRatio: fc.float({ min: 0.05, max: 0.5, noNaN: true }),
  avgRiskScore: fc.float({ min: 0, max: 100, noNaN: true }),
  sampleCount: fc.integer({ min: 10, max: 1000 }),
});

// ── Property 31: Historical Comparison ──────────────────────────────

describe('Property 31: Anomaly Detector compares with historical periods', () => {
  /**
   * **Validates: Requirements 11.5**
   *
   * For any dataset with historical data available, the Anomaly Detector
   * must compare against up to 6 previous periods of the same company.
   */
  it('detectOutliers uses all provided historical periods (up to 6)', () => {
    fc.assert(
      fc.property(
        fc.array(payrollRowArb, { minLength: 3, maxLength: 10 }).chain((currentRows: PayrollRow[]) => {
          const docs = currentRows.map((r: PayrollRow) => r.documento as string);
          return fc.tuple(
            fc.constant(currentRows as PayrollRow[]),
            fc.array(historicalPeriodArb(docs), { minLength: 2, maxLength: 6 }),
          );
        }),
        ([currentRows, historicalData]: [PayrollRow[], { year: number; month: number; rows: PayrollRow[] }[]]) => {
          // The detector should accept and process up to 6 historical periods
          const anomalies = detectOutliers(currentRows, historicalData);

          // All anomalies should reference data points from historical periods
          for (const anomaly of anomalies) {
            expect(anomaly.dataPoints).toBeDefined();
            expect(anomaly.dataPoints.periods.length).toBeGreaterThan(0);
            // Historical periods used should not exceed what was provided
            expect(anomaly.dataPoints.periods.length).toBeLessThanOrEqual(
              historicalData.length,
            );
          }

          // Every anomaly must have a valid category and confidence
          for (const anomaly of anomalies) {
            expect(['potential_fraud', 'systematic_error', 'seasonal_variation', 'legitimate_change']).toContain(anomaly.category);
            expect(['high', 'medium', 'low']).toContain(anomaly.confidence);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('detectInterPeriodVariations compares against all provided historical periods', () => {
    fc.assert(
      fc.property(
        fc.array(payrollRowArb, { minLength: 3, maxLength: 10 }),
        fc.array(
          fc.record({
            year: fc.integer({ min: 2020, max: 2025 }),
            month: fc.integer({ min: 1, max: 12 }),
            rows: fc.array(payrollRowArb, { minLength: 3, maxLength: 10 }),
          }),
          { minLength: 1, maxLength: 6 },
        ),
        (currentRows: PayrollRow[], historicalData: { year: number; month: number; rows: PayrollRow[] }[]) => {
          const anomalies = detectInterPeriodVariations(
            currentRows,
            historicalData,
          );

          // All inter-period anomalies should reference historical data
          for (const anomaly of anomalies) {
            expect(anomaly.dataPoints).toBeDefined();
            // The historical average should be computed from the provided periods
            expect(anomaly.dataPoints.historicalAverage).toBeGreaterThan(0);
            expect(anomaly.dataPoints.periods.length).toBeLessThanOrEqual(
              historicalData.length,
            );
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('falls back to benchmark comparison when no historical data exists', () => {
    fc.assert(
      fc.property(
        fc.array(payrollRowArb, { minLength: 5, maxLength: 20 }),
        benchmarkArb,
        (currentRows: PayrollRow[], benchmark: BenchmarkReference) => {
          const anomalies = compareAgainstBenchmarks(
            currentRows,
            benchmark,
          );

          // When using benchmarks, anomalies should reference benchmark data
          for (const anomaly of anomalies) {
            expect(anomaly.dataPoints).toBeDefined();
            // historicalAverage should be the benchmark value
            expect(anomaly.dataPoints.historicalAverage).toBeGreaterThan(0);
            // No historical periods should be referenced
            expect(anomaly.dataPoints.periods).toHaveLength(0);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// ── Property 32: Non-empty Explanations ─────────────────────────────

describe('Property 32: Anomaly Detector generates non-empty explanations', () => {
  /**
   * **Validates: Requirements 11.7**
   *
   * For any detected anomaly, the natural language explanation must be
   * non-empty and contain the category of the anomaly.
   */
  it('generateExplanation produces non-empty string containing category', () => {
    fc.assert(
      fc.property(anomalyResultArb, (anomaly: AnomalyResult) => {
        const explanation = generateExplanation(anomaly);

        // Explanation must be non-empty
        expect(explanation.length).toBeGreaterThan(0);
        expect(explanation.trim().length).toBeGreaterThan(0);

        // Explanation must contain a reference to the anomaly category
        // The category is translated to Spanish in the explanation
        const categoryTerms: Record<AnomalyCategory, string> = {
          potential_fraud: 'fraude',
          systematic_error: 'error sistemático',
          seasonal_variation: 'variación estacional',
          legitimate_change: 'cambio legítimo',
        };
        const expectedTerm = categoryTerms[anomaly.category];
        expect(explanation.toLowerCase()).toContain(expectedTerm.toLowerCase());
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('enhanceExplanations ensures all anomalies have non-empty descriptions', () => {
    fc.assert(
      fc.property(
        fc.array(anomalyResultArb, { minLength: 1, maxLength: 20 }),
        (anomalies: AnomalyResult[]) => {
          const enhanced = enhanceExplanations(anomalies);

          // Same number of anomalies
          expect(enhanced).toHaveLength(anomalies.length);

          // Every enhanced anomaly must have a non-empty description
          for (const anomaly of enhanced) {
            expect(anomaly.description.length).toBeGreaterThan(0);
            expect(anomaly.description.trim().length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('detectRoundingPatterns generates descriptions for detected anomalies', () => {
    fc.assert(
      fc.property(
        // Generate rows with suspicious rounding patterns
        fc.array(
          fc.record({
            documento: fc.stringOf(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9'), { minLength: 5, maxLength: 12 }),
            nombre: fc.string({ minLength: 2, maxLength: 20 }),
            salario: fc.integer({ min: 1, max: 50 }).map((v: number) => v * 1_000_000), // Always round millions
            salud: fc.integer({ min: 1, max: 20 }).map((v: number) => v * 100_000), // Always round 100k
          }),
          { minLength: 5, maxLength: 20 },
        ),
        (rows: PayrollRow[]) => {
          const anomalies = detectRoundingPatterns(rows as PayrollRow[]);

          // Every detected anomaly must have a non-empty description
          for (const anomaly of anomalies) {
            expect(anomaly.description.length).toBeGreaterThan(0);
            expect(anomaly.recommendation.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
