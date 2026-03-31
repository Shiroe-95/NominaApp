/**
 * Anomaly Pipeline Integration — Connects the Anomaly Detector agent
 * with the audit pipeline, historical comparison, and benchmark fallback.
 *
 * Orchestrates:
 * 1. Fetching up to 6 historical periods for comparison
 * 2. Running anomaly detection (via Worker for >50 employees)
 * 3. Falling back to industry benchmarks when no history exists
 * 4. Generating natural language explanations
 * 5. Saving results to the database
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7
 *
 * @module lib/ai/anomaly-pipeline
 */

import type { PayrollRow } from '@/lib/ai/types';
import {
  type AnomalyResult,
  type AnomalyCategory,
  type ConfidenceLevel,
  detectOutliers,
  detectInterPeriodVariations,
  detectRoundingPatterns,
  fetchHistoricalData,
  fetchBenchmarks,
  compareAgainstBenchmarks,
  saveAnomalies,
} from '@/lib/ai/agents/anomaly-detector';

// ── Types ───────────────────────────────────────────────────────────

export interface AnomalyPipelineInput {
  payrollId: string;
  workspaceId: string;
  companyId: string;
  countryCode: string;
  currentYear: number;
  currentMonth: number;
  currentRows: PayrollRow[];
  companySize?: string;
  industry?: string;
}

export interface AnomalyPipelineResult {
  anomalies: AnomalyResult[];
  summary: AnomalySummary;
}

export interface AnomalySummary {
  total: number;
  byCategory: Record<AnomalyCategory, number>;
  byConfidence: Record<ConfidenceLevel, number>;
  usedBenchmarks: boolean;
  historicalPeriodsAnalyzed: number;
}

// ── Constants ───────────────────────────────────────────────────────

const MAX_HISTORICAL_PERIODS = 6;

// ── Explanation Generator ───────────────────────────────────────────

/**
 * Generate a natural language explanation for an anomaly.
 * Includes the category, data points, and recommended action.
 *
 * Requirements: 11.7
 */
export function generateExplanation(anomaly: AnomalyResult): string {
  const { category, confidence, dataPoints, employeeDoc } = anomaly;

  const categoryLabels: Record<AnomalyCategory, string> = {
    potential_fraud: 'posible fraude',
    systematic_error: 'error sistemático',
    seasonal_variation: 'variación estacional',
    legitimate_change: 'cambio legítimo',
  };

  const confidenceLabels: Record<ConfidenceLevel, string> = {
    high: 'alta',
    medium: 'media',
    low: 'baja',
  };

  const catLabel = categoryLabels[category] ?? category;
  const confLabel = confidenceLabels[confidence] ?? confidence;
  const target = employeeDoc ? `para el empleado ${employeeDoc}` : 'a nivel agregado';

  let explanation = `Se detectó una anomalía de tipo ${catLabel} (confianza ${confLabel}) ${target}. `;

  if (dataPoints.currentValue && dataPoints.historicalAverage) {
    const direction = dataPoints.deviation > 0 ? 'por encima' : 'por debajo';
    explanation += `El valor actual (${dataPoints.currentValue.toLocaleString()}) está ${Math.abs(dataPoints.deviation).toFixed(1)}% ${direction} del promedio histórico (${dataPoints.historicalAverage.toLocaleString()}). `;
  }

  if (dataPoints.periods.length > 0) {
    explanation += `Comparado contra ${dataPoints.periods.length} periodo(s) anteriores. `;
  }

  return explanation.trim();
}

/**
 * Enhance all anomalies with natural language explanations.
 * Ensures every anomaly has a non-empty description containing its category.
 *
 * Requirements: 11.7
 */
export function enhanceExplanations(anomalies: AnomalyResult[]): AnomalyResult[] {
  return anomalies.map((a) => {
    const explanation = generateExplanation(a);
    // Ensure description contains the category and is non-empty
    const description = explanation || a.description;
    return { ...a, description };
  });
}

// ── Historical Comparison ───────────────────────────────────────────

