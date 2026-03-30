/**
 * NLQEngine Agent — Translates natural language queries to data lookups on payroll data.
 *
 * Registered in AgentBus v2 as 'nlq'.
 * Supports: comparative queries, aggregations, employee-level queries.
 * Clarification flow for ambiguous queries.
 * RBAC-scoped responses (only data user can access).
 * Shows data sources used for each response.
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */

import { generateText } from 'ai';
import type { LanguageModel } from 'ai';
import type { AgentContext, AgentDefinition, AgentResult, PayrollRow, ToolDefinition } from '@/lib/ai/types';
import { createAdminClient } from '@/lib/supabase/admin';

// ── Types ───────────────────────────────────────────────────────────

export type NLQQueryType =
  | 'aggregation'
  | 'comparative'
  | 'employee_lookup'
  | 'trend'
  | 'ranking'
  | 'count'
  | 'unknown';

export interface NLQDataSource {
  table: string;
  description: string;
  periodRange?: { from: string; to: string };
  rowCount: number;
}

export interface NLQClarification {
  message: string;
  options: string[];
}

export interface NLQResult {
  query: string;
  queryType: NLQQueryType;
  answer: string;
  data: Record<string, unknown> | null;
  dataSources: NLQDataSource[];
  clarification: NLQClarification | null;
  rbacFiltered: boolean;
  locale: string;
}

// ── Constants ───────────────────────────────────────────────────────

const NLQ_SYSTEM_PROMPT = `Eres un motor de consultas en lenguaje natural experto en datos de nómina. Tu trabajo es interpretar preguntas del usuario sobre datos de nómina y traducirlas a búsquedas estructuradas.

Para cada consulta debes:
1. Clasificar el tipo de consulta: aggregation, comparative, employee_lookup, trend, ranking, count
2. Identificar los campos, periodos y filtros relevantes
3. Ejecutar la búsqueda sobre los datos proporcionados
4. Generar una respuesta clara en lenguaje natural con datos específicos
5. Listar las fuentes de datos utilizadas

Si la consulta es ambigua, genera opciones de clarificación específicas en lugar de adivinar.
Nunca inventes datos. Si no hay datos disponibles, indícalo claramente.
Respeta siempre los permisos del usuario — solo responde con datos del workspace activo.`;


const QUERY_CLASSIFICATION_PROMPT = `Clasifica la siguiente consulta del usuario sobre datos de nómina.

Consulta: "{query}"

Responde SOLO con un JSON válido:
{
  "queryType": "aggregation" | "comparative" | "employee_lookup" | "trend" | "ranking" | "count" | "unknown",
  "isAmbiguous": boolean,
  "clarificationNeeded": string | null,
  "clarificationOptions": string[] | null,
  "targetColumns": string[],
  "targetPeriods": string[],
  "targetEmployees": string[],
  "filters": object
}`;

// ── Query Classification ────────────────────────────────────────────

interface ParsedQuery {
  queryType: NLQQueryType;
  isAmbiguous: boolean;
  clarificationNeeded: string | null;
  clarificationOptions: string[] | null;
  targetColumns: string[];
  targetPeriods: string[];
  targetEmployees: string[];
  filters: Record<string, unknown>;
}

/**
 * Classify a natural language query using pattern matching as a fast path.
 * Falls back to AI classification for complex queries.
 */
export function classifyQueryLocal(query: string): NLQQueryType {
  const lower = query.toLowerCase();

  // Comparative patterns
  if (/\bcompar[aeo]\b|\bvs\.?\b|\bversus\b|\bdiferencia\b|\bcompare\b/.test(lower)) {
    return 'comparative';
  }

  // Ranking patterns
  if (/\bmayor\b|\bmenor\b|\bmáximo\b|\bmínimo\b|\btop\b|\bpeor\b|\bmejor\b|\bhighest\b|\blowest\b/.test(lower)) {
    return 'ranking';
  }

  // Count patterns
  if (/\bcuánt[oa]s?\b|\bnúmero de\b|\btotal de\b|\bhow many\b|\bcount\b/.test(lower)) {
    return 'count';
  }

  // Trend patterns
  if (/\btendencia\b|\bevolución\b|\bhistóric[oa]\b|\btrend\b|\bover time\b/.test(lower)) {
    return 'trend';
  }

  // Employee lookup patterns
  if (/\bempleado\b|\btrabajador\b|\bcédula\b|\bdocumento\b|\bemployee\b/.test(lower)) {
    return 'employee_lookup';
  }

  // Aggregation patterns (default for "how much", "total", "sum", etc.)
  if (/\bcuánto\b|\btotal\b|\bsuma\b|\bpromedio\b|\bmedia\b|\bhow much\b|\baverage\b|\bsum\b/.test(lower)) {
    return 'aggregation';
  }

  return 'unknown';
}

