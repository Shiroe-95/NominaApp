/**
 * Unit tests for Excel export functionality.
 * Tests that the workbook has exactly 3 sheets with correct names and headers.
 *
 * Validates: Requirements 7.4, 22.1, 22.2, 22.4
 */
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  buildReportWorkbook,
  SUMMARY_HEADERS,
  EMPLOYEE_RISK_HEADERS,
  ACTIONS_HEADERS,
  type ExportablePayroll,
  type ExportableAction,
} from './export-excel';

function makePayroll(overrides: Partial<ExportablePayroll> = {}): ExportablePayroll {
  return {
    company_name: 'Acme Corp',
    company_nit: '900123456',
    country_code: 'CO',
    period_year: 2025,
    period_month: 6,
    rule_label: 'Colombia 2025',
    detected_variables: ['salario_base', 'ibc'],
    mapped_fields: ['salario_base'],
    risk_report: { score: 45, level: 'medium' },
    certification_ready: true,
    created_at: '2025-06-15T10:00:00Z',
    employee_risk_summary: {
      topEmployees: [
        { document: '123', name: 'Juan', score: 40, findings: ['IBC inconsistente'] },
      ],
    },
    ...overrides,
  };
}

function makeAction(overrides: Partial<ExportableAction> = {}): ExportableAction {
  return {
    employee_name: 'Juan Pérez',
    title: 'Corregir IBC',
    priority: 'high',
    status: 'open',
    assigned_to: 'analyst@test.com',
    ...overrides,
  };
}

describe('Task 10.4: buildReportWorkbook', () => {
  it('creates a workbook with exactly 3 sheets', () => {
    const wb = buildReportWorkbook([makePayroll()], makePayroll(), [makeAction()]);
    expect(wb.SheetNames).toHaveLength(3);
  });

  it('names sheets "Resumen", "Riesgo Empleados", "Cola de Acciones"', () => {
    const wb = buildReportWorkbook([makePayroll()], makePayroll(), [makeAction()]);
    expect(wb.SheetNames).toEqual(['Resumen', 'Riesgo Empleados', 'Cola de Acciones']);
  });

  it('Resumen sheet has correct headers', () => {
    const wb = buildReportWorkbook([makePayroll()], makePayroll(), []);
    const ws = wb.Sheets['Resumen'];
    const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
    expect(data[0]).toEqual([...SUMMARY_HEADERS]);
  });

  it('Riesgo Empleados sheet has correct headers', () => {
    const wb = buildReportWorkbook([makePayroll()], makePayroll(), []);
    const ws = wb.Sheets['Riesgo Empleados'];
    const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
    expect(data[0]).toEqual([...EMPLOYEE_RISK_HEADERS]);
  });

  it('Cola de Acciones sheet has correct headers', () => {
    const wb = buildReportWorkbook([makePayroll()], undefined, [makeAction()]);
    const ws = wb.Sheets['Cola de Acciones'];
    const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
    expect(data[0]).toEqual([...ACTIONS_HEADERS]);
  });

  it('Resumen sheet contains payroll data rows', () => {
    const payrolls = [makePayroll(), makePayroll({ company_name: 'Beta Inc' })];
    const wb = buildReportWorkbook(payrolls, payrolls[0], []);
    const ws = wb.Sheets['Resumen'];
    const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
    // 1 header + 2 data rows
    expect(data.length).toBe(3);
  });

  it('Riesgo Empleados sheet contains employee data', () => {
    const payroll = makePayroll({
      employee_risk_summary: {
        topEmployees: [
          { document: '111', name: 'Ana', score: 60, findings: ['Finding A'] },
          { document: '222', name: 'Bob', score: 20, findings: ['Finding B'] },
        ],
      },
    });
    const wb = buildReportWorkbook([payroll], payroll, []);
    const ws = wb.Sheets['Riesgo Empleados'];
    const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
    // 1 header + 2 employees
    expect(data.length).toBe(3);
  });

  it('creates all 3 sheets even with empty data', () => {
    const wb = buildReportWorkbook([], undefined, []);
    expect(wb.SheetNames).toEqual(['Resumen', 'Riesgo Empleados', 'Cola de Acciones']);
  });

  it('Riesgo Empleados sheet has only headers when no latest report', () => {
    const wb = buildReportWorkbook([makePayroll()], undefined, []);
    const ws = wb.Sheets['Riesgo Empleados'];
    const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
    expect(data.length).toBe(1); // only headers
  });

  it('Cola de Acciones sheet has only headers when no actions', () => {
    const wb = buildReportWorkbook([makePayroll()], makePayroll(), []);
    const ws = wb.Sheets['Cola de Acciones'];
    const data = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
    expect(data.length).toBe(1); // only headers
  });
});
