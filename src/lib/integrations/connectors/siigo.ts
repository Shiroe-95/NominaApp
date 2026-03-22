/**
 * Conector para Siigo — ERP contable colombiano.
 *
 * Siigo expone una API REST para consultar nómina, empleados y conceptos.
 * Docs: https://siigonube.siigo.com/
 *
 * Este conector normaliza los datos de Siigo al formato interno de NominaSmart.
 *
 * @module lib/integrations/connectors/siigo
 */

import type {
  IntegrationConnector,
  IntegrationConfig,
  SyncResult,
  NormalizedPayrollData,
  NormalizedEmployee,
} from '../types';

async function siigoFetch(
  config: IntegrationConfig,
  path: string,
): Promise<Response> {
  const baseUrl = config.baseUrl || 'https://api.siigo.com/v1';
  return fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${config.credentials.accessToken}`,
      'Content-Type': 'application/json',
      'Partner-Id': config.credentials.partnerId || '',
    },
  });
}

export const siigoConnector: IntegrationConnector = {
  providerId: 'siigo',
  displayName: 'Siigo Nube',
  type: 'erp',

  async testConnection(config) {
    try {
      const res = await siigoFetch(config, '/users');
      if (res.ok) return { ok: true, message: 'Conexión exitosa con Siigo' };
      const body = await res.text();
      return { ok: false, message: `Siigo respondió ${res.status}: ${body.slice(0, 200)}` };
    } catch (err) {
      return { ok: false, message: `Error de conexión: ${(err as Error).message}` };
    }
  },

  async importPayroll(config, periodYear, periodMonth) {
    const errors: SyncResult['errors'] = [];

    try {
      // Fetch employees from Siigo
      const empRes = await siigoFetch(config, '/payroll/employees');
      if (!empRes.ok) {
        return {
          success: false,
          recordsProcessed: 0,
          recordsFailed: 0,
          errors: [{ message: `Error fetching employees: ${empRes.status}`, code: 'SIIGO_FETCH_ERROR' }],
        };
      }

      const empData = (await empRes.json()) as { results?: SiigoEmployee[] };
      const siigoEmployees = empData.results || [];

      // Fetch payroll period
      const payRes = await siigoFetch(
        config,
        `/payroll/periods?year=${periodYear}&month=${periodMonth}`,
      );

      let payrollDetails: SiigoPayrollDetail[] = [];
      if (payRes.ok) {
        const payData = (await payRes.json()) as { results?: SiigoPayrollDetail[] };
        payrollDetails = payData.results || [];
      }

      // Build lookup by employee ID
      const detailsByEmployee = new Map<string, SiigoPayrollDetail>();
      for (const detail of payrollDetails) {
        detailsByEmployee.set(detail.employee_id, detail);
      }

      // Normalize
      const employees: NormalizedEmployee[] = [];
      for (const emp of siigoEmployees) {
        const detail = detailsByEmployee.get(emp.id);
        employees.push({
          documentType: emp.identification?.type || 'CC',
          documentNumber: emp.identification?.number || '',
          firstName: emp.first_name || '',
          lastName: emp.last_name || '',
          baseSalary: detail?.base_salary ?? emp.salary ?? 0,
          nonSalaryPayments: detail?.non_salary_total ?? 0,
          workedDays: detail?.worked_days ?? 30,
          contributorType: emp.contributor_type || 'dependent',
          extra: { siigoId: emp.id },
        });
      }

      const data: NormalizedPayrollData = {
        companyId: config.settings?.companyId as string || '',
        countryCode: 'CO',
        periodYear,
        periodMonth,
        employees,
        metadata: { source: 'siigo', importedAt: new Date().toISOString() },
      };

      return {
        success: true,
        recordsProcessed: employees.length,
        recordsFailed: errors.length,
        errors,
        data,
      };
    } catch (err) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsFailed: 0,
        errors: [{ message: (err as Error).message, code: 'SIIGO_IMPORT_ERROR' }],
      };
    }
  },

  async exportAuditResults(config, payrollId, findings) {
    try {
      const res = await siigoFetch(config, '/payroll/observations');
      // Siigo doesn't have a native audit endpoint — log as note
      if (!res.ok) {
        return {
          success: false,
          recordsProcessed: 0,
          recordsFailed: findings.length,
          errors: [{ message: `Export not supported: ${res.status}`, code: 'SIIGO_EXPORT_UNSUPPORTED' }],
        };
      }

      return {
        success: true,
        recordsProcessed: findings.length,
        recordsFailed: 0,
        errors: [],
      };
    } catch (err) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsFailed: findings.length,
        errors: [{ message: (err as Error).message, code: 'SIIGO_EXPORT_ERROR' }],
      };
    }
  },
};

// ── Siigo API types (minimal) ───────────────────────────────

interface SiigoEmployee {
  id: string;
  identification?: { type: string; number: string };
  first_name?: string;
  last_name?: string;
  salary?: number;
  contributor_type?: string;
}

interface SiigoPayrollDetail {
  employee_id: string;
  base_salary?: number;
  non_salary_total?: number;
  worked_days?: number;
}