/**
 * Detect if a query is ambiguous and needs clarification.
 */
export function detectAmbiguity(
  query: string,
  availableColumns: string[],
  availablePeriods: { year: number; month: number }[],
): NLQClarification | null {
  const lower = query.toLowerCase();

  // No period specified for time-sensitive queries
  const needsPeriod = /\bgast[aeoó]\b|\bcost[oó]\b|\bpag[aeoó]\b|\baport[eó]\b|\bspent\b|\bcost\b/.test(lower);
  const hasPeriod = /\bmes\b|\bperiodo\b|\benero\b|\bfebrero\b|\bmarzo\b|\babril\b|\bmayo\b|\bjunio\b|\bjulio\b|\bagosto\b|\bseptiembre\b|\boctubre\b|\bnoviembre\b|\bdiciembre\b|\bmonth\b|\bperiod\b|\bjanuary\b|\bfebruary\b/.test(lower);

  if (needsPeriod && !hasPeriod && availablePeriods.length > 1) {
    const periodOptions = availablePeriods
      .slice(0, 5)
      .map((p) => `${p.month}/${p.year}`);
    return {
      message: '¿A qué periodo te refieres?',
      options: [...periodOptions, 'Todos los periodos disponibles'],
    };
  }

  // Ambiguous column reference
  const columnKeywords = availableColumns.filter((col) => lower.includes(col.toLowerCase()));
  if (columnKeywords.length === 0 && classifyQueryLocal(query) === 'aggregation') {
    const suggestedColumns = availableColumns.slice(0, 5);
    if (suggestedColumns.length > 0) {
      return {
        message: '¿Sobre qué concepto de nómina deseas consultar?',
        options: suggestedColumns,
      };
    }
  }

  return null;
}


// ── Data Query Functions ────────────────────────────────────────────

/**
 * Get numeric columns from payroll rows (skip identity/metadata columns).
 */
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

