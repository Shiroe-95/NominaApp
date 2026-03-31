/**
 * Web Worker for anomaly detection on payroll data.
 *
 * Runs statistical anomaly detection (outliers, inter-period variations,
 * rounding patterns) in a background thread when employee count > 50.
 * Reports progress every 500ms.
 * Supports cancellation via 'cancel' message.
 *
 * Requirements: 3.2, 3.3, 3.6
 *
 * @module lib/workers/anomaly-detect.worker
 */

/// <reference lib="webworker" />

// ── Types (duplicated to avoid importing from main thread modules) ──

type AnomalyCategory =
  | 'potential_fraud'
  | 'systematic_error'
  | 'seasonal_variation'
  | 'legitimate_change';

type ConfidenceLevel = 'high' | 'medium' | 'low';

interface AnomalyDataPoints {
  currentValue: number;
  historicalAverage: number;
  deviation: number;
  periods: { year: number; month: number; value: number }[];
}

interface AnomalyResult {
  id: string;
  payrollId: string;
  employeeDoc: string | null;
  category: AnomalyCategory;
  confidence: ConfidenceLevel;
  description: string;
  recommendation: string;
  dataPoints: AnomalyDataPoints;
}

type PayrollRow = Record<string, unknown>;

interface HistoricalPeriod {
  year: number;
  month: number;
  rows: PayrollRow[];
}

export interface AnomalyDetectMessage {
  type: 'anomaly-detect' | 'cancel';
  currentRows?: PayrollRow[];
  historicalData?: HistoricalPeriod[];
  payrollId?: string;
}

// ── Constants ───────────────────────────────────────────────────────

const OUTLIER_ZSCORE_HIGH = 3.0;
const OUTLIER_ZSCORE_MEDIUM = 2.0;
const VARIATION_THRESHOLD_HIGH = 0.30;
const VARIATION_THRESHOLD_MEDIUM = 0.15;
const ROUNDING_PATTERN_THRESHOLD = 0.7;
const PROGRESS_INTERVAL_MS = 500;

let cancelled = false;

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

function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

function getNumericColumns(rows: PayrollRow[]): string[] {
  if (rows.length === 0) return [];
  const sample = rows[0];
  return Object.keys(sample).filter((key) => {
    const val = sample[key];
    return typeof val === 'number' || (typeof val === 'string' && !isNaN(Number(val)) && val !== '');
  });
}

function sumColumn(rows: PayrollRow[], col: string): number {
  return rows.reduce((sum, r) => {
    const v = Number(r[col]);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);
}

function generateId(): string {
  // crypto.randomUUID may not be available in all worker contexts
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

// ── Progress Reporting ──────────────────────────────────────────────

function reportProgress(percent: number): void {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  self.postMessage({ type: 'progress', percent: clamped });
}

// ── Detection Functions ─────────────────────────────────────────────

function classifyOutlier(zScore: number, deviationPct: number): AnomalyCategory {
  if (zScore >= OUTLIER_ZSCORE_HIGH && deviationPct > 50) return 'potential_fraud';
  if (zScore >= OUTLIER_ZSCORE_HIGH) return 'systematic_error';
  return 'seasonal_variation';
}

function classifyVariation(
  absVariation: number,
  historicalTotals: { year: number; month: number; value: number }[],
): AnomalyCategory {
  if (absVariation >= VARIATION_THRESHOLD_HIGH) return 'systematic_error';
  if (historicalTotals.length >= 4) return 'seasonal_variation';
  return 'legitimate_change';
}

function detectOutliers(
  currentRows: PayrollRow[],
  historicalData: HistoricalPeriod[],
  payrollId: string,
): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];
  const numericColumns = getNumericColumns(currentRows);

  for (const row of currentRows) {
    if (cancelled) return anomalies;

    const employeeDoc = String(row['documento'] ?? row['employee_doc'] ?? row['cedula'] ?? '');
    if (!employeeDoc) continue;

    for (const col of numericColumns) {
      const currentValue = Number(row[col]);
      if (isNaN(currentValue) || currentValue === 0) continue;

      const historicalValues: { year: number; month: number; value: number }[] = [];
      for (const period of historicalData) {
        const match = period.rows.find(
          (r) => String(r['documento'] ?? r['employee_doc'] ?? r['cedula'] ?? '') === employeeDoc,
        );
        if (match) {
          const val = Number(match[col]);
          if (!isNaN(val)) {
            historicalValues.push({ year: period.year, month: period.month, value: val });
          }
        }
      }

      if (historicalValues.length < 2) continue;

      const values = historicalValues.map((h) => h.value);
      const mean = calculateMean(values);
      const stdDev = calculateStdDev(values);
      const zScore = calculateZScore(currentValue, mean, stdDev);
      const absZ = Math.abs(zScore);

      if (absZ >= OUTLIER_ZSCORE_MEDIUM) {
        const confidence: ConfidenceLevel = absZ >= OUTLIER_ZSCORE_HIGH ? 'high' : 'medium';
        const deviation = mean !== 0 ? ((currentValue - mean) / mean) * 100 : 0;

        anomalies.push({
          id: generateId(),
          payrollId,
          employeeDoc,
          category: classifyOutlier(absZ, deviation),
          confidence,
          description: `Valor atípico en "${col}" para empleado ${employeeDoc}: ${currentValue.toLocaleString()} (promedio histórico: ${mean.toLocaleString()}, desviación: ${deviation.toFixed(1)}%, z-score: ${absZ.toFixed(2)})`,
          recommendation: `Revisar el valor de "${col}" para el empleado ${employeeDoc}. ${confidence === 'high' ? 'Se recomienda revisión urgente.' : 'Verificar si corresponde a un cambio esperado.'}`,
          dataPoints: {
            currentValue,
            historicalAverage: mean,
            deviation: Number(deviation.toFixed(2)),
            periods: historicalValues,
          },
        });
      }
    }
  }

  return anomalies;
}

