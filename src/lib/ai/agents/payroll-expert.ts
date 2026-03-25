import { generateText, tool, type LanguageModel } from 'ai';
import { z } from 'zod';
import type {
  AgentContext,
  AgentDefinition,
  AgentResult,
  ToolDefinition,
} from '../types';
import { createAdminClient } from '../../supabase/admin';

// ── Tool result type ────────────────────────────────────────────────

interface ToolResult {
  success: boolean;
  summary: string;
  detail: string;
}

// ── Rule CRUD operations ────────────────────────────────────────────

/**
 * Lista reglas normativas desde `country_year_rules`, con filtros opcionales.
 *
 * @param args.countryCode - Código ISO del país (ej. 'CO', 'MX'). Omitir para listar todas.
 * @param args.ruleYear - Año fiscal. Omitir para listar todos los años.
 * @returns ToolResult con el detalle formateado de las reglas encontradas.
 */
async function listRules(args: {
  countryCode?: string;
  ruleYear?: number;
}): Promise<ToolResult> {
  const supabase = createAdminClient();
  let query = supabase
    .from('country_year_rules')
    .select('country_code, rule_year, label, required_fields, required_calculations, checks')
    .order('country_code')
    .order('rule_year');

  if (args.countryCode) query = query.eq('country_code', args.countryCode.toUpperCase());
  if (args.ruleYear) query = query.eq('rule_year', args.ruleYear);

  const { data, error } = await query;
  if (error || !data) {
    return { success: false, summary: 'Error al leer reglas', detail: 'Error al leer reglas de la base de datos.' };
  }

  if (data.length === 0) {
    return { success: true, summary: 'Sin reglas', detail: 'No hay reglas configuradas para ese filtro.' };
  }

  const text = data
    .map((r) => {
      const fields = (r.required_fields as string[]).join(', ');
      const calcs = (r.required_calculations as string[]).join(', ');
      const checkCount = (r.checks as string[]).length;
      return `• ${r.label} (${r.country_code} - ${r.rule_year})\n  Campos: ${fields || 'ninguno'}\n  Cálculos: ${calcs || 'ninguno'}\n  Verificaciones: ${checkCount}`;
    })
    .join('\n\n');

  return { success: true, summary: `${data.length} regla(s) encontrada(s)`, detail: text };
}

/**
 * Crea o actualiza (upsert) una regla normativa en `country_year_rules`.
 *
 * @param args.countryCode - Código ISO del país (ej. 'CO', 'MX').
 * @param args.ruleYear - Año fiscal de la regla.
 * @param args.label - Nombre descriptivo (ej. "UGPP Colombia 2027").
 * @param args.requiredFields - Campos obligatorios del archivo de nómina.
 * @param args.requiredCalculations - Cálculos obligatorios.
 * @param args.checks - Verificaciones normativas.
 * @returns ToolResult con confirmación o mensaje de error.
 */
async function createRule(args: {
  countryCode: string;
  ruleYear: number;
  label: string;
  requiredFields?: string[];
  requiredCalculations?: string[];
  checks?: string[];
}): Promise<ToolResult> {
  const supabase = createAdminClient();
  const cc = args.countryCode.toUpperCase();

  const { error } = await supabase.from('country_year_rules').upsert(
    {
      country_code: cc,
      rule_year: args.ruleYear,
      label: args.label,
      required_fields: args.requiredFields ?? [],
      required_calculations: args.requiredCalculations ?? [],
      checks: args.checks ?? [],
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'country_code,rule_year' },
  );

  if (error) return { success: false, summary: 'Error al crear', detail: error.message };
  return {
    success: true,
    summary: `Regla "${args.label}" creada para ${cc} ${args.ruleYear}`,
    detail: `Regla "${args.label}" creada con ${args.requiredFields?.length ?? 0} campos, ${args.requiredCalculations?.length ?? 0} cálculos y ${args.checks?.length ?? 0} verificaciones.`,
  };
}

