/**
 * PredictiveAnalytics Agent — Cost forecasting for payroll data.
 *
 * Registered in AgentBus v2 as 'predictive'.
 * Generates 3/6/12-month cost forecasts from historical data.
 * Considers: trends, regulatory changes, seasonality, headcount growth.
 * Outputs optimistic/expected/pessimistic bands.
 * Alerts on >15% cost increase projections.
 * Auto-recalculates on new payroll data.
 * User-adjustable parameters: growth rate, salary increase, regulatory changes.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6
 */

import { generateText } from 'ai';
import type { LanguageModel } from 'ai';
import type { AgentContext, AgentDefinition, AgentResult, PayrollRow, ToolDefinition } from '@/lib/ai/types';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ForecastParamsInput } from '@/lib/schemas/world-class-schemas';

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

export interface ForecastResult {
  companyId: string;
  countryCode: string;
  generatedAt: string;
  monthsAhead: 3 | 6 | 12;
  bands: ForecastBand[];
  alerts: CostAlert[];
  parameters: ForecastParameters;
  historicalSummary: HistoricalSummary;
  narrative: string;
}

export interface ForecastParameters {
  growthRate: number;
  salaryIncrease: number;
  regulatoryChanges: RegulatoryChange[];
}

export interface RegulatoryChange {
  description: string;
  impactPercentage: number;
  effectiveMonth: number;
}

export interface HistoricalSummary {
  periodsAnalyzed: number;
  avgMonthlyCost: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
  seasonalityDetected: boolean;
}

// ── Constants ───────────────────────────────────────────────────────

const COST_ALERT_THRESHOLD = 0.15; // 15%
const DEFAULT_GROWTH_RATE = 0.02; // 2% monthly headcount growth
const DEFAULT_SALARY_INCREASE = 0.0; // 0% unless specified
const SEASONALITY_VARIANCE_THRESHOLD = 0.10; // 10% CV indicates seasonality
const OPTIMISTIC_FACTOR = 0.85;
const PESSIMISTIC_FACTOR = 1.20;
const MIN_HISTORICAL_PERIODS = 2;

const PREDICTIVE_SYSTEM_PROMPT = `Eres un analista financiero experto en costos de nómina. Tu trabajo es generar proyecciones de costos precisas basadas en datos históricos, considerando tendencias, estacionalidad, cambios regulatorios y crecimiento de plantilla.

Para cada proyección debes:
1. Analizar la tendencia histórica de costos
2. Identificar patrones estacionales (bonificaciones, primas, etc.)
3. Incorporar cambios regulatorios conocidos (salario mínimo, contribuciones)
4. Considerar el crecimiento esperado de la plantilla
5. Generar bandas de confianza: optimista, esperado, pesimista

Siempre explica los supuestos detrás de tus proyecciones y alerta sobre incrementos significativos.`;

// ── Statistical / Forecasting Helpers ───────────────────────────────

/**
 * Calculate the mean of an array of numbers.
 */
export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calculate the standard deviation (sample) of an array of numbers.
 */
export function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1));
}

/**
 * Detect a linear trend using simple linear regression.
 * Returns slope (change per period) and the trend direction.
 */
