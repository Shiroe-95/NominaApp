import { describe, it, expect } from 'vitest';
import type { AuditFinding, AuditReport, AuditSummary } from './auditor';
import type { CorrectionEntry, CorrectionReport } from './corrector';
import type { WriterReport, GroupedFinding } from './writer';
import {
  validateCorrections,
  validateReportData,
  generateWarning,
  crossValidateCorrections,
  crossValidateReport,
  type CorrectionValidationInput,
  type ReportDataValidationInput,
} from './cross-validator';

// ── Helpers ─────────────────────────────────────────────────────────

function makeFinding(overrides?: Partial<AuditFinding>): AuditFinding {
  return {
    document: 'fila_1',
    description: 'Descuento salud empleado incorrecto',
    severity: 'alta',
    norm: 'Aporte salud empleado 4%',
    expectedValue: 80000,
    reportedValue: 60000,
    category: 'Seguridad Social',
    ...overrides,
  };
}

function makeCorrection(overrides?: Partial<CorrectionEntry>): CorrectionEntry {
  return {
    rowIndex: 0,
    fieldName: 'health_employee_deduction',
    currentValue: 60000,
    suggestedValue: 80000,
    justification: 'Salud = IBC × 4%',
    ...overrides,
  };
}

function makeSummary(overrides?: Partial<AuditSummary>): AuditSummary {
  return {
    totalFindings: 3,
    bySeverity: { alta: 1, media: 1, baja: 1 },
    byCategory: {
      IBC: 0,
      Prestaciones: 1,
      'Seguridad Social': 1,
      Parafiscales: 0,
      Impuestos: 0,
      Datos: 1,
    },
    ...overrides,
  };
}

function makeAuditReport(overrides?: Partial<AuditReport>): AuditReport {
  const findings = overrides?.findings ?? [
    makeFinding({ severity: 'alta', category: 'Seguridad Social' }),
    makeFinding({ severity: 'media', category: 'Prestaciones', document: 'fila_2', description: 'Prima provision incorrecta' }),
    makeFinding({ severity: 'baja', category: 'Datos', document: 'fila_3', description: 'Dato faltante' }),
  ];
  return {
    findings,
    summary: overrides?.summary ?? makeSummary(),
    validationReport: overrides?.validationReport ?? {
      countryCode: 'CO',
      year: 2024,
      rowsAnalyzed: 10,
      rowsWithFindings: 3,
      criticalFindings: 1,
      checks: [],
      coverage: { totalHeaders: 10, mappedHeaders: 10, unmappedHeaders: [], createdFieldsMapped: [] },
    },
    ...overrides,
  };
}

function makeWriterReport(auditReport: AuditReport): WriterReport {
  const findingsByCategory: GroupedFinding[] = [];
  const categoryMap = new Map<string, AuditFinding[]>();

  for (const f of auditReport.findings) {
    const list = categoryMap.get(f.category) ?? [];
    list.push(f);
    categoryMap.set(f.category, list);
  }

  for (const [category, findings] of categoryMap) {
    findingsByCategory.push({
      category: category as AuditFinding['category'],
      findings,
    });
  }

  const riskLevel =
    auditReport.summary.bySeverity.alta > 0
      ? 'alto'
      : auditReport.summary.bySeverity.media > 0
        ? 'medio'
        : 'bajo';

  return {
    executiveSummary: 'Resumen ejecutivo de prueba',
    riskLevel: riskLevel as WriterReport['riskLevel'],
    findingsByCategory,
    recommendations: ['Revisar hallazgos'],
    normativeReferences: ['Norma test'],
  };
}

// ── validateCorrections (Req 9.1) ───────────────────────────────────

