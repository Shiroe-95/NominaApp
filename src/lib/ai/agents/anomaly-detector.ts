/**
 * AnomalyDetector Agent — Detects atypical patterns in payroll data.
 *
 * Registered in AgentBus v2 as 'anomaly-detector'.
 * Detects: outliers, inter-period variations, suspicious rounding patterns.
 * Compares current period against 6 previous periods.
 * Classifies: potential_fraud, systematic_error, seasonal_variation, legitimate_change.
 * Confidence levels: high, medium, low.
 * Generates natural language explanations and recommendations.
 * Falls back to industry benchmarks when no historical data is available.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6
 */

import { generateText } from 'ai';
import type { LanguageModel } from 'ai';
import type { AgentContext, AgentDefinition, AgentResult, PayrollRow, ToolDefinition } from '@/lib/ai/types';
import { createAdminClient } from '@/lib/supabase/admin';

// ── Types ───────────────────────────────────────────────────────────

export type AnomalyCategory =
  | 'potential_fraud'
  | 'systematic_error'
  | 'seasonal_variation'
  | 'legitimate_change';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface AnomalyDataPoints {
  currentValue: number;
  historicalAverage: number;
  deviation: number;
  periods: { year: number; month: number; value: number }[];
}

export interface AnomalyResult {
  id: string;
  payrollId: string;
  employeeDoc: string | null;
  category: AnomalyCategory;
  confidence: ConfidenceLevel;
  description: string;
  recommendation: string;
  dataPoints: AnomalyDataPoints;
}

export interface BenchmarkReference {
  industry: string;
  countryCode: string;
  companySize: string;
  avgCostPerEmployee: number;
  avgContributionRatio: number;
  avgRiskScore: number;
  sampleCount: number;
}

// ── Constants ───────────────────────────────────────────────────────

const HISTORICAL_PERIODS = 6;
const OUTLIER_ZSCORE_HIGH = 3.0;
const OUTLIER_ZSCORE_MEDIUM = 2.0;
const VARIATION_THRESHOLD_HIGH = 0.30; // 30%
const VARIATION_THRESHOLD_MEDIUM = 0.15; // 15%
const ROUNDING_PATTERN_THRESHOLD = 0.7; // 70% of values ending in 00/000
const MIN_BENCHMARK_SAMPLE = 10;

const ANOMALY_DETECTOR_SYSTEM_PROMPT = `Eres un detector de anomalías experto en nómina. Tu trabajo es analizar datos de nómina y detectar patrones atípicos que podrían indicar fraude, errores sistemáticos, variaciones estacionales o cambios legítimos.

Para cada anomalía detectada, debes:
1. Clasificarla en una categoría: potential_fraud, systematic_error, seasonal_variation, legitimate_change
2. Asignar un nivel de confianza: high, medium, low
3. Generar una explicación clara en lenguaje natural
4. Proporcionar una recomendación de acción

Siempre referencia datos específicos (valores, porcentajes, periodos) en tus explicaciones.`;

// ── Statistical Helpers ─────────────────────────────────────────────

export function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function calculateStdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = calculateMean(values);
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1));
}

export function calculateZScore(value: number, mean: number, stdDev: number): number {
  if (stdDev === 0) return 0;
  return (value - mean) / stdDev;
}

// ── Detection Functions ─────────────────────────────────────────────

/**
 * Detect outlier values using z-score analysis.
 * Compares each employee's current values against historical averages.
 */
