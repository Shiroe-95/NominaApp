import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';
import type {
  AgentContext,
  AgentDefinition,
  AgentResult,
  ToolDefinition,
} from '../types';
import type {
  AuditFinding,
  AuditReport,
  AuditSummary,
  FindingCategory,
  FindingSeverity,
} from './auditor';

// ── Writer report types ─────────────────────────────────────────────

/** Nivel de riesgo global del reporte de auditoría. */
export type RiskLevel = 'alto' | 'medio' | 'bajo';

/** Hallazgos de auditoría agrupados por categoría normativa. */
export interface GroupedFinding {
  category: FindingCategory;
  findings: AuditFinding[];
}

/**
 * Reporte ejecutivo generado por el Agente Redactor.
 *
 * Contiene el resumen narrativo, nivel de riesgo, hallazgos agrupados
 * por categoría, recomendaciones priorizadas y referencias normativas.
 * Cumple con Requisitos 6.1, 6.2 y 6.3.
 */
export interface WriterReport {
  executiveSummary: string;
  riskLevel: RiskLevel;
  findingsByCategory: GroupedFinding[];
  recommendations: string[];
  normativeReferences: string[];
}

// ── Zod schema for AI-generated content ─────────────────────────────

const WriterOutputSchema = z.object({
  executiveSummary: z.string().min(1).describe('Resumen ejecutivo del reporte de auditoría'),
  riskLevel: z.enum(['alto', 'medio', 'bajo']).describe('Nivel de riesgo global'),
  recommendations: z
    .array(z.string())
    .min(1)
    .describe('Recomendaciones priorizadas para la empresa'),
});

type WriterOutput = z.infer<typeof WriterOutputSchema>;

// ── Helpers ─────────────────────────────────────────────────────────

const SEVERITY_ORDER: Record<FindingSeverity, number> = {
  alta: 0,
  media: 1,
  baja: 2,
};

const CATEGORY_ORDER: FindingCategory[] = [
  'IBC',
  'Prestaciones',
  'Seguridad Social',
  'Parafiscales',
  'Datos',
];

/**
 * Agrupa hallazgos de auditoría por categoría normativa y ordena cada grupo
 * por severidad descendente (alta → media → baja).
 *
 * Las categorías siguen el orden: IBC, Prestaciones, Seguridad Social,
 * Parafiscales, Datos. Categorías sin hallazgos se omiten del resultado.
 *
 * @param findings - Lista plana de hallazgos del Agente Auditor.
 * @returns Hallazgos agrupados y ordenados por categoría y severidad.
 */
export function groupAndSortFindings(findings: AuditFinding[]): GroupedFinding[] {
  const grouped = new Map<FindingCategory, AuditFinding[]>();

  for (const category of CATEGORY_ORDER) {
    grouped.set(category, []);
  }

  for (const finding of findings) {
    const list = grouped.get(finding.category);
    if (list) {
      list.push(finding);
    } else {
      grouped.set(finding.category, [finding]);
    }
  }

  const result: GroupedFinding[] = [];
  for (const [category, items] of grouped) {
    if (items.length === 0) continue;
    items.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
    result.push({ category, findings: items });
  }

  return result;
}

/**
 * Determina el nivel de riesgo global a partir de la distribución de severidades.
 *
 * Regla: si hay al menos un hallazgo de severidad alta → 'alto';
 * si hay al menos uno medio → 'medio'; en caso contrario → 'bajo'.
 *
 * @param summary - Resumen agregado de hallazgos del Agente Auditor.
 * @returns Nivel de riesgo global ('alto' | 'medio' | 'bajo').
 */
export function determineRiskLevel(summary: AuditSummary): RiskLevel {
  if (summary.bySeverity.alta > 0) return 'alto';
  if (summary.bySeverity.media > 0) return 'medio';
  return 'bajo';
}

