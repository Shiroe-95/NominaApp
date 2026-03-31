/**
 * Property-Based Tests for Forecast Service
 * Feature: platform-improvements
 *
 * Property 35: Forecast considers required factors
 * Property 36: Forecast alerts when increment > 15%
 *
 * Uses fast-check with minimum 100 iterations.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  validateForecastFactors,
  detectCostAlerts,
  COST_ALERT_THRESHOLD,
  type ForecastParameters,
  type ForecastBand,
  type HistoricalCost,
} from './forecast-service';
import {
  generateForecastNotifications,
  shouldAlertForIncrease,
} from './forecast-alerts';

const NUM_RUNS = 100;

// ── Generators ──────────────────────────────────────────────────────

/** Generate a valid historical cost entry */
const historicalCostArb: fc.Arbitrary<HistoricalCost> = fc.record({
  year: fc.integer({ min: 2020, max: 2026 }),
  month: fc.integer({ min: 1, max: 12 }),
  totalCost: fc.integer({ min: 1000, max: 10_000_000 }),
});

/** Generate an array of historical costs (at least 3 for full factor coverage) */
const historicalCostsArb = (minLen: number = 3): fc.Arbitrary<HistoricalCost[]> =>
  fc.array(historicalCostArb, { minLength: minLen, maxLength: 12 });

/** Generate a valid regulatory change */
const regulatoryChangeArb = fc.record({
  description: fc.string({ minLength: 1, maxLength: 50 }),
  impactPercentage: fc.double({ min: -10, max: 30, noNaN: true }),
  effectiveMonth: fc.integer({ min: 1, max: 12 }),
});

/** Generate valid forecast parameters with all required factors */
const forecastParamsArb: fc.Arbitrary<ForecastParameters> = fc.record({
  growthRate: fc.double({ min: -0.1, max: 0.5, noNaN: true }),
  salaryIncrease: fc.double({ min: -0.1, max: 0.5, noNaN: true }),
  regulatoryChanges: fc.array(regulatoryChangeArb, { minLength: 0, maxLength: 3 }),
});

/** Generate a forecast band */
const forecastBandArb: fc.Arbitrary<ForecastBand> = fc.record({
  month: fc.integer({ min: 1, max: 12 }),
  year: fc.integer({ min: 2024, max: 2030 }),
  optimistic: fc.integer({ min: 0, max: 10_000_000 }),
  expected: fc.integer({ min: 0, max: 10_000_000 }),
  pessimistic: fc.integer({ min: 0, max: 10_000_000 }),
});

/** Generate a positive last historical cost */
const lastCostArb = fc.integer({ min: 1000, max: 5_000_000 });

// ── Property 35: Forecast considers required factors ────────────────