export function detectTrend(values: number[]): {
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

/**
 * Detect seasonality by checking the coefficient of variation.
 * If CV > threshold, seasonality is likely present.
 */
export function detectSeasonality(values: number[]): {
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

/**
 * Generate forecast bands for N months ahead.
 * Uses linear trend extrapolation with adjustments for growth, salary increases,
 * and regulatory changes.
 */
export function generateForecastBands(
  historicalCosts: { year: number; month: number; totalCost: number }[],
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
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }

    // Base projection: last cost + trend slope per period
    let baseCost = lastCost + slope * i;

    // Apply headcount growth rate (compounding)
    baseCost *= Math.pow(1 + params.growthRate, i);

    // Apply salary increase (compounding)
    baseCost *= Math.pow(1 + params.salaryIncrease, i);

    // Apply regulatory changes for the effective month
    for (const change of params.regulatoryChanges) {
      if (currentMonth >= change.effectiveMonth) {
        baseCost *= 1 + change.impactPercentage / 100;
      }
    }

    // Ensure non-negative
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

/**
 * Check forecast bands for cost increase alerts (>15% threshold).
 */
export function detectCostAlerts(
  bands: ForecastBand[],
  lastHistoricalCost: number,
): CostAlert[] {
  if (lastHistoricalCost <= 0 || bands.length === 0) return [];

  const alerts: CostAlert[] = [];

  for (const band of bands) {
    const increase = (band.expected - lastHistoricalCost) / lastHistoricalCost;
    if (increase > COST_ALERT_THRESHOLD) {
      alerts.push({
        message: `Proyección de incremento del ${(increase * 100).toFixed(1)}% en costos para ${band.month}/${band.year} respecto al último periodo.`,
        projectedIncrease: Number((increase * 100).toFixed(1)),
        month: band.month,
        year: band.year,
      });
    }
  }

  return alerts;
}

// ── Data Helpers ────────────────────────────────────────────────────

function getNumericColumns(rows: PayrollRow[]): string[] {
  if (rows.length === 0) return [];
  const firstRow = rows[0];
  const skipColumns = new Set([
    'id', 'documento', 'employee_doc', 'cedula', 'nombre', 'name',
    'cargo', 'position', 'departamento', 'department', 'fecha', 'date',
    'periodo', 'period', 'empresa', 'company', 'row_number',
  ]);

  return Object.keys(firstRow).filter((key) => {
    if (skipColumns.has(key.toLowerCase())) return false;
    const numericCount = rows
      .slice(0, 10)
      .filter((r) => {
        const v = Number(r[key]);
        return !isNaN(v) && v !== 0;
      }).length;
    return numericCount >= 3;
  });
}

function sumColumn(rows: PayrollRow[], col: string): number {
  return rows.reduce((sum, r) => {
    const v = Number(r[col]);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);
}

/**
 * Calculate total cost from all numeric columns in payroll rows.
 */
export function calculateTotalCost(rows: PayrollRow[]): number {
  const numericCols = getNumericColumns(rows);
  let total = 0;
  for (const col of numericCols) {
    total += sumColumn(rows, col);
  }
  return total;
}

/**
 * Extract historical cost series from payroll data.
 */
export function extractHistoricalCosts(
  historicalData: { year: number; month: number; rows: PayrollRow[] }[],
): { year: number; month: number; totalCost: number }[] {
  return historicalData
    .map((period) => ({
      year: period.year,
      month: period.month,
      totalCost: calculateTotalCost(period.rows),
    }))
    .filter((p) => p.totalCost > 0)
    .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month);
}

// ── Persistence ─────────────────────────────────────────────────────

/**
 * Save a forecast snapshot to the forecast_snapshots table.
 */
export async function saveForecastSnapshot(
  result: ForecastResult,
  workspaceId: string,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from('forecast_snapshots').insert({
    workspace_id: workspaceId,
    company_id: result.companyId,
    country_code: result.countryCode,
    projections: {
      bands: result.bands,
      alerts: result.alerts,
      narrative: result.narrative,
      historicalSummary: result.historicalSummary,
    },
    parameters: result.parameters,
  });

  if (error) {
    throw new Error(`Failed to save forecast snapshot: ${error.message}`);
  }
}

/**
 * Fetch historical payroll data for forecasting.
 */
export async function fetchHistoricalData(
  workspaceId: string,
  companyId: string,
  periodsBack: number = 12,
): Promise<{ year: number; month: number; rows: PayrollRow[] }[]> {
  try {
    const supabase = createAdminClient();

    const { data: payrolls, error } = await supabase
      .from('payroll_uploads')
      .select('id, period_year, period_month, parsed_data')
      .eq('workspace_id', workspaceId)
      .eq('company_id', companyId)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(periodsBack);

    if (error || !payrolls) return [];

    return (payrolls as { id: string; period_year: number; period_month: number; parsed_data: unknown }[])
      .map((p) => ({
        year: p.period_year,
        month: p.period_month,
        rows: Array.isArray(p.parsed_data) ? (p.parsed_data as PayrollRow[]) : [],
      }))
      .filter((p) => p.rows.length > 0);
  } catch {
    return [];
  }
}

// ── AI Enhancement ──────────────────────────────────────────────────

/**
 * Use AI to generate a narrative explanation of the forecast.
 */
async function generateNarrative(
  result: Omit<ForecastResult, 'narrative'>,
  model: LanguageModel,
): Promise<string> {
  try {
    const { text } = await generateText({
      model,
      system: PREDICTIVE_SYSTEM_PROMPT,
      prompt: `País: ${result.countryCode}
Periodos históricos analizados: ${result.historicalSummary.periodsAnalyzed}
Costo mensual promedio: ${result.historicalSummary.avgMonthlyCost.toLocaleString()}
Tendencia: ${result.historicalSummary.trend} (${result.historicalSummary.trendPercentage}%)
Estacionalidad detectada: ${result.historicalSummary.seasonalityDetected ? 'Sí' : 'No'}
Meses proyectados: ${result.monthsAhead}
Tasa de crecimiento: ${(result.parameters.growthRate * 100).toFixed(1)}%
Incremento salarial: ${(result.parameters.salaryIncrease * 100).toFixed(1)}%
Cambios regulatorios: ${result.parameters.regulatoryChanges.length > 0 ? result.parameters.regulatoryChanges.map((c) => `${c.description} (${c.impactPercentage}%, mes ${c.effectiveMonth})`).join('; ') : 'Ninguno'}
Alertas: ${result.alerts.length > 0 ? result.alerts.map((a) => a.message).join('; ') : 'Ninguna'}

Primer mes proyectado: ${result.bands[0]?.expected.toLocaleString() ?? 'N/A'}
Último mes proyectado: ${result.bands[result.bands.length - 1]?.expected.toLocaleString() ?? 'N/A'}

Genera un resumen ejecutivo de 2-3 párrafos en español explicando la proyección de costos, los factores considerados y las recomendaciones. Sé específico con números y porcentajes.`,
    });

    return text;
  } catch {
    return `Proyección de costos para ${result.monthsAhead} meses. Tendencia ${result.historicalSummary.trend} con ${result.alerts.length} alertas de incremento significativo.`;
  }
}

// ── Agent Definition ────────────────────────────────────────────────

export function createPredictiveAnalyticsAgent(): AgentDefinition {
  const tools: ToolDefinition[] = [
    {
      name: 'generateForecast',
      description:
        'Genera proyecciones de costos de nómina para 3, 6 o 12 meses basándose en datos históricos, tendencias, estacionalidad y cambios regulatorios.',
      parameters: {
        type: 'object',
        properties: {
          companyId: { type: 'string', description: 'UUID de la empresa' },
          monthsAhead: { type: 'number', description: 'Meses a proyectar: 3, 6 o 12' },
          growthRate: { type: 'number', description: 'Tasa de crecimiento mensual de plantilla (0-1)' },
          salaryIncrease: { type: 'number', description: 'Incremento salarial esperado (0-0.5)' },
          regulatoryChanges: {
            type: 'array',
            description: 'Cambios regulatorios anticipados',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                impactPercentage: { type: 'number' },
                effectiveMonth: { type: 'number' },
              },
            },
          },
        },
        required: ['companyId'],
      },
    },
  ];

  async function execute(
    context: AgentContext,
    model: LanguageModel,
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const rows = context.payrollData ?? [];

    // Extract parameters from context
    const params = (context.previousResults?.['forecastParams'] ?? {}) as Partial<ForecastParamsInput>;
    const monthsAhead: 3 | 6 | 12 = (params.months_ahead as 3 | 6 | 12) ?? 6;

    const forecastParams: ForecastParameters = {
      growthRate: params.growth_rate ?? DEFAULT_GROWTH_RATE,
      salaryIncrease: params.salary_increase ?? DEFAULT_SALARY_INCREASE,
      regulatoryChanges: (params.regulatory_changes ?? []).map((c: { description: string; impact_percentage: number; effective_month: number }) => ({
        description: c.description,
        impactPercentage: c.impact_percentage,
        effectiveMonth: c.effective_month,
      })),
    };

    // Gather historical data from context
    const historicalData =
      (context.previousResults?.['historicalData'] as {
        year: number;
        month: number;
        rows: PayrollRow[];
      }[]) ?? [];

    // Include current payroll data as the most recent period
    const allData = [...historicalData];
    if (rows.length > 0) {
      const now = new Date();
      allData.push({
        year: context.year ?? now.getFullYear(),
        month: now.getMonth() + 1,
        rows,
      });
    }

    if (allData.length < MIN_HISTORICAL_PERIODS) {
      return {
        agentName: 'predictive',
        success: true,
        data: {
          forecast: null,
          message: `Se requieren al menos ${MIN_HISTORICAL_PERIODS} periodos históricos para generar proyecciones. Periodos disponibles: ${allData.length}.`,
        },
        tokensUsed: 0,
        providerUsed: model.modelId ?? 'unknown',
        latencyMs: Date.now() - startTime,
      };
    }

    // Extract cost series
    const historicalCosts = extractHistoricalCosts(allData);

    if (historicalCosts.length < MIN_HISTORICAL_PERIODS) {
      return {
        agentName: 'predictive',
        success: true,
        data: {
          forecast: null,
          message: `Datos de costos insuficientes para generar proyecciones. Se encontraron ${historicalCosts.length} periodos con datos válidos.`,
        },
        tokensUsed: 0,
        providerUsed: model.modelId ?? 'unknown',
        latencyMs: Date.now() - startTime,
      };
    }

    // Analyze historical data
    const costValues = historicalCosts.map((h) => h.totalCost);
    const trend = detectTrend(costValues);
    const seasonality = detectSeasonality(costValues);
    const avgMonthlyCost = calculateMean(costValues);

    // Generate forecast bands
    const bands = generateForecastBands(historicalCosts, monthsAhead, forecastParams);

    // Detect cost alerts
    const lastCost = costValues[costValues.length - 1];
    const alerts = detectCostAlerts(bands, lastCost);

    // Build result (without narrative yet)
    const forecastBase: Omit<ForecastResult, 'narrative'> = {
      companyId: (params.company_id as string) ?? '',
      countryCode: context.countryCode,
      generatedAt: new Date().toISOString(),
      monthsAhead,
      bands,
      alerts,
      parameters: forecastParams,
      historicalSummary: {
        periodsAnalyzed: historicalCosts.length,
        avgMonthlyCost: Math.round(avgMonthlyCost),
        trend: trend.direction,
        trendPercentage: trend.percentageChange,
        seasonalityDetected: seasonality.detected,
      },
    };

    // Generate AI narrative
    const narrative = await generateNarrative(forecastBase, model);

    const forecast: ForecastResult = {
      ...forecastBase,
      narrative,
    };

    return {
      agentName: 'predictive',
      success: true,
      data: {
        forecast,
        summary: {
          monthsAhead,
          periodsAnalyzed: historicalCosts.length,
          trend: trend.direction,
          trendPercentage: trend.percentageChange,
          seasonalityDetected: seasonality.detected,
          alertCount: alerts.length,
          avgMonthlyCost: Math.round(avgMonthlyCost),
          firstProjectedCost: bands[0]?.expected ?? 0,
          lastProjectedCost: bands[bands.length - 1]?.expected ?? 0,
        },
      },
      tokensUsed: 0,
      providerUsed: model.modelId ?? 'unknown',
      latencyMs: Date.now() - startTime,
    };
  }

  return {
    name: 'predictive',
    systemPrompt: PREDICTIVE_SYSTEM_PROMPT,
    tools,
    execute,
  };
}