export function detectOutliers(
  currentRows: PayrollRow[],
  historicalData: { year: number; month: number; rows: PayrollRow[] }[],
): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];
  const numericColumns = getNumericColumns(currentRows);

  for (const row of currentRows) {
    const employeeDoc = String(row['documento'] ?? row['employee_doc'] ?? row['cedula'] ?? '');
    if (!employeeDoc) continue;

    for (const col of numericColumns) {
      const currentValue = Number(row[col]);
      if (isNaN(currentValue) || currentValue === 0) continue;

      // Gather historical values for this employee + column
      const historicalValues: { year: number; month: number; value: number }[] = [];
      for (const period of historicalData) {
        const match = period.rows.find(
          (r) =>
            String(r['documento'] ?? r['employee_doc'] ?? r['cedula'] ?? '') === employeeDoc,
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
          id: crypto.randomUUID(),
          payrollId: '',
          employeeDoc,
          category: classifyOutlier(absZ, deviation),
          confidence,
          description: `Valor atípico en "${col}" para empleado ${employeeDoc}: ${currentValue.toLocaleString()} (promedio histórico: ${mean.toLocaleString()}, desviación: ${deviation.toFixed(1)}%, z-score: ${absZ.toFixed(2)})`,
          recommendation: generateOutlierRecommendation(confidence, col, deviation),
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

/**
 * Detect significant inter-period variations.
 * Compares aggregate totals between current and previous periods.
 */
export function detectInterPeriodVariations(
  currentRows: PayrollRow[],
  historicalData: { year: number; month: number; rows: PayrollRow[] }[],
): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];
  const numericColumns = getNumericColumns(currentRows);

  for (const col of numericColumns) {
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
        id: crypto.randomUUID(),
        payrollId: '',
        employeeDoc: null,
        category: classifyVariation(absVariation, historicalTotals),
        confidence,
        description: `${direction.charAt(0).toUpperCase() + direction.slice(1)} significativo en "${col}": ${(variationPct * 100).toFixed(1)}% respecto al promedio de ${historicalTotals.length} periodos anteriores (actual: ${currentTotal.toLocaleString()}, promedio: ${avgTotal.toLocaleString()})`,
        recommendation: `Revisar el concepto "${col}" para identificar la causa del ${direction} del ${(absVariation * 100).toFixed(1)}%. ${confidence === 'high' ? 'Se recomienda revisión urgente.' : 'Verificar si corresponde a cambios esperados.'}`,
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

/**
 * Detect suspicious rounding patterns.
 * Flags when an unusually high percentage of values end in round numbers.
 */
export function detectRoundingPatterns(currentRows: PayrollRow[]): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];
  const numericColumns = getNumericColumns(currentRows);

  for (const col of numericColumns) {
    const values = currentRows
      .map((r) => Number(r[col]))
      .filter((v) => !isNaN(v) && v > 0);

    if (values.length < 5) continue;

    // Check for suspicious rounding (values ending in 000 or 00)
    const roundedCount = values.filter((v) => v % 1000 === 0 || v % 100 === 0).length;
    const roundedRatio = roundedCount / values.length;

    if (roundedRatio >= ROUNDING_PATTERN_THRESHOLD) {
      const mean = calculateMean(values);

      anomalies.push({
        id: crypto.randomUUID(),
        payrollId: '',
        employeeDoc: null,
        category: 'systematic_error',
        confidence: roundedRatio >= 0.9 ? 'high' : 'medium',
        description: `Patrón de redondeo sospechoso en "${col}": ${(roundedRatio * 100).toFixed(0)}% de los valores (${roundedCount}/${values.length}) terminan en números redondos (múltiplos de 100 o 1000)`,
        recommendation: `Verificar si los valores en "${col}" están siendo redondeados incorrectamente. Esto podría indicar un error en el cálculo de nómina o manipulación de datos.`,
        dataPoints: {
          currentValue: roundedCount,
          historicalAverage: values.length * 0.3, // expected ~30% rounding naturally
          deviation: Number(((roundedRatio - 0.3) * 100).toFixed(2)),
          periods: [],
        },
      });
    }
  }

  return anomalies;
}

// ── Classification Helpers ──────────────────────────────────────────

function classifyOutlier(zScore: number, deviationPct: number): AnomalyCategory {
  // Very high z-score with large positive deviation → potential fraud
  if (zScore >= OUTLIER_ZSCORE_HIGH && deviationPct > 50) return 'potential_fraud';
  // High z-score → systematic error
  if (zScore >= OUTLIER_ZSCORE_HIGH) return 'systematic_error';
  // Moderate deviation → could be legitimate
  if (Math.abs(deviationPct) < 20) return 'legitimate_change';
  return 'systematic_error';
}

function classifyVariation(
  absVariation: number,
  historicalTotals: { year: number; month: number; value: number }[],
): AnomalyCategory {
  // Check for seasonal pattern: if similar variation happened in same month previously
  if (historicalTotals.length >= 4) {
    const values = historicalTotals.map((h) => h.value);
    const stdDev = calculateStdDev(values);
    const mean = calculateMean(values);
    const cv = mean !== 0 ? stdDev / mean : 0;
    // High coefficient of variation suggests seasonal pattern
    if (cv > 0.15) return 'seasonal_variation';
  }

  if (absVariation >= 0.5) return 'potential_fraud';
  if (absVariation >= VARIATION_THRESHOLD_HIGH) return 'systematic_error';
  return 'legitimate_change';
}

function generateOutlierRecommendation(
  confidence: ConfidenceLevel,
  column: string,
  deviationPct: number,
): string {
  if (confidence === 'high') {
    return `Revisión urgente requerida: el valor en "${column}" presenta una desviación del ${deviationPct.toFixed(1)}% respecto al histórico. Verificar con el departamento de nómina y comparar contra documentos fuente.`;
  }
  return `Verificar el valor en "${column}" (desviación del ${deviationPct.toFixed(1)}%). Podría ser un cambio legítimo (promoción, ajuste salarial) o un error de captura.`;
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
    // Check if at least some values in this column are numeric
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

// ── Benchmark Fallback ──────────────────────────────────────────────

/**
 * Fetch industry benchmarks from the database when no historical data exists.
 * Requires minimum sample count for statistical significance.
 */
export async function fetchBenchmarks(
  countryCode: string,
  companySize?: string,
  industry?: string,
): Promise<BenchmarkReference | null> {
  try {
    const supabase = createAdminClient();
    let query = supabase
      .from('benchmark_data')
      .select('*')
      .eq('country_code', countryCode)
      .gte('sample_count', MIN_BENCHMARK_SAMPLE)
      .order('period_year', { ascending: false })
      .order('period_quarter', { ascending: false })
      .limit(1);

    if (companySize) query = query.eq('company_size', companySize);
    if (industry) query = query.eq('industry', industry);

    const { data, error } = await query;
    if (error || !data || data.length === 0) return null;

    const row = data[0];
    return {
      industry: row.industry,
      countryCode: row.country_code,
      companySize: row.company_size,
      avgCostPerEmployee: Number(row.avg_cost_per_employee),
      avgContributionRatio: Number(row.avg_contribution_ratio),
      avgRiskScore: Number(row.avg_risk_score),
      sampleCount: row.sample_count,
    };
  } catch {
    return null;
  }
}

/**
 * Compare current payroll against industry benchmarks.
 */
export function compareAgainstBenchmarks(
  currentRows: PayrollRow[],
  benchmark: BenchmarkReference,
): AnomalyResult[] {
  const anomalies: AnomalyResult[] = [];
  const employeeCount = currentRows.length;
  if (employeeCount === 0) return anomalies;

  // Calculate total cost from numeric columns
  const numericCols = getNumericColumns(currentRows);
  let totalCost = 0;
  for (const col of numericCols) {
    totalCost += sumColumn(currentRows, col);
  }

  const costPerEmployee = totalCost / employeeCount;
  const benchmarkCost = benchmark.avgCostPerEmployee;

  if (benchmarkCost > 0) {
    const deviation = ((costPerEmployee - benchmarkCost) / benchmarkCost) * 100;
    if (Math.abs(deviation) >= 20) {
      anomalies.push({
        id: crypto.randomUUID(),
        payrollId: '',
        employeeDoc: null,
        category: deviation > 50 ? 'potential_fraud' : 'systematic_error',
        confidence: Math.abs(deviation) >= 40 ? 'high' : 'medium',
        description: `Costo por empleado (${costPerEmployee.toLocaleString()}) difiere ${deviation.toFixed(1)}% del benchmark de la industria (${benchmarkCost.toLocaleString()}) para ${benchmark.countryCode}, tamaño ${benchmark.companySize} (muestra: ${benchmark.sampleCount} empresas)`,
        recommendation: `Comparar la estructura de costos contra empresas similares. ${deviation > 0 ? 'Los costos están por encima' : 'Los costos están por debajo'} del promedio de la industria.`,
        dataPoints: {
          currentValue: costPerEmployee,
          historicalAverage: benchmarkCost,
          deviation: Number(deviation.toFixed(2)),
          periods: [],
        },
      });
    }
  }

  return anomalies;
}

// ── Persistence ─────────────────────────────────────────────────────

/**
 * Save detected anomalies to the anomaly_detections table.
 */
export async function saveAnomalies(
  anomalies: AnomalyResult[],
  workspaceId: string,
  payrollId: string,
): Promise<void> {
  if (anomalies.length === 0) return;

  const supabase = createAdminClient();
  const rows = anomalies.map((a) => ({
    payroll_id: payrollId,
    workspace_id: workspaceId,
    employee_doc: a.employeeDoc,
    category: a.category,
    confidence: a.confidence,
    description: a.description,
    recommendation: a.recommendation,
    data_points: a.dataPoints,
  }));

  const { error } = await supabase.from('anomaly_detections').insert(rows);
  if (error) {
    throw new Error(`Failed to save anomalies: ${error.message}`);
  }
}

/**
 * Fetch historical payroll data for the last N periods.
 */
export async function fetchHistoricalData(
  workspaceId: string,
  companyId: string,
  currentYear: number,
  currentMonth: number,
  periodsBack: number = HISTORICAL_PERIODS,
): Promise<{ year: number; month: number; rows: PayrollRow[] }[]> {
  try {
    const supabase = createAdminClient();

    // Calculate the date range for historical periods
    const periods: { year: number; month: number }[] = [];
    let y = currentYear;
    let m = currentMonth;
    for (let i = 0; i < periodsBack; i++) {
      m--;
      if (m < 1) {
        m = 12;
        y--;
      }
      periods.push({ year: y, month: m });
    }

    // Fetch payroll uploads for these periods
    const { data: payrolls, error } = await supabase
      .from('payroll_uploads')
      .select('id, period_year, period_month, parsed_data')
      .eq('workspace_id', workspaceId)
      .eq('company_id', companyId)
      .in('period_year', [...new Set(periods.map((p) => p.year))])
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false });

    if (error || !payrolls) return [];

    return (payrolls as { id: string; period_year: number; period_month: number; parsed_data: unknown }[])
      .filter((p) =>
        periods.some((period) => period.year === p.period_year && period.month === p.period_month),
      )
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
 * Use AI to generate natural language explanations for anomalies.
 */
async function enhanceWithAI(
  anomalies: AnomalyResult[],
  model: LanguageModel,
  countryCode: string,
): Promise<{ enhancedDescriptions: Map<string, { description: string; recommendation: string }> }> {
  const enhancedDescriptions = new Map<string, { description: string; recommendation: string }>();

  if (anomalies.length === 0) return { enhancedDescriptions };

  try {
    const anomalySummary = anomalies
      .slice(0, 15) // Limit to avoid token overflow
      .map(
        (a) =>
          `[${a.confidence.toUpperCase()}] ${a.category} — ${a.employeeDoc ?? 'Agregado'}: ${a.description}`,
      )
      .join('\n');

    const { text } = await generateText({
      model,
      system: ANOMALY_DETECTOR_SYSTEM_PROMPT,
      prompt: `País: ${countryCode}

Analiza las siguientes ${anomalies.length} anomalías detectadas en datos de nómina y genera para cada una:
1. Una explicación mejorada en lenguaje natural (clara para un gerente no técnico)
2. Una recomendación de acción específica

Anomalías:
${anomalySummary}

Responde en formato JSON array:
[{"id": "...", "description": "...", "recommendation": "..."}]`,
    });

    // Parse AI response
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          id?: string;
          description?: string;
          recommendation?: string;
        }[];
        for (let i = 0; i < Math.min(parsed.length, anomalies.length); i++) {
          const entry = parsed[i];
          if (entry?.description && entry?.recommendation) {
            enhancedDescriptions.set(anomalies[i].id, {
              description: entry.description,
              recommendation: entry.recommendation,
            });
          }
        }
      }
    } catch {
      // If parsing fails, keep original descriptions
    }
  } catch {
    // If AI enhancement fails, keep original descriptions
  }

  return { enhancedDescriptions };
}

