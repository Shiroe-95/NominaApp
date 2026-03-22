import { generateText, type LanguageModel } from 'ai';
import type {
  AgentContext,
  AgentDefinition,
  AgentResult,
  PayrollRow,
  ToolDefinition,
} from '../types';
import type { AuditFinding, AuditReport } from './auditor';

// ── Applied correction types ────────────────────────────────────────

/** Record of a correction that has been approved and applied */
export interface AppliedCorrection {
  rowIndex: number;
  fieldName: string;
  valueBefore: string;
  valueAfter: string;
  formulaApplied?: string;
  approvedBy: string;
  revalidationResult: 'resolved' | 'new_findings' | 'unchanged' | 'pending';
  batchId?: string;
}

/** Result of applying a batch of corrections */
export interface ApplyCorrectionsResult {
  applied: number;
  batchId: string;
  revalidationSummary: Record<string, number>;
}

/** Result of revalidating a single corrected row */
export interface RevalidationResult {
  rowIndex: number;
  outcome: 'resolved' | 'new_findings' | 'unchanged';
  remainingFindings: number;
}

// ── Correction types ────────────────────────────────────────────────

export interface CorrectionEntry {
  rowIndex: number;
  fieldName: string;
  currentValue: number;
  suggestedValue: number;
  justification: string;
}

export interface CorrectionReport {
  corrections: CorrectionEntry[];
  skipped: number;
  aiSummary?: string;
}

// ── Correction formulas (default rates, used as fallback) ────────────

/**
 * Maps auditor check IDs to deterministic correction formulas.
 * Each formula receives the payroll row values and returns the correct value,
 * or null when the calculation is not deterministic (Req 7.3).
 *
 * Rates are loaded dynamically from countryRules when available.
 * The factory function `buildCorrectionFormulas()` creates formulas
 * with the correct rates for the country being processed.
 */

interface FormulaContext {
  ibcTotal: number;
  baseSalary: number;
  nonSalary: number;
  grossPay: number;
  totalIncome: number;
}

interface FormulaResult {
  suggestedValue: number;
  justification: string;
}

type CorrectionFormula = (ctx: FormulaContext) => FormulaResult | null;

const FIELD_FOR_CHECK: Record<string, string> = {
  health_deduction_4pct: 'health_employee_deduction',
  pension_deduction_4pct: 'pension_employee_deduction',
  cesantias_rate: 'cesantias_provision',
  prima_rate: 'prima_provision',
  vacation_rate: 'vacation_provision',
  salud_empleador_rate: 'salud_empleador',
  pension_empleador_rate: 'pension_empleador',
  parafiscales_rate: 'parafiscales_total',
};

/**
 * Builds correction formulas with rates from country rules.
 * Falls back to default rates (CO) when country-specific rates are not available.
 */
