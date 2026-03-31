/**
 * Web Worker for payroll cost forecasting calculations.
 *
 * Runs forecast band generation, trend detection, seasonality analysis,
 * and cost alert detection in a background thread when >3 historical periods.
 * Reports progress every 500ms.
 * Supports cancellation via 'cancel' message.
 *
 * Requirements: 3.4, 3.6
 *
 * @module lib/workers/forecast-calc.worker
 */

/// <reference lib="webworker" />

// ── Types ───────────────────────────────────────────────────────────

interface ForecastBand {
  month: number;
  year: number;
  optimistic: number;
  expected: number;
  pessimistic: number;
}

interface CostAlert {
  message: string;
  projectedIncrease: number;
  month: number;
  year: number;
}

interface RegulatoryChange {
  description: string;
  impactPercentage: number;
  effectiveMonth: number;
}

interface ForecastParameters {
  growthRate: number;
  salaryIncrease: number;
  regulatoryChanges: RegulatoryChange[];
}

interface HistoricalCost {
  year: number;
  month: number;
  totalCost: number;
}

interface HistoricalSummary {
  periodsAnalyzed: number;
  avgMonthlyCost: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
  seasonalityDetected: boolean;
}

interface ForecastWorkerResult {
  bands: ForecastBand[];
  alerts: CostAlert[];
  historicalSummary: HistoricalSummary;
}

export interface ForecastCalcMessage {
  type: 'forecast-calc' | 'cancel';
  historicalCosts?: HistoricalCost[];
  monthsAhead?: 3 | 6 | 12;
  parameters?: ForecastParameters;
}

// ── Constants ───────────────────────────────────────────────────────

const COST_ALERT_THRESHOLD = 0.15;
const SEASONALITY_VARIANCE_THRESHOLD = 0.10;
const OPTIMISTIC_FACTOR = 0.85;
const PESSIMISTIC_FACTOR = 1.20;

let cancelled = false;

// ── Progress Reporting ──────────────────────────────────────────────

function reportProgress(percent: number): void {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  self.postMessage({ type: 'progress', percent: clamped });
}

// ── Statistical Helpers ─────────────────────────────────────────────

function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1));
}

function detectTrend(values: number[]): {
  slope: number;
  direction: 'increasing' | 'decreasing' | 'stable';
  percentageChange: number;
} {
  if (values.length < 2) {
    return { slope: 0, direction: 'stable', percentageChange: 0 };
  }

  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = calculateMean(values);

  let numerator = 0;
  let denominator = 0;
  for (let i = 0; i < n; i++) {
    numerator += (i - xMean) * (values[i] - yMean);
    denominator += (i - xMean) ** 2;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const firstVal = values[0];
  const percentageChange = firstVal !== 0 ? (slope * (n - 1)) / firstVal : 0;

  let direction: 'increasing' | 'decreasing' | 'stable';
  if (percentageChange > 0.02) direction = 'increasing';
  else if (percentageChange < -0.02) direction = 'decreasing';
  else direction = 'stable';

  return { slope, direction, percentageChange: Number((percentageChange * 100).toFixed(2)) };
}

function detectSeasonality(values: number[]): {
  detected: boolean;
  coefficientOfVariation: number;
} {
  if (values.length < 3) {
    return { detected: false, coefficientOfVariation: 0 };
  }

  const mean = calculateMean(values);
  if (mean === 0) return { detected: false, coefficientOfVariation: 0 };

  const stdDev = calculateStdDev(values);
  const cv = stdDev / mean;

  return {
    detected: cv > SEASONALITY_VARIANCE_THRESHOLD,
    coefficientOfVariation: Number(cv.toFixed(4)),
  };
}

// ── Forecast Functions ──────────────────────────────────────────────

function generateForecastBands(
  historicalCosts: HistoricalCost[],
  monthsAhead: 3 | 6 | 12,
  params: ForecastParameters,
): ForecastBand[] {
  if (historicalCosts.length === 0) return [];

  const costs = historicalCosts.map((h) => h.totalCost);
  const { slope } = detectTrend(costs);
  const lastCost = costs[costs.length - 1];
  const lastPeriod = historicalCosts[historicalCosts.length - 1];

  const bands: ForecastBand[] = [];
  let currentMonth = lastPeriod.month;
  let currentYear = lastPeriod.year;

  for (let i = 1; i <= monthsAhead; i++) {
    if (cancelled) return bands;

    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }

    let baseCost = lastCost + slope * i;
    baseCost *= Math.pow(1 + params.growthRate, i);
    baseCost *= Math.pow(1 + params.salaryIncrease, i);

    for (const change of params.regulatoryChanges) {
      if (currentMonth >= change.effectiveMonth) {
        baseCost *= 1 + change.impactPercentage / 100;
      }
    }

    baseCost = Math.max(0, baseCost);

    bands.push({
      month: currentMonth,
      year: currentYear,
      optimistic: Math.round(baseCost * OPTIMISTIC_FACTOR),
      expected: Math.round(baseCost),
      pessimistic: Math.round(baseCost * PESSIMISTIC_FACTOR),
    });
  }

  return bands;
}

function detectCostAlerts(bands: ForecastBand[], lastHistoricalCost: number): CostAlert[] {
  if (lastHistoricalCost <= 0 || bands.length === 0) return [];

  const alerts: CostAlert[] = [];

  for (const band of bands) {
    const increase = (band.expected - lastHistoricalCost) / lastHistoricalCost;
    if (increase > COST_ALERT_THRESHOLD) {
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

// ── Main Message Handler ────────────────────────────────────────────

self.onmessage = (event: MessageEvent<ForecastCalcMessage>) => {
  const { type } = event.data;

  if (type === 'cancel') {
    cancelled = true;
    return;
  }

  if (type !== 'forecast-calc') return;

  cancelled = false;

  try {
    const {
      historicalCosts = [],
      monthsAhead = 6,
      parameters = { growthRate: 0.02, salaryIncrease: 0, regulatoryChanges: [] },
    } = event.data;

    reportProgress(5);

    if (historicalCosts.length === 0) {
      self.postMessage({
        type: 'result',
        result: { bands: [], alerts: [], historicalSummary: null },
      });
      return;
    }

    // Phase 1: Analyze historical data (5% → 30%)
    const costs = historicalCosts.map((h) => h.totalCost);
    const trend = detectTrend(costs);
    const seasonality = detectSeasonality(costs);
    const avgMonthlyCost = calculateMean(costs);

    if (cancelled) {
      self.postMessage({ type: 'error', message: 'Cancelled' });
      return;
    }

    reportProgress(30);

    // Phase 2: Generate forecast bands (30% → 70%)
    const bands = generateForecastBands(historicalCosts, monthsAhead, parameters);

    if (cancelled) {
      self.postMessage({ type: 'error', message: 'Cancelled' });
      return;
    }

    reportProgress(70);

    // Phase 3: Detect cost alerts (70% → 90%)
    const lastCost = costs[costs.length - 1];
    const alerts = detectCostAlerts(bands, lastCost);

    reportProgress(90);

    const historicalSummary: HistoricalSummary = {
      periodsAnalyzed: historicalCosts.length,
      avgMonthlyCost: Math.round(avgMonthlyCost),
      trend: trend.direction,
      trendPercentage: trend.percentageChange,
      seasonalityDetected: seasonality.detected,
    };

    reportProgress(95);

    self.postMessage({
      type: 'result',
      result: { bands, alerts, historicalSummary },
    });

    reportProgress(100);
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : 'Error in forecast calculation',
    });
  }
};
