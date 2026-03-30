/**
 * Unit tests for the Ana (Writer) agent.
 * Tests grouping by category, severity ordering, risk score calculation,
 * per-employee grouping, and report structure.
 *
 * Validates: Requirements 7.1, 7.2
 */
import { describe, it, expect } from 'vitest';
import {
  groupAndSortFindings,
  determineRiskLevel,
  extractNormativeReferences,
  calculateRiskScore,
  groupFindingsByEmployee,
  type WriterReport,
} from './writer';
import type { AuditFinding, AuditSummary } from './auditor';

// ── Helpers ─────────────────────────────────────────────────────────

function makeFinding(overrides: Partial<AuditFinding> = {}): AuditFinding {
  return {
    document: '1234567890',
    description: 'Test finding',
    severity: 'media',
    norm: 'Art. 249 CST',
    expectedValue: 100,
    reportedValue: 80,
    category: 'IBC',
    ...overrides,
  };
}

// ── groupAndSortFindings ────────────────────────────────────────────

describe('Task 10.1: groupAndSortFindings', () => {
  it('groups findings by category', () => {
    const findings: AuditFinding[] = [
      makeFinding({ category: 'IBC' }),
      makeFinding({ category: 'Prestaciones' }),
      makeFinding({ category: 'IBC' }),
    ];
    const grouped = groupAndSortFindings(findings);
    expect(grouped).toHaveLength(2);
    expect(grouped[0].category).toBe('IBC');
    expect(grouped[0].findings).toHaveLength(2);
    expect(grouped[1].category).toBe('Prestaciones');
    expect(grouped[1].findings).toHaveLength(1);
  });

  it('sorts findings within each category by severity: alta > media > baja', () => {
    const findings: AuditFinding[] = [
      makeFinding({ category: 'IBC', severity: 'baja' }),
      makeFinding({ category: 'IBC', severity: 'alta' }),
      makeFinding({ category: 'IBC', severity: 'media' }),
    ];
    const grouped = groupAndSortFindings(findings);
    expect(grouped).toHaveLength(1);
    const severities = grouped[0].findings.map(f => f.severity);
    expect(severities).toEqual(['alta', 'media', 'baja']);
  });

  it('omits categories with no findings', () => {
    const findings: AuditFinding[] = [
      makeFinding({ category: 'Parafiscales' }),
    ];
    const grouped = groupAndSortFindings(findings);
    expect(grouped).toHaveLength(1);
    expect(grouped[0].category).toBe('Parafiscales');
  });

  it('returns empty array for no findings', () => {
    expect(groupAndSortFindings([])).toEqual([]);
  });

  it('follows category order: IBC, Prestaciones, Seguridad Social, Parafiscales, Impuestos, Datos', () => {
    const findings: AuditFinding[] = [
      makeFinding({ category: 'Datos' }),
      makeFinding({ category: 'IBC' }),
      makeFinding({ category: 'Parafiscales' }),
    ];
    const grouped = groupAndSortFindings(findings);
    const categories = grouped.map(g => g.category);
    expect(categories).toEqual(['IBC', 'Parafiscales', 'Datos']);
  });
});

// ── determineRiskLevel ──────────────────────────────────────────────

describe('Task 10.1: determineRiskLevel', () => {
  it('returns alto when there are alta severity findings', () => {
    const summary: AuditSummary = {
      totalFindings: 3,
      bySeverity: { alta: 1, media: 1, baja: 1 },
      byCategory: { IBC: 1, Prestaciones: 1, 'Seguridad Social': 0, Parafiscales: 0, Impuestos: 0, Datos: 1 },
    };
    expect(determineRiskLevel(summary)).toBe('alto');
  });

  it('returns medio when no alta but media findings exist', () => {
    const summary: AuditSummary = {
      totalFindings: 2,
      bySeverity: { alta: 0, media: 2, baja: 0 },
      byCategory: { IBC: 1, Prestaciones: 1, 'Seguridad Social': 0, Parafiscales: 0, Impuestos: 0, Datos: 0 },
    };
    expect(determineRiskLevel(summary)).toBe('medio');
  });

  it('returns bajo when only baja findings', () => {
    const summary: AuditSummary = {
      totalFindings: 1,
      bySeverity: { alta: 0, media: 0, baja: 1 },
      byCategory: { IBC: 0, Prestaciones: 0, 'Seguridad Social': 0, Parafiscales: 0, Impuestos: 0, Datos: 1 },
    };
    expect(determineRiskLevel(summary)).toBe('bajo');
  });

  it('returns bajo when no findings at all', () => {
    const summary: AuditSummary = {
      totalFindings: 0,
      bySeverity: { alta: 0, media: 0, baja: 0 },
      byCategory: { IBC: 0, Prestaciones: 0, 'Seguridad Social': 0, Parafiscales: 0, Impuestos: 0, Datos: 0 },
    };
    expect(determineRiskLevel(summary)).toBe('bajo');
  });
});