describe('Property 35: Forecast considers required factors', () => {
  /**
   * **Validates: Requirements 13.4**
   *
   * For any forecast calculation, the input parameters must include
   * historical trends, regulatory changes, seasonality, and growth rate.
   */
  it('validates all 4 required factors when sufficient historical data is provided', () => {
    fc.assert(
      fc.property(
        forecastParamsArb,
        historicalCostsArb(3),
        (params, historicalCosts) => {
          const result = validateForecastFactors(params, historicalCosts);

          // With >= 3 periods and valid params, all factors should be present
          expect(result.valid).toBe(true);
          expect(result.factors).toContain('historical_trends');
          expect(result.factors).toContain('regulatory_changes');
          expect(result.factors).toContain('seasonality');
          expect(result.factors).toContain('growth_rate');
          expect(result.missing).toHaveLength(0);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('reports missing historical_trends when fewer than 2 periods', () => {
    fc.assert(
      fc.property(
        forecastParamsArb,
        fc.array(historicalCostArb, { minLength: 0, maxLength: 1 }),
        (params, historicalCosts) => {
          const result = validateForecastFactors(params, historicalCosts);

          expect(result.missing).toContain('historical_trends');
          expect(result.factors).not.toContain('historical_trends');
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('reports missing seasonality when fewer than 3 periods', () => {
    fc.assert(
      fc.property(
        forecastParamsArb,
        fc.array(historicalCostArb, { minLength: 2, maxLength: 2 }),
        (params, historicalCosts) => {
          const result = validateForecastFactors(params, historicalCosts);

          // 2 periods: has historical_trends but not seasonality
          expect(result.factors).toContain('historical_trends');
          expect(result.missing).toContain('seasonality');
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('always includes regulatory_changes factor when array is present', () => {
    fc.assert(
      fc.property(
        forecastParamsArb,
        historicalCostsArb(1),
        (params, historicalCosts) => {
          const result = validateForecastFactors(params, historicalCosts);

          // regulatoryChanges is always an array in valid params
          expect(result.factors).toContain('regulatory_changes');
          expect(result.missing).not.toContain('regulatory_changes');
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('reports missing growth_rate when growthRate is NaN or Infinity', () => {
    fc.assert(
      fc.property(
        historicalCostsArb(3),
        fc.constantFrom(NaN, Infinity, -Infinity),
        (historicalCosts, badGrowth) => {
          const params: ForecastParameters = {
            growthRate: badGrowth,
            salaryIncrease: 0,
            regulatoryChanges: [],
          };
          const result = validateForecastFactors(params, historicalCosts);

          expect(result.missing).toContain('growth_rate');
          expect(result.valid).toBe(false);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('factor count equals factors.length + missing.length and is always 4', () => {
    fc.assert(
      fc.property(
        forecastParamsArb,
        fc.array(historicalCostArb, { minLength: 0, maxLength: 12 }),
        (params, historicalCosts) => {
          const result = validateForecastFactors(params, historicalCosts);

          expect(result.factors.length + result.missing.length).toBe(4);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// ── Property 36: Forecast alerts when increment > 15% ──────────────

describe('Property 36: Forecast alerts when increment > 15%', () => {
  /**
   * **Validates: Requirements 13.5**
   *
   * For any forecast projection indicating a cost increase > 15%
   * compared to the previous period, the system must generate an alert.
   */
  it('generates alert for every band with expected cost > 15% above last cost', () => {
    fc.assert(
      fc.property(
        fc.array(forecastBandArb, { minLength: 1, maxLength: 12 }),
        lastCostArb,
        (bands, lastCost) => {
          const alerts = detectCostAlerts(bands, lastCost);

          // Check each band: if increase > 15%, there must be an alert
          for (const band of bands) {
            const increase = (band.expected - lastCost) / lastCost;
            const hasAlert = alerts.some(
              a => a.month === band.month && a.year === band.year,
            );

            if (increase > COST_ALERT_THRESHOLD) {
              expect(hasAlert).toBe(true);
            } else {
              expect(hasAlert).toBe(false);
            }
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('never generates alerts when all bands are below threshold', () => {
    fc.assert(
      fc.property(
        lastCostArb,
        fc.integer({ min: 1, max: 12 }),
        (lastCost, bandCount) => {
          // Create bands that are at most 15% above lastCost
          const maxExpected = Math.floor(lastCost * (1 + COST_ALERT_THRESHOLD));
          const bands: ForecastBand[] = Array.from({ length: bandCount }, (_, i) => ({
            month: ((i % 12) + 1),
            year: 2025,
            optimistic: Math.round(lastCost * 0.85),
            expected: Math.min(maxExpected, lastCost + i * 10),
            pessimistic: Math.round(lastCost * 1.2),
          }));

          const alerts = detectCostAlerts(bands, lastCost);
          expect(alerts).toHaveLength(0);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('alert projectedIncrease matches actual percentage', () => {
    fc.assert(
      fc.property(
        fc.array(forecastBandArb, { minLength: 1, maxLength: 6 }),
        lastCostArb,
        (bands, lastCost) => {
          const alerts = detectCostAlerts(bands, lastCost);

          for (const alert of alerts) {
            const band = bands.find(
              b => b.month === alert.month && b.year === alert.year,
            );
            expect(band).toBeDefined();

            if (band) {
              const expectedIncrease = ((band.expected - lastCost) / lastCost) * 100;
              expect(alert.projectedIncrease).toBeCloseTo(expectedIncrease, 0);
            }
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('returns empty alerts when lastHistoricalCost is zero or negative', () => {
    fc.assert(
      fc.property(
        fc.array(forecastBandArb, { minLength: 1, maxLength: 6 }),
        fc.integer({ min: -1_000_000, max: 0 }),
        (bands, badCost) => {
          const alerts = detectCostAlerts(bands, badCost);
          expect(alerts).toHaveLength(0);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('generateForecastNotifications creates notifications for all alerts', () => {
    fc.assert(
      fc.property(
        fc.array(forecastBandArb, { minLength: 1, maxLength: 6 }),
        lastCostArb,
        (bands, lastCost) => {
          const alerts = detectCostAlerts(bands, lastCost);
          const notifications = generateForecastNotifications(bands, lastCost);

          // One notification per alert
          expect(notifications.length).toBe(alerts.length);

          // Each notification has correct type and non-empty message
          for (const n of notifications) {
            expect(n.type).toBe('forecast_cost_alert');
            expect(n.message.length).toBeGreaterThan(0);
            expect(n.projectedIncrease).toBeGreaterThan(COST_ALERT_THRESHOLD * 100);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('shouldAlertForIncrease returns true iff increase > 15%', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -50, max: 100, noNaN: true }),
        (pct) => {
          const result = shouldAlertForIncrease(pct);
          expect(result).toBe(pct > COST_ALERT_THRESHOLD * 100);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
