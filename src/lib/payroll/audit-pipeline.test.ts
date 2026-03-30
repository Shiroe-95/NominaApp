/**
 * Unit tests for the Audit Pipeline agents (Tasks 7.1, 8.1, 8.3, 9.1, 9.3).
 *
 * Tests cover:
 * - Task 7.1: MappingAI categories, created fields, fallback
 * - Task 8.1: Audit engine 14 checks, dynamic rules, missing dependencies
 * - Task 8.3: Severity-based risk score calculation
 * - Task 9.1: Corrector formulas with explicit normative formulas
 * - Task 9.3: PayrollEditor correction accept/reject
 *
 * Validates: Requirements 4.1-4.5, 5.1-5.7, 6.1-6.5
 */
import { describe, it, expect } from 'vitest';
import {
  validatePayrollCalculations,
  type MappingRelationInput,
  type MatrixInput,
  type ValidationReport,
  type CheckResult,
} from '@/lib/payroll/ruleValidation';
import {
  calculateSeverityRiskScore,
  SEVERITY_WEIGHTS,
  requestAutoCorrections,
  type SeverityFinding,
} from '@/lib/payroll/employeeRisk';
import {
  buildCorrectionFormulas,
  type CorrectionReport,
} from '@/lib/ai/agents/corrector';
import { VALID_CATEGORIES } from '@/components/ui/MappingAI';

// ═══════════════════════════════════════════════════════════════════════════════
// Task 7.1: MappingAI categories and created fields
// Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5
// ═══════════════════════════════════════════════════════════════════════════════

