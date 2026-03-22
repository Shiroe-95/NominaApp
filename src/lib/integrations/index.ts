/**
 * Módulo de integraciones con sistemas externos.
 *
 * Exporta el registry de conectores y los tipos necesarios.
 * Los conectores se auto-registran al importar este módulo.
 *
 * ## Conectores disponibles:
 * - `siigo` — Siigo Nube (ERP contable colombiano)
 * - `generic-api` — API REST genérica (cualquier sistema con endpoint JSON)
 *
 * ## Agregar un nuevo conector:
 * 1. Crear `src/lib/integrations/connectors/<provider>.ts`
 * 2. Implementar `IntegrationConnector`
 * 3. Importar y registrar aquí con `registerConnector()`
 *
 * @module lib/integrations
 */

export type {
  IntegrationType,
  ConnectionStatus,
  NormalizedPayrollData,
  NormalizedEmployee,
  IntegrationConfig,
  SyncResult,
  SyncError,
  IntegrationConnector,
} from './types';

export {
  registerConnector,
  getConnector,
  listConnectors,
  hasConnector,
} from './registry';

// ── Auto-register built-in connectors ───────────────────────

import { registerConnector } from './registry';
import { siigoConnector } from './connectors/siigo';
import { genericApiConnector } from './connectors/generic-api';

registerConnector(siigoConnector);
registerConnector(genericApiConnector);