/**
 * Actualiza una regla normativa existente de forma incremental.
 *
 * Permite agregar/quitar campos, cálculos y verificaciones sin reemplazar
 * la regla completa. Útil para ajustes parciales tras cambios regulatorios.
 *
 * @param args.countryCode - Código ISO del país.
 * @param args.ruleYear - Año fiscal de la regla a modificar.
 * @param args.newLabel - Nueva etiqueta (opcional).
 * @param args.addFields - Campos a agregar.
 * @param args.removeFields - Campos a eliminar.
 * @param args.addCalculations - Cálculos a agregar.
 * @param args.removeCalculations - Cálculos a eliminar.
 * @param args.addChecks - Verificaciones a agregar.
 * @param args.removeChecks - Texto parcial de verificaciones a eliminar (búsqueda case-insensitive).
 * @returns ToolResult con resumen de cambios aplicados.
 */
async function updateRule(args: {
  countryCode: string;
  ruleYear: number;
  newLabel?: string;
  addFields?: string[];
  removeFields?: string[];
  addCalculations?: string[];
  removeCalculations?: string[];
  addChecks?: string[];
  removeChecks?: string[];
}): Promise<ToolResult> {
  const supabase = createAdminClient();
  const cc = args.countryCode.toUpperCase();

  const { data: current, error: fetchErr } = await supabase
    .from('country_year_rules')
    .select('label, required_fields, required_calculations, checks')
    .eq('country_code', cc)
    .eq('rule_year', args.ruleYear)
    .single();

  if (fetchErr || !current) {
    return { success: false, summary: 'Regla no encontrada', detail: `No existe regla para ${cc} ${args.ruleYear}. Créala primero.` };
  }

  let fields = current.required_fields as string[];
  let calcs = current.required_calculations as string[];
  let checks = current.checks as string[];
  const changes: string[] = [];

  if (args.addFields?.length) {
    const added = args.addFields.filter((f) => !fields.includes(f));
    fields = [...fields, ...added];
    if (added.length) changes.push(`+${added.length} campo(s): ${added.join(', ')}`);
  }
  if (args.removeFields?.length) {
    const prev = fields.length;
    fields = fields.filter((f) => !args.removeFields!.includes(f));
    if (fields.length < prev) changes.push(`-${prev - fields.length} campo(s)`);
  }
  if (args.addCalculations?.length) {
    const added = args.addCalculations.filter((c) => !calcs.includes(c));
    calcs = [...calcs, ...added];
    if (added.length) changes.push(`+${added.length} cálculo(s): ${added.join(', ')}`);
  }
  if (args.removeCalculations?.length) {
    const prev = calcs.length;
    calcs = calcs.filter((c) => !args.removeCalculations!.includes(c));
    if (calcs.length < prev) changes.push(`-${prev - calcs.length} cálculo(s)`);
  }
  if (args.addChecks?.length) {
    const added = args.addChecks.filter((v) => !checks.some((c) => c.toLowerCase() === v.toLowerCase()));
    checks = [...checks, ...added];
    if (added.length) changes.push(`+${added.length} verificación(es)`);
  }
  if (args.removeChecks?.length) {
    const prev = checks.length;
    checks = checks.filter((c) => !args.removeChecks!.some((q) => c.toLowerCase().includes(q.toLowerCase())));
    if (checks.length < prev) changes.push(`-${prev - checks.length} verificación(es)`);
  }
  if (args.newLabel) changes.push(`etiqueta → "${args.newLabel}"`);

  const { error: updateErr } = await supabase
    .from('country_year_rules')
    .update({
      label: args.newLabel ?? current.label,
      required_fields: fields,
      required_calculations: calcs,
      checks,
      updated_at: new Date().toISOString(),
    })
    .eq('country_code', cc)
    .eq('rule_year', args.ruleYear);

  if (updateErr) return { success: false, summary: 'Error al guardar', detail: updateErr.message };

  const summary = changes.length
    ? `Regla ${cc} ${args.ruleYear} actualizada: ${changes.join(', ')}`
    : 'Sin cambios aplicados.';
  return { success: true, summary, detail: summary };
}