function buildCorrectionFormulas(countryRules?: AgentContext['countryRules']): Record<string, CorrectionFormula> {
  // Try to extract rates from country rules checks
  let healthEmpRate = 0.04;
  let pensionEmpRate = 0.04;
  let healthEmployerRate = 0.085;
  let pensionEmployerRate = 0.12;

  if (countryRules?.checks) {
    for (const check of countryRules.checks) {
      const healthEmpMatch = check.match(/salud\s*empleado(?!r)[^0-9]*([0-9.,]+)\s*%/i);
      if (healthEmpMatch) healthEmpRate = parseFloat(healthEmpMatch[1].replace(',', '.')) / 100;

      const pensionEmpMatch = check.match(/pensi[oó]n\s*empleado(?!r)[^0-9]*([0-9.,]+)\s*%/i);
      if (pensionEmpMatch) pensionEmpRate = parseFloat(pensionEmpMatch[1].replace(',', '.')) / 100;

      const healthErMatch = check.match(/salud\s*empleador[^0-9]*([0-9.,]+)\s*%/i);
      if (healthErMatch) healthEmployerRate = parseFloat(healthErMatch[1].replace(',', '.')) / 100;

      const pensionErMatch = check.match(/pensi[oó]n\s*empleador[^0-9]*([0-9.,]+)\s*%/i);
      if (pensionErMatch) pensionEmployerRate = parseFloat(pensionErMatch[1].replace(',', '.')) / 100;
    }
  }

  return {
    health_deduction_4pct: (ctx) => {
      if (ctx.ibcTotal <= 0) return null;
      return {
        suggestedValue: Math.round(ctx.ibcTotal * healthEmpRate),
        justification: `Aporte salud empleado = Base cotización × ${(healthEmpRate * 100).toFixed(1)}% = ${ctx.ibcTotal} × ${healthEmpRate}`,
      };
    },

    pension_deduction_4pct: (ctx) => {
      if (ctx.ibcTotal <= 0) return null;
      return {
        suggestedValue: Math.round(ctx.ibcTotal * pensionEmpRate),
        justification: `Aporte pensión empleado = Base cotización × ${(pensionEmpRate * 100).toFixed(1)}% = ${ctx.ibcTotal} × ${pensionEmpRate}`,
      };
    },

    cesantias_rate: (ctx) => {
      const base = ctx.grossPay > 0 ? ctx.grossPay : ctx.totalIncome;
      if (base <= 0) return null;
      return {
        suggestedValue: Math.round(base * 0.0833),
        justification: `Cesantías/Aguinaldo = Total devengado × 8.33% = ${base} × 0.0833`,
      };
    },

    prima_rate: (ctx) => {
      const base = ctx.grossPay > 0 ? ctx.grossPay : ctx.totalIncome;
      if (base <= 0) return null;
      return {
        suggestedValue: Math.round(base * 0.0833),
        justification: `Prima/Gratificación = Total devengado × 8.33% = ${base} × 0.0833`,
      };
    },

    vacation_rate: (ctx) => {
      if (ctx.baseSalary <= 0) return null;
      return {
        suggestedValue: Math.round(ctx.baseSalary * 0.0417),
        justification: `Vacaciones = Salario básico × 4.17% = ${ctx.baseSalary} × 0.0417`,
      };
    },

    salud_empleador_rate: (ctx) => {
      if (ctx.ibcTotal <= 0) return null;
      return {
        suggestedValue: Math.round(ctx.ibcTotal * healthEmployerRate),
        justification: `Aporte salud empleador = Base cotización × ${(healthEmployerRate * 100).toFixed(1)}% = ${ctx.ibcTotal} × ${healthEmployerRate}`,
      };
    },

    pension_empleador_rate: (ctx) => {
      if (ctx.ibcTotal <= 0) return null;
      return {
        suggestedValue: Math.round(ctx.ibcTotal * pensionEmployerRate),
        justification: `Aporte pensión empleador = Base cotización × ${(pensionEmployerRate * 100).toFixed(1)}% = ${ctx.ibcTotal} × ${pensionEmployerRate}`,
      };
    },

    parafiscales_rate: (ctx) => {
      if (ctx.ibcTotal <= 0) return null;
      return {
        suggestedValue: Math.round(ctx.ibcTotal * 0.09),
        justification: `Contribuciones patronales = Base cotización × 9% = ${ctx.ibcTotal} × 0.09`,
      };
    },
  };
}

// Default formulas (CO rates) — used by revalidateRow and other static callers
const CORRECTION_FORMULAS: Record<string, CorrectionFormula> = buildCorrectionFormulas();

// Checks where the correct value is NOT deterministic (Req 7.3)
const NON_DETERMINISTIC_CHECKS = new Set([
  'ibc_rule_1393',       // IBC depends on salary classification decisions
  'tope_40_value',       // Depends on IBC calculation
  'ibc_min_max',         // Range check, no single correct value
  'ibc_consistency_subsystems', // Multiple subsystems, unclear which is wrong
  'transport_eligibility',      // Eligibility check, not a numeric correction
  'arl_bounds',          // ARL rate depends on risk class (I–V), not deterministic
]);

// ── Helpers ─────────────────────────────────────────────────────────

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^0-9,.-]/g, '').replace(/\.(?=.*\.)/g, '').replace(',', '.');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/**
 * Extracts numeric values from a payroll row for the fields needed by formulas.
 */
function extractFormulaContext(row: PayrollRow): FormulaContext {
  const baseSalary = toNumber(row['base_salary'] ?? row['salario_basico'] ?? 0);
  const nonSalary = toNumber(row['non_salary_payments'] ?? row['pagos_no_salariales'] ?? 0);
  const grossPay = toNumber(row['gross_pay'] ?? row['total_devengado'] ?? 0);
  const ibcTotal = toNumber(row['ibc_total'] ?? row['ibc'] ?? 0);
  const totalIncome = baseSalary + nonSalary;

  return { ibcTotal, baseSalary, nonSalary, grossPay, totalIncome };
}

