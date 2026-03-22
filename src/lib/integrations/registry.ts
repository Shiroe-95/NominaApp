/**
 * Registro central de conectores de integración.
 *
 * Los conectores se registran aquí y se acceden por `providerId`.
 * Para agregar un nuevo conector:
 *   1. Crear archivo en `src/lib/integrations/connectors/<provider>.ts`
 *   2. Implementar `IntegrationConnector`
 *   3. Registrarlo en este archivo con `registerConnector()`
 *
 * @module lib/integrations/registry
 */

import type { IntegrationConnector } from './types';

const connectors = new Map<string, IntegrationConnector>();

/** Registra un conector en el registry */
export function registerConnector(connector: IntegrationConnector): void {
  connectors.set(connector.providerId, connector);
}

/** Obtiene un conector por su providerId */
export function getConnector(providerId: string): IntegrationConnector | undefined {
  return connectors.get(providerId);
}

/** Lista todos los conectores registrados */
export function listConnectors(): IntegrationConnector[] {
  return Array.from(connectors.values());
}

/** Verifica si un conector está registrado */
export function hasConnector(providerId: string): boolean {
  return connectors.has(providerId);
}