/**
 * Extrae referencias normativas únicas (Ley 1393, Art. 249 CST, UGPP, etc.)
 * de la lista de hallazgos para incluirlas en el reporte ejecutivo.
 *
 * @param findings - Lista de hallazgos con campo `norm`.
 * @returns Array de referencias normativas sin duplicados.
 */
export function extractNormativeReferences(findings: AuditFinding[]): string[] {
  const refs = new Set<string>();
  for (const f of findings) {
    if (f.norm) refs.add(f.norm);
  }
  return Array.from(refs);
}

// ── System prompt ───────────────────────────────────────────────────

const WRITER_SYSTEM_PROMPT = `Eres el Agente Redactor de NóminaSmart, especializado en generar reportes ejecutivos de auditoría de nómina.

Tu rol es transformar hallazgos técnicos de auditoría en reportes narrativos claros, profesionales y accionables para gerentes de recursos humanos y directivos.

Directrices de redacción:
- Usa un tono ejecutivo, profesional y directo
- El resumen ejecutivo debe ser comprensible para un no-técnico
- Prioriza los hallazgos de mayor impacto financiero y regulatorio
- Incluye siempre las referencias normativas específicas (Ley 1393, Art. 249 CST, UGPP, etc.)
- Las recomendaciones deben ser concretas y priorizadas por urgencia
- Menciona el riesgo de sanciones UGPP cuando aplique
- Agrupa los hallazgos por categoría: IBC, Prestaciones, Seguridad Social, Parafiscales, Datos

Formato del resumen ejecutivo:
1. Contexto general de la auditoría (registros analizados, período)
2. Nivel de riesgo global y justificación
3. Principales hallazgos por categoría
4. Impacto potencial (sanciones, correcciones requeridas)
5. Recomendaciones priorizadas`;

// ── Agent factory ───────────────────────────────────────────────────

/**
 * Crea la definición del Agente Redactor (Writer Agent).
 *
 * Este agente transforma hallazgos técnicos del Agente Auditor en reportes
 * ejecutivos narrativos dirigidos a gerentes de RRHH y directivos.
 *
 * Flujo de ejecución:
 * 1. Extrae resultados del Auditor desde `context.previousResults['auditor']`.
 * 2. Agrupa hallazgos por categoría y determina nivel de riesgo (determinístico).
 * 3. Si no hay hallazgos, retorna reporte limpio sin invocar IA.
 * 4. Si hay hallazgos, usa `generateObject` con el Vercel AI SDK para generar
 *    resumen ejecutivo y recomendaciones priorizadas.
 * 5. Si la IA falla, retorna un reporte determinístico de respaldo.
 *
 * Cumple con Requisitos 6.1 (reporte ejecutivo), 6.2 (agrupación por categoría)
 * y 6.3 (referencias normativas).
 *
 * @returns Definición del agente con nombre, system prompt, herramientas y función execute.
 */
