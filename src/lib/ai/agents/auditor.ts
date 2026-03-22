import { generateText, type LanguageModel } from 'ai';
import type {
  AgentContext,
  AgentDefinition,
  AgentResult,
  PayrollRow,
  ToolDefinition,
} from '../types';
import {
  validatePayrollCalculations,
  type CheckResult,
  type MappingRelationInput,
  type MatrixInput,
  type ValidationReport,
} from '../../payroll/ruleValidation';

// ── Finding types ───────────────────────────────────────────────────

export type FindingSeverity = 'alta' | 'media' | 'baja';

/**
 * Categorías de hallazgos de auditoría de nómina.
 *
 * - IBC: Ingreso Base de Cotización (topes, Ley 1393, consistencia).
 * - Prestaciones: Cesantías, prima, vacaciones (CST).
 * - Seguridad Social: Salud, pensión, ARL (Ley 100/1993).
 * - Parafiscales: SENA, ICBF, Caja de compensación (Ley 21/1982).
 * - Impuestos: Retención en la fuente, impuesto de renta y cargas tributarias sobre nómina.
 * - Datos: Validaciones de datos de entrada (auxilio de transporte, campos faltantes).
 */
export type FindingCategory =
  | 'IBC'
  | 'Prestaciones'
  | 'Seguridad Social'
  | 'Parafiscales'
  | 'Impuestos'
  | 'Datos';

export interface AuditFinding {
  document: string;
  description: string;
  severity: FindingSeverity;
  norm: string;
  expectedValue: number;
  reportedValue: number;
  category: FindingCategory;
}

export interface AuditSummary {
  totalFindings: number;
  bySeverity: Record<FindingSeverity, number>;
  byCategory: Record<FindingCategory, number>;
}

export interface AuditReport {
  findings: AuditFinding[];
  summary: AuditSummary;
  validationReport: ValidationReport;
  aiInterpretation?: string;
}

// ── Check → category / severity / norm mapping ─────────────────────

/**
 * Default CHECK_META for Colombia. For other countries, norms are loaded
 * dynamically from the country_year_rules table via the checks array.
 * This serves as fallback when no country-specific metadata is available.
 */
const CHECK_META: Record<
  string,
  { category: FindingCategory; severity: FindingSeverity; norm: string }
> = {
  ibc_rule_1393: {
    category: 'IBC',
    severity: 'alta',
    norm: 'Base de cotización: exceso no salarial sobre tope permitido',
  },
  tope_40_value: {
    category: 'IBC',
    severity: 'media',
    norm: 'Tope de pagos no salariales sobre base de cotización',
  },
  ibc_min_max: {
    category: 'IBC',
    severity: 'alta',
    norm: 'Base de cotización mínima/máxima según normativa local',
  },
  ibc_consistency_subsystems: {
    category: 'IBC',
    severity: 'media',
    norm: 'Consistencia entre subsistemas de seguridad social',
  },
  transport_eligibility: {
    category: 'Datos',
    severity: 'baja',
    norm: 'Elegibilidad de auxilio de transporte según salario',
  },
  health_deduction_4pct: {
    category: 'Seguridad Social',
    severity: 'alta',
    norm: 'Aporte salud empleado según porcentaje normativo',
  },
  pension_deduction_4pct: {
    category: 'Seguridad Social',
    severity: 'alta',
    norm: 'Aporte pensión empleado según porcentaje normativo',
  },
  cesantias_rate: {
    category: 'Prestaciones',
    severity: 'media',
    norm: 'Provisión de cesantías / aguinaldo según normativa local',
  },
  prima_rate: {
    category: 'Prestaciones',
    severity: 'media',
    norm: 'Prima de servicios / gratificación según normativa local',
  },
  vacation_rate: {
    category: 'Prestaciones',
    severity: 'baja',
    norm: 'Provisión de vacaciones según normativa local',
  },
  salud_empleador_rate: {
    category: 'Seguridad Social',
    severity: 'alta',
    norm: 'Aporte salud empleador según porcentaje normativo',
  },
  pension_empleador_rate: {
    category: 'Seguridad Social',
    severity: 'alta',
    norm: 'Aporte pensión empleador según porcentaje normativo',
  },
  parafiscales_rate: {
    category: 'Parafiscales',
    severity: 'media',
    norm: 'Aportes parafiscales / contribuciones patronales según normativa local',
  },
  arl_bounds: {
    category: 'Seguridad Social',
    severity: 'media',
    norm: 'Seguro de riesgos laborales dentro de rango normativo',
  },
};

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Converts AgentContext payrollData (array of objects) into the
 * MatrixInput format expected by validatePayrollCalculations.
 */