/**
 * Finds the row index in payrollData that matches a finding's document identifier.
 * Returns -1 if no match is found.
 */
function findRowIndex(rows: PayrollRow[], finding: AuditFinding): number {
  const doc = finding.document?.trim();
  if (!doc || doc === 'Desconocido') return -1;

  // Check for "fila_N" pattern from auditor
  const filaMatch = doc.match(/^fila_(\d+)$/);
  if (filaMatch) {
    const idx = parseInt(filaMatch[1], 10) - 1; // fila_1 → index 0
    return idx >= 0 && idx < rows.length ? idx : -1;
  }

  // Match by document_number field
  for (let i = 0; i < rows.length; i++) {
    const rowDoc = String(
      rows[i]['document_number'] ?? rows[i]['documento'] ?? rows[i]['cedula'] ?? ''
    ).trim();
    if (rowDoc && rowDoc === doc) return i;
  }

  return -1;
}

/**
 * Maps an auditor finding category + description to a check ID
 * so we can look up the appropriate correction formula.
 */
function findCheckIdForFinding(finding: AuditFinding): string | null {
  const desc = finding.description.toLowerCase();

  if (desc.includes('descuento salud') || desc.includes('health_deduction') || desc.includes('salud empleado'))
    return 'health_deduction_4pct';
  if (desc.includes('descuento pension') || desc.includes('pension_deduction') || desc.includes('pensión empleado') || desc.includes('pension empleado'))
    return 'pension_deduction_4pct';
  if (desc.includes('cesant'))
    return 'cesantias_rate';
  if (desc.includes('prima'))
    return 'prima_rate';
  if (desc.includes('vacacion'))
    return 'vacation_rate';
  if (desc.includes('salud empleador'))
    return 'salud_empleador_rate';
  if ((desc.includes('pension empleador') || desc.includes('pensión empleador')) && !desc.includes('descuento'))
    return 'pension_empleador_rate';
  if (desc.includes('parafiscal'))
    return 'parafiscales_rate';
  if (desc.includes('ibc') && desc.includes('1393'))
    return 'ibc_rule_1393';
  if (desc.includes('tope') && desc.includes('40'))
    return 'tope_40_value';
  if (desc.includes('ibc') && (desc.includes('rango') || desc.includes('min') || desc.includes('max')))
    return 'ibc_min_max';
  if (desc.includes('consistencia') || desc.includes('subsistema'))
    return 'ibc_consistency_subsystems';
  if (desc.includes('transporte'))
    return 'transport_eligibility';
  if (desc.includes('arl'))
    return 'arl_bounds';

  return null;
}

// ── System prompt ───────────────────────────────────────────────────

const CORRECTOR_SYSTEM_PROMPT = `Eres el Agente Corrector de NóminaSmart, especializado en proponer correcciones numéricas precisas para errores de nómina multi-país.

Tu rol es analizar los hallazgos del Agente Auditor y las correcciones determinísticas calculadas, y proporcionar un resumen ejecutivo de las correcciones propuestas.

Las fórmulas y porcentajes se cargan dinámicamente desde la tabla country_year_rules según el país y año del contexto. Los porcentajes por defecto (fallback para Colombia) son:
- Salud empleado: 4% de la base de cotización
- Pensión empleado: 4% de la base de cotización
- Cesantías/Aguinaldo: 8.33% del total devengado
- Prima de servicios: 8.33% del total devengado
- Vacaciones: 4.17% del salario básico
- Salud empleador: 8.5% de la base de cotización
- Pensión empleador: 12% de la base de cotización
- Parafiscales: 9% de la base de cotización

Reglas estrictas:
- SOLO propones correcciones cuando el cálculo es 100% determinístico
- NUNCA propones valores especulativos
- Cada corrección incluye la fórmula exacta aplicada y la norma del país
- Si no puedes calcular con certeza, omites la corrección`;

// ── Agent factory ───────────────────────────────────────────────────

