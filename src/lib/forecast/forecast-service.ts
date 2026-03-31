/**
 * Forecast service — shared logic for forecast UI components.
 *
 * Provides types, data fetching, parameter validation,
 * cost alert detection, and auto-recalculation support.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 *
 * @module lib/forecast/forecast-service
 */

// ── Types ───────────────────────────────────────────────────────────

export interface ForecastBand {
  month: number;
  year: number;
  optimistic: number;
  expected: number;
  pessimistic: number;
}

export interface CostAlert {
  message: string;
  projectedIncrease: number;
  month: number;
  year: number;
}

export interface RegulatoryChange {
  description: string;
  impactPercentage: number;
  effectiveMonth: number;
}

export interface ForecastParameters {
  growthRate: number;
  salaryIncrease: number;
  regulatoryChanges: RegulatoryChange[];
}

export interface HistoricalCost {
  year: number;
  month: number;
  totalCost: number;
}

export interface HistoricalSummary {
  periodsAnalyzed: number;
  avgMonthlyCost: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
  seasonalityDetected: boolean;
}

export interface ForecastResult {
  bands: ForecastBand[];
  alerts: CostAlert[];
  historicalSummary: HistoricalSummary | null;
}

export type ForecastHorizon = 3 | 6 | 12;

// ── Constants ───────────────────────────────────────────────────────

export const COST_ALERT_THRESHOLD = 0.15;
export const DEFAULT_PARAMETERS: ForecastParameters = {
  growthRate: 0.02,
  salaryIncrease: 0,
  regulatoryChanges: [],
};

// ── Forecast factor validation (Property 35) ────────────────────────

/**
 * Validates that forecast parameters include all required factors:
 * historical trends, regulatory changes, seasonality, and growth rate.
 *
 * Returns true if all required factors are present and valid.
 */
export function validateForecastFactors(
  params: ForecastParameters,
  historicalCosts: HistoricalCost[],
): { valid: boolean; factors: string[]; missing: string[] } {
  const factors: string[] = [];
  const missing: string[] = [];

  // Factor 1: Historical trends (need at least 2 periods)
  if (historicalCosts.length >= 2) {
    factors.push('historical_trends');
  } else {
    missing.push('historical_trends');
  }

  // Factor 2: Regulatory changes (always present, may be empty array)
  if (Array.isArray(params.regulatoryChanges)) {
    factors.push('regulatory_changes');
  } else {
    missing.push('regulatory_changes');
  }

  // Factor 3: Seasonality (need at least 3 periods to detect)
  if (historicalCosts.length >= 3) {
    factors.push('seasonality');
  } else {
    missing.push('seasonality');
  }

  // Factor 4: Growth rate (must be a finite number)
  if (typeof params.growthRate === 'number' && isFinite(params.growthRate)) {
    factors.push('growth_rate');
  } else {
    missing.push('growth_rate');
  }

  return {
    valid: missing.length === 0,
    factors,
    missing,
  };
}

// ── Cost alert detection (Property 36) ──────────────────────────────

/**
 * Checks forecast bands for cost increases exceeding the threshold (15%).
 * Returns alerts for each band that exceeds the threshold.
 */
export function detectCostAlerts(
  bands: ForecastBand[],
  lastHistoricalCost: number,
  threshold: number = COST_ALERT_THRESHOLD,
): CostAlert[] {
  if (lastHistoricalCost <= 0 || bands.length === 0) return [];

  const alerts: CostAlert[] = [];

  for (const band of bands) {
    const increase = (band.expected - lastHistoricalCost) / lastHistoricalCost;
    if (increase > threshold) {
      alerts.push({
        message: `Proyección de incremento del ${(increase * 100).toFixed(1)}% en costos para ${band.month}/${band.year}`,
        projectedIncrease: Number((increase * 100).toFixed(1)),
        month: band.month,
        year: band.year,
      });
    }
  }

  return alerts;
}

// ── Chart data helpers ──────────────────────────────────────────────

export interface ForecastChartPoint {
  label: string;
  actual?: number;
  optimistic?: number;
  expected?: number;
  pessimistic?: number;
}

/**
 * Merges historical costs and forecast bands into a single chart-ready array.
 */
export function buildChartData(
  historicalCosts: HistoricalCost[],
  bands: ForecastBand[],
): ForecastChartPoint[] {
  const points: ForecastChartPoint[] = [];

  for (const h of historicalCosts) {
    points.push({
      label: `${h.month}/${h.year}`,
      actual: h.totalCost,
    });
  }

  for (const b of bands) {
    points.push({
      label: `${b.month}/${b.year}`,
      optimistic: b.optimistic,
      expected: b.expected,
      pessimistic: b.pessimistic,
    });
  }

  return points;
}

/**
 * Formats a currency value for display.
 */
export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}
