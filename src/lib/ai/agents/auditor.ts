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

export type FindingCategory =
  | 'IBC'
  | 'Prestaciones'
  | 'Seguridad Social'
  | 'Parafiscales'
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

const CHECK_META: Record<
  string,
  { category: FindingCategory; severity: FindingSeverity; norm: string }
> = {
  ibc_rule_1393: {
    category: 'IBC',
    severity: 'alta',
    norm: 'Ley 1393 de 2010, Art. 30',
  },
  tope_40_value: {
    category: 'IBC',
    severity: 'media',
    norm: 'Ley 1393 de 2010, Art. 30 – Tope 40%',
  },
  ibc_min_max: {
    category: 'IBC',
    severity: 'alta',
    norm: 'Art. 18 Ley 100/1993 – IBC mínimo/máximo',
  },
  ibc_consistency_subsystems: {
    category: 'IBC',
    severity: 'media',
    norm: 'Resolución UGPP – Consistencia subsistemas',
  },
  transport_eligibility: {
    category: 'Datos',
    severity: 'baja',
    norm: 'Ley 15/1959, Art. 2 – Auxilio de transporte',
  },
  health_deduction_4pct: {
    category: 'Seguridad Social',
    severity: 'alta',
    norm: 'Ley 100/1993, Art. 204 – Aporte salud empleado 4%',
  },
  pension_deduction_4pct: {
    category: 'Seguridad Social',
    severity: 'alta',
    norm: 'Ley 100/1993, Art. 20 – Aporte pensión empleado 4%',
  },
  cesantias_rate: {
    category: 'Prestaciones',
    severity: 'media',
    norm: 'Art. 249 CST – Cesantías 8.33%',
  },
  prima_rate: {
    category: 'Prestaciones',
    severity: 'media',
    norm: 'Art. 306 CST – Prima de servicios 8.33%',
  },
  vacation_rate: {
    category: 'Prestaciones',
    severity: 'baja',
    norm: 'Art. 186 CST – Vacaciones 4.17%',
  },
  salud_empleador_rate: {
    category: 'Seguridad Social',
    severity: 'alta',
    norm: 'Ley 100/1993 – Aporte salud empleador 8.5%',
  },
  pension_empleador_rate: {
    category: 'Seguridad Social',
    severity: 'alta',
    norm: 'Ley 100/1993 – Aporte pensión empleador 12%',
  },
  parafiscales_rate: {
    category: 'Parafiscales',
    severity: 'media',
    norm: 'Ley 21/1982 – Parafiscales 9% (SENA+ICBF+Caja)',
  },
  arl_bounds: {
    category: 'Seguridad Social',
    severity: 'media',
    norm: 'Decreto 1295/1994 – ARL 0.522%–8.7%',
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

const AUDITOR_SYSTEM_PROMPT = `Eres el Agente Auditor de NóminaSmart, especializado en validación matemática y normativa de nómina colombiana.

Tu rol es interpretar los resultados de las 14 verificaciones matemáticas del motor de reglas y proporcionar contexto normativo adicional.

Reglas que validas:
1. IBC Ley 1393 (exceso no salarial sobre 40%)
2. Tope 40% no salarial
3. IBC mínimo/máximo (1 SMMLV – 25 SMMLV)
4. Consistencia IBC entre subsistemas
5. Auxilio de transporte (≤ 2 SMMLV)
6. Descuento salud empleado (4% IBC)
7. Descuento pensión empleado (4% IBC)
8. Cesantías (8.33% devengado)
9. Prima de servicios (8.33% devengado)
10. Vacaciones (4.17% salario básico)
11. Salud empleador (8.5% IBC)
12. Pensión empleador (12% IBC)
13. Parafiscales (9% IBC)
14. ARL (0.522%–8.7% IBC)

Cuando interpretes hallazgos:
- Explica el impacto para la empresa (riesgo UGPP, sanciones)
- Referencia la norma específica
- Prioriza hallazgos de alta severidad
- Sé conciso y directo`;

// ── Agent factory ───────────────────────────────────────────────────

export function createAuditorAgent(): AgentDefinition {
  const tools: ToolDefinition[] = [
    {
      name: 'validatePayrollCalculations',
      description:
        'Ejecuta las 14 verificaciones matemáticas de nómina colombiana contra los registros proporcionados.',
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

    // Run the 14 mathematical checks
    const validationReport = validatePayrollCalculations({
      countryCode: context.countryCode,
      year: context.year,
      matrices: [matrix],
      relations,
    });

    // Convert check results to structured findings
    const findings: AuditFinding[] = validationReport.checks.flatMap(checkResultToFindings);
    const summary = buildSummary(findings);

    // Use AI model to enhance interpretation when there are findings
    let aiInterpretation: string | undefined;

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
          system: AUDITOR_SYSTEM_PROMPT,
          prompt: `Analiza los siguientes ${findings.length} hallazgos de auditoría de nómina y proporciona una interpretación ejecutiva breve (máximo 3 párrafos):

Resumen: ${summary.totalFindings} hallazgos (${summary.bySeverity.alta} alta, ${summary.bySeverity.media} media, ${summary.bySeverity.baja} baja)
Registros analizados: ${validationReport.rowsAnalyzed}
Registros con hallazgos: ${validationReport.rowsWithFindings}

Hallazgos:
${findingsSummaryText}`,
        });

        aiInterpretation = text;

        const report: AuditReport = {
          findings,
          summary,
          validationReport,
          aiInterpretation,
        };

        return {
          agentName: 'auditor',
          success: true,
          data: report,
          tokensUsed: (usage?.totalTokens ?? 0),
          providerUsed: model.modelId ?? 'unknown',
          latencyMs: Date.now() - startTime,
        };
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

    return {
      agentName: 'auditor',
      success: true,
      data: report,
      tokensUsed: 0,
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