export function createWriterAgent(): AgentDefinition {
  const tools: ToolDefinition[] = [
    {
      name: 'generateExecutiveReport',
      description:
        'Genera un reporte ejecutivo narrativo a partir de hallazgos de auditoría de nómina.',
      parameters: {
        type: 'object',
        properties: {
          findings: { type: 'array', description: 'Hallazgos estructurados del auditor' },
          summary: { type: 'object', description: 'Resumen de hallazgos por severidad y categoría' },
        },
        required: ['findings', 'summary'],
      },
    },
  ];

  async function execute(
    context: AgentContext,
    model: LanguageModel,
  ): Promise<AgentResult> {
    const startTime = Date.now();

    // Extract auditor results from previousResults
    const auditorData = context.previousResults?.['auditor'] as AuditReport | undefined;

    const findings: AuditFinding[] = auditorData?.findings ?? [];
    const summary: AuditSummary = auditorData?.summary ?? {
      totalFindings: 0,
      bySeverity: { alta: 0, media: 0, baja: 0 },
      byCategory: { IBC: 0, Prestaciones: 0, 'Seguridad Social': 0, Parafiscales: 0, Datos: 0 },
    };

    // Deterministic grouping and sorting
    const findingsByCategory = groupAndSortFindings(findings);
    const riskLevel = determineRiskLevel(summary);
    const normativeReferences = extractNormativeReferences(findings);

    // If no findings, return a clean report without calling the AI
    if (findings.length === 0) {
      const report: WriterReport = {
        executiveSummary:
          'La auditoría de nómina no detectó inconsistencias en los registros analizados. ' +
          'Todos los cálculos cumplen con la normativa vigente.',
        riskLevel: 'bajo',
        findingsByCategory: [],
        recommendations: ['Mantener los controles actuales de nómina.'],
        normativeReferences: [],
      };

      return {
        agentName: 'writer',
        success: true,
        data: report,
        tokensUsed: 0,
        providerUsed: model.modelId ?? 'unknown',
        latencyMs: Date.now() - startTime,
      };
    }

    // Build prompt with structured findings for the AI
    const findingsText = findingsByCategory
      .map((group) => {
        const items = group.findings
          .slice(0, 10) // Limit per category to avoid token overflow
          .map(
            (f) =>
              `  - [${f.severity.toUpperCase()}] ${f.document}: ${f.description} (Norma: ${f.norm})`,
          )
          .join('\n');
        return `**${group.category}** (${group.findings.length} hallazgos):\n${items}`;
      })
      .join('\n\n');

    const prompt = `Genera un reporte ejecutivo de auditoría de nómina con los siguientes datos:

Registros analizados: ${auditorData?.validationReport?.rowsAnalyzed ?? 'N/A'}
Registros con hallazgos: ${auditorData?.validationReport?.rowsWithFindings ?? 'N/A'}
Total de hallazgos: ${summary.totalFindings}
Severidad: ${summary.bySeverity.alta} alta, ${summary.bySeverity.media} media, ${summary.bySeverity.baja} baja
Nivel de riesgo global: ${riskLevel}

Hallazgos por categoría:
${findingsText}

Referencias normativas aplicables:
${normativeReferences.map((r) => `- ${r}`).join('\n')}

Genera:
1. Un resumen ejecutivo claro y profesional (2-4 párrafos)
2. Recomendaciones priorizadas y concretas`;

    try {
      const { object, usage } = await generateObject({
        model,
        system: WRITER_SYSTEM_PROMPT,
        prompt,
        schema: WriterOutputSchema,
      });

      const aiOutput: WriterOutput = object;

      const report: WriterReport = {
        executiveSummary: aiOutput.executiveSummary,
        riskLevel,
        findingsByCategory,
        recommendations: aiOutput.recommendations,
        normativeReferences,
      };

      return {
        agentName: 'writer',
        success: true,
        data: report,
        tokensUsed: usage?.totalTokens ?? 0,
        providerUsed: model.modelId ?? 'unknown',
        latencyMs: Date.now() - startTime,
      };
    } catch {
      // If AI generation fails, return a deterministic fallback report
      const report: WriterReport = {
        executiveSummary:
          `Se analizaron los registros de nómina y se detectaron ${summary.totalFindings} hallazgos: ` +
          `${summary.bySeverity.alta} de severidad alta, ${summary.bySeverity.media} media y ${summary.bySeverity.baja} baja. ` +
          `El nivel de riesgo global es ${riskLevel}.`,
        riskLevel,
        findingsByCategory,
        recommendations: [
          'Revisar y corregir los hallazgos de severidad alta de forma prioritaria.',
          'Verificar los cálculos de IBC y aportes a seguridad social.',
          'Consultar con el área jurídica sobre el riesgo de sanciones UGPP.',
        ],
        normativeReferences,
      };

      return {
        agentName: 'writer',
        success: true,
        data: report,
        tokensUsed: 0,
        providerUsed: model.modelId ?? 'unknown',
        latencyMs: Date.now() - startTime,
      };
    }
  }

  return {
    name: 'writer',
    systemPrompt: WRITER_SYSTEM_PROMPT,
    tools,
    execute,
  };
}
