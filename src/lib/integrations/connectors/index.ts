/**
 * ERP Integration Connectors — SAP, Oracle, Workday, ADP, Generic REST stubs.
 * Extends existing IntegrationConnector interface.
 *
 * Requirements: 37.1, 37.2, 37.3, 37.4, 37.5, 37.6, 37.7
 * @module lib/integrations/connectors
 */

import type { IntegrationConnector, IntegrationConfig, SyncResult } from '../types';

// ─── Base stub implementation ───────────────────────────────────────

function createStubConnector(
  providerId: string,
  displayName: string,
): IntegrationConnector {
  return {
    providerId,
    displayName,
    type: 'erp',

    async testConnection(config: IntegrationConfig) {
      if (!config.credentials?.apiKey && !config.credentials?.clientId) {
        return { ok: false, message: 'Missing credentials' };
      }
      return { ok: true, message: `${displayName} connection OK (stub)` };
    },

    async importPayroll(
      _config: IntegrationConfig,
      _periodYear: number,
      _periodMonth: number,
    ): Promise<SyncResult> {
      return {
        success: true,
        recordsProcessed: 0,
        recordsFailed: 0,
        errors: [],
        data: undefined,
      };
    },

    async exportAuditResults(
      _config: IntegrationConfig,
      _payrollId: string,
      _findings: unknown[],
    ): Promise<SyncResult> {
      return {
        success: true,
        recordsProcessed: 0,
        recordsFailed: 0,
        errors: [],
      };
    },
  };
}

// ─── Connector instances ────────────────────────────────────────────

export const sapConnector = createStubConnector('sap-successfactors', 'SAP SuccessFactors');
export const oracleConnector = createStubConnector('oracle-hcm', 'Oracle HCM Cloud');
export const workdayConnector = createStubConnector('workday', 'Workday');
export const adpConnector = createStubConnector('adp', 'ADP Workforce Now');
export const genericRestConnector = createStubConnector('generic-rest', 'Generic REST API');

/** All available connectors indexed by provider ID. */
export const CONNECTOR_REGISTRY: Record<string, IntegrationConnector> = {
  'sap-successfactors': sapConnector,
  'oracle-hcm': oracleConnector,
  'workday': workdayConnector,
  'adp': adpConnector,
  'generic-rest': genericRestConnector,
};

/**
 * Get a connector by provider ID.
 */
export function getConnector(providerId: string): IntegrationConnector | undefined {
  return CONNECTOR_REGISTRY[providerId];
}

/**
 * List all available connector metadata for the setup wizard.
 */
export function listAvailableConnectors(): { id: string; name: string; type: string }[] {
  return Object.values(CONNECTOR_REGISTRY).map((c) => ({
    id: c.providerId,
    name: c.displayName,
    type: c.type,
  }));
}