function detectInterPeriodVariations(
  currentRows: PayrollRow[],
  historicalData: HistoricalPeriod[],
  payrollId: string,
): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];
  const numericColumns = getNumericColumns(currentRows);

  for (const col of numericColumns) {
    if (cancelled) return anomalies;

    const currentTotal = sumColumn(currentRows, col);
    if (currentTotal === 0) continue;

    const historicalTotals: { year: number; month: number; value: number }[] = [];
    for (const period of historicalData) {
      const total = sumColumn(period.rows, col);
      if (total > 0) {
        historicalTotals.push({ year: period.year, month: period.month, value: total });
      }
    }

    if (historicalTotals.length === 0) continue;

    const avgTotal = calculateMean(historicalTotals.map((h) => h.value));
    const variationPct = avgTotal !== 0 ? (currentTotal - avgTotal) / avgTotal : 0;
    const absVariation = Math.abs(variationPct);

    if (absVariation >= VARIATION_THRESHOLD_MEDIUM) {
      const confidence: ConfidenceLevel = absVariation >= VARIATION_THRESHOLD_HIGH ? 'high' : 'medium';
      const direction = variationPct > 0 ? 'incremento' : 'disminución';

      anomalies.push({
        id: generateId(),
        payrollId,
        employeeDoc: null,
        category: classifyVariation(absVariation, historicalTotals),
        confidence,
        description: `${direction.charAt(0).toUpperCase() + direction.slice(1)} significativo en "${col}": ${(variationPct * 100).toFixed(1)}% respecto al promedio de ${historicalTotals.length} periodos anteriores`,
        recommendation: `Revisar el concepto "${col}" para identificar la causa del ${direction}.`,
        dataPoints: {
          currentValue: currentTotal,
          historicalAverage: avgTotal,
          deviation: Number((variationPct * 100).toFixed(2)),
          periods: historicalTotals,
        },
      });
    }
  }

  return anomalies;
}

function detectRoundingPatterns(currentRows: PayrollRow[], payrollId: string): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];
  const numericColumns = getNumericColumns(currentRows);

  for (const col of numericColumns) {
    if (cancelled) return anomalies;

    const values = currentRows.map((r) => Number(r[col])).filter((v) => !isNaN(v) && v > 0);
    if (values.length < 5) continue;

    const roundedCount = values.filter((v) => v % 1000 === 0 || v % 100 === 0).length;
    const roundedRatio = roundedCount / values.length;

    if (roundedRatio >= ROUNDING_PATTERN_THRESHOLD) {
      anomalies.push({
        id: generateId(),
        payrollId,
        employeeDoc: null,
        category: 'systematic_error',
        confidence: roundedRatio >= 0.9 ? 'high' : 'medium',
        description: `Patrón de redondeo sospechoso en "${col}": ${(roundedRatio * 100).toFixed(0)}% de los valores terminan en números redondos`,
        recommendation: `Verificar si los valores en "${col}" están siendo redondeados incorrectamente.`,
        dataPoints: {
          currentValue: roundedCount,
          historicalAverage: values.length * 0.3,
          deviation: Number(((roundedRatio - 0.3) * 100).toFixed(2)),
          periods: [],
        },
      });
    }
  }

  return anomalies;
}

// ── Main Message Handler ────────────────────────────────────────────

self.onmessage = (event: MessageEvent<AnomalyDetectMessage>) => {
  const { type } = event.data;

  if (type === 'cancel') {
    cancelled = true;
    return;
  }

  if (type !== 'anomaly-detect') return;

  cancelled = false;

  try {
    const { currentRows = [], historicalData = [], payrollId = '' } = event.data;

    reportProgress(5);

    if (currentRows.length === 0) {
      self.postMessage({ type: 'result', result: [] });
      return;
    }

    let lastProgressTime = Date.now();
    const allAnomalies: AnomalyResult[] = [];

    // Phase 1: Outlier detection (5% → 40%)
    reportProgress(10);
    const outliers = detectOutliers(currentRows, historicalData, payrollId);
    allAnomalies.push(...outliers);

    if (cancelled) {
      self.postMessage({ type: 'error', message: 'Cancelled' });
      return;
    }

    // Report progress at 500ms intervals
    const now1 = Date.now();
    if (now1 - lastProgressTime >= PROGRESS_INTERVAL_MS) {
      reportProgress(40);
      lastProgressTime = now1;
    } else {
      reportProgress(40);
    }

    // Phase 2: Inter-period variations (40% → 70%)
    const variations = detectInterPeriodVariations(currentRows, historicalData, payrollId);
    allAnomalies.push(...variations);

    if (cancelled) {
      self.postMessage({ type: 'error', message: 'Cancelled' });
      return;
    }

    reportProgress(70);

    // Phase 3: Rounding patterns (70% → 90%)
    const rounding = detectRoundingPatterns(currentRows, payrollId);
    allAnomalies.push(...rounding);

    if (cancelled) {
      self.postMessage({ type: 'error', message: 'Cancelled' });
      return;
    }

    reportProgress(95);

    self.postMessage({ type: 'result', result: allAnomalies });
    reportProgress(100);
  } catch (err) {
    self.postMessage({
      type: 'error',
      message: err instanceof Error ? err.message : 'Error in anomaly detection',
    });
  }
};