describe('validateCorrections', () => {
  it('returns consistent when corrections match audit findings', () => {
    const findings = [makeFinding()];
    const corrections = [makeCorrection()];

    const result = validateCorrections({ corrections, auditFindings: findings });

    expect(result.isConsistent).toBe(true);
    expect(result.discrepancies).toBeUndefined();
  });

  it('detects when correction moves away from expected value', () => {
    const findings = [makeFinding({ expectedValue: 80000 })];
    const corrections = [
      makeCorrection({ currentValue: 60000, suggestedValue: 40000 }),
    ];

    const result = validateCorrections({ corrections, auditFindings: findings });

    expect(result.isConsistent).toBe(false);
    expect(result.discrepancies).toHaveLength(1);
    expect(result.discrepancies![0]).toContain('se aleja del valor esperado');
  });

  it('detects when suggested value equals current value', () => {
    const findings = [makeFinding()];
    const corrections = [
      makeCorrection({ currentValue: 60000, suggestedValue: 60000 }),
    ];

    const result = validateCorrections({ corrections, auditFindings: findings });

    expect(result.isConsistent).toBe(false);
    expect(result.discrepancies!.some((d) => d.includes('igual al valor actual'))).toBe(true);
  });

  it('detects when no matching finding exists for a correction', () => {
    const findings = [makeFinding({ document: 'fila_5' })];
    const corrections = [makeCorrection({ rowIndex: 0 })]; // fila_1

    const result = validateCorrections({ corrections, auditFindings: findings });

    expect(result.isConsistent).toBe(false);
    expect(result.discrepancies!.some((d) => d.includes('no se encontró hallazgo'))).toBe(true);
  });

  it('handles empty corrections list as consistent', () => {
    const result = validateCorrections({ corrections: [], auditFindings: [makeFinding()] });

    expect(result.isConsistent).toBe(true);
  });

  it('handles multiple corrections with mixed results', () => {
    const findings = [
      makeFinding({ document: 'fila_1', expectedValue: 80000 }),
      makeFinding({ document: 'fila_2', description: 'Pensión empleado incorrecta', expectedValue: 100000 }),
    ];
    const corrections = [
      makeCorrection({ rowIndex: 0, suggestedValue: 80000 }), // good
      makeCorrection({
        rowIndex: 1,
        fieldName: 'pension_employee_deduction',
        currentValue: 90000,
        suggestedValue: 50000, // moves away from 100000
      }),
    ];

    const result = validateCorrections({ corrections, auditFindings: findings });

    expect(result.isConsistent).toBe(false);
    expect(result.discrepancies!.length).toBeGreaterThanOrEqual(1);
  });
});

// ── validateReportData (Req 9.2) ────────────────────────────────────

describe('validateReportData', () => {
  it('returns consistent when report matches audit data', () => {
    const auditReport = makeAuditReport();
    const writerReport = makeWriterReport(auditReport);

    const result = validateReportData({ report: writerReport, auditReport });

    expect(result.isConsistent).toBe(true);
    expect(result.discrepancies).toBeUndefined();
  });

  it('detects total findings mismatch', () => {
    const auditReport = makeAuditReport();
    // Create a writer report with fewer findings
    const writerReport = makeWriterReport(auditReport);
    writerReport.findingsByCategory = writerReport.findingsByCategory.slice(0, 1);

    const result = validateReportData({ report: writerReport, auditReport });

    expect(result.isConsistent).toBe(false);
    expect(result.discrepancies!.some((d) => d.includes('Total de hallazgos'))).toBe(true);
  });

  it('detects severity distribution mismatch', () => {
    const auditReport = makeAuditReport();
    const writerReport = makeWriterReport(auditReport);
    // Tamper with a finding's severity in the report
    if (writerReport.findingsByCategory[0]?.findings[0]) {
      writerReport.findingsByCategory[0].findings[0] = {
        ...writerReport.findingsByCategory[0].findings[0],
        severity: 'baja',
      };
    }

    const result = validateReportData({ report: writerReport, auditReport });

    expect(result.isConsistent).toBe(false);
  });

  it('detects risk level inconsistency', () => {
    const auditReport = makeAuditReport();
    const writerReport = makeWriterReport(auditReport);
    writerReport.riskLevel = 'bajo'; // Should be 'alto' since there are alta findings

    const result = validateReportData({ report: writerReport, auditReport });

    expect(result.isConsistent).toBe(false);
    expect(result.discrepancies!.some((d) => d.includes('Nivel de riesgo'))).toBe(true);
  });

  it('handles empty findings as consistent', () => {
    const auditReport = makeAuditReport({
      findings: [],
      summary: makeSummary({
        totalFindings: 0,
        bySeverity: { alta: 0, media: 0, baja: 0 },
        byCategory: { IBC: 0, Prestaciones: 0, 'Seguridad Social': 0, Parafiscales: 0, Impuestos: 0, Datos: 0 },
      }),
    });
    const writerReport: WriterReport = {
      executiveSummary: 'Sin hallazgos',
      riskLevel: 'bajo',
      findingsByCategory: [],
      recommendations: [],
      normativeReferences: [],
    };

    const result = validateReportData({ report: writerReport, auditReport });

    expect(result.isConsistent).toBe(true);
  });
});