// ── calculateRiskScore ──────────────────────────────────────────────

describe('Task 10.1: calculateRiskScore', () => {
  it('calculates score as alta×40 + media×20 + baja×10', () => {
    const summary: AuditSummary = {
      totalFindings: 4,
      bySeverity: { alta: 1, media: 1, baja: 1 },
      byCategory: { IBC: 1, Prestaciones: 1, 'Seguridad Social': 1, Parafiscales: 0, Impuestos: 0, Datos: 0 },
    };
    expect(calculateRiskScore(summary)).toBe(70); // 40 + 20 + 10
  });

  it('caps at 100', () => {
    const summary: AuditSummary = {
      totalFindings: 10,
      bySeverity: { alta: 3, media: 0, baja: 0 },
      byCategory: { IBC: 3, Prestaciones: 0, 'Seguridad Social': 0, Parafiscales: 0, Impuestos: 0, Datos: 0 },
    };
    expect(calculateRiskScore(summary)).toBe(100); // 3×40 = 120 → capped at 100
  });

  it('returns 0 for no findings', () => {
    const summary: AuditSummary = {
      totalFindings: 0,
      bySeverity: { alta: 0, media: 0, baja: 0 },
      byCategory: { IBC: 0, Prestaciones: 0, 'Seguridad Social': 0, Parafiscales: 0, Impuestos: 0, Datos: 0 },
    };
    expect(calculateRiskScore(summary)).toBe(0);
  });
});

// ── groupFindingsByEmployee ─────────────────────────────────────────

describe('Task 10.1: groupFindingsByEmployee', () => {
  it('groups findings by employee document', () => {
    const findings: AuditFinding[] = [
      makeFinding({ document: 'EMP001' }),
      makeFinding({ document: 'EMP002' }),
      makeFinding({ document: 'EMP001' }),
    ];
    const result = groupFindingsByEmployee(findings);
    expect(result).toHaveLength(2);
    const docs = result.map(e => e.employeeDoc);
    expect(docs).toContain('EMP001');
    expect(docs).toContain('EMP002');
  });

  it('sorts employees by riskScore descending', () => {
    const findings: AuditFinding[] = [
      makeFinding({ document: 'LOW', severity: 'baja' }),
      makeFinding({ document: 'HIGH', severity: 'alta' }),
      makeFinding({ document: 'HIGH', severity: 'alta' }),
    ];
    const result = groupFindingsByEmployee(findings);
    expect(result[0].employeeDoc).toBe('HIGH');
    expect(result[0].riskScore).toBe(80); // 2 × 40
    expect(result[1].employeeDoc).toBe('LOW');
    expect(result[1].riskScore).toBe(10); // 1 × 10
  });

  it('includes recommendations per employee', () => {
    const findings: AuditFinding[] = [
      makeFinding({ document: 'EMP001', severity: 'alta' }),
      makeFinding({ document: 'EMP001', severity: 'baja' }),
    ];
    const result = groupFindingsByEmployee(findings);
    expect(result[0].recommendations.length).toBeGreaterThan(0);
  });

  it('includes normative references per employee', () => {
    const findings: AuditFinding[] = [
      makeFinding({ document: 'EMP001', norm: 'Ley 1393' }),
      makeFinding({ document: 'EMP001', norm: 'Art. 249 CST' }),
    ];
    const result = groupFindingsByEmployee(findings);
    expect(result[0].normativeReferences).toContain('Ley 1393');
    expect(result[0].normativeReferences).toContain('Art. 249 CST');
  });

  it('returns empty array for no findings', () => {
    expect(groupFindingsByEmployee([])).toEqual([]);
  });
});

// ── extractNormativeReferences ──────────────────────────────────────

describe('Task 10.1: extractNormativeReferences', () => {
  it('extracts unique normative references', () => {
    const findings: AuditFinding[] = [
      makeFinding({ norm: 'Ley 1393' }),
      makeFinding({ norm: 'Art. 249 CST' }),
      makeFinding({ norm: 'Ley 1393' }), // duplicate
    ];
    const refs = extractNormativeReferences(findings);
    expect(refs).toHaveLength(2);
    expect(refs).toContain('Ley 1393');
    expect(refs).toContain('Art. 249 CST');
  });
});