function payrollRowsToMatrix(rows: PayrollRow[]): MatrixInput {
  if (rows.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = Object.keys(rows[0]);
  const matrixRows = rows.map((row) => headers.map((h) => row[h]));

  return { headers, rows: matrixRows };
}

/**
 * Builds default identity mapping relations from headers.
 * Each header maps to a snake_case target with a best-guess category.
 */
function buildDefaultRelations(headers: string[]): MappingRelationInput[] {
  return headers.map((header) => {
    const target = header
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');

    return {
      source: header,
      target,
      analysisCategory: 'informational' as const,
      isCreated: false,
      requiredByRule: false,
    };
  });
}

/**
 * Parses sample findings from a CheckResult into structured AuditFindings.
 */
function checkResultToFindings(check: CheckResult): AuditFinding[] {
  const meta = CHECK_META[check.id];
  if (!meta) return [];

  return check.sampleFindings.map((sample) => {
    // Extract document identifier (first part before colon)
    const colonIdx = sample.indexOf(':');
    const document = colonIdx > 0 ? sample.slice(0, colonIdx).trim() : 'Desconocido';
    const description = colonIdx > 0 ? sample.slice(colonIdx + 1).trim() : sample;

    // Try to extract numeric values from the description
    const numbers = description.match(/[\d,.]+/g)?.map((n) =>
      parseFloat(n.replace(/\./g, '').replace(',', '.'))
    ) ?? [];

    return {
      document,
      description: `${check.label} – ${description}`,
      severity: meta.severity,
      norm: meta.norm,
      expectedValue: numbers[1] ?? 0,
      reportedValue: numbers[0] ?? 0,
      category: meta.category,
    };
  });
}

function buildSummary(findings: AuditFinding[]): AuditSummary {
  const bySeverity: Record<FindingSeverity, number> = { alta: 0, media: 0, baja: 0 };
  const byCategory: Record<FindingCategory, number> = {
    IBC: 0,
    Prestaciones: 0,
    'Seguridad Social': 0,
    Parafiscales: 0,
    Impuestos: 0,
    Datos: 0,
  };

  for (const f of findings) {
    bySeverity[f.severity] += 1;
    byCategory[f.category] += 1;
  }

  return {
    totalFindings: findings.length,
    bySeverity,
    byCategory,
  };
}

// ── System prompt ───────────────────────────────────────────────────

const AUDITOR_SYSTEM_PROMPT = `Eres el Agente Auditor de NóminaSmart, especializado en validación matemática y normativa de nómina multi-país.

Tu rol es interpretar los resultados de las verificaciones matemáticas del motor de reglas y proporcionar contexto normativo según el país analizado.

Verificaciones que ejecutas (adaptadas al país):
1. Base de cotización: exceso no salarial sobre tope permitido
2. Tope de pagos no salariales
3. Base de cotización mínima/máxima según normativa local
4. Consistencia entre subsistemas de seguridad social
5. Elegibilidad de auxilio de transporte
6. Aporte salud empleado
7. Aporte pensión empleado
8. Provisión de cesantías / aguinaldo / 13º salario
9. Prima de servicios / gratificación
10. Provisión de vacaciones
11. Aporte salud empleador
12. Aporte pensión empleador
13. Aportes parafiscales / contribuciones patronales
14. Seguro de riesgos laborales

Los porcentajes y normas específicas se cargan dinámicamente desde la tabla country_year_rules según el país y año del contexto.

Cuando interpretes hallazgos:
- Referencia la norma específica del país (ej: UGPP para CO, IMSS para MX, CLT para BR)
- Explica el impacto regulatorio y financiero para la empresa
- Prioriza hallazgos de alta severidad
- Sé conciso y directo`;

// ── Agent factory ───────────────────────────────────────────────────

/**
 * Crea la definición del agente Auditor (Juli).
 *
 * Ejecuta verificaciones matemáticas y normativas sobre registros de nómina
 * adaptadas al país y año del contexto. El flujo de ejecución es:
 *
 * 1. Convierte los datos de nómina a formato matricial.
 * 2. Ejecuta las verificaciones del motor de reglas ({@link validatePayrollCalculations}).
 * 3. Convierte los resultados en hallazgos estructurados ({@link AuditFinding}).
 * 4. Enriquece el system prompt con las reglas normativas del país (si están disponibles
 *    en `context.countryRules`) para que la interpretación de IA referencie normas específicas.
 * 5. Solicita al modelo de IA una interpretación ejecutiva de los hallazgos.
 * 6. Si el AgentBus está disponible y el corrector está registrado, solicita
 *    proactivamente sugerencias de auto-corrección para entregar auditoría + correcciones
 *    en un solo paso del pipeline.
 *
 * @returns AgentDefinition con nombre, system prompt, herramientas y función execute.
 */
export function createAuditorAgent(): AgentDefinition {
  const tools: ToolDefinition[] = [
    {
      name: 'validatePayrollCalculations',
      description:
        'Ejecuta las verificaciones matemáticas de nómina contra los registros proporcionados, adaptadas al país y año del contexto.',
      parameters: {
        type: 'object',
        properties: {
          countryCode: { type: 'string' },
          year: { type: 'number' },
          matrices: { type: 'array' },
          relations: { type: 'array' },
        },
        required: ['countryCode', 'year', 'matrices', 'relations'],
      },
    },
  ];

  async function execute(
    context: AgentContext,
    model: LanguageModel,
  ): Promise<AgentResult> {
    const startTime = Date.now();

    const rows = context.payrollData ?? [];
    const matrix = payrollRowsToMatrix(rows);

    // Use relations from previousResults if available, otherwise build defaults
    const relations: MappingRelationInput[] =
      (context.previousResults?.['relations'] as MappingRelationInput[] | undefined) ??
      buildDefaultRelations(matrix.headers);

    // Run the mathematical checks
    const validationReport = validatePayrollCalculations({
      countryCode: context.countryCode,
      year: context.year,
      matrices: [matrix],
      relations,
    });

    // Convert check results to structured findings
    const findings: AuditFinding[] = validationReport.checks.flatMap(checkResultToFindings);
    const summary = buildSummary(findings);

    // Construye un system prompt dinámico inyectando las reglas normativas
    // del país (hasta 15 verificaciones) para que la interpretación de IA
    // referencie normas específicas (ej: UGPP para CO, IMSS para MX, CLT para BR).
    const countryContext = context.countryRules
      ? `\n\nCONTEXTO NORMATIVO (${context.countryCode} ${context.year}):\nRegla: ${context.countryRules.label}\nVerificaciones del país:\n${context.countryRules.checks.slice(0, 15).map(c => `• ${c}`).join('\n')}`
      : '';
    const dynamicSystemPrompt = AUDITOR_SYSTEM_PROMPT + countryContext;

    // Use AI model to enhance interpretation when there are findings
    let aiInterpretation: string | undefined;
    let totalTokens = 0;

    if (findings.length > 0) {
      try {
        const findingsSummaryText = findings
          .slice(0, 20) // Limit to avoid token overflow
          .map(
            (f) =>
              `[${f.severity.toUpperCase()}] ${f.category} – ${f.document}: ${f.description} (Norma: ${f.norm})`,
          )
          .join('\n');

        const { text, usage } = await generateText({
          model,
          system: dynamicSystemPrompt,
          prompt: `País: ${context.countryCode} | Año: ${context.year}

Analiza los siguientes ${findings.length} hallazgos de auditoría de nómina y proporciona una interpretación ejecutiva breve (máximo 3 párrafos). Referencia las normas específicas del país ${context.countryCode}:

Resumen: ${summary.totalFindings} hallazgos (${summary.bySeverity.alta} alta, ${summary.bySeverity.media} media, ${summary.bySeverity.baja} baja)
Registros analizados: ${validationReport.rowsAnalyzed}
Registros con hallazgos: ${validationReport.rowsWithFindings}

Hallazgos:
${findingsSummaryText}`,
        });

        aiInterpretation = text;
        totalTokens = usage?.totalTokens ?? 0;
      } catch {
        // If AI enhancement fails, still return the mathematical results
      }
    }

    const report: AuditReport = {
      findings,
      summary,
      validationReport,
      aiInterpretation,
    };

    // ── Comunicación inter-agente: solicitar auto-correcciones al corrector ──
    // Cuando hay hallazgos corregibles y el AgentBus está disponible con el
    // corrector registrado, se solicitan proactivamente sugerencias de corrección.
    // Esto permite que el pipeline entregue auditoría + correcciones en un solo
    // paso, sin necesidad de que el Master orqueste una fase separada de corrección.
    // Si falla, no es crítico: las correcciones pueden solicitarse manualmente.
    if (findings.length > 0 && context.bus?.hasAgent('corrector')) {
      try {
        const correctorResult = await context.bus.send({
          fromAgent: 'auditor',
          toAgent: 'corrector',
          queryType: 'auto-correct-suggestions',
          payload: {
            auditor: report,
            countryCode: context.countryCode,
            year: context.year,
          },
        });
        if (correctorResult.success) {
          (report as AuditReport & { autoCorrections?: unknown }).autoCorrections = correctorResult.data;
        }
      } catch {
        // Non-critical: corrections can still be requested manually
      }
    }

    return {
      agentName: 'auditor',
      success: true,
      data: report,
      tokensUsed: totalTokens,
      providerUsed: model.modelId ?? 'unknown',
      latencyMs: Date.now() - startTime,
    };
  }

  return {
    name: 'auditor',
    systemPrompt: AUDITOR_SYSTEM_PROMPT,
    tools,
    execute,
  };
}