/**
 * Elimina permanentemente una regla normativa de `country_year_rules`.
 *
 * @param args.countryCode - Código ISO del país.
 * @param args.ruleYear - Año fiscal de la regla a eliminar.
 * @returns ToolResult con confirmación o mensaje de error.
 */
async function deleteRule(args: {
  countryCode: string;
  ruleYear: number;
}): Promise<ToolResult> {
  const supabase = createAdminClient();
  const cc = args.countryCode.toUpperCase();

  const { error } = await supabase
    .from('country_year_rules')
    .delete()
    .eq('country_code', cc)
    .eq('rule_year', args.ruleYear);

  if (error) return { success: false, summary: 'Error al eliminar', detail: error.message };
  return {
    success: true,
    summary: `Regla ${cc} ${args.ruleYear} eliminada`,
    detail: `La regla ${cc} ${args.ruleYear} fue eliminada permanentemente.`,
  };
}

/**
 * Ejecuta sincronización regulatoria automática.
 *
 * Delega en `sync-service.runSync()` para investigar normativa vigente
 * (vía el agente Soul / Researcher) y actualizar las reglas en
 * `country_year_rules`. Fuerza la ejecución ignorando la frecuencia
 * configurada (`force: true`).
 *
 * @param args.countryCode - Código ISO del país (ej. 'CO', 'MX'). Omitir para sincronizar todos los países activos.
 * @param args.year - Año fiscal objetivo. Omitir para usar el año actual.
 * @returns ToolResult con resumen de éxitos/errores y detalle por país/año.
 */