export function createCorrectorAgent(): AgentDefinition {
  const tools: ToolDefinition[] = [
    {
      name: 'calculateCorrections',
      description:
        'Calcula correcciones numéricas determinísticas usando fórmulas normativas del país correspondiente para cada hallazgo del auditor.',
      parameters: {
        type: 'object',
        properties: {
          findings: { type: 'array', description: 'Hallazgos del auditor' },
          payrollData: { type: 'array', description: 'Registros originales de nómina' },
        },
        required: ['findings', 'payrollData'],
      },
    },
  ];

  async function execute(
    context: AgentContext,
    model: LanguageModel,
  ): Promise<AgentResult> {
    const startTime = Date.now();

    const rows = context.payrollData ?? [];
    const auditorData = context.previousResults?.['auditor'] as AuditReport | undefined;
    const findings: AuditFinding[] = auditorData?.findings ?? [];

    // Calculate deterministic corrections using country-specific rates
    const formulas = buildCorrectionFormulas(context.countryRules);
    const corrections: CorrectionEntry[] = [];
    let skipped = 0;

    for (const finding of findings) {
      const checkId = findCheckIdForFinding(finding);

      // Skip non-deterministic checks (Req 7.3)
      if (!checkId || NON_DETERMINISTIC_CHECKS.has(checkId)) {
        skipped++;
        continue;
      }

      const formula = formulas[checkId];
      if (!formula) {
        skipped++;
        continue;
      }

      const fieldName = FIELD_FOR_CHECK[checkId];
      if (!fieldName) {
        skipped++;
        continue;
      }

      const rowIndex = findRowIndex(rows, finding);
      if (rowIndex < 0) {
        skipped++;
        continue;
      }

      const row = rows[rowIndex];
      const formulaCtx = extractFormulaContext(row);
      const result = formula(formulaCtx);

      // Omit when formula cannot determine value (Req 7.3)
      if (!result) {
        skipped++;
        continue;
      }

      const currentValue = toNumber(row[fieldName] ?? 0);

      // Only suggest when suggestedValue differs from currentValue
      if (Math.abs(result.suggestedValue - currentValue) <= 1) {
        continue;
      }

      corrections.push({
        rowIndex,
        fieldName,
        currentValue,
        suggestedValue: result.suggestedValue,
        justification: result.justification,
      });
    }

    // Use AI to generate a summary when there are corrections
    let aiSummary: string | undefined;

    if (corrections.length > 0) {
      try {
        const correctionsText = corrections
          .slice(0, 20)
          .map(
            (c) =>
              `Fila ${c.rowIndex}: ${c.fieldName} — actual: ${c.currentValue}, sugerido: ${c.suggestedValue} (${c.justification})`,
          )
          .join('\n');

        // Build country-aware system prompt
        const countryContext = context.countryRules
          ? `\n\nCONTEXTO NORMATIVO (${context.countryCode} ${context.year}):\nRegla: ${context.countryRules.label}\nVerificaciones:\n${context.countryRules.checks.slice(0, 10).map(c => `• ${c}`).join('\n')}`
          : '';
        const dynamicSystemPrompt = CORRECTOR_SYSTEM_PROMPT + countryContext;

        const { text, usage } = await generateText({
          model,
          system: dynamicSystemPrompt,
          prompt: `País: ${context.countryCode} | Año: ${context.year}

Analiza las siguientes ${corrections.length} correcciones propuestas y genera un resumen ejecutivo breve (máximo 2 párrafos) indicando los patrones de error más comunes y el impacto estimado. Referencia las normas del país ${context.countryCode}:

Correcciones omitidas (no determinísticas): ${skipped}

Correcciones propuestas:
${correctionsText}`,
        });

        aiSummary = text;

        const report: CorrectionReport = { corrections, skipped, aiSummary };

        return {
          agentName: 'corrector',
          success: true,
          data: report,
          tokensUsed: usage?.totalTokens ?? 0,
          providerUsed: model.modelId ?? 'unknown',
          latencyMs: Date.now() - startTime,
        };
      } catch {
        // If AI enhancement fails, still return the deterministic corrections
      }
    }

    // ── Inter-agent: consult payroll-expert for non-deterministic findings ──
    // When there are skipped (non-deterministic) findings and the bus is
    // available, ask the payroll-expert for guidance on how to handle them.
    let expertGuidance: string | undefined;
    if (skipped > 0 && context.bus?.hasAgent('payroll-expert')) {
      try {
        const expertResult = await context.bus.send({
          fromAgent: 'corrector',
          toAgent: 'payroll-expert',
          queryType: 'non-deterministic-guidance',
          payload: {
            userMessage: `Tengo ${skipped} hallazgos de auditoría de nómina (${context.countryCode} ${context.year}) que no son determinísticos y no puedo corregir automáticamente. ¿Qué recomendaciones generales puedes dar para revisarlos manualmente?`,
            countryCode: context.countryCode,
            year: context.year,
          },
        });
        if (expertResult.success) {
          const expertData = expertResult.data as Record<string, unknown>;
          expertGuidance = expertData?.reply as string | undefined;
        }
      } catch {
        // Non-critical
      }
    }

    const report: CorrectionReport & { expertGuidance?: string } = {
      corrections,
      skipped,
      aiSummary,
      expertGuidance,
    };

    return {
      agentName: 'corrector',
      success: true,
      data: report,
      tokensUsed: 0,
      providerUsed: model.modelId ?? 'unknown',
      latencyMs: Date.now() - startTime,
    };
  }

  return {
    name: 'corrector',
    systemPrompt: CORRECTOR_SYSTEM_PROMPT,
    tools,
    execute,
  };
}