// ── generateWarning (Req 9.3) ───────────────────────────────────────

describe('generateWarning', () => {
  it('returns null when result is consistent', () => {
    const warning = generateWarning({ isConsistent: true }, 'correction-mismatch');
    expect(warning).toBeNull();
  });

  it('generates correction-mismatch warning with details', () => {
    const warning = generateWarning(
      { isConsistent: false, discrepancies: ['Error A', 'Error B'] },
      'correction-mismatch',
    );

    expect(warning).not.toBeNull();
    expect(warning!.type).toBe('correction-mismatch');
    expect(warning!.message).toContain('correcciones propuestas');
    expect(warning!.message).toContain('2 discrepancia(s)');
    expect(warning!.details).toEqual(['Error A', 'Error B']);
  });

  it('generates report-data-mismatch warning with details', () => {
    const warning = generateWarning(
      { isConsistent: false, discrepancies: ['Mismatch X'] },
      'report-data-mismatch',
    );

    expect(warning).not.toBeNull();
    expect(warning!.type).toBe('report-data-mismatch');
    expect(warning!.message).toContain('datos del reporte');
    expect(warning!.details).toEqual(['Mismatch X']);
  });

  it('handles empty discrepancies array', () => {
    const warning = generateWarning(
      { isConsistent: false, discrepancies: [] },
      'correction-mismatch',
    );

    expect(warning).not.toBeNull();
    expect(warning!.details).toEqual([]);
    expect(warning!.message).toContain('0 discrepancia(s)');
  });
});

// ── crossValidateCorrections (pipeline) ─────────────────────────────

describe('crossValidateCorrections', () => {
  it('returns consistent result and no warning for valid corrections', () => {
    const auditReport = makeAuditReport({
      findings: [makeFinding()],
      summary: makeSummary({ totalFindings: 1, bySeverity: { alta: 1, media: 0, baja: 0 } }),
    });
    const correctionReport: CorrectionReport = {
      corrections: [makeCorrection()],
      skipped: 0,
    };

    const { result, warning } = crossValidateCorrections(correctionReport, auditReport);

    expect(result.isConsistent).toBe(true);
    expect(warning).toBeNull();
  });

  it('returns inconsistent result and warning for bad corrections', () => {
    const auditReport = makeAuditReport({
      findings: [makeFinding({ expectedValue: 80000 })],
      summary: makeSummary({ totalFindings: 1, bySeverity: { alta: 1, media: 0, baja: 0 } }),
    });
    const correctionReport: CorrectionReport = {
      corrections: [makeCorrection({ suggestedValue: 30000, currentValue: 60000 })],
      skipped: 0,
    };

    const { result, warning } = crossValidateCorrections(correctionReport, auditReport);

    expect(result.isConsistent).toBe(false);
    expect(warning).not.toBeNull();
    expect(warning!.type).toBe('correction-mismatch');
  });
});

// ── crossValidateReport (pipeline) ──────────────────────────────────

describe('crossValidateReport', () => {
  it('returns consistent result and no warning for matching report', () => {
    const auditReport = makeAuditReport();
    const writerReport = makeWriterReport(auditReport);

    const { result, warning } = crossValidateReport(writerReport, auditReport);

    expect(result.isConsistent).toBe(true);
    expect(warning).toBeNull();
  });

  it('returns inconsistent result and warning for mismatched report', () => {
    const auditReport = makeAuditReport();
    const writerReport = makeWriterReport(auditReport);
    writerReport.riskLevel = 'bajo'; // wrong

    const { result, warning } = crossValidateReport(writerReport, auditReport);

    expect(result.isConsistent).toBe(false);
    expect(warning).not.toBeNull();
    expect(warning!.type).toBe('report-data-mismatch');
  });
});