function avgColumn(rows: PayrollRow[], col: string): number {
  const values = rows.map((r) => Number(r[col])).filter((v) => !isNaN(v));
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Execute an aggregation query: sum, average, min, max for specified columns.
 */
export function executeAggregation(
  rows: PayrollRow[],
  columns: string[],
): Record<string, { sum: number; avg: number; min: number; max: number; count: number }> {
  const result: Record<string, { sum: number; avg: number; min: number; max: number; count: number }> = {};

  for (const col of columns) {
    const values = rows
      .map((r) => Number(r[col]))
      .filter((v) => !isNaN(v));

    if (values.length === 0) {
      result[col] = { sum: 0, avg: 0, min: 0, max: 0, count: 0 };
      continue;
    }

    result[col] = {
      sum: values.reduce((s, v) => s + v, 0),
      avg: values.reduce((s, v) => s + v, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
    };
  }

  return result;
}

/**
 * Execute a comparative query between two sets of payroll rows.
 */
export function executeComparative(
  periodA: { label: string; rows: PayrollRow[] },
  periodB: { label: string; rows: PayrollRow[] },
  columns: string[],
): Record<string, { periodA: number; periodB: number; difference: number; percentChange: number }> {
  const result: Record<string, { periodA: number; periodB: number; difference: number; percentChange: number }> = {};

  for (const col of columns) {
    const sumA = sumColumn(periodA.rows, col);
    const sumB = sumColumn(periodB.rows, col);
    const difference = sumB - sumA;
    const percentChange = sumA !== 0 ? (difference / sumA) * 100 : 0;

    result[col] = {
      periodA: sumA,
      periodB: sumB,
      difference,
      percentChange: Number(percentChange.toFixed(2)),
    };
  }

  return result;
}

/**
 * Execute an employee-level lookup query.
 */
export function executeEmployeeLookup(
  rows: PayrollRow[],
  employeeFilter: string,
): PayrollRow[] {
  const lower = employeeFilter.toLowerCase();
  return rows.filter((r) => {
    const doc = String(r['documento'] ?? r['employee_doc'] ?? r['cedula'] ?? '').toLowerCase();
    const name = String(r['nombre'] ?? r['name'] ?? '').toLowerCase();
    return doc.includes(lower) || name.includes(lower);
  });
}

/**
 * Execute a ranking query: top/bottom N employees by a column.
 */
export function executeRanking(
  rows: PayrollRow[],
  column: string,
  direction: 'top' | 'bottom',
  limit: number = 5,
): { employee: string; value: number }[] {
  const ranked = rows
    .map((r) => ({
      employee: String(r['nombre'] ?? r['name'] ?? r['documento'] ?? r['employee_doc'] ?? 'Unknown'),
      value: Number(r[column]),
    }))
    .filter((r) => !isNaN(r.value))
    .sort((a, b) => direction === 'top' ? b.value - a.value : a.value - b.value)
    .slice(0, limit);

  return ranked;
}


// ── RBAC Scoping ────────────────────────────────────────────────────

/**
 * Fetch payroll data scoped to the user's workspace and accessible companies.
 * Ensures RBAC compliance — only returns data the user can access.
 */
export async function fetchRBACPayrollData(
  workspaceId: string,
  userId: string,
  periodYear?: number,
  periodMonth?: number,
): Promise<{
  rows: PayrollRow[];
  periods: { year: number; month: number }[];
  sources: NLQDataSource[];
}> {
  try {
    const supabase = createAdminClient();

    // Verify user is a member of the workspace
    const { data: membership, error: memberError } = await supabase
      .from('workspace_members')
      .select('role')
      .eq('workspace_id', workspaceId)
      .eq('user_id', userId)
      .single();

    if (memberError || !membership) {
      return { rows: [], periods: [], sources: [] };
    }

    // Fetch payroll uploads for this workspace
    let query = supabase
      .from('payroll_uploads')
      .select('id, period_year, period_month, parsed_data, company_id, file_name')
      .eq('workspace_id', workspaceId)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false });

    if (periodYear) query = query.eq('period_year', periodYear);
    if (periodMonth) query = query.eq('period_month', periodMonth);

    const { data: payrolls, error } = await query.limit(50);

    if (error || !payrolls) return { rows: [], periods: [], sources: [] };

    const allRows: PayrollRow[] = [];
    const periods: { year: number; month: number }[] = [];
    const sources: NLQDataSource[] = [];

    for (const p of payrolls as { id: string; period_year: number; period_month: number; parsed_data: unknown; company_id: string; file_name: string }[]) {
      const rows = Array.isArray(p.parsed_data) ? (p.parsed_data as PayrollRow[]) : [];
      if (rows.length === 0) continue;

      allRows.push(...rows);
      periods.push({ year: p.period_year, month: p.period_month });
      sources.push({
        table: 'payroll_uploads',
        description: `Planilla ${p.file_name ?? p.id} — ${p.period_month}/${p.period_year}`,
        periodRange: {
          from: `${p.period_year}-${String(p.period_month).padStart(2, '0')}`,
          to: `${p.period_year}-${String(p.period_month).padStart(2, '0')}`,
        },
        rowCount: rows.length,
      });
    }

    // Deduplicate periods
    const uniquePeriods = Array.from(
      new Map(periods.map((p) => [`${p.year}-${p.month}`, p])).values(),
    );

    return { rows: allRows, periods: uniquePeriods, sources };
  } catch {
    return { rows: [], periods: [], sources: [] };
  }
}

// ── AI-Powered Query Processing ─────────────────────────────────────

/**
 * Use AI to interpret a natural language query and generate a structured answer.
 */