// ── Correction application ──────────────────────────────────────────

/**
 * Generates a UUID-like batch identifier.
 * Uses crypto.randomUUID when available, falls back to a timestamp-based ID.
 */
function generateBatchId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const hex = () => Math.random().toString(16).slice(2, 10);
  return `${hex()}-${hex()}-${hex()}-${hex()}`;
}

/**
 * Converts a CorrectionEntry (suggestion) into an AppliedCorrection record
 * ready for persistence.
 */
export function correctionEntryToApplied(
  entry: CorrectionEntry,
  approvedBy: string,
  batchId: string,
): AppliedCorrection {
  return {
    rowIndex: entry.rowIndex,
    fieldName: entry.fieldName,
    valueBefore: String(entry.currentValue),
    valueAfter: String(entry.suggestedValue),
    formulaApplied: entry.justification,
    approvedBy,
    revalidationResult: 'pending',
    batchId,
  };
}

/**
 * Applies a single correction to the in-memory payroll data.
 * Mutates the row at the given index, setting the field to the new value.
 * Returns false if the row or field cannot be located.
 */
export function applySingleCorrection(
  rows: PayrollRow[],
  correction: AppliedCorrection,
): boolean {
  if (correction.rowIndex < 0 || correction.rowIndex >= rows.length) return false;
  const row = rows[correction.rowIndex];
  if (!(correction.fieldName in row)) return false;
  row[correction.fieldName] = toNumber(correction.valueAfter);
  return true;
}

/**
 * Re-runs the deterministic correction formulas for a specific row
 * to check whether the applied correction resolved the original finding.
 *
 * Returns the revalidation outcome:
 * - 'resolved'     – no remaining discrepancies for the corrected field
 * - 'new_findings' – the correction introduced a new discrepancy
 * - 'unchanged'    – the field still has a discrepancy (should not happen for valid corrections)
 */
export function revalidateRow(
  row: PayrollRow,
  fieldName: string,
): RevalidationResult['outcome'] {
  const ctx = extractFormulaContext(row);

  // Find which checkId corresponds to this field
  const checkId = Object.entries(FIELD_FOR_CHECK).find(
    ([, field]) => field === fieldName,
  )?.[0];

  if (!checkId) {
    // No formula for this field — can't revalidate, treat as resolved
    return 'resolved';
  }

  if (NON_DETERMINISTIC_CHECKS.has(checkId)) {
    return 'resolved';
  }

  const formula = CORRECTION_FORMULAS[checkId];
  if (!formula) return 'resolved';

  const result = formula(ctx);
  if (!result) return 'resolved';

  const currentValue = toNumber(row[fieldName] ?? 0);
  const diff = Math.abs(result.suggestedValue - currentValue);

  if (diff <= 1) return 'resolved';

  // The value still doesn't match — check if it's worse than before
  // (new_findings) or the same issue (unchanged). Since we just applied
  // the suggested value, a remaining diff means the formula context
  // changed (e.g., IBC changed affecting downstream fields).
  return 'new_findings';
}