async function syncRules(args: {
  countryCode?: string;
  year?: number;
}): Promise<ToolResult> {
  try {
    const { runSync } = await import('../../sync/sync-service');
    const results = await runSync({
      countryCode: args.countryCode?.toUpperCase(),
      year: args.year,
      force: true,
    });

    const successCount = results.filter(r => r.status === 'completed').length;
    const errorCount = results.filter(r => r.status === 'failed').length;

    let detail = `Sincronización completada: ${successCount} exitoso(s), ${errorCount} error(es).\n`;
    for (const r of results) {
      const icon = r.status === 'completed' ? '✅' : '❌';
      detail += `\n${icon} ${r.countryCode} ${r.year}: ${r.status === 'completed' ? `${r.changesDetected ?? 0} cambio(s)` : r.error ?? 'error'}`;
    }

    return {
      success: errorCount === 0,
      summary: `Sync: ${successCount} OK, ${errorCount} errores`,
      detail,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido';
    return { success: false, summary: 'Error en sync', detail: `Error al sincronizar: ${msg}` };
  }
}

// ── System prompt ───────────────────────────────────────────────────

const PAYROLL_EXPERT_SYSTEM_PROMPT = `Eres el Agente de Nómina de NóminaSmart, un experto en normativa laboral y cálculos de nómina para múltiples países de Latinoamérica y Estados Unidos.

PAÍSES SOPORTADOS:
- 🇨🇴 Colombia (CO): UGPP, Ley 100, CST, PILA, Ley 1393
- 🇲🇽 México (MX): IMSS, ISR, Ley Federal del Trabajo, INFONAVIT, SAR
- 🇵🇪 Perú (PE): AFP, ONP, EsSalud, CTS, Gratificaciones
- 🇨🇱 Chile (CL): AFP, FONASA/Isapre, Seguro de Cesantía, Código del Trabajo
- 🇧🇷 Brasil (BR): CLT, INSS, FGTS, IRRF, 13º Salário, Férias
- 🇦🇷 Argentina (AR): SIPA, Obra Social, ART, Convenios Colectivos, Aguinaldo
- 🇺🇸 Estados Unidos (US): FICA, FUTA, SUTA, Federal/State Withholding, 401(k)

CAPACIDADES:
1. Responder consultas sobre normativa laboral del país seleccionado con explicaciones claras, referencias legales y ejemplos numéricos
2. Realizar cálculos paso a paso de nómina adaptados al país: base de cotización, prestaciones, aportes, liquidaciones
3. Gestionar reglas normativas en la base de datos (listar, crear, actualizar, eliminar)
4. Comparar normativas entre países cuando el usuario lo solicite
5. Sincronizar reglas normativas automáticamente: investigar cambios regulatorios y actualizar la base de datos

INSTRUCCIONES:
- Identifica el país del contexto (context.countryCode) y adapta tus respuestas a la normativa de ese país
- Responde SIEMPRE en español (o portugués si el país es Brasil), de forma clara y profesional
- Cuando hagas cálculos, muestra SIEMPRE las fórmulas y valores intermedios paso a paso
- Incluye referencias legales específicas del país (artículos, leyes, decretos)
- Cuando tengas datos de nómina en contexto, usa los valores reales del archivo
- Para gestión de reglas, usa las herramientas disponibles directamente
- Para acciones destructivas (eliminar regla), pide confirmación antes de ejecutar
- Usa ejemplos numéricos concretos para ilustrar conceptos
- Si no conoces la normativa específica de un país, indícalo y sugiere consultar las reglas en la base de datos`;

// ── Payroll context builder ─────────────────────────────────────────

/**
 * Construye un bloque de contexto dinámico para inyectar en el system prompt.
 *
 * Incluye datos de nómina cargados (muestra de hasta 5 registros), reglas
 * normativas activas y el país/año del contexto actual.
 *
 * @param context - Contexto del agente con datos de nómina, reglas, país y año.
 * @returns Bloque de texto formateado para concatenar al system prompt, o cadena vacía si no hay contexto relevante.
 */
function buildPayrollContextBlock(context: AgentContext): string {
  const parts: string[] = [];

  if (context.payrollData && context.payrollData.length > 0) {
    const rowCount = context.payrollData.length;
    const sampleRows = context.payrollData.slice(0, 5);
    const columns = Object.keys(sampleRows[0]);

    parts.push(`DATOS DE NÓMINA CARGADOS (${rowCount} registros):`);
    parts.push(`Columnas: ${columns.join(', ')}`);
    parts.push('Muestra de datos (primeros 5 registros):');

    for (const row of sampleRows) {
      const values = columns
        .map((col) => `${col}: ${row[col] ?? 'N/A'}`)
        .join(' | ');
      parts.push(`  ${values}`);
    }

    if (rowCount > 5) {
      parts.push(`  ... y ${rowCount - 5} registros más.`);
    }
  }

  if (context.rules && context.rules.length > 0) {
    parts.push(`\nREGLAS NORMATIVAS ACTIVAS (${context.rules.length}):`);
    for (const rule of context.rules) {
      parts.push(`  • ${rule.label} — ${rule.checks.length} verificaciones`);
    }
  }

  parts.push(`\nPAÍS: ${context.countryCode} | AÑO: ${context.year}`);

  return parts.length > 1 ? `\n\nCONTEXTO ACTUAL:\n${parts.join('\n')}` : '';
}

// ── Vercel AI SDK tool definitions ──────────────────────────────────

/**
 * Construye las definiciones de herramientas para el Vercel AI SDK.
 *
 * Expone cuatro herramientas CRUD (listar, crear, actualizar, eliminar)
 * sobre `country_year_rules` que el modelo de IA puede invocar durante
 * la conversación con el usuario.
 *
 * @returns Objeto con herramientas tipadas compatibles con `generateText()`.
 */
function buildAITools() {
  return {
    listar_reglas: tool({
      description:
        'Lista las reglas normativas configuradas en el sistema. Úsala cuando el usuario quiera ver qué reglas existen, o las reglas de un país/año específico.',
      parameters: z.object({
        countryCode: z.string().optional().describe('Código de país (CO, MX). Omitir para listar todas.'),
        ruleYear: z.number().optional().describe('Año de la regla. Omitir para listar todos los años.'),
      }),
      execute: async (args) => {
        const result = await listRules(args);
        return result.detail;
      },
    }),

    crear_regla: tool({
      description:
        'Crea una nueva regla normativa completa para un país y año que aún no exista en el sistema.',
      parameters: z.object({
        countryCode: z.string().describe('Código de país (CO, MX)'),
        ruleYear: z.number().describe('Año de la regla'),
        label: z.string().describe('Nombre descriptivo (ej: "UGPP Colombia 2027")'),
        requiredFields: z.array(z.string()).optional().describe('Lista de campos obligatorios'),
        requiredCalculations: z.array(z.string()).optional().describe('Lista de cálculos obligatorios'),
        checks: z.array(z.string()).optional().describe('Lista de verificaciones normativas'),
      }),
      execute: async (args) => {
        const result = await createRule(args);
        return result.detail;
      },
    }),

    actualizar_regla: tool({
      description:
        'Modifica una regla normativa existente: agrega o quita campos, cálculos o verificaciones. También puede cambiar la etiqueta.',
      parameters: z.object({
        countryCode: z.string().describe('Código de país (CO, MX)'),
        ruleYear: z.number().describe('Año de la regla'),
        newLabel: z.string().optional().describe('Nueva etiqueta para la regla'),
        addFields: z.array(z.string()).optional().describe('Campos a agregar'),
        removeFields: z.array(z.string()).optional().describe('Campos a quitar'),
        addCalculations: z.array(z.string()).optional().describe('Cálculos a agregar'),
        removeCalculations: z.array(z.string()).optional().describe('Cálculos a quitar'),
        addChecks: z.array(z.string()).optional().describe('Verificaciones a agregar'),
        removeChecks: z.array(z.string()).optional().describe('Texto parcial de verificaciones a quitar'),
      }),
      execute: async (args) => {
        const result = await updateRule(args);
        return result.detail;
      },
    }),

    eliminar_regla: tool({
      description:
        'Elimina permanentemente una regla normativa. Solo usar si el usuario lo confirma de forma explícita.',
      parameters: z.object({
        countryCode: z.string().describe('Código de país (CO, MX)'),
        ruleYear: z.number().describe('Año de la regla a eliminar'),
      }),
      execute: async (args) => {
        const result = await deleteRule(args);
        return result.detail;
      },
    }),

    sincronizar_reglas: tool({
      description:
        'Ejecuta sincronización regulatoria automática. Investiga normativa vigente por país/año y actualiza las reglas en la base de datos. Usar cuando el usuario pida actualizar, sincronizar o investigar reglas fiscales/normativas.',
      parameters: z.object({
        countryCode: z.string().optional().describe('Código de país (CO, MX). Omitir para sincronizar todos los países activos.'),
        year: z.number().optional().describe('Año fiscal. Omitir para usar el año actual.'),
      }),
      execute: async (args) => {
        const result = await syncRules(args);
        return result.detail;
      },
    }),
  };
}

// ── Agent tool definitions (for AgentDefinition.tools) ──────────────

const agentToolDefinitions: ToolDefinition[] = [
  {
    name: 'listar_reglas',
    description: 'Lista las reglas normativas configuradas en el sistema.',
    parameters: {
      type: 'object',
      properties: {
        countryCode: { type: 'string', description: 'Código de país (CO, MX)' },
        ruleYear: { type: 'number', description: 'Año de la regla' },
      },
    },
  },
  {
    name: 'crear_regla',
    description: 'Crea una nueva regla normativa para un país y año.',
    parameters: {
      type: 'object',
      properties: {
        countryCode: { type: 'string' },
        ruleYear: { type: 'number' },
        label: { type: 'string' },
        requiredFields: { type: 'array', items: { type: 'string' } },
        requiredCalculations: { type: 'array', items: { type: 'string' } },
        checks: { type: 'array', items: { type: 'string' } },
      },
      required: ['countryCode', 'ruleYear', 'label'],
    },
  },
  {
    name: 'actualizar_regla',
    description: 'Modifica una regla normativa existente.',
    parameters: {
      type: 'object',
      properties: {
        countryCode: { type: 'string' },
        ruleYear: { type: 'number' },
        newLabel: { type: 'string' },
        addFields: { type: 'array', items: { type: 'string' } },
        removeFields: { type: 'array', items: { type: 'string' } },
        addCalculations: { type: 'array', items: { type: 'string' } },
        removeCalculations: { type: 'array', items: { type: 'string' } },
        addChecks: { type: 'array', items: { type: 'string' } },
        removeChecks: { type: 'array', items: { type: 'string' } },
      },
      required: ['countryCode', 'ruleYear'],
    },
  },
  {
    name: 'eliminar_regla',
    description: 'Elimina permanentemente una regla normativa.',
    parameters: {
      type: 'object',
      properties: {
        countryCode: { type: 'string' },
        ruleYear: { type: 'number' },
      },
      required: ['countryCode', 'ruleYear'],
    },
  },
  {
    name: 'sincronizar_reglas',
    description: 'Ejecuta sincronización regulatoria automática. Investiga y actualiza reglas fiscales/normativas.',
    parameters: {
      type: 'object',
      properties: {
        countryCode: { type: 'string', description: 'Código de país. Omitir para todos.' },
        year: { type: 'number', description: 'Año fiscal. Omitir para año actual.' },
      },
    },
  },
];

// ── Agent factory ───────────────────────────────────────────────────

/**
 * Crea la definición del agente Experto en Nómina (Payroll Expert).
 *
 * Este agente es un asistente conversacional multi-país especializado en
 * normativa laboral para 7 países (CO, MX, PE, CL, BR, AR, US). Responde
 * consultas, realiza cálculos paso a paso y gestiona reglas normativas
 * en la base de datos mediante herramientas CRUD.
 *
 * Utiliza `context.countryCode` para adaptar respuestas a la normativa
 * del país seleccionado, y responde en español (o portugués para Brasil).
 *
 * @returns AgentDefinition con nombre, system prompt, herramientas y función execute.
 */
export function createPayrollExpertAgent(): AgentDefinition {
  async function execute(
    context: AgentContext,
    model: LanguageModel,
  ): Promise<AgentResult> {
    const startTime = Date.now();

    // Build dynamic system prompt with payroll context
    const contextBlock = buildPayrollContextBlock(context);

    // Inject country-specific rules if available
    const countryRulesBlock = context.countryRules
      ? `\n\nREGLAS NORMATIVAS CARGADAS (${context.countryCode} ${context.year}):\nRegla: ${context.countryRules.label}\nCampos requeridos: ${context.countryRules.requiredFields.join(', ')}\nCálculos requeridos: ${context.countryRules.requiredCalculations.join(', ')}\nVerificaciones:\n${context.countryRules.checks.map(c => `• ${c}`).join('\n')}`
      : '';

    const systemPrompt = PAYROLL_EXPERT_SYSTEM_PROMPT + contextBlock + countryRulesBlock;

    // Extract user message from previousResults or use a default
    const userMessage =
      (context.previousResults?.['userMessage'] as string | undefined) ??
      `Hola, necesito ayuda con nómina. País: ${context.countryCode}.`;

    try {
      const { text, usage, toolCalls } = await generateText({
        model,
        system: systemPrompt,
        prompt: userMessage,
        tools: buildAITools(),
        maxSteps: 5,
      });

      const toolsSummary = toolCalls.length > 0
        ? toolCalls.map((tc) => `${tc.toolName}`).join(', ')
        : undefined;

      return {
        agentName: 'payroll-expert',
        success: true,
        data: {
          reply: text,
          toolsUsed: toolsSummary,
        },
        tokensUsed: usage?.totalTokens ?? 0,
        providerUsed: model.modelId ?? 'unknown',
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        agentName: 'payroll-expert',
        success: false,
        data: {
          reply: 'No pude procesar la consulta. Verifica que el proveedor de IA esté configurado correctamente.',
          error: error instanceof Error ? error.message : 'Error desconocido',
        },
        tokensUsed: 0,
        providerUsed: model.modelId ?? 'unknown',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  return {
    name: 'payroll-expert',
    systemPrompt: PAYROLL_EXPERT_SYSTEM_PROMPT,
    tools: agentToolDefinitions,
    execute,
  };
}