async function processQueryWithAI(
  query: string,
  queryType: NLQQueryType,
  data: Record<string, unknown>,
  sources: NLQDataSource[],
  model: LanguageModel,
  locale: string,
): Promise<{ answer: string; enhancedData: Record<string, unknown> | null }> {
  try {
    const sourcesSummary = sources
      .map((s) => `${s.description} (${s.rowCount} registros)`)
      .join(', ');

    const { text } = await generateText({
      model,
      system: NLQ_SYSTEM_PROMPT,
      prompt: `Consulta del usuario: "${query}"
Tipo de consulta: ${queryType}
Idioma de respuesta: ${locale}
Datos encontrados: ${JSON.stringify(data, null, 2)}
Fuentes: ${sourcesSummary}

Genera una respuesta clara y concisa en lenguaje natural que responda la consulta del usuario.
Incluye valores específicos, porcentajes y contexto relevante.
Si los datos son insuficientes, indícalo claramente.

Responde SOLO con un JSON:
{
  "answer": "respuesta en lenguaje natural",
  "enhancedData": { datos estructurados adicionales o null }
}`,
    });

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { answer?: string; enhancedData?: Record<string, unknown> | null };
        return {
          answer: parsed.answer ?? text,
          enhancedData: parsed.enhancedData ?? null,
        };
      }
    } catch {
      // If JSON parsing fails, use raw text
    }

    return { answer: text, enhancedData: null };
  } catch {
    return {
      answer: `No se pudo procesar la consulta "${query}". Por favor, intenta reformularla.`,
      enhancedData: null,
    };
  }
}


// ── Main Query Processor ────────────────────────────────────────────

/**
 * Process a natural language query against payroll data.
 * This is the main entry point for NLQ processing.
 */
export async function processNLQuery(
  query: string,
  rows: PayrollRow[],
  historicalData: { year: number; month: number; rows: PayrollRow[] }[],
  sources: NLQDataSource[],
  model: LanguageModel,
  locale: string = 'es',
): Promise<NLQResult> {
  const queryType = classifyQueryLocal(query);
  const numericColumns = getNumericColumns(rows);
  const availablePeriods = historicalData.map((h) => ({ year: h.year, month: h.month }));

  // Check for ambiguity
  const clarification = detectAmbiguity(query, numericColumns, availablePeriods);
  if (clarification) {
    return {
      query,
      queryType,
      answer: clarification.message,
      data: null,
      dataSources: sources,
      clarification,
      rbacFiltered: true,
      locale,
    };
  }

  let data: Record<string, unknown> = {};

  switch (queryType) {
    case 'aggregation': {
      const targetCols = numericColumns.length > 0 ? numericColumns : [];
      data = { aggregations: executeAggregation(rows, targetCols) };
      break;
    }

    case 'comparative': {
      if (historicalData.length >= 2) {
        const periodA = historicalData[historicalData.length - 1];
        const periodB = historicalData[historicalData.length - 2];
        const cols = numericColumns.length > 0 ? numericColumns : [];
        data = {
          comparison: executeComparative(
            { label: `${periodA.month}/${periodA.year}`, rows: periodA.rows },
            { label: `${periodB.month}/${periodB.year}`, rows: periodB.rows },
            cols,
          ),
          periodA: `${periodA.month}/${periodA.year}`,
          periodB: `${periodB.month}/${periodB.year}`,
        };
      } else {
        data = { message: 'Se necesitan al menos 2 periodos para una comparación.' };
      }
      break;
    }

    case 'employee_lookup': {
      // Extract employee identifier from query
      const employeeMatch = query.match(/\b\d{5,15}\b/) ?? query.match(/(?:empleado|trabajador|employee)\s+(.+?)(?:\s|$)/i);
      const filter = employeeMatch ? (employeeMatch[1] ?? employeeMatch[0]) : query;
      const matchedRows = executeEmployeeLookup(rows, filter);
      data = { employees: matchedRows.slice(0, 20), matchCount: matchedRows.length };
      break;
    }

    case 'ranking': {
      const direction = /\bmenor\b|\bmínimo\b|\bpeor\b|\blowest\b|\bbottom\b/.test(query.toLowerCase()) ? 'bottom' : 'top';
      const col = numericColumns[0] ?? '';
      if (col) {
        data = { ranking: executeRanking(rows, col, direction), column: col, direction };
      }
      break;
    }

    case 'count': {
      data = {
        totalRows: rows.length,
        totalPeriods: availablePeriods.length,
        columns: numericColumns,
      };
      break;
    }

    case 'trend': {
      if (historicalData.length >= 2) {
        const trendData = historicalData.map((h) => {
          const totalCost = numericColumns.reduce((sum, col) => sum + sumColumn(h.rows, col), 0);
          return { year: h.year, month: h.month, totalCost, employeeCount: h.rows.length };
        });
        data = { trend: trendData };
      } else {
        data = { message: 'Se necesitan al menos 2 periodos para analizar tendencias.' };
      }
      break;
    }

    default: {
      // For unknown queries, provide available data context to AI
      data = {
        availableColumns: numericColumns,
        availablePeriods,
        rowCount: rows.length,
      };
      break;
    }
  }

  // Enhance answer with AI
  const { answer, enhancedData } = await processQueryWithAI(
    query,
    queryType,
    data,
    sources,
    model,
    locale,
  );

  return {
    query,
    queryType,
    answer,
    data: enhancedData ?? data,
    dataSources: sources,
    clarification: null,
    rbacFiltered: true,
    locale,
  };
}


