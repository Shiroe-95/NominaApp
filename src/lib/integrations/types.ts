/**
 * Tipos base para integraciones con sistemas externos (ERPs, contabilidad, bancos).
 *
 * Define la interfaz común que todos los conectores deben implementar,
 * permitiendo agregar nuevos sistemas sin modificar el core de la app.
 *
 * @module lib/integrations/types
 */

/** Tipos de sistema soportados */
export type IntegrationType = 'erp' | 'accounting' | 'banking' | 'payroll_provider';

/** Estado de conexión de una integración */
export type ConnectionStatus = 'connected' | 'disconnected' | 'error' | 'pending';

/** Formato de datos de nómina normalizado para importación/exportación */
export interface NormalizedPayrollData {
  companyId: string;
  countryCode: string;
  periodYear: number;
  periodMonth: number;
  employees: NormalizedEmployee[];
  metadata?: Record<string, unknown>;
}

export interface NormalizedEmployee {
  documentType: string;
  documentNumber: string;
  firstName: string;
  lastName: string;
  baseSalary: number;
  nonSalaryPayments?: number;
  workedDays?: number;
  contributorType?: string;
  /** Campos adicionales específicos del sistema origen */
  extra?: Record<string, unknown>;
}

/** Configuración de una integración */
export interface IntegrationConfig {
  id: string;
  type: IntegrationType;
  provider: string;
  displayName: string;
  /** Credenciales encriptadas (API key, OAuth tokens, etc.) */
  credentials: Record<string, string>;
  /** URL base del sistema externo */
  baseUrl?: string;
  /** Configuración específica del conector */
  settings?: Record<string, unknown>;
  isActive: boolean;
  lastSyncAt?: string;
  lastSyncStatus?: ConnectionStatus;
}

/** Resultado de una operación de sincronización */
export interface SyncResult {
  success: boolean;
  recordsProcessed: number;
  recordsFailed: number;
  errors: SyncError[];
  data?: NormalizedPayrollData;
}

export interface SyncError {
  row?: number;
  field?: string;
  message: string;
  code: string;
}

/**
 * Interfaz que todo conector de integración debe implementar.
 *
 * Cada conector (SAP, Oracle, Siigo, etc.) implementa esta interfaz
 * para normalizar la comunicación con el sistema externo.
 */
export interface IntegrationConnector {
  /** Identificador único del conector */
  readonly providerId: string;
  /** Nombre legible */
  readonly displayName: string;
  /** Tipo de integración */
  readonly type: IntegrationType;

  /** Verifica conectividad con el sistema externo */
  testConnection(config: IntegrationConfig): Promise<{ ok: boolean; message: string }>;

  /** Importa datos de nómina desde el sistema externo */
  importPayroll(
    config: IntegrationConfig,
    periodYear: number,
    periodMonth: number,
  ): Promise<SyncResult>;

  /** Exporta resultados de auditoría al sistema externo */
  exportAuditResults(
    config: IntegrationConfig,
    payrollId: string,
    findings: unknown[],
  ): Promise<SyncResult>;
}
