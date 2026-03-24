import type { CrossValidationResult } from './agent-bus';
import type { AuditFinding, AuditReport } from './auditor';
import type { CorrectionEntry, CorrectionReport } from './corrector';
import type { WriterReport } from './writer';

// ── Types ───────────────────────────────────────────────────────────

/** Input for validating corrector corrections against auditor rules (Req 9.1) */
export interface CorrectionValidationInput {
  corrections: CorrectionEntry[];
  auditFindings: AuditFinding[];
}

/** Input for validating numeric data in writer reports (Req 9.2) */
export interface ReportDataValidationInput {
  report: WriterReport;
  auditReport: AuditReport;
}

/** A warning generated when cross-validation detects inconsistencies (Req 9.3) */
export interface CrossValidationWarning {
  type: 'correction-mismatch' | 'report-data-mismatch';
  message: string;
  details: string[];
}

// ── Correction validation (Req 9.1) ────────────────────────────────

/**
 * Validates corrections proposed by the corrector agent against the
 * original auditor findings.
 *
 * Checks:
 * - Each correction references a valid row/field from the audit findings
 * - The suggested value differs from the reported (incorrect) value
 * - The suggested value moves toward the expected value from the finding
 *
 * @returns CrossValidationResult indicating consistency and any discrepancies.
 */
export function validateCorrections(
  input: CorrectionValidationInput,
): CrossValidationResult {
  const { corrections, auditFindings } = input;
  const discrepancies: string[] = [];

  for (const correction of corrections) {
    // Find matching audit finding for this correction
    const matchingFinding = findMatchingFinding(
      auditFindings,
      correction.rowIndex,
      correction.fieldName,
    );

    if (!matchingFinding) {
      discrepancies.push(
        `Corrección en fila ${correction.rowIndex}, campo "${correction.fieldName}": ` +
        `no se encontró hallazgo de auditoría correspondiente`,
      );
      continue;
    }

    // Check that the correction moves toward the expected value
    if (matchingFinding.expectedValue !== 0) {
      const distanceBefore = Math.abs(correction.currentValue - matchingFinding.expectedValue);
      const distanceAfter = Math.abs(correction.suggestedValue - matchingFinding.expectedValue);

      if (distanceAfter > distanceBefore) {
        discrepancies.push(
          `Corrección en fila ${correction.rowIndex}, campo "${correction.fieldName}": ` +
          `el valor sugerido (${correction.suggestedValue}) se aleja del valor esperado ` +
          `(${matchingFinding.expectedValue}) en lugar de acercarse`,
        );
      }
    }

    // Check that suggested value actually differs from current
    if (correction.suggestedValue === correction.currentValue) {
      discrepancies.push(
        `Corrección en fila ${correction.rowIndex}, campo "${correction.fieldName}": ` +
        `el valor sugerido es igual al valor actual (${correction.currentValue})`,
      );
    }
  }

  return {
    isConsistent: discrepancies.length === 0,
    discrepancies: discrepancies.length > 0 ? discrepancies : undefined,
  };
}

// ── Report data validation (Req 9.2) ───────────────────────────────

/**
 * Validates that numeric data cited in the writer's report matches
 * the original auditor findings.
 *
 * Checks:
 * - Total findings count matches
 * - Severity distribution matches
 * - Category counts match
 * - Risk level is consistent with severity distribution
 *
 * @returns CrossValidationResult indicating consistency and any discrepancies.
 */
export function validateReportData(
  input: ReportDataValidationInput,
): CrossValidationResult {
  const { report, auditReport } = input;
  const discrepancies: string[] = [];

  const auditSummary = auditReport.summary;

  // Check total findings count in report categories
  const reportTotalFindings = report.findingsByCategory.reduce(
    (sum, group) => sum + group.findings.length,
    0,
  );

  if (reportTotalFindings !== auditSummary.totalFindings) {
    discrepancies.push(
      `Total de hallazgos en reporte (${reportTotalFindings}) no coincide ` +
      `con hallazgos del auditor (${auditSummary.totalFindings})`,
    );
  }

  // Check severity distribution
  const reportBySeverity = { alta: 0, media: 0, baja: 0 };
  for (const group of report.findingsByCategory) {
    for (const finding of group.findings) {
      if (finding.severity in reportBySeverity) {
        reportBySeverity[finding.severity]++;
      }
    }
  }

  for (const severity of ['alta', 'media', 'baja'] as const) {
    if (reportBySeverity[severity] !== auditSummary.bySeverity[severity]) {
      discrepancies.push(
        `Hallazgos de severidad "${severity}" en reporte (${reportBySeverity[severity]}) ` +
        `no coincide con auditor (${auditSummary.bySeverity[severity]})`,
      );
    }
  }

  // Check risk level consistency
  const expectedRiskLevel =
    auditSummary.bySeverity.alta > 0
      ? 'alto'
      : auditSummary.bySeverity.media > 0
        ? 'medio'
        : 'bajo';

  if (report.riskLevel !== expectedRiskLevel) {
    discrepancies.push(
      `Nivel de riesgo en reporte ("${report.riskLevel}") no es consistente ` +
      `con la distribución de severidades (esperado: "${expectedRiskLevel}")`,
    );
  }

  return {
    isConsistent: discrepancies.length === 0,
    discrepancies: discrepancies.length > 0 ? discrepancies : undefined,
  };
}

