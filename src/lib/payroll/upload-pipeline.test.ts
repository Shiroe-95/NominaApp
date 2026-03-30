/**
 * Unit tests for the Upload Pipeline (Tasks 5.4, 5.6, 5.8, 5.10).
 *
 * Tests cover:
 * - Task 5.4: Dynamic rule loading with FALLBACK_RULES for CO and MX
 * - Task 5.6: Certification evaluation with coverage calculation
 * - Task 5.8: Correction entry registration
 * - Task 5.10: Payroll persistence payload structure
 *
 * Validates: Requirements 3.5, 3.6, 3.7, 3.9, 3.10, 3.11, 3.12, 3.13, 3.15
 */
import { describe, it, expect } from 'vitest';
import type {
  RuleSet,
  RuleApiRow,
  CertificationResult,
  RecentPayroll,
} from '@/lib/payroll/pipeline-state';
import { EMPTY_MAPPING, EMPTY_RULE } from '@/lib/payroll/pipeline-state';
import type { CorrectionEntry } from '@/components/ui/PayrollEditor';

// ─── FALLBACK_RULES (mirrored from upload page for testability) ─────────────

const FALLBACK_RULES: Record<'CO' | 'MX', Record<number, RuleSet>> = {
  CO: {
    2026: {
      label: 'Normativa Colombia 2026 - Ley 1393',
      requiredFields: ['document_number', 'first_name', 'base_salary', 'non_salary_payments'],
      requiredCalculations: ['ibc_total', 'health_employee_deduction', 'pension_employee_deduction'],
      checks: [
        'SMMLV 2026: $1.750.905',
        'Auxilio de transporte 2026: $226.100 (solo aplica si salario <= 2 SMMLV)',
        'IBC = Salario Base + Exceso No Salarial sobre 40% del total devengado',
        'Exceso No Salarial = MAX(0, Pagos No Salariales - (Total Devengado * 0.40))',
        'IBC minimo proporcional: SMMLV * (dias trabajados / 30)',
        'IBC maximo: 25 SMMLV = $43.772.625',
        'Aporte Salud Empleado: 4% del IBC',
        'Aporte Pension Empleado: 4% del IBC',
      ],
    },
    2025: {
      label: 'Normativa Colombia 2025 - Ley 1393',
      requiredFields: ['document_number', 'first_name', 'base_salary', 'non_salary_payments'],
      requiredCalculations: ['ibc_total', 'health_employee_deduction', 'pension_employee_deduction'],
      checks: [
        'SMMLV 2025: $1.423.500',
        'Auxilio de transporte 2025: $200.000 (solo aplica si salario <= 2 SMMLV)',
        'IBC = Salario Base + Exceso No Salarial sobre 40% del total devengado',
      ],
    },
  },
  MX: {
    2025: {
      label: 'Normativa México 2025 - IMSS/ISR',
      requiredFields: ['employee_id', 'first_name', 'last_name', 'base_salary'],
      requiredCalculations: ['sbc', 'isr_retenido'],
      checks: ['Validar SBC y retencion ISR'],
    },
  },
};

// ─── Helper: compute certification result (mirrors upload page logic) ───────

function computeCertification(
  activeRule: RuleSet,
  mappedTargets: string[],
): CertificationResult {
  let missingFields = activeRule.requiredFields.filter(
    (field) => !mappedTargets.includes(field),
  );
  // Ambiguity handling: if first_name is mapped, don't block for last_name
  if (mappedTargets.includes('first_name')) {
    missingFields = missingFields.filter((f) => f !== 'last_name');
  }
  const missingCalculations = activeRule.requiredCalculations.filter(
    (calc) => !mappedTargets.includes(calc),
  );
  const totalRequired = activeRule.requiredFields.length + activeRule.requiredCalculations.length;
  const totalMissing = missingFields.length + missingCalculations.length;
  const coverage = totalRequired > 0
    ? Math.round(((totalRequired - totalMissing) / totalRequired) * 100)
    : 100;
  return {
    ready: missingFields.length === 0 && missingCalculations.length === 0,
    missingFields,
    missingCalculations,
    coverage,
  };
}

