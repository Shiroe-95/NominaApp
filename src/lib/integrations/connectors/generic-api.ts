/**
 * Conector genérico para APIs REST de nómina/ERP.
 *
 * Permite conectar cualquier sistema que exponga un endpoint REST
 * que retorne datos de empleados y nómina en formato JSON.
 *
 * Configuración requerida en `IntegrationConfig.settings`:
 *   - employeesEndpoint: path relativo para listar empleados
 *   - payrollEndpoint: path relativo para datos de nómina (acepta {year} y {month})
 *   - fieldMapping: mapeo de campos del sistema externo a campos normalizados
 *
 * @module lib/integrations/connectors/generic-api
 */

import type {
  IntegrationConnector,
  IntegrationConfig,
  NormalizedPayrollData,
  NormalizedEmployee,
} from '../types';

/** Mapeo de campos del sistema externo al formato normalizado */
interface FieldMapping {
  documentType?: string;
  documentNumber?: string;
  firstName?: string;
  lastName?: string;
  baseSalary?: string;
  nonSalaryPayments?: string;
  workedDays?: string;
  contributorType?: string;
}

const DEFAULT_MAPPING: FieldMapping = {
  documentType: 'document_type',
  documentNumber: 'document_number',
  firstName: 'first_name',
  lastName: 'last_name',
  baseSalary: 'base_salary',
  nonSalaryPayments: 'non_salary_payments',
  workedDays: 'worked_days',
  contributorType: 'contributor_type',
};

/**
 * Accede a un valor anidado en un objeto usando notación de punto.
 *
 * @param obj - Objeto fuente
 * @param path - Ruta al valor (ej: `"employee.salary.base"`)
 * @returns El valor encontrado o `undefined` si la ruta no existe
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

/**
 * Realiza un fetch autenticado contra la API externa.
 *
 * Soporta autenticación Bearer (apiKey) y Basic (basicAuth).
 * Si no hay credenciales, envía la petición sin header de autorización.
 *
 * @param config - Configuración de la integración con `baseUrl` y `credentials`
 * @param path - Path relativo del endpoint (se concatena a `baseUrl`)
 * @returns Respuesta HTTP del sistema externo
 */
async function apiFetch(config: IntegrationConfig, path: string): Promise<Response> {
  const baseUrl = config.baseUrl || '';
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (config.credentials.apiKey) {
    headers['Authorization'] = `Bearer ${config.credentials.apiKey}`;
  } else if (config.credentials.basicAuth) {
    headers['Authorization'] = `Basic ${config.credentials.basicAuth}`;
  }

  return fetch(`${baseUrl}${path}`, { headers });
}

/**
 * Conector genérico para cualquier API REST de nómina/ERP.
 *
 * Implementa `IntegrationConnector` con soporte para:
 * - Autenticación Bearer y Basic
 * - Mapeo configurable de campos (field mapping con notación de punto)
 * - Importación de nómina con normalización automática
 * - Exportación de resultados de auditoría (stub para extensión)
 *
 * @see {@link IntegrationConnector} para la interfaz base
 */
export const genericApiConnector: IntegrationConnector = {
  providerId: 'generic-api',
  displayName: 'API REST Genérica',
  type: 'erp',

  async testConnection(config) {
    try {
      const endpoint = (config.settings?.employeesEndpoint as string) || '/employees';
      const res = await apiFetch(config, endpoint);
      if (res.ok) return { ok: true, message: 'Conexión exitosa' };
      return { ok: false, message: `Respuesta ${res.status}` };
    } catch (err) {
      return { ok: false, message: `Error: ${(err as Error).message}` };
    }
  },

  async importPayroll(config, periodYear, periodMonth) {
    try {
      const settings = config.settings || {};
      const mapping: FieldMapping = { ...DEFAULT_MAPPING, ...(settings.fieldMapping as FieldMapping || {}) };

      const payrollEndpoint = ((settings.payrollEndpoint as string) || '/payroll/{year}/{month}')
        .replace('{year}', String(periodYear))
        .replace('{month}', String(periodMonth));

      const res = await apiFetch(config, payrollEndpoint);
      if (!res.ok) {
        return {
          success: false,
          recordsProcessed: 0,
          recordsFailed: 0,
          errors: [{ message: `API respondió ${res.status}`, code: 'API_FETCH_ERROR' }],
        };
      }

      const json = (await res.json()) as { data?: Record<string, unknown>[] } | Record<string, unknown>[];
      const records = Array.isArray(json) ? json : (json.data || []);

      const employees: NormalizedEmployee[] = records.map((record) => {
        const rec = record as Record<string, unknown>;
        return {
          documentType: String(getNestedValue(rec, mapping.documentType!) || 'CC'),
          documentNumber: String(getNestedValue(rec, mapping.documentNumber!) || ''),
          firstName: String(getNestedValue(rec, mapping.firstName!) || ''),
          lastName: String(getNestedValue(rec, mapping.lastName!) || ''),
          baseSalary: Number(getNestedValue(rec, mapping.baseSalary!) || 0),
          nonSalaryPayments: Number(getNestedValue(rec, mapping.nonSalaryPayments!) || 0),
          workedDays: Number(getNestedValue(rec, mapping.workedDays!) || 30),
          contributorType: String(getNestedValue(rec, mapping.contributorType!) || 'dependent'),
        };
      });

      const data: NormalizedPayrollData = {
        companyId: (settings.companyId as string) || '',
        countryCode: (settings.countryCode as string) || 'CO',
        periodYear,
        periodMonth,
        employees,
        metadata: { source: 'generic-api', importedAt: new Date().toISOString() },
      };

      return {
        success: true,
        recordsProcessed: employees.length,
        recordsFailed: 0,
        errors: [],
        data,
      };
    } catch (err) {
      return {
        success: false,
        recordsProcessed: 0,
        recordsFailed: 0,
        errors: [{ message: (err as Error).message, code: 'API_IMPORT_ERROR' }],
      };
    }
  },

  async exportAuditResults(_config, _payrollId, findings) {
    // Generic API export — override in specific implementations
    return {
      success: true,
      recordsProcessed: findings.length,
      recordsFailed: 0,
      errors: [],
    };
  },
};