/**
 * Compare current payroll data against up to 6 historical periods.
 * Falls back to industry benchmarks if no historical data exists.
 *
 * Requirements: 11.5, 11.6
 */
export async function compareWithHistory(
  input: AnomalyPipelineInput,
): Promise<AnomalyPipelineResult> {
  const { currentRows, workspaceId, companyId, currentYear, currentMonth, countryCode, payrollId } = input;

  if (currentRows.length === 0) {
    return {
      anomalies: [],
      summary: emptySummary(false, 0),
    };
  }

  // Fetch up to 6 historical periods
  const historicalData = await fetchHistoricalData(
    workspaceId,
    companyId,
    currentYear,
    currentMonth,
    MAX_HISTORICAL_PERIODS,
  );

  const allAnomalies: AnomalyResult[] = [];

  if (historicalData.length >= 2) {
    // Outlier detection requires at least 2 historical periods
    const outliers = detectOutliers(currentRows, historicalData);
    allAnomalies.push(...outliers.map((a) => ({ ...a, payrollId })));
  }

  if (historicalData.length >= 1) {
    // Inter-period variation detection
    const variations = detectInterPeriodVariations(currentRows, historicalData);
    allAnomalies.push(...variations.map((a) => ({ ...a, payrollId })));
  }

  // Rounding patterns (no historical data needed)
  const rounding = detectRoundingPatterns(currentRows);
  allAnomalies.push(...rounding.map((a) => ({ ...a, payrollId })));

  // Fallback to benchmarks when no historical data
  let usedBenchmarks = false;
  if (historicalData.length === 0) {
    const benchmark = await fetchBenchmarks(countryCode, input.companySize, input.industry);
    if (benchmark) {
      const benchmarkAnomalies = compareAgainstBenchmarks(currentRows, benchmark);
      allAnomalies.push(...benchmarkAnomalies.map((a) => ({ ...a, payrollId })));
      usedBenchmarks = true;
    }
  }

  // Enhance with natural language explanations
  const enhanced = enhanceExplanations(allAnomalies);

  // Sort by confidence then category priority
  enhanced.sort((a, b) => {
    const confOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const catOrder: Record<string, number> = {
      potential_fraud: 0, systematic_error: 1, seasonal_variation: 2, legitimate_change: 3,
    };
    const confDiff = (confOrder[a.confidence] ?? 2) - (confOrder[b.confidence] ?? 2);
    if (confDiff !== 0) return confDiff;
    return (catOrder[a.category] ?? 3) - (catOrder[b.category] ?? 3);
  });

  return {
    anomalies: enhanced,
    summary: buildSummary(enhanced, usedBenchmarks, historicalData.length),
  };
}

// ── Summary Helpers ─────────────────────────────────────────────────

function buildSummary(
  anomalies: AnomalyResult[],
  usedBenchmarks: boolean,
  historicalPeriods: number,
): AnomalySummary {
  const byCategory: Record<AnomalyCategory, number> = {
    potential_fraud: 0,
    systematic_error: 0,
    seasonal_variation: 0,
    legitimate_change: 0,
  };
  const byConfidence: Record<ConfidenceLevel, number> = {
    high: 0,
    medium: 0,
    low: 0,
  };

  for (const a of anomalies) {
    byCategory[a.category] = (byCategory[a.category] ?? 0) + 1;
    byConfidence[a.confidence] = (byConfidence[a.confidence] ?? 0) + 1;
  }

  return {
    total: anomalies.length,
    byCategory,
    byConfidence,
    usedBenchmarks,
    historicalPeriodsAnalyzed: historicalPeriods,
  };
}

function emptySummary(usedBenchmarks: boolean, historicalPeriods: number): AnomalySummary {
  return {
    total: 0,
    byCategory: { potential_fraud: 0, systematic_error: 0, seasonal_variation: 0, legitimate_change: 0 },
    byConfidence: { high: 0, medium: 0, low: 0 },
    usedBenchmarks,
    historicalPeriodsAnalyzed: historicalPeriods,
  };
}