// ── Warning generation (Req 9.3) ───────────────────────────────────

/**
 * Generates a visible warning message from a cross-validation result
 * when inconsistencies are detected.
 *
 * @returns A CrossValidationWarning if inconsistent, or null if consistent.
 */
export function generateWarning(
  result: CrossValidationResult,
  type: 'correction-mismatch' | 'report-data-mismatch',
): CrossValidationWarning | null {
  if (result.isConsistent) {
    return null;
  }

  const details = result.discrepancies ?? [];

  const messagePrefix =
    type === 'correction-mismatch'
      ? '⚠️ Validación cruzada: se detectaron inconsistencias en las correcciones propuestas'
      : '⚠️ Validación cruzada: se detectaron inconsistencias en los datos del reporte';

  return {
    type,
    message: `${messagePrefix}. ${details.length} discrepancia(s) encontrada(s).`,
    details,
  };
}

/**
 * Runs the full cross-validation pipeline for corrector output.
 * Validates corrections against audit findings and generates warnings if needed.
 *
 * @returns Object with the validation result and optional warning.
 */
export function crossValidateCorrections(
  correctionReport: CorrectionReport,
  auditReport: AuditReport,
): { result: CrossValidationResult; warning: CrossValidationWarning | null } {
  const result = validateCorrections({
    corrections: correctionReport.corrections,
    auditFindings: auditReport.findings,
  });

  const warning = generateWarning(result, 'correction-mismatch');

  return { result, warning };
}

/**
 * Runs the full cross-validation pipeline for writer output.
 * Validates report data against audit findings and generates warnings if needed.
 *
 * @returns Object with the validation result and optional warning.
 */
export function crossValidateReport(
  writerReport: WriterReport,
  auditReport: AuditReport,
): { result: CrossValidationResult; warning: CrossValidationWarning | null } {
  const result = validateReportData({
    report: writerReport,
    auditReport,
  });

  const warning = generateWarning(result, 'report-data-mismatch');

  return { result, warning };
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Finds an audit finding that matches a correction's row index and field name.
 * Uses heuristics to match the finding's document identifier to the row index
 * and the finding's description/category to the field name.
 */
function findMatchingFinding(
  findings: AuditFinding[],
  rowIndex: number,
  fieldName: string,
): AuditFinding | undefined {
  const fieldToKeywords: Record<string, string[]> = {
    health_employee_deduction: ['salud', 'health'],
    pension_employee_deduction: ['pensión', 'pension'],
    cesantias_provision: ['cesant'],
    prima_provision: ['prima'],
    vacation_provision: ['vacacion'],
    salud_empleador: ['salud empleador', 'salud_empleador'],
    pension_empleador: ['pensión empleador', 'pension_empleador', 'pension empleador'],
    parafiscales_total: ['parafiscal'],
  };

  const keywords = fieldToKeywords[fieldName] ?? [fieldName];

  return findings.find((finding) => {
    // Match row: check if the document references this row index
    const docMatchesRow = matchesRowIndex(finding.document, rowIndex);

    // Match field: check if the finding description contains relevant keywords
    const descLower = finding.description.toLowerCase();
    const fieldMatches = keywords.some((kw) => descLower.includes(kw.toLowerCase()));

    return docMatchesRow && fieldMatches;
  });
}

/**
 * Checks if a finding's document identifier references a given row index.
 */
function matchesRowIndex(document: string, rowIndex: number): boolean {
  if (!document) return false;

  // Match "fila_N" pattern (1-indexed)
  const filaMatch = document.match(/^fila_(\d+)$/);
  if (filaMatch) {
    return parseInt(filaMatch[1], 10) - 1 === rowIndex;
  }

  // If document is a number, treat it as a document identifier — not a row index
  // In this case, we can't match by row, so we allow the match (field match is enough)
  return true;
}