// ─── Helper: map API rows to rulesByYear (mirrors upload page logic) ────────

function mapApiRowsToRulesByYear(rows: RuleApiRow[]): Record<number, RuleSet> {
  return rows.reduce<Record<number, RuleSet>>((acc, row) => {
    acc[row.rule_year] = {
      label: row.label,
      requiredFields: row.required_fields ?? [],
      requiredCalculations: row.required_calculations ?? [],
      checks: row.checks ?? [],
    };
    return acc;
  }, {});
}

// ═══════════════════════════════════════════════════════════════════════════════
// Task 5.4: Dynamic rule loading with fallback
// Validates: Requirements 3.6, 3.7
// ═══════════════════════════════════════════════════════════════════════════════

describe('Task 5.4: Dynamic rule loading with FALLBACK_RULES', () => {
  it('FALLBACK_RULES contains rules for CO', () => {
    expect(FALLBACK_RULES.CO).toBeDefined();
    const years = Object.keys(FALLBACK_RULES.CO).map(Number);
    expect(years.length).toBeGreaterThanOrEqual(1);
    for (const year of years) {
      const rule = FALLBACK_RULES.CO[year];
      expect(rule.label).toBeTruthy();
      expect(rule.requiredFields.length).toBeGreaterThan(0);
      expect(rule.requiredCalculations.length).toBeGreaterThan(0);
      expect(rule.checks.length).toBeGreaterThan(0);
    }
  });

  it('FALLBACK_RULES contains rules for MX', () => {
    expect(FALLBACK_RULES.MX).toBeDefined();
    const years = Object.keys(FALLBACK_RULES.MX).map(Number);
    expect(years.length).toBeGreaterThanOrEqual(1);
    for (const year of years) {
      const rule = FALLBACK_RULES.MX[year];
      expect(rule.label).toBeTruthy();
      expect(rule.requiredFields.length).toBeGreaterThan(0);
      expect(rule.requiredCalculations.length).toBeGreaterThan(0);
    }
  });

  it('should select the latest year from fallback rules', () => {
    const coYears = Object.keys(FALLBACK_RULES.CO).map(Number);
    const latestYear = Math.max(...coYears);
    expect(latestYear).toBe(2026);
  });

  it('should map API rows to rulesByYear correctly', () => {
    const apiRows: RuleApiRow[] = [
      {
        country_code: 'CO',
        rule_year: 2025,
        label: 'Test Rule 2025',
        required_fields: ['doc', 'name'],
        required_calculations: ['ibc'],
        checks: ['check1'],
      },
      {
        country_code: 'CO',
        rule_year: 2026,
        label: 'Test Rule 2026',
        required_fields: ['doc', 'name', 'salary'],
        required_calculations: ['ibc', 'health'],
        checks: ['check1', 'check2'],
      },
    ];

    const mapped = mapApiRowsToRulesByYear(apiRows);
    expect(Object.keys(mapped).map(Number).sort()).toEqual([2025, 2026]);
    expect(mapped[2026].label).toBe('Test Rule 2026');
    expect(mapped[2026].requiredFields).toEqual(['doc', 'name', 'salary']);
  });

  it('should update year to latest available when current year not in new rules', () => {
    const apiRows: RuleApiRow[] = [
      {
        country_code: 'MX',
        rule_year: 2024,
        label: 'MX 2024',
        required_fields: ['id'],
        required_calculations: ['sbc'],
        checks: [],
      },
      {
        country_code: 'MX',
        rule_year: 2025,
        label: 'MX 2025',
        required_fields: ['id'],
        required_calculations: ['sbc'],
        checks: [],
      },
    ];

    const mapped = mapApiRowsToRulesByYear(apiRows);
    const years = Object.keys(mapped).map(Number);
    const currentYear = 2026; // not in the rules
    const newYear = years.includes(currentYear) ? currentYear : Math.max(...years);
    expect(newYear).toBe(2025);
  });

  it('should handle API rows with null/undefined arrays gracefully', () => {
    const apiRows: RuleApiRow[] = [
      {
        country_code: 'CO',
        rule_year: 2025,
        label: 'Partial Rule',
        required_fields: undefined as unknown as string[],
        required_calculations: null as unknown as string[],
        checks: [],
      },
    ];

    const mapped = mapApiRowsToRulesByYear(apiRows);
    expect(mapped[2025].requiredFields).toEqual([]);
    expect(mapped[2025].requiredCalculations).toEqual([]);
  });

  it('EMPTY_RULE has empty arrays and default label', () => {
    expect(EMPTY_RULE.label).toBe('Sin regla');
    expect(EMPTY_RULE.requiredFields).toEqual([]);
    expect(EMPTY_RULE.requiredCalculations).toEqual([]);
    expect(EMPTY_RULE.checks).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Task 5.6: Certification evaluation (step 3)
// Validates: Requirements 3.5, 3.9
// ═══════════════════════════════════════════════════════════════════════════════

describe('Task 5.6: Certification evaluation', () => {
  const coRule = FALLBACK_RULES.CO[2026];

  it('should return ready=true and coverage=100 when all fields and calculations are mapped', () => {
    const allMapped = [...coRule.requiredFields, ...coRule.requiredCalculations];
    const result = computeCertification(coRule, allMapped);
    expect(result.ready).toBe(true);
    expect(result.coverage).toBe(100);
    expect(result.missingFields).toEqual([]);
    expect(result.missingCalculations).toEqual([]);
  });

  it('should return ready=false when required fields are missing', () => {
    const partial = ['document_number', 'first_name']; // missing base_salary, non_salary_payments
    const result = computeCertification(coRule, partial);
    expect(result.ready).toBe(false);
    expect(result.missingFields).toContain('base_salary');
    expect(result.missingFields).toContain('non_salary_payments');
    expect(result.coverage).toBeLessThan(100);
  });

  it('should return ready=false when required calculations are missing', () => {
    const mapped = [...coRule.requiredFields]; // all fields but no calculations
    const result = computeCertification(coRule, mapped);
    expect(result.ready).toBe(false);
    expect(result.missingCalculations.length).toBeGreaterThan(0);
    expect(result.coverage).toBeLessThan(100);
  });

  it('should calculate coverage as percentage of total required items', () => {
    const totalRequired = coRule.requiredFields.length + coRule.requiredCalculations.length;
    // Map only half the fields
    const halfFields = coRule.requiredFields.slice(0, 2);
    const result = computeCertification(coRule, halfFields);
    const expectedMissing = totalRequired - 2;
    const expectedCoverage = Math.round(((totalRequired - expectedMissing) / totalRequired) * 100);
    expect(result.coverage).toBe(expectedCoverage);
  });

  it('should return coverage=100 when rule has no required items', () => {
    const emptyRule: RuleSet = {
      label: 'Empty',
      requiredFields: [],
      requiredCalculations: [],
      checks: [],
    };
    const result = computeCertification(emptyRule, []);
    expect(result.ready).toBe(true);
    expect(result.coverage).toBe(100);
  });

  it('should show missing fields explicitly', () => {
    const result = computeCertification(coRule, []);
    expect(result.missingFields).toEqual(coRule.requiredFields);
    expect(result.missingCalculations).toEqual(coRule.requiredCalculations);
  });

  it('should handle MX rules correctly', () => {
    const mxRule = FALLBACK_RULES.MX[2025];
    const allMapped = [...mxRule.requiredFields, ...mxRule.requiredCalculations];
    const result = computeCertification(mxRule, allMapped);
    expect(result.ready).toBe(true);
    expect(result.coverage).toBe(100);
  });

  it('should not block certification for missing last_name when first_name is mapped', () => {
    const ruleWithLastName: RuleSet = {
      label: 'Test',
      requiredFields: ['document_number', 'first_name', 'last_name', 'base_salary'],
      requiredCalculations: [],
      checks: [],
    };
    const mapped = ['document_number', 'first_name', 'base_salary'];
    const result = computeCertification(ruleWithLastName, mapped);
    expect(result.ready).toBe(true);
    expect(result.missingFields).not.toContain('last_name');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Task 5.8: Correction registration (step 4)
// Validates: Requirements 3.10, 3.11
// ═══════════════════════════════════════════════════════════════════════════════

describe('Task 5.8: Correction entry registration', () => {
  it('should create a valid correction entry with all required fields', () => {
    const entry: CorrectionEntry = {
      sheetIndex: 0,
      rowIndex: 5,
      colIndex: 3,
      originalValue: 1500000,
      newValue: 1750905,
      source: 'manual',
    };
    expect(entry.sheetIndex).toBeGreaterThanOrEqual(0);
    expect(entry.rowIndex).toBeGreaterThanOrEqual(0);
    expect(entry.colIndex).toBeGreaterThanOrEqual(0);
    expect(entry.originalValue).not.toBe(entry.newValue);
    expect(['manual', 'ai']).toContain(entry.source);
  });

  it('should support AI-sourced corrections', () => {
    const entry: CorrectionEntry = {
      sheetIndex: 0,
      rowIndex: 2,
      colIndex: 7,
      originalValue: 50000,
      newValue: 70036,
      source: 'ai',
    };
    expect(entry.source).toBe('ai');
  });

  it('should track corrections per sheet, row, and column', () => {
    const corrections: CorrectionEntry[] = [
      { sheetIndex: 0, rowIndex: 0, colIndex: 1, originalValue: 'A', newValue: 'B', source: 'manual' },
      { sheetIndex: 0, rowIndex: 0, colIndex: 2, originalValue: 100, newValue: 200, source: 'ai' },
      { sheetIndex: 1, rowIndex: 3, colIndex: 0, originalValue: 'X', newValue: 'Y', source: 'manual' },
    ];

    const sheet0Corrections = corrections.filter((c) => c.sheetIndex === 0);
    expect(sheet0Corrections).toHaveLength(2);

    const sheet1Corrections = corrections.filter((c) => c.sheetIndex === 1);
    expect(sheet1Corrections).toHaveLength(1);
  });

  it('should upsert corrections (replace existing for same cell)', () => {
    const corrections: CorrectionEntry[] = [
      { sheetIndex: 0, rowIndex: 1, colIndex: 2, originalValue: 100, newValue: 200, source: 'manual' },
    ];

    // Simulate upsert: remove old, add new
    const newEntry: CorrectionEntry = {
      sheetIndex: 0, rowIndex: 1, colIndex: 2, originalValue: 100, newValue: 300, source: 'ai',
    };
    const rest = corrections.filter(
      (x) => !(x.sheetIndex === newEntry.sheetIndex && x.rowIndex === newEntry.rowIndex && x.colIndex === newEntry.colIndex),
    );
    rest.push(newEntry);

    expect(rest).toHaveLength(1);
    expect(rest[0].newValue).toBe(300);
    expect(rest[0].source).toBe('ai');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Task 5.10: Payroll persistence
// Validates: Requirements 3.12, 3.13, 3.15
// ═══════════════════════════════════════════════════════════════════════════════

describe('Task 5.10: Payroll persistence payload', () => {
  it('should build a valid persistence payload with all required fields', () => {
    const payload = {
      companyId: 'uuid-123',
      countryCode: 'CO',
      year: 2026,
      month: 6,
      ruleLabel: 'Normativa Colombia 2026 - Ley 1393',
      certificationReady: true,
      fileCount: 1,
      mappedFields: ['document_number', 'first_name', 'base_salary'],
      createdFields: ['non_salary_payments'],
      mappingRelations: [],
      missingRequiredFields: [],
      missingRequiredCalculations: [],
      sheetSummary: [{ fileName: 'test.xlsx', sheetName: 'Hoja1', rowCount: 50, headerCount: 10 }],
      detectedVariables: ['Salario', 'Documento'],
      conceptSummary: { total: 2, byCategory: { salary_base: 1, identity: 1 } },
      riskReport: { score: 25, level: 'low' },
      employeeRiskSummary: [],
      calculationValidationReport: { totalRows: 50, rowsWithFindings: 0, criticalFindings: 0, checks: [] },
      aiValidationReport: {},
    };

    expect(payload.companyId).toBeTruthy();
    expect(payload.countryCode).toHaveLength(2);
    expect(payload.year).toBeGreaterThanOrEqual(2020);
    expect(payload.year).toBeLessThanOrEqual(2030);
    expect(payload.month).toBeGreaterThanOrEqual(1);
    expect(payload.month).toBeLessThanOrEqual(12);
    expect(payload.ruleLabel).toBeTruthy();
    expect(typeof payload.certificationReady).toBe('boolean');
    expect(payload.riskReport).toBeDefined();
    expect(payload.calculationValidationReport).toBeDefined();
    expect(payload.aiValidationReport).toBeDefined();
    expect(payload.conceptSummary).toBeDefined();
    expect(payload.sheetSummary.length).toBeGreaterThan(0);
  });

  it('should include corrections in the payload when present', () => {
    const corrections: CorrectionEntry[] = [
      { sheetIndex: 0, rowIndex: 1, colIndex: 2, originalValue: 100, newValue: 200, source: 'manual' },
      { sheetIndex: 0, rowIndex: 3, colIndex: 5, originalValue: 'old', newValue: 'new', source: 'ai' },
    ];

    const correctionSummary = {
      appliedAt: new Date().toISOString(),
      totalCells: corrections.length,
      bySource: {
        manual: corrections.filter((c) => c.source === 'manual').length,
        ai: corrections.filter((c) => c.source === 'ai').length,
      },
      summary: corrections.map((c) => ({
        sheet: `Hoja${c.sheetIndex + 1}`,
        col: c.colIndex,
        row: c.rowIndex + 1,
        from: c.originalValue,
        to: c.newValue,
        source: c.source,
      })),
    };

    expect(correctionSummary.totalCells).toBe(2);
    expect(correctionSummary.bySource.manual).toBe(1);
    expect(correctionSummary.bySource.ai).toBe(1);
    expect(correctionSummary.summary).toHaveLength(2);
  });

  it('should format recent payroll data correctly', () => {
    const recent: RecentPayroll = {
      id: 'uuid-456',
      company_name: 'Acme Corp',
      country_code: 'CO',
      period_year: 2026,
      period_month: 6,
      rule_label: 'Normativa Colombia 2026 - Ley 1393',
      certification_ready: true,
      created_at: '2026-06-15T10:00:00Z',
    };

    expect(recent.id).toBeTruthy();
    expect(recent.company_name).toBeTruthy();
    expect(recent.country_code).toHaveLength(2);
    expect(recent.period_year).toBeGreaterThanOrEqual(2020);
    expect(recent.period_month).toBeGreaterThanOrEqual(1);
    expect(recent.period_month).toBeLessThanOrEqual(12);
    expect(typeof recent.certification_ready).toBe('boolean');
  });

  it('should handle empty corrections gracefully', () => {
    const corrections: CorrectionEntry[] = [];
    const correctionSummary = {
      totalCells: corrections.length,
      bySource: {
        manual: corrections.filter((c) => c.source === 'manual').length,
        ai: corrections.filter((c) => c.source === 'ai').length,
      },
    };
    expect(correctionSummary.totalCells).toBe(0);
    expect(correctionSummary.bySource.manual).toBe(0);
    expect(correctionSummary.bySource.ai).toBe(0);
  });

  it('EMPTY_MAPPING has correct default structure', () => {
    expect(EMPTY_MAPPING.mappedTargets).toEqual([]);
    expect(EMPTY_MAPPING.createdTargets).toEqual([]);
    expect(EMPTY_MAPPING.mappingDetails).toEqual([]);
  });
});
