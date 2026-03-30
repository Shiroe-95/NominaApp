import * as XLSX from 'xlsx';

/**
 * Minimal payroll report shape needed for Excel export.
 * Matches the PayrollReport interface from the Reports page.
 */
export interface ExportablePayroll {
  company_name: string | null;
  company_nit: string | null;
  country_code: string;
  period_year: number;
  period_month: number;
  rule_label: string | null;
  detected_variables?: string[];
  mapped_fields?: string[];
  risk_report?: { score?: number; level?: string };
  certification_ready: boolean;
  created_at: string;
  employee_risk_summary?: {
    topEmployees?: Array<{
      document: string;
      name: string;
      score: number;
      findings: string[];
    }>;
  };
}

export interface ExportableAction {
  employee_name: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  status: string;
  assigned_to: string | null;
}

/** Headers for the "Resumen" sheet. */
export const SUMMARY_HEADERS = [
  'Fecha', 'Empresa', 'NIT', 'País', 'Período',
  'Regla', 'Variables', 'Mapeados', 'Riesgo', 'Estado',
] as const;

/** Headers for the "Riesgo Empleados" sheet. */
export const EMPLOYEE_RISK_HEADERS = [
  'Documento', 'Nombre', 'Score Riesgo', 'Hallazgos',
] as const;

/** Headers for the "Cola de Acciones" sheet. */
export const ACTIONS_HEADERS = [
  'Empleado', 'Título', 'Prioridad', 'Estado', 'Asignado a',
] as const;

/**
 * Builds an XLSX workbook with exactly 3 sheets:
 *  1. "Resumen" — summary of all payroll reports
 *  2. "Riesgo Empleados" — employee risk from the latest report
 *  3. "Cola de Acciones" — action items queue
 *
 * Always creates all 3 sheets (empty data rows if no data available)
 * to satisfy Requirement 7.4, 22.1, 22.2.
 *
 * @returns The XLSX WorkBook object (useful for testing without triggering download).
 */
export function buildReportWorkbook(
  rows: ExportablePayroll[],
  latest: ExportablePayroll | undefined,
  actions: ExportableAction[],
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Resumen
  const summaryData: unknown[][] = [
    [...SUMMARY_HEADERS],
    ...rows.map((r) => [
      new Date(r.created_at).toLocaleDateString('es-CO'),
      r.company_name ?? '',
      r.company_nit ?? '',
      r.country_code,
      `${String(r.period_month).padStart(2, '0')}/${r.period_year}`,
      r.rule_label ?? '',
      r.detected_variables?.length ?? 0,
      r.mapped_fields?.length ?? 0,
      r.risk_report?.score ?? 0,
      r.certification_ready ? 'Certificable' : 'No certificable',
    ]),
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Resumen');

  // Sheet 2: Riesgo Empleados
  const topEmployees = latest?.employee_risk_summary?.topEmployees ?? [];
  const empData: unknown[][] = [
    [...EMPLOYEE_RISK_HEADERS],
    ...topEmployees.map((e) => [
      e.document,
      e.name,
      e.score,
      (e.findings ?? []).join('; '),
    ]),
  ];
  const wsEmp = XLSX.utils.aoa_to_sheet(empData);
  XLSX.utils.book_append_sheet(wb, wsEmp, 'Riesgo Empleados');

  // Sheet 3: Cola de Acciones
  const actData: unknown[][] = [
    [...ACTIONS_HEADERS],
    ...actions.map((a) => [
      a.employee_name,
      a.title,
      a.priority,
      a.status,
      a.assigned_to ?? '',
    ]),
  ];
  const wsAct = XLSX.utils.aoa_to_sheet(actData);
  XLSX.utils.book_append_sheet(wb, wsAct, 'Cola de Acciones');

  return wb;
}

/**
 * Exports the report to an Excel file and triggers browser download.
 * Generates the file entirely in the browser using XLSX (Requirement 22.4).
 */
export function exportReportToExcel(
  rows: ExportablePayroll[],
  latest: ExportablePayroll | undefined,
  actions: ExportableAction[],
): void {
  if (rows.length === 0) return;

  const wb = buildReportWorkbook(rows, latest, actions);
  const filename = `reporte_nominasmart_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, filename);
}