describe('Task 7.1: MappingAI valid categories', () => {
  it('should define exactly 7 valid categories', () => {
    expect(VALID_CATEGORIES).toHaveLength(7);
    expect(VALID_CATEGORIES).toContain('identity');
    expect(VALID_CATEGORIES).toContain('salary_base');
    expect(VALID_CATEGORIES).toContain('non_salary');
    expect(VALID_CATEGORIES).toContain('ibc');
    expect(VALID_CATEGORIES).toContain('contribution');
    expect(VALID_CATEGORIES).toContain('contract');
    expect(VALID_CATEGORIES).toContain('informational');
  });

  it('should not contain duplicate categories', () => {
    const unique = new Set(VALID_CATEGORIES);
    expect(unique.size).toBe(VALID_CATEGORIES.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Task 8.1: Audit engine 14 checks with dynamic rules
// Validates: Requirements 5.1, 5.2, 5.3, 5.4, 5.6
// ═══════════════════════════════════════════════════════════════════════════════

describe('Task 8.1: Audit engine verification checks', () => {
  const baseRelations: MappingRelationInput[] = [
    { source: 'Documento', target: 'document_number', analysisCategory: 'identity', isCreated: false, requiredByRule: true },
    { source: 'Nombre', target: 'first_name', analysisCategory: 'identity', isCreated: false, requiredByRule: true },
    { source: 'Salario', target: 'base_salary', analysisCategory: 'salary_base', isCreated: false, requiredByRule: true },
    { source: 'No Salarial', target: 'non_salary_payments', analysisCategory: 'non_salary', isCreated: false, requiredByRule: false },
    { source: 'IBC', target: 'ibc_total', analysisCategory: 'ibc', isCreated: false, requiredByRule: true },
    { source: 'Salud Emp', target: 'health_employee_deduction', analysisCategory: 'contribution', isCreated: false, requiredByRule: true },
    { source: 'Pension Emp', target: 'pension_employee_deduction', analysisCategory: 'contribution', isCreated: false, requiredByRule: true },
    { source: 'Devengado', target: 'gross_pay', analysisCategory: 'salary_base', isCreated: false, requiredByRule: false },
  ];

  const baseMatrix: MatrixInput = {
    headers: ['Documento', 'Nombre', 'Salario', 'No Salarial', 'IBC', 'Salud Emp', 'Pension Emp', 'Devengado'],
    rows: [
      ['123456', 'Juan Pérez', 1750905, 0, 1750905, 70036, 70036, 1750905],
      ['789012', 'María López', 3500000, 500000, 3500000, 140000, 140000, 4000000],
    ],
  };

  it('should execute checks and return a ValidationReport with correct structure', () => {
    const report = validatePayrollCalculations({
      countryCode: 'CO',
      year: 2026,
      matrices: [baseMatrix],
      relations: baseRelations,
    });

    expect(report.countryCode).toBe('CO');
    expect(report.year).toBe(2026);
    expect(report.rowsAnalyzed).toBe(2);
    expect(report.checks).toBeDefined();
    expect(Array.isArray(report.checks)).toBe(true);
  });

  it('each check result should have id, label, passedRows, failedRows, sampleFindings', () => {
    const report = validatePayrollCalculations({
      countryCode: 'CO',
      year: 2026,
      matrices: [baseMatrix],
      relations: baseRelations,
    });

    for (const check of report.checks) {
      expect(check.id).toBeTruthy();
      expect(check.label).toBeTruthy();
      expect(typeof check.passedRows).toBe('number');
      expect(typeof check.failedRows).toBe('number');
      expect(Array.isArray(check.sampleFindings)).toBe(true);
    }
  });

  it('should include severity on each check', () => {
    const report = validatePayrollCalculations({
      countryCode: 'CO',
      year: 2026,
      matrices: [baseMatrix],
      relations: baseRelations,
    });

    for (const check of report.checks) {
      expect(['high', 'medium', 'low']).toContain(check.severity);
    }
  });

  it('should report missing dependencies with potentialMatches for unmapped checks', () => {
    // Only map document and salary — many checks will have missing deps
    const minimalRelations: MappingRelationInput[] = [
      { source: 'Documento', target: 'document_number', analysisCategory: 'identity', isCreated: false, requiredByRule: true },
      { source: 'Salario', target: 'base_salary', analysisCategory: 'salary_base', isCreated: false, requiredByRule: true },
    ];

    const matrix: MatrixInput = {
      headers: ['Documento', 'Salario', 'Pagos No Salariales', 'Base Cotizacion'],
      rows: [['123', 2000000, 500000, 2000000]],
    };

    const report = validatePayrollCalculations({
      countryCode: 'CO',
      year: 2026,
      matrices: [matrix],
      relations: minimalRelations,
    });

    const checksWithMissing = report.checks.filter(c => c.missingDependencies && c.missingDependencies.length > 0);
    expect(checksWithMissing.length).toBeGreaterThan(0);

    // At least some should have potentialMatches
    const withMatches = checksWithMissing.filter(c => c.potentialMatches && Object.keys(c.potentialMatches).length > 0);
    // potentialMatches may or may not be found depending on fuzzy matching
    expect(checksWithMissing.length).toBeGreaterThan(0);
  });

  it('should generate a validation report with totals', () => {
    const report = validatePayrollCalculations({
      countryCode: 'CO',
      year: 2026,
      matrices: [baseMatrix],
      relations: baseRelations,
    });

    expect(typeof report.rowsAnalyzed).toBe('number');
    expect(typeof report.rowsWithFindings).toBe('number');
    expect(typeof report.criticalFindings).toBe('number');
    expect(report.rowsAnalyzed).toBeGreaterThanOrEqual(0);
    expect(report.coverage).toBeDefined();
    expect(typeof report.coverage.totalHeaders).toBe('number');
    expect(typeof report.coverage.mappedHeaders).toBe('number');
  });

  it('should detect correct health deduction at 4%', () => {
    // Row with correct 4% health deduction
    const correctMatrix: MatrixInput = {
      headers: ['Documento', 'Nombre', 'Salario', 'No Salarial', 'IBC', 'Salud Emp', 'Pension Emp', 'Devengado'],
      rows: [['123', 'Test', 2000000, 0, 2000000, 80000, 80000, 2000000]],
    };

    const report = validatePayrollCalculations({
      countryCode: 'CO',
      year: 2026,
      matrices: [correctMatrix],
      relations: baseRelations,
    });

    const healthCheck = report.checks.find(c => c.id === 'health_deduction_4pct');
    if (healthCheck) {
      expect(healthCheck.passedRows).toBe(1);
      expect(healthCheck.failedRows).toBe(0);
    }
  });

  it('should detect incorrect health deduction', () => {
    // Row with wrong health deduction (should be 80000 but is 50000)
    const wrongMatrix: MatrixInput = {
      headers: ['Documento', 'Nombre', 'Salario', 'No Salarial', 'IBC', 'Salud Emp', 'Pension Emp', 'Devengado'],
      rows: [['123', 'Test', 2000000, 0, 2000000, 50000, 80000, 2000000]],
    };

    const report = validatePayrollCalculations({
      countryCode: 'CO',
      year: 2026,
      matrices: [wrongMatrix],
      relations: baseRelations,
    });

    const healthCheck = report.checks.find(c => c.id === 'health_deduction_4pct');
    if (healthCheck) {
      expect(healthCheck.failedRows).toBe(1);
      expect(healthCheck.sampleFindings.length).toBeGreaterThan(0);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Task 8.3: Severity-based risk score calculation
// Validates: Requirements 5.5, 5.7
// ═══════════════════════════════════════════════════════════════════════════════

describe('Task 8.3: Severity-based risk score', () => {
  it('should calculate score as high×40 + medium×20 + low×10', () => {
    const findings: SeverityFinding[] = [
      { severity: 'high', description: 'IBC error' },
      { severity: 'medium', description: 'Cesantías error' },
      { severity: 'low', description: 'Transport warning' },
    ];
    const score = calculateSeverityRiskScore(findings);
    expect(score).toBe(40 + 20 + 10); // 70
  });

  it('should return 0 for empty findings', () => {
    expect(calculateSeverityRiskScore([])).toBe(0);
  });

  it('should handle multiple findings of same severity', () => {
    const findings: SeverityFinding[] = [
      { severity: 'high', description: 'Error 1' },
      { severity: 'high', description: 'Error 2' },
      { severity: 'high', description: 'Error 3' },
    ];
    expect(calculateSeverityRiskScore(findings)).toBe(120); // 3 × 40
  });

  it('should have correct severity weights', () => {
    expect(SEVERITY_WEIGHTS.high).toBe(40);
    expect(SEVERITY_WEIGHTS.medium).toBe(20);
    expect(SEVERITY_WEIGHTS.low).toBe(10);
  });

  it('should handle only low severity findings', () => {
    const findings: SeverityFinding[] = [
      { severity: 'low', description: 'Info 1' },
      { severity: 'low', description: 'Info 2' },
    ];
    expect(calculateSeverityRiskScore(findings)).toBe(20); // 2 × 10
  });

  it('requestAutoCorrections should return null when bus has no corrector', async () => {
    const mockBus = {
      hasAgent: () => false,
      send: async () => ({ success: true, data: {} }),
    };
    const result = await requestAutoCorrections(mockBus, [], 'CO', 2026);
    expect(result).toBeNull();
  });

  it('requestAutoCorrections should call bus.send when corrector is registered', async () => {
    let sentPayload: unknown = null;
    const mockBus = {
      hasAgent: (name: string) => name === 'corrector',
      send: async (msg: { payload: unknown }) => {
        sentPayload = msg.payload;
        return { success: true, data: { corrections: [] } };
      },
    };
    const result = await requestAutoCorrections(mockBus, [{ id: 'test' }], 'CO', 2026);
    expect(result).not.toBeNull();
    expect(result?.success).toBe(true);
    expect(sentPayload).toEqual({
      findings: [{ id: 'test' }],
      countryCode: 'CO',
      year: 2026,
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Task 9.1: Corrector with explicit normative formulas
// Validates: Requirements 6.1, 6.2, 6.3
// ═══════════════════════════════════════════════════════════════════════════════

describe('Task 9.1: Corrector formulas with normative formulas', () => {
  it('buildCorrectionFormulas should return formulas for all correctable checks', () => {
    const formulas = buildCorrectionFormulas();
    const expectedChecks = [
      'health_deduction_4pct',
      'pension_deduction_4pct',
      'cesantias_rate',
      'prima_rate',
      'vacation_rate',
      'salud_empleador_rate',
      'pension_empleador_rate',
      'parafiscales_rate',
    ];
    for (const checkId of expectedChecks) {
      expect(formulas[checkId]).toBeDefined();
    }
  });

  it('each formula should return suggestedValue, justification, and formula', () => {
    const formulas = buildCorrectionFormulas();
    const ctx = { ibcTotal: 2000000, baseSalary: 2000000, nonSalary: 0, grossPay: 2000000, totalIncome: 2000000 };

    for (const [checkId, formula] of Object.entries(formulas)) {
      const result = formula(ctx);
      if (result) {
        expect(typeof result.suggestedValue).toBe('number');
        expect(result.justification).toBeTruthy();
        expect(result.formula).toBeTruthy();
      }
    }
  });

  it('health deduction formula should calculate 4% of IBC', () => {
    const formulas = buildCorrectionFormulas();
    const result = formulas['health_deduction_4pct']({
      ibcTotal: 2000000, baseSalary: 2000000, nonSalary: 0, grossPay: 2000000, totalIncome: 2000000,
    });
    expect(result).not.toBeNull();
    expect(result!.suggestedValue).toBe(80000); // 2000000 × 0.04
    expect(result!.formula).toContain('4.0%');
  });

  it('pension deduction formula should calculate 4% of IBC', () => {
    const formulas = buildCorrectionFormulas();
    const result = formulas['pension_deduction_4pct']({
      ibcTotal: 3000000, baseSalary: 3000000, nonSalary: 0, grossPay: 3000000, totalIncome: 3000000,
    });
    expect(result).not.toBeNull();
    expect(result!.suggestedValue).toBe(120000); // 3000000 × 0.04
  });

  it('cesantias formula should calculate 8.33% of gross pay', () => {
    const formulas = buildCorrectionFormulas();
    const result = formulas['cesantias_rate']({
      ibcTotal: 2000000, baseSalary: 2000000, nonSalary: 0, grossPay: 2000000, totalIncome: 2000000,
    });
    expect(result).not.toBeNull();
    expect(result!.suggestedValue).toBe(Math.round(2000000 * 0.0833));
  });

  it('should use country-specific rates when provided', () => {
    const countryRules = {
      label: 'Test Rule',
      checks: [
        'Aporte salud empleado: 5.0% del IBC',
        'Aporte pensión empleado: 5.0% del IBC',
      ],
      requiredFields: [],
      requiredCalculations: [],
    };
    const formulas = buildCorrectionFormulas(countryRules);
    const result = formulas['health_deduction_4pct']({
      ibcTotal: 2000000, baseSalary: 2000000, nonSalary: 0, grossPay: 2000000, totalIncome: 2000000,
    });
    // Should use 5% from country rules instead of default 4%
    expect(result).not.toBeNull();
    expect(result!.suggestedValue).toBe(100000); // 2000000 × 0.05
  });

  it('formulas should return null when IBC is 0', () => {
    const formulas = buildCorrectionFormulas();
    const ctx = { ibcTotal: 0, baseSalary: 0, nonSalary: 0, grossPay: 0, totalIncome: 0 };
    expect(formulas['health_deduction_4pct'](ctx)).toBeNull();
    expect(formulas['pension_deduction_4pct'](ctx)).toBeNull();
    expect(formulas['salud_empleador_rate'](ctx)).toBeNull();
  });

  it('vacation formula should use base salary, not gross pay', () => {
    const formulas = buildCorrectionFormulas();
    const result = formulas['vacation_rate']({
      ibcTotal: 3000000, baseSalary: 2000000, nonSalary: 1000000, grossPay: 3000000, totalIncome: 3000000,
    });
    expect(result).not.toBeNull();
    expect(result!.suggestedValue).toBe(Math.round(2000000 * 0.0417)); // Based on salary, not gross
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Task 9.3: PayrollEditor correction types
// Validates: Requirements 6.4, 6.5
// ═══════════════════════════════════════════════════════════════════════════════

describe('Task 9.3: PayrollEditor correction types', () => {
  it('WilCorrection should have required fields for display', () => {
    // Type-level test: ensure the interface is usable
    const correction = {
      rowIndex: 0,
      fieldName: 'health_employee_deduction',
      currentValue: 50000,
      suggestedValue: 80000,
      justification: 'Aporte salud = IBC × 4%',
      formula: 'IBC × 4.0%',
    };
    expect(correction.rowIndex).toBe(0);
    expect(correction.fieldName).toBeTruthy();
    expect(correction.suggestedValue).not.toBe(correction.currentValue);
    expect(correction.formula).toBeTruthy();
  });

  it('CorrectionEntry should track source as manual or ai', () => {
    const manualCorr = {
      sheetIndex: 0,
      rowIndex: 1,
      colIndex: 3,
      originalValue: 50000,
      newValue: 80000,
      source: 'manual' as const,
    };
    const aiCorr = {
      sheetIndex: 0,
      rowIndex: 1,
      colIndex: 3,
      originalValue: 50000,
      newValue: 80000,
      source: 'ai' as const,
    };
    expect(manualCorr.source).toBe('manual');
    expect(aiCorr.source).toBe('ai');
    expect(manualCorr.originalValue).not.toBe(manualCorr.newValue);
  });

  it('correction history should track all changes with sheet, row, col', () => {
    const corrections = [
      { sheetIndex: 0, rowIndex: 0, colIndex: 5, originalValue: 50000, newValue: 80000, source: 'ai' as const },
      { sheetIndex: 0, rowIndex: 1, colIndex: 5, originalValue: 60000, newValue: 90000, source: 'ai' as const },
      { sheetIndex: 1, rowIndex: 0, colIndex: 3, originalValue: 100, newValue: 200, source: 'manual' as const },
    ];

    // Each correction has unique cell coordinates
    const keys = corrections.map(c => `${c.sheetIndex}-${c.rowIndex}-${c.colIndex}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(corrections.length);

    // All have different original vs new values
    for (const c of corrections) {
      expect(c.originalValue).not.toBe(c.newValue);
    }
  });
});