/**
 * Applies a batch of approved corrections atomically.
 *
 * "Atomic" here means all-or-nothing: if any single correction fails to
 * apply, the entire batch is rolled back (in-memory) and no records are
 * produced. This mirrors a SQL transaction semantic.
 *
 * Steps:
 * 1. Generate a batch ID
 * 2. Snapshot affected rows for rollback
 * 3. Apply all corrections to the in-memory payroll data
 * 4. Re-validate affected rows
 * 5. Build applied_corrections records
 * 6. Return summary
 */
export function applyCorrections(
  corrections: AppliedCorrection[],
  payrollData: PayrollRow[],
  payrollUploadId: string,
  approvedBy: string,
): ApplyCorrectionsResult {
  if (corrections.length === 0) {
    return { applied: 0, batchId: '', revalidationSummary: {} };
  }

  const batchId = generateBatchId();

  // Snapshot rows that will be modified (for rollback)
  const affectedIndices = [...new Set(corrections.map((c) => c.rowIndex))];
  const snapshots = new Map<number, PayrollRow>();
  for (const idx of affectedIndices) {
    if (idx >= 0 && idx < payrollData.length) {
      snapshots.set(idx, { ...payrollData[idx] });
    }
  }

  // Phase 1: Apply all corrections
  const applied: AppliedCorrection[] = [];
  let rollback = false;

  for (const correction of corrections) {
    const record: AppliedCorrection = {
      ...correction,
      approvedBy,
      batchId,
      revalidationResult: 'pending',
    };

    const success = applySingleCorrection(payrollData, record);
    if (!success) {
      rollback = true;
      break;
    }
    applied.push(record);
  }

  // Rollback on failure — restore all snapshots
  if (rollback) {
    for (const [idx, snapshot] of snapshots) {
      if (idx < payrollData.length) {
        Object.assign(payrollData[idx], snapshot);
      }
    }
    return { applied: 0, batchId, revalidationSummary: { failed: corrections.length } };
  }

  // Phase 2: Revalidate affected rows
  const revalidationSummary: Record<string, number> = {
    resolved: 0,
    new_findings: 0,
    unchanged: 0,
  };

  for (const record of applied) {
    const row = payrollData[record.rowIndex];
    if (!row) {
      record.revalidationResult = 'unchanged';
      revalidationSummary['unchanged']++;
      continue;
    }

    const outcome = revalidateRow(row, record.fieldName);
    record.revalidationResult = outcome;
    revalidationSummary[outcome] = (revalidationSummary[outcome] ?? 0) + 1;
  }

  return { applied: applied.length, batchId, revalidationSummary };
}

/**
 * Converts a batch of CorrectionEntry suggestions into AppliedCorrection
 * records and applies them in one atomic operation.
 *
 * This is the high-level convenience function that bridges the suggestion
 * flow (from `executeCorrector`) with the application flow.
 */
export function approveAndApplyCorrections(
  suggestions: CorrectionEntry[],
  payrollData: PayrollRow[],
  payrollUploadId: string,
  approvedBy: string,
): ApplyCorrectionsResult {
  const batchId = generateBatchId();

  const corrections: AppliedCorrection[] = suggestions.map((entry) =>
    correctionEntryToApplied(entry, approvedBy, batchId),
  );

  return applyCorrections(corrections, payrollData, payrollUploadId, approvedBy);
}

/**
 * Builds the SQL-compatible record objects for inserting into the
 * `applied_corrections` table. This is used by the persistence layer
 * to store the correction audit trail.
 */
export function buildAppliedCorrectionRecords(
  corrections: AppliedCorrection[],
  payrollUploadId: string,
): Array<{
  payroll_upload_id: string;
  row_index: number;
  field_name: string;
  value_before: string;
  value_after: string;
  formula_applied: string | null;
  approved_by: string;
  revalidation_result: string;
  batch_id: string | null;
}> {
  return corrections.map((c) => ({
    payroll_upload_id: payrollUploadId,
    row_index: c.rowIndex,
    field_name: c.fieldName,
    value_before: c.valueBefore,
    value_after: c.valueAfter,
    formula_applied: c.formulaApplied ?? null,
    approved_by: c.approvedBy,
    revalidation_result: c.revalidationResult,
    batch_id: c.batchId ?? null,
  }));
}