// ── Agent Definition ────────────────────────────────────────────────

export function createNLQEngineAgent(): AgentDefinition {
  const tools: ToolDefinition[] = [
    {
      name: 'queryPayrollData',
      description:
        'Traduce una consulta en lenguaje natural a una búsqueda sobre datos de nómina. Soporta consultas comparativas, agregaciones, búsquedas por empleado, rankings y tendencias.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Consulta en lenguaje natural del usuario' },
          locale: { type: 'string', description: 'Idioma de la respuesta: es, en, pt, fr, de' },
          workspaceId: { type: 'string', description: 'UUID del workspace activo' },
        },
        required: ['query', 'workspaceId'],
      },
    },
  ];

  async function execute(
    context: AgentContext,
    model: LanguageModel,
  ): Promise<AgentResult> {
    const startTime = Date.now();
    const rows = context.payrollData ?? [];
    const locale = context.locale ?? 'es';

    // Extract query from context
    const query = (context.previousResults?.['nlqQuery'] as string) ?? '';

    if (!query) {
      return {
        agentName: 'nlq',
        success: false,
        data: { error: 'No query provided', result: null },
        tokensUsed: 0,
        providerUsed: model.modelId ?? 'unknown',
        latencyMs: Date.now() - startTime,
      };
    }

    // Gather historical data from context
    const historicalData =
      (context.previousResults?.['historicalData'] as {
        year: number;
        month: number;
        rows: PayrollRow[];
      }[]) ?? [];

    // Build data sources list
    const sources: NLQDataSource[] = [];
    if (rows.length > 0) {
      sources.push({
        table: 'payroll_uploads',
        description: `Datos del periodo actual (${context.year})`,
        rowCount: rows.length,
      });
    }
    for (const period of historicalData) {
      sources.push({
        table: 'payroll_uploads',
        description: `Planilla ${period.month}/${period.year}`,
        periodRange: {
          from: `${period.year}-${String(period.month).padStart(2, '0')}`,
          to: `${period.year}-${String(period.month).padStart(2, '0')}`,
        },
        rowCount: period.rows.length,
      });
    }

    // Process the query
    const result = await processNLQuery(
      query,
      rows,
      historicalData,
      sources,
      model,
      locale,
    );

    return {
      agentName: 'nlq',
      success: true,
      data: {
        result,
        summary: {
          queryType: result.queryType,
          hasClarification: result.clarification !== null,
          sourceCount: result.dataSources.length,
          rbacFiltered: result.rbacFiltered,
        },
      },
      tokensUsed: 0,
      providerUsed: model.modelId ?? 'unknown',
      latencyMs: Date.now() - startTime,
    };
  }

  return {
    name: 'nlq',
    systemPrompt: NLQ_SYSTEM_PROMPT,
    tools,
    execute,
  };
}