// ── Agent Definition ────────────────────────────────────────────────

export function createAnomalyDetectorAgent(): AgentDefinition {
  const tools: ToolDefinition[] = [
    {
      name: 'detectAnomalies',
      description:
        'Analiza datos de nómina para detectar anomalías: outliers, variaciones entre periodos y patrones de redondeo sospechosos.',
      parameters: {
        type: 'object',
        properties: {
          payrollData: { type: 'array', description: 'Filas de datos de nómina del periodo actual' },
          historicalData: {
            type: 'array',
            description: 'Datos históricos de periodos anteriores para comparación',
          },
          countryCode: { type: 'string', description: 'Código de país ISO 2' },
          companySize: { type: 'string', description: 'Tamaño de empresa: small, medium, large, enterprise' },
          industry: { type: 'string', description: 'Industria para benchmarks' },
        },
        required: ['payrollData', 'countryCode'],
      },
    },
  ];

  async function execute(
    context: AgentContext,
    model: LanguageModel,
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const rows = context.payrollData ?? [];

    if (rows.length === 0) {
      return {
        agentName: 'anomaly-detector',
        success: true,
        data: { anomalies: [], message: 'No payroll data provided for analysis' },
        tokensUsed: 0,
        providerUsed: model.modelId ?? 'unknown',
        latencyMs: Date.now() - startTime,
      };
    }

    // Gather historical data from context or empty array
    const historicalData =
      (context.previousResults?.['historicalData'] as {
        year: number;
        month: number;
        rows: PayrollRow[];
      }[]) ?? [];

    // Run all detection algorithms
    const allAnomalies: AnomalyResult[] = [];

    // 1. Outlier detection (requires historical data)
    if (historicalData.length >= 2) {
      allAnomalies.push(...detectOutliers(rows, historicalData));
    }

    // 2. Inter-period variation detection
    if (historicalData.length >= 1) {
      allAnomalies.push(...detectInterPeriodVariations(rows, historicalData));
    }

    // 3. Rounding pattern detection (no historical data needed)
    allAnomalies.push(...detectRoundingPatterns(rows));

    // 4. Benchmark comparison fallback when no historical data
    if (historicalData.length === 0) {
      const benchmark = await fetchBenchmarks(context.countryCode);
      if (benchmark) {
        allAnomalies.push(...compareAgainstBenchmarks(rows, benchmark));
      }
    }

    // Enhance descriptions with AI
    let totalTokens = 0;
    if (allAnomalies.length > 0) {
      const { enhancedDescriptions } = await enhanceWithAI(
        allAnomalies,
        model,
        context.countryCode,
      );

      // Apply enhanced descriptions
      for (const anomaly of allAnomalies) {
        const enhanced = enhancedDescriptions.get(anomaly.id);
        if (enhanced) {
          anomaly.description = enhanced.description;
          anomaly.recommendation = enhanced.recommendation;
        }
      }
    }

    // Sort by confidence (high first) then by category priority
    const categoryPriority: Record<AnomalyCategory, number> = {
      potential_fraud: 0,
      systematic_error: 1,
      seasonal_variation: 2,
      legitimate_change: 3,
    };
    const confidencePriority: Record<ConfidenceLevel, number> = {
      high: 0,
      medium: 1,
      low: 2,
    };

    allAnomalies.sort((a, b) => {
      const confDiff = confidencePriority[a.confidence] - confidencePriority[b.confidence];
      if (confDiff !== 0) return confDiff;
      return categoryPriority[a.category] - categoryPriority[b.category];
    });

    return {
      agentName: 'anomaly-detector',
      success: true,
      data: {
        anomalies: allAnomalies,
        summary: {
          total: allAnomalies.length,
          byCategory: {
            potential_fraud: allAnomalies.filter((a) => a.category === 'potential_fraud').length,
            systematic_error: allAnomalies.filter((a) => a.category === 'systematic_error').length,
            seasonal_variation: allAnomalies.filter((a) => a.category === 'seasonal_variation').length,
            legitimate_change: allAnomalies.filter((a) => a.category === 'legitimate_change').length,
          },
          byConfidence: {
            high: allAnomalies.filter((a) => a.confidence === 'high').length,
            medium: allAnomalies.filter((a) => a.confidence === 'medium').length,
            low: allAnomalies.filter((a) => a.confidence === 'low').length,
          },
          usedBenchmarks: historicalData.length === 0,
          historicalPeriodsAnalyzed: historicalData.length,
        },
      },
      tokensUsed: totalTokens,
      providerUsed: model.modelId ?? 'unknown',
      latencyMs: Date.now() - startTime,
    };
  }

  return {
    name: 'anomaly-detector',
    systemPrompt: ANOMALY_DETECTOR_SYSTEM_PROMPT,
    tools,
    execute,
  };
}
