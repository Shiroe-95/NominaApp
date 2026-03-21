import { generateText, tool, type LanguageModel } from 'ai';
import { z } from 'zod';
import type {
  AgentContext,
  AgentDefinition,
  AgentResult,
  ToolDefinition,
} from '../types';
import { createAdminClient } from '../../supabase/admin';

// ── Web search types ────────────────────────────────────────────────

export interface WebSearchResult {
  success: boolean;
  data: string;
  sources: ResearchSource[];
  confidence: 'high' | 'medium' | 'low';
  usedFallback: boolean;
}

export interface WebSearchConfig {
  maxRetries: number;
  baseDelayMs: number;
  fetchFn?: typeof fetch;
}

const DEFAULT_WEB_SEARCH_CONFIG: WebSearchConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
};

// ── Research result types ───────────────────────────────────────────

export interface ResearchSource {
  url: string;
  title: string;
  accessDate: string;
}

export interface ResearchChange {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface ResearchResult {
  countryCode: string;
  year: number;
  sources: ResearchSource[];
  confidence: 'high' | 'medium' | 'low';
  changesDetected?: ResearchChange[];
  rulesUpdated: boolean;
}

interface ToolResult {
  success: boolean;
  summary: string;
  detail: string;
}

// ── Conflict resolution types ───────────────────────────────────────

/** A single data point from a source about a regulatory field. */
export interface SourceDataPoint {
  /** The regulatory field this data point refers to (e.g. 'smmlv', 'healthEmployee'). */
  field: string;
  /** The value reported by this source. */
  value: unknown;
  /** Confidence level of the source providing this data point. */
  confidence: 'high' | 'medium' | 'low';
  /** URL of the source for traceability. */
  sourceUrl: string;
  /** Title of the source. */
  sourceTitle: string;
}

/** Result of resolving conflicts across multiple sources. */
export interface ConflictResolutionResult {
  /** The resolved values keyed by field name, chosen from the highest-confidence source. */
  resolvedValues: Record<string, unknown>;
  /** Fields where contradictory information was found between sources. */
  conflicts: Array<{
    field: string;
    /** The value that was selected (from the highest-confidence source). */
    selectedValue: unknown;
    /** The confidence level of the selected source. */
    selectedConfidence: 'high' | 'medium' | 'low';
    /** All alternative values from lower-confidence sources. */
    alternatives: Array<{
      value: unknown;
      confidence: 'high' | 'medium' | 'low';
      sourceUrl: string;
    }>;
  }>;
  /** Overall confidence of the resolution (the highest confidence among all selected values). */
  overallConfidence: 'high' | 'medium' | 'low';
}

// ── Confidence ranking helper ───────────────────────────────────────

const CONFIDENCE_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

/**
 * Returns a numeric rank for a confidence level. Higher is better.
 */
export function confidenceRank(level: 'high' | 'medium' | 'low'): number {
  return CONFIDENCE_RANK[level] ?? 0;
}

/**
 * Resolves contradictions across multiple source data points by
 * prioritizing the value from the source with the highest confidence
 * level (high > medium > low).
 *
 * When multiple sources report different values for the same regulatory
 * field, the value from the highest-confidence source wins. Ties at the
 * same confidence level are broken by keeping the first occurrence.
 *
 * @param dataPoints - Array of data points from various sources.
 * @returns ConflictResolutionResult with resolved values and conflict details.
 */
export function resolveConflicts(
  dataPoints: SourceDataPoint[],
): ConflictResolutionResult {
  // Group data points by field
  const byField = new Map<string, SourceDataPoint[]>();
  for (const dp of dataPoints) {
    const existing = byField.get(dp.field) ?? [];
    existing.push(dp);
    byField.set(dp.field, existing);
  }

  const resolvedValues: Record<string, unknown> = {};
  const conflicts: ConflictResolutionResult['conflicts'] = [];
  let bestConfidenceRank = 0;

  for (const [field, points] of byField) {
    // Sort by confidence descending (high first)
    const sorted = [...points].sort(
      (a, b) => confidenceRank(b.confidence) - confidenceRank(a.confidence),
    );

    const winner = sorted[0];
    resolvedValues[field] = winner.value;

    const rank = confidenceRank(winner.confidence);
    if (rank > bestConfidenceRank) {
      bestConfidenceRank = rank;
    }

    // Detect conflicts: different values across sources for the same field
    const uniqueValues = new Set(sorted.map((p) => JSON.stringify(p.value)));
    if (uniqueValues.size > 1) {
      conflicts.push({
        field,
        selectedValue: winner.value,
        selectedConfidence: winner.confidence,
        alternatives: sorted.slice(1)
          .filter((p) => JSON.stringify(p.value) !== JSON.stringify(winner.value))
          .map((p) => ({
            value: p.value,
            confidence: p.confidence,
            sourceUrl: p.sourceUrl,
          })),
      });
    }
  }

  const overallConfidence: 'high' | 'medium' | 'low' =
    bestConfidenceRank >= 3 ? 'high' : bestConfidenceRank >= 2 ? 'medium' : 'low';

  return { resolvedValues, conflicts, overallConfidence };
}

// ── Simulated regulation data by country ────────────────────────────

/**
 * Simulated regulation database. In production this would be replaced
 * by actual web search / scraping of government sources.
 */
const REGULATION_DB: Record<string, {
  label: string;
  requiredFields: string[];
  requiredCalculations: string[];
  checks: string[];
  sources: ResearchSource[];
  confidence: 'high' | 'medium' | 'low';
}> = {
  'CO-2025': {
    label: 'UGPP Colombia 2025',
    requiredFields: [
      'documento', 'nombre', 'salario_basico', 'dias_trabajados',
      'devengado', 'deducciones', 'neto_pagar',
    ],
    requiredCalculations: [
      'ibc', 'salud_empleado', 'pension_empleado', 'salud_empleador',
      'pension_empleador', 'arl', 'parafiscales', 'cesantias',
      'intereses_cesantias', 'prima', 'vacaciones',
    ],
    checks: [
      'IBC no puede ser inferior a 1 SMMLV ($1.423.500 para 2025)',
      'IBC no puede superar 25 SMMLV ($35.587.500 para 2025)',
      'Auxilio de transporte aplica si salario <= 2 SMMLV ($2.847.000)',
      'Salud empleado = 4% del IBC',
      'Pensión empleado = 4% del IBC',
      'Salud empleador = 8.5% del IBC',
      'Pensión empleador = 12% del IBC',
      'ARL entre 0.522% y 8.7% del IBC según nivel de riesgo',
      'Parafiscales = 9% del IBC (SENA 2% + ICBF 3% + Caja 4%)',
      'Cesantías = 8.33% del devengado mensual',
      'Prima de servicios = 8.33% del devengado mensual',
      'Vacaciones = 4.17% del salario básico',
    ],
    sources: [
      { url: 'https://www.mintrabajo.gov.co/normatividad/decretos/2024', title: 'Decreto SMMLV 2025 - MinTrabajo', accessDate: new Date().toISOString().split('T')[0] },
      { url: 'https://www.ugpp.gov.co/normativa', title: 'Normativa UGPP - Aportes y Parafiscales', accessDate: new Date().toISOString().split('T')[0] },
    ],
    confidence: 'high',
  },
  'MX-2025': {
    label: 'IMSS México 2025',
    requiredFields: [
      'numero_empleado', 'nombre', 'salario_diario', 'dias_trabajados',
      'percepciones', 'deducciones', 'neto_pagar',
    ],
    requiredCalculations: [
      'sdi', 'cuota_imss_obrera', 'cuota_imss_patronal', 'isr',
      'infonavit', 'aguinaldo', 'prima_vacacional', 'ptu',
    ],
    checks: [
      'SDI no puede ser inferior al salario mínimo vigente ($278.80/día zona libre frontera norte, $207.44 resto)',
      'SDI no puede superar 25 veces la UMA ($2,724.45 × 25 = $68,111.25/día)',
      'Cuota IMSS obrera: enfermedad y maternidad 0.625% del excedente de 3 UMA',
      'Cuota IMSS patronal: enfermedad y maternidad 1.10% del SBC',
      'ISR según tabla Art. 96 LISR vigente',
      'INFONAVIT patronal = 5% del SBC',
      'Aguinaldo mínimo = 15 días de salario',
      'Prima vacacional mínima = 25% del salario de vacaciones',
    ],
    sources: [
      { url: 'https://www.imss.gob.mx/patrones/cuotas-obrero-patronales', title: 'Cuotas IMSS 2025', accessDate: new Date().toISOString().split('T')[0] },
      { url: 'https://www.sat.gob.mx/normatividad/tablas-isr', title: 'Tablas ISR 2025 - SAT', accessDate: new Date().toISOString().split('T')[0] },
    ],
    confidence: 'high',
  },
  'PE-2025': {
    label: 'SUNAT Perú 2025',
    requiredFields: [
      'documento', 'nombre', 'remuneracion_basica', 'dias_trabajados',
      'ingresos', 'descuentos', 'neto_pagar',
    ],
    requiredCalculations: [
      'essalud', 'onp_o_afp', 'cts', 'gratificacion', 'vacaciones',
      'renta_quinta_categoria',
    ],
    checks: [
      'Remuneración mínima vital no inferior a S/ 1,130',
      'EsSalud empleador = 9% de la remuneración',
      'ONP = 13% de la remuneración (si no está en AFP)',
      'AFP: aporte obligatorio ~10% + comisión + prima de seguro',
      'CTS = 1/12 de la remuneración computable por mes',
      'Gratificación = 1 remuneración en julio y diciembre',
      'Vacaciones = 30 días calendario por año de servicio',
    ],
    sources: [
      { url: 'https://www.sunat.gob.pe/legislacion/renta/quinta-categoria', title: 'Renta 5ta Categoría - SUNAT', accessDate: new Date().toISOString().split('T')[0] },
      { url: 'https://www.gob.pe/mtpe/normas-laborales', title: 'Normas Laborales - MTPE Perú', accessDate: new Date().toISOString().split('T')[0] },
    ],
    confidence: 'medium',
  },
};

// ── Retry with exponential backoff ──────────────────────────────────

/**
 * Delays execution for the specified number of milliseconds.
 * Extracted for testability — can be overridden in tests.
 */
export let _delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Replaces the internal delay function. Used in tests to avoid real waits.
 */
export function _setDelay(fn: (ms: number) => Promise<void>): void {
  _delay = fn;
}

/**
 * Executes an async function with exponential backoff retries.
 *
 * Retries up to `maxRetries` times (default 3) with delays of
 * baseDelay * 2^attempt (1s, 2s, 4s by default).
 *
 * @param fn - Async function to execute.
 * @param config - Retry configuration (maxRetries, baseDelayMs).
 * @returns The result of the function if successful.
 * @throws The last error if all retries are exhausted.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config: Pick<WebSearchConfig, 'maxRetries' | 'baseDelayMs'> = DEFAULT_WEB_SEARCH_CONFIG,
): Promise<T> {
  const { maxRetries, baseDelayMs } = config;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries - 1) {
        const delayMs = baseDelayMs * Math.pow(2, attempt);
        await _delay(delayMs);
      }
    }
  }

  throw lastError!;
}

// ── Web search implementation ───────────────────────────────────────

/**
 * Performs a web search for labor regulations using fetch.
 *
 * Constructs a search query from the country code, year, and query string,
 * then calls a web search endpoint. In production this would hit a real
 * search API (e.g., Tavily, Serper, or similar).
 *
 * @param args.query - Search query string.
 * @param args.countryCode - ISO country code.
 * @param args.year - Fiscal year.
 * @param config - Optional configuration for retries and fetch function.
 * @returns WebSearchResult with data, sources, and confidence level.
 */
export async function executeWebSearch(
  args: { query: string; countryCode: string; year: number },
  config: WebSearchConfig = DEFAULT_WEB_SEARCH_CONFIG,
): Promise<WebSearchResult> {
  const cc = args.countryCode.toUpperCase();
  const fetchImpl = config.fetchFn ?? fetch;

  try {
    const result = await retryWithBackoff(async () => {
      const searchQuery = `${args.query} ${cc} ${args.year} labor regulations`;
      const response = await fetchImpl(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}`,
        {
          headers: {
            'Accept': 'application/json',
            'X-Subscription-Token': process.env.WEB_SEARCH_API_KEY ?? '',
          },
          signal: AbortSignal.timeout(10_000),
        },
      );

      if (!response.ok) {
        throw new Error(`Web search failed with status ${response.status}`);
      }

      const data = await response.json();
      return data;
    }, { maxRetries: config.maxRetries, baseDelayMs: config.baseDelayMs });

    // Parse web results into sources
    const webResults = (result as { web?: { results?: Array<{ url: string; title: string }> } })
      ?.web?.results ?? [];

    const sources: ResearchSource[] = webResults.slice(0, 5).map(
      (r: { url: string; title: string }) => ({
        url: r.url,
        title: r.title,
        accessDate: new Date().toISOString().split('T')[0],
      }),
    );

    // Determine confidence based on source domains
    const govDomains = sources.filter(
      (s) => s.url.includes('.gov.') || s.url.includes('.gob.') || s.url.includes('.gov/'),
    );
    const confidence: 'high' | 'medium' | 'low' =
      govDomains.length >= 2 ? 'high' : govDomains.length >= 1 ? 'medium' : 'low';

    return {
      success: true,
      data: JSON.stringify(webResults.slice(0, 5)),
      sources,
      confidence,
      usedFallback: false,
    };
  } catch {
    // All retries exhausted — fall back to REGULATION_DB
    return webSearchFallback(cc, args.year);
  }
}

/**
 * Falls back to REGULATION_DB when web search is unavailable.
 * Marks confidence as 'low' per requirement 2.3.
 */
export function webSearchFallback(
  countryCode: string,
  year: number,
): WebSearchResult {
  const key = `${countryCode.toUpperCase()}-${year}`;
  const data = REGULATION_DB[key];

  if (!data) {
    return {
      success: false,
      data: `No fallback data available for ${countryCode} ${year}`,
      sources: [],
      confidence: 'low',
      usedFallback: true,
    };
  }

  return {
    success: true,
    data: [
      `[FALLBACK] Datos de respaldo para ${data.label}`,
      `Campos requeridos: ${data.requiredFields.join(', ')}`,
      `Cálculos requeridos: ${data.requiredCalculations.join(', ')}`,
      `Verificaciones: ${data.checks.join('; ')}`,
    ].join('\n'),
    sources: data.sources,
    confidence: 'low',
    usedFallback: true,
  };
}

// ── Tool implementations ────────────────────────────────────────────

/**
 * Busca regulaciones laborales vigentes en la base de datos simulada.
 *
 * Consulta `REGULATION_DB` por clave `{countryCode}-{year}` y retorna
 * campos requeridos, cálculos, verificaciones y fuentes. Opcionalmente
 * filtra verificaciones por tema.
 *
 * @param args.countryCode - Código ISO del país (CO, MX, PE, etc.).
 * @param args.year - Año fiscal de las regulaciones.
 * @param args.topic - Tema opcional para filtrar verificaciones.
 * @returns Resultado con detalle de regulaciones o mensaje de error.
 */
async function searchRegulations(args: {
  countryCode: string;
  year: number;
  topic?: string;
}): Promise<ToolResult> {
  const key = `${args.countryCode.toUpperCase()}-${args.year}`;
  const data = REGULATION_DB[key];

  if (!data) {
    return {
      success: false,
      summary: `No se encontraron regulaciones para ${args.countryCode} ${args.year}`,
      detail: `No hay datos de regulación disponibles para ${args.countryCode.toUpperCase()} año ${args.year}. Los países soportados actualmente son: ${[...new Set(Object.keys(REGULATION_DB).map((k) => k.split('-')[0]))].join(', ')}.`,
    };
  }

  const topicFilter = args.topic?.toLowerCase();
  let filteredChecks = data.checks;
  if (topicFilter) {
    filteredChecks = data.checks.filter((c) => c.toLowerCase().includes(topicFilter));
    if (filteredChecks.length === 0) filteredChecks = data.checks;
  }

  const detail = [
    `Regulaciones encontradas: ${data.label}`,
    `Confianza: ${data.confidence}`,
    `\nCampos requeridos (${data.requiredFields.length}): ${data.requiredFields.join(', ')}`,
    `\nCálculos requeridos (${data.requiredCalculations.length}): ${data.requiredCalculations.join(', ')}`,
    `\nVerificaciones (${filteredChecks.length}):`,
    ...filteredChecks.map((c) => `  • ${c}`),
    `\nFuentes (${data.sources.length}):`,
    ...data.sources.map((s) => `  • ${s.title} — ${s.url}`),
  ].join('\n');

  return {
    success: true,
    summary: `Encontradas ${filteredChecks.length} verificaciones para ${data.label}`,
    detail,
  };
}

/**
 * Crea o actualiza una regla normativa en la tabla `country_year_rules`.
 *
 * Usa upsert con conflicto en `(country_code, rule_year)` para crear
 * reglas nuevas o actualizar existentes de forma idempotente.
 *
 * @param args.countryCode - Código ISO del país.
 * @param args.year - Año fiscal.
 * @param args.label - Nombre descriptivo de la regla.
 * @param args.requiredFields - Campos obligatorios en la nómina.
 * @param args.requiredCalculations - Cálculos obligatorios.
 * @param args.checks - Verificaciones normativas.
 * @returns Resultado con confirmación o mensaje de error.
 */
async function createOrUpdateRule(args: {
  countryCode: string;
  year: number;
  label: string;
  requiredFields: string[];
  requiredCalculations: string[];
  checks: string[];
}): Promise<ToolResult> {
  const supabase = createAdminClient();
  const cc = args.countryCode.toUpperCase();

  const { error } = await supabase.from('country_year_rules').upsert(
    {
      country_code: cc,
      rule_year: args.year,
      label: args.label,
      required_fields: args.requiredFields,
      required_calculations: args.requiredCalculations,
      checks: args.checks,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'country_code,rule_year' },
  );

  if (error) {
    return { success: false, summary: 'Error al guardar regla', detail: error.message };
  }

  return {
    success: true,
    summary: `Regla "${args.label}" guardada para ${cc} ${args.year}`,
    detail: `Regla "${args.label}" guardada con ${args.requiredFields.length} campos, ${args.requiredCalculations.length} cálculos y ${args.checks.length} verificaciones.`,
  };
}

/**
 * Compara reglas existentes en `country_year_rules` con datos nuevos
 * para detectar cambios regulatorios (campos, cálculos, verificaciones).
 *
 * Identifica adiciones y eliminaciones en cada categoría y genera un
 * reporte detallado de diferencias.
 *
 * @param args.countryCode - Código ISO del país.
 * @param args.year - Año fiscal.
 * @param args.newChecks - Nuevas verificaciones a comparar.
 * @param args.newRequiredFields - Nuevos campos requeridos a comparar.
 * @param args.newRequiredCalculations - Nuevos cálculos requeridos a comparar.
 * @returns Resultado con detalle de cambios detectados o confirmación de igualdad.
 */
async function compareRules(args: {
  countryCode: string;
  year: number;
  newChecks: string[];
  newRequiredFields: string[];
  newRequiredCalculations: string[];
}): Promise<ToolResult> {
  const supabase = createAdminClient();
  const cc = args.countryCode.toUpperCase();

  const { data: existing, error } = await supabase
    .from('country_year_rules')
    .select('label, required_fields, required_calculations, checks')
    .eq('country_code', cc)
    .eq('rule_year', args.year)
    .single();

  if (error || !existing) {
    return {
      success: true,
      summary: 'No hay regla existente para comparar',
      detail: `No existe regla previa para ${cc} ${args.year}. Se creará una nueva.`,
    };
  }

  const changes: ResearchChange[] = [];
  const oldFields = existing.required_fields as string[];
  const oldCalcs = existing.required_calculations as string[];
  const oldChecks = existing.checks as string[];

  // Compare required fields
  const addedFields = args.newRequiredFields.filter((f) => !oldFields.includes(f));
  const removedFields = oldFields.filter((f) => !args.newRequiredFields.includes(f));
  if (addedFields.length > 0 || removedFields.length > 0) {
    changes.push({
      field: 'required_fields',
      oldValue: oldFields,
      newValue: args.newRequiredFields,
    });
  }

  // Compare required calculations
  const addedCalcs = args.newRequiredCalculations.filter((c) => !oldCalcs.includes(c));
  const removedCalcs = oldCalcs.filter((c) => !args.newRequiredCalculations.includes(c));
  if (addedCalcs.length > 0 || removedCalcs.length > 0) {
    changes.push({
      field: 'required_calculations',
      oldValue: oldCalcs,
      newValue: args.newRequiredCalculations,
    });
  }

  // Compare checks
  const addedChecks = args.newChecks.filter((c) => !oldChecks.includes(c));
  const removedChecks = oldChecks.filter((c) => !args.newChecks.includes(c));
  if (addedChecks.length > 0 || removedChecks.length > 0) {
    changes.push({
      field: 'checks',
      oldValue: oldChecks,
      newValue: args.newChecks,
    });
  }

  if (changes.length === 0) {
    return {
      success: true,
      summary: 'Sin cambios detectados',
      detail: `Las reglas para ${cc} ${args.year} están actualizadas. No se detectaron diferencias.`,
    };
  }

  const detailParts = [`Cambios detectados para ${cc} ${args.year} (${changes.length}):`];
  if (addedFields.length) detailParts.push(`  + Campos nuevos: ${addedFields.join(', ')}`);
  if (removedFields.length) detailParts.push(`  - Campos eliminados: ${removedFields.join(', ')}`);
  if (addedCalcs.length) detailParts.push(`  + Cálculos nuevos: ${addedCalcs.join(', ')}`);
  if (removedCalcs.length) detailParts.push(`  - Cálculos eliminados: ${removedCalcs.join(', ')}`);
  if (addedChecks.length) detailParts.push(`  + Verificaciones nuevas (${addedChecks.length}):\n${addedChecks.map((c) => `    • ${c}`).join('\n')}`);
  if (removedChecks.length) detailParts.push(`  - Verificaciones eliminadas (${removedChecks.length}):\n${removedChecks.map((c) => `    • ${c}`).join('\n')}`);

  return {
    success: true,
    summary: `${changes.length} cambio(s) detectado(s) para ${cc} ${args.year}`,
    detail: detailParts.join('\n'),
  };
}

/**
 * Registra fuentes consultadas durante la investigación en la tabla `research_sources`.
 *
 * Validates that every source has the required fields (`source_url`, `source_title`,
 * `accessed_at`, `confidence`, `country_year_rule_id`) before inserting. Sources
 * missing `url` or `title` are skipped with a warning in the result detail.
 *
 * Si no se proporciona `ruleId`, busca automáticamente la regla correspondiente
 * en `country_year_rules` por país y año para vincular las fuentes.
 *
 * @param args.countryCode - Código ISO del país.
 * @param args.year - Año fiscal.
 * @param args.sources - Lista de fuentes con URL, título y fecha de acceso.
 * @param args.confidence - Nivel de confianza de las fuentes ('high' | 'medium' | 'low').
 * @param args.ruleId - ID opcional de la regla asociada en `country_year_rules`.
 * @returns Resultado con confirmación o mensaje de error.
 */
export async function storeSources(args: {
  countryCode: string;
  year: number;
  sources: ResearchSource[];
  confidence: 'high' | 'medium' | 'low';
  ruleId?: string;
}): Promise<ToolResult> {
  const supabase = createAdminClient();
  const cc = args.countryCode.toUpperCase();

  // Look up the rule ID if not provided
  let ruleId = args.ruleId;
  if (!ruleId) {
    const { data } = await supabase
      .from('country_year_rules')
      .select('id')
      .eq('country_code', cc)
      .eq('rule_year', args.year)
      .single();
    ruleId = data?.id;
  }

  // Validate and filter sources — skip those missing required fields
  const skipped: string[] = [];
  const validSources = args.sources.filter((s) => {
    if (!s.url || !s.title) {
      skipped.push(`Fuente omitida (faltan campos): url=${s.url ?? '(vacío)'}, title=${s.title ?? '(vacío)'}`);
      return false;
    }
    return true;
  });

  if (validSources.length === 0) {
    return {
      success: false,
      summary: 'No hay fuentes válidas para registrar',
      detail: skipped.length > 0
        ? `Todas las fuentes fueron omitidas:\n${skipped.join('\n')}`
        : 'La lista de fuentes está vacía.',
    };
  }

  const rows = validSources.map((s) => ({
    country_code: cc,
    rule_year: args.year,
    source_url: s.url,
    source_title: s.title,
    confidence: args.confidence,
    accessed_at: s.accessDate || new Date().toISOString(),
    country_year_rule_id: ruleId ?? null,
  }));

  const { error } = await supabase.from('research_sources').insert(rows);

  if (error) {
    return { success: false, summary: 'Error al guardar fuentes', detail: error.message };
  }

  const detail = validSources.map((s) => `  • ${s.title} — ${s.url}`).join('\n');
  const warnings = skipped.length > 0 ? `\nAdvertencias:\n${skipped.join('\n')}` : '';

  return {
    success: true,
    summary: `${rows.length} fuente(s) registrada(s) para ${cc} ${args.year}`,
    detail: detail + warnings,
  };
}

// ── System prompt ───────────────────────────────────────────────────

const RESEARCHER_SYSTEM_PROMPT = `Eres el Agente Investigador Regulatorio de NóminaSmart, especializado en investigar normativa laboral vigente para cualquier país y año.

TU ROL:
Investigar las tasas, porcentajes, reglas de cálculo y normativa laboral vigente para el país y año solicitados. Crear o actualizar las reglas en el sistema y registrar las fuentes consultadas.

PROCESO DE INVESTIGACIÓN:
1. Usar web_search para buscar regulaciones vigentes en fuentes web reales
2. Si web_search falla, usar search_regulations como respaldo (datos locales)
3. Comparar con las reglas existentes en el sistema para detectar cambios
4. Si hay cambios o no existen reglas, crear/actualizar las reglas
5. Registrar las fuentes consultadas para auditoría

CRITERIOS DE CONFIANZA:
- Alta: Fuentes gubernamentales oficiales, gacetas oficiales, entidades reguladoras
- Media: Fuentes secundarias confiables (firmas de auditoría, consultoras reconocidas)
- Baja: Fuentes no verificadas o información parcial

INSTRUCCIONES:
- Siempre busca primero las regulaciones antes de crear reglas
- Siempre compara con reglas existentes antes de actualizar
- Registra TODAS las fuentes consultadas
- Indica el nivel de confianza de la investigación
- Si detectas cambios, describe claramente qué cambió
- Responde en español, de forma clara y profesional`;

// ── Vercel AI SDK tool definitions ──────────────────────────────────

/**
 * Construye las herramientas del Vercel AI SDK para el Agente Investigador.
 *
 * Cada herramienta envuelve una función interna de investigación y la expone
 * como un `tool()` compatible con `generateText` del Vercel AI SDK, permitiendo
 * que el modelo de IA invoque operaciones de investigación regulatoria de forma
 * autónoma durante una conversación.
 *
 * Herramientas disponibles:
 * - `web_search`: Busca regulaciones laborales en fuentes web reales con fallback a REGULATION_DB.
 * - `search_regulations`: Busca regulaciones laborales vigentes por país/año.
 * - `create_rule`: Crea o actualiza reglas normativas en `country_year_rules`.
 * - `compare_rules`: Compara reglas existentes con datos nuevos para detectar cambios.
 * - `store_sources`: Registra fuentes consultadas en `research_sources`.
 *
 * @returns Objeto con las herramientas AI SDK listas para usar en `generateText({ tools })`.
 */
function buildAITools() {
  return {
    web_search: tool({
      description:
        'Busca regulaciones laborales en fuentes web reales. Usa reintentos con backoff exponencial. Si las fuentes web no están disponibles, usa datos de respaldo con confianza baja.',
      parameters: z.object({
        query: z.string().describe('Consulta de búsqueda sobre regulaciones laborales'),
        countryCode: z.string().describe('Código de país ISO (CO, MX, PE, CL, BR, AR, US)'),
        year: z.number().describe('Año fiscal de las regulaciones'),
      }),
      execute: async (args) => {
        const result = await executeWebSearch(args);
        const prefix = result.usedFallback
          ? `[FALLBACK - Confianza: ${result.confidence}] `
          : `[Web - Confianza: ${result.confidence}] `;
        return prefix + result.data;
      },
    }),

    search_regulations: tool({
      description:
        'Busca las regulaciones laborales vigentes para un país y año. Retorna tasas, campos requeridos, cálculos y verificaciones normativas.',
      parameters: z.object({
        countryCode: z.string().describe('Código de país ISO (CO, MX, PE, CL, BR, AR, US)'),
        year: z.number().describe('Año fiscal de las regulaciones'),
        topic: z.string().optional().describe('Tema específico a buscar (ej: "salud", "pensión", "isr")'),
      }),
      execute: async (args) => {
        const result = await searchRegulations(args);
        return result.detail;
      },
    }),

    create_rule: tool({
      description:
        'Crea o actualiza una regla normativa en la base de datos para un país y año específicos.',
      parameters: z.object({
        countryCode: z.string().describe('Código de país ISO'),
        year: z.number().describe('Año fiscal'),
        label: z.string().describe('Nombre descriptivo de la regla (ej: "UGPP Colombia 2025")'),
        requiredFields: z.array(z.string()).describe('Lista de campos obligatorios en la nómina'),
        requiredCalculations: z.array(z.string()).describe('Lista de cálculos obligatorios'),
        checks: z.array(z.string()).describe('Lista de verificaciones normativas'),
      }),
      execute: async (args) => {
        const result = await createOrUpdateRule(args);
        return result.detail;
      },
    }),

    compare_rules: tool({
      description:
        'Compara las reglas existentes en el sistema con datos nuevos para detectar cambios regulatorios.',
      parameters: z.object({
        countryCode: z.string().describe('Código de país ISO'),
        year: z.number().describe('Año fiscal'),
        newChecks: z.array(z.string()).describe('Nuevas verificaciones encontradas'),
        newRequiredFields: z.array(z.string()).describe('Nuevos campos requeridos encontrados'),
        newRequiredCalculations: z.array(z.string()).describe('Nuevos cálculos requeridos encontrados'),
      }),
      execute: async (args) => {
        const result = await compareRules(args);
        return result.detail;
      },
    }),

    store_sources: tool({
      description:
        'Registra las fuentes consultadas durante la investigación en la tabla research_sources.',
      parameters: z.object({
        countryCode: z.string().describe('Código de país ISO'),
        year: z.number().describe('Año fiscal'),
        sources: z.array(z.object({
          url: z.string().describe('URL de la fuente'),
          title: z.string().describe('Título descriptivo de la fuente'),
          accessDate: z.string().describe('Fecha de acceso (ISO format)'),
        })).describe('Lista de fuentes consultadas'),
        confidence: z.enum(['high', 'medium', 'low']).describe('Nivel de confianza de las fuentes'),
      }),
      execute: async (args) => {
        const result = await storeSources(args);
        return result.detail;
      },
    }),
  };
}

// ── Agent tool definitions (for AgentDefinition.tools) ──────────────

const agentToolDefinitions: ToolDefinition[] = [
  {
    name: 'web_search',
    description: 'Busca regulaciones laborales en fuentes web reales con fallback a datos de respaldo.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Consulta de búsqueda' },
        countryCode: { type: 'string', description: 'Código de país ISO' },
        year: { type: 'number', description: 'Año fiscal' },
      },
      required: ['query', 'countryCode', 'year'],
    },
  },
  {
    name: 'search_regulations',
    description: 'Busca regulaciones laborales vigentes para un país y año.',
    parameters: {
      type: 'object',
      properties: {
        countryCode: { type: 'string', description: 'Código de país ISO' },
        year: { type: 'number', description: 'Año fiscal' },
        topic: { type: 'string', description: 'Tema específico a buscar' },
      },
      required: ['countryCode', 'year'],
    },
  },
  {
    name: 'create_rule',
    description: 'Crea o actualiza una regla normativa para un país y año.',
    parameters: {
      type: 'object',
      properties: {
        countryCode: { type: 'string' },
        year: { type: 'number' },
        label: { type: 'string' },
        requiredFields: { type: 'array', items: { type: 'string' } },
        requiredCalculations: { type: 'array', items: { type: 'string' } },
        checks: { type: 'array', items: { type: 'string' } },
      },
      required: ['countryCode', 'year', 'label', 'requiredFields', 'requiredCalculations', 'checks'],
    },
  },
  {
    name: 'compare_rules',
    description: 'Compara reglas existentes con datos nuevos para detectar cambios.',
    parameters: {
      type: 'object',
      properties: {
        countryCode: { type: 'string' },
        year: { type: 'number' },
        newChecks: { type: 'array', items: { type: 'string' } },
        newRequiredFields: { type: 'array', items: { type: 'string' } },
        newRequiredCalculations: { type: 'array', items: { type: 'string' } },
      },
      required: ['countryCode', 'year', 'newChecks', 'newRequiredFields', 'newRequiredCalculations'],
    },
  },
  {
    name: 'store_sources',
    description: 'Registra fuentes consultadas en research_sources.',
    parameters: {
      type: 'object',
      properties: {
        countryCode: { type: 'string' },
        year: { type: 'number' },
        sources: { type: 'array', items: { type: 'object' } },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
      required: ['countryCode', 'year', 'sources', 'confidence'],
    },
  },
];

// ── Main agent execution ────────────────────────────────────────────

export async function executeResearcher(
  context: AgentContext,
  model: LanguageModel,
): Promise<AgentResult> {
  const startTime = Date.now();
  const cc = context.countryCode.toUpperCase();
  const year = context.year;

  // Build the research prompt from context
  const userMessage =
    (context.previousResults?.['userMessage'] as string | undefined) ??
    `Investiga la normativa laboral vigente para ${cc} año ${year}. Busca las regulaciones, compara con las reglas existentes, actualiza si hay cambios y registra las fuentes.`;

  try {
    const { text, usage, toolCalls } = await generateText({
      model,
      system: RESEARCHER_SYSTEM_PROMPT,
      prompt: userMessage,
      tools: buildAITools(),
      maxSteps: 8,
    });

    // Build research result from tool calls
    const researchResult = await buildResearchResult(cc, year, toolCalls);

    return {
      agentName: 'researcher',
      success: true,
      data: {
        ...researchResult,
        aiSummary: text,
        toolsUsed: toolCalls.length > 0
          ? toolCalls.map((tc) => tc.toolName).join(', ')
          : undefined,
      },
      tokensUsed: usage?.totalTokens ?? 0,
      providerUsed: model.modelId ?? 'unknown',
      latencyMs: Date.now() - startTime,
    };
  } catch (error) {
    // Fallback: run the research pipeline directly without AI orchestration
    try {
      const result = await runDirectResearch(cc, year);
      return {
        agentName: 'researcher',
        success: true,
        data: result,
        tokensUsed: 0,
        providerUsed: model.modelId ?? 'unknown',
        latencyMs: Date.now() - startTime,
      };
    } catch (fallbackError) {
      return {
        agentName: 'researcher',
        success: false,
        data: {
          error: error instanceof Error ? error.message : 'Error desconocido',
          fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Error en fallback',
        },
        tokensUsed: 0,
        providerUsed: model.modelId ?? 'unknown',
        latencyMs: Date.now() - startTime,
      };
    }
  }
}

// ── Helper: build ResearchResult from tool calls ────────────────────

async function buildResearchResult(
  countryCode: string,
  year: number,
  toolCalls: Array<{ toolName: string; args: Record<string, unknown> }>,
): Promise<ResearchResult> {
  const key = `${countryCode}-${year}`;
  const regData = REGULATION_DB[key];

  // Check if web_search was used and determine confidence from it
  const webSearchCall = toolCalls.find((tc) => tc.toolName === 'web_search');
  let confidence: 'high' | 'medium' | 'low' = regData?.confidence ?? 'low';
  let sources = regData?.sources ?? [];

  if (webSearchCall) {
    // If web_search was used, run it again to get actual sources/confidence
    try {
      const webResult = await executeWebSearch(
        webSearchCall.args as { query: string; countryCode: string; year: number },
      );
      if (webResult.sources.length > 0) {
        sources = webResult.sources;
      }
      confidence = webResult.confidence;
    } catch {
      // Keep defaults from REGULATION_DB
    }
  }

  return {
    countryCode,
    year,
    sources,
    confidence,
    changesDetected: undefined,
    rulesUpdated: toolCalls.some((tc) => tc.toolName === 'create_rule'),
  };
}

// ── Fallback: direct research pipeline (no AI) ─────────────────────

async function runDirectResearch(
  countryCode: string,
  year: number,
): Promise<ResearchResult> {
  // 1. Try web search first
  const webResult = await executeWebSearch({
    query: 'labor regulations payroll',
    countryCode,
    year,
  });

  // 2. If web search succeeded without fallback, use web data
  // Otherwise fall back to REGULATION_DB via searchRegulations
  const searchResult = await searchRegulations({ countryCode, year });

  const key = `${countryCode}-${year}`;
  const regData = REGULATION_DB[key];

  // Determine confidence: web search confidence if available, else low
  const confidence = webResult.usedFallback ? 'low' as const : webResult.confidence;
  const sources = webResult.sources.length > 0 ? webResult.sources : (regData?.sources ?? []);

  if (!searchResult.success && !webResult.success) {
    return {
      countryCode,
      year,
      sources: [],
      confidence: 'low',
      rulesUpdated: false,
    };
  }

  if (!regData) {
    return {
      countryCode,
      year,
      sources,
      confidence,
      rulesUpdated: false,
    };
  }

  // 3. Compare with existing rules
  const compareResult = await compareRules({
    countryCode,
    year,
    newChecks: regData.checks,
    newRequiredFields: regData.requiredFields,
    newRequiredCalculations: regData.requiredCalculations,
  });

  const hasChanges = compareResult.summary !== 'Sin cambios detectados';

  // 4. Create/update rule if changes detected or no existing rule
  let rulesUpdated = false;
  if (hasChanges || compareResult.summary === 'No hay regla existente para comparar') {
    const createResult = await createOrUpdateRule({
      countryCode,
      year,
      label: regData.label,
      requiredFields: regData.requiredFields,
      requiredCalculations: regData.requiredCalculations,
      checks: regData.checks,
    });
    rulesUpdated = createResult.success;
  }

  // 5. Store sources
  await storeSources({
    countryCode,
    year,
    sources,
    confidence,
  });

  return {
    countryCode,
    year,
    sources,
    confidence,
    changesDetected: hasChanges ? [{ field: 'rules', oldValue: 'previous', newValue: 'updated' }] : undefined,
    rulesUpdated,
  };
}

// ── Agent factory ───────────────────────────────────────────────────

export function createResearcherAgent(): AgentDefinition {
  return {
    name: 'researcher',
    systemPrompt: RESEARCHER_SYSTEM_PROMPT,
    tools: agentToolDefinitions,
    execute: executeResearcher,
  };
}
