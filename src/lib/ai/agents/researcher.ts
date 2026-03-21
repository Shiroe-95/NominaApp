import { generateText, tool, type LanguageModel } from 'ai';
import { z } from 'zod';
import type {
  AgentContext,
  AgentDefinition,
  AgentResult,
  ToolDefinition,
} from '../types';
import { createAdminClient } from '../../supabase/admin';

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
async function storeSources(args: {
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

  const rows = args.sources.map((s) => ({
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

  return {
    success: true,
    summary: `${rows.length} fuente(s) registrada(s) para ${cc} ${args.year}`,
    detail: args.sources.map((s) => `  • ${s.title} — ${s.url}`).join('\n'),
  };
}

// ── System prompt ───────────────────────────────────────────────────

const RESEARCHER_SYSTEM_PROMPT = `Eres el Agente Investigador Regulatorio de NóminaSmart, especializado en investigar normativa laboral vigente para cualquier país y año.

TU ROL:
Investigar las tasas, porcentajes, reglas de cálculo y normativa laboral vigente para el país y año solicitados. Crear o actualizar las reglas en el sistema y registrar las fuentes consultadas.

PROCESO DE INVESTIGACIÓN:
1. Buscar las regulaciones vigentes para el país y año indicados
2. Comparar con las reglas existentes en el sistema para detectar cambios
3. Si hay cambios o no existen reglas, crear/actualizar las reglas
4. Registrar las fuentes consultadas para auditoría

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
 * - `search_regulations`: Busca regulaciones laborales vigentes por país/año.
 * - `create_rule`: Crea o actualiza reglas normativas en `country_year_rules`.
 * - `compare_rules`: Compara reglas existentes con datos nuevos para detectar cambios.
 * - `store_sources`: Registra fuentes consultadas en `research_sources`.
 *
 * @returns Objeto con las herramientas AI SDK listas para usar en `generateText({ tools })`.
 */
function buildAITools() {
  return {
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

  return {
    countryCode,
    year,
    sources: regData?.sources ?? [],
    confidence: regData?.confidence ?? 'low',
    changesDetected: undefined, // populated by compare_rules tool during execution
    rulesUpdated: toolCalls.some((tc) => tc.toolName === 'create_rule'),
  };
}

// ── Fallback: direct research pipeline (no AI) ─────────────────────

async function runDirectResearch(
  countryCode: string,
  year: number,
): Promise<ResearchResult> {
  // 1. Search regulations
  const searchResult = await searchRegulations({ countryCode, year });
  if (!searchResult.success) {
    return {
      countryCode,
      year,
      sources: [],
      confidence: 'low',
      rulesUpdated: false,
    };
  }

  const key = `${countryCode}-${year}`;
  const regData = REGULATION_DB[key];
  if (!regData) {
    return {
      countryCode,
      year,
      sources: [],
      confidence: 'low',
      rulesUpdated: false,
    };
  }

  // 2. Compare with existing rules
  const compareResult = await compareRules({
    countryCode,
    year,
    newChecks: regData.checks,
    newRequiredFields: regData.requiredFields,
    newRequiredCalculations: regData.requiredCalculations,
  });

  const hasChanges = compareResult.summary !== 'Sin cambios detectados';

  // 3. Create/update rule if changes detected or no existing rule
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

  // 4. Store sources
  await storeSources({
    countryCode,
    year,
    sources: regData.sources,
    confidence: regData.confidence,
  });

  return {
    countryCode,
    year,
    sources: regData.sources,
    confidence: regData.confidence,
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
