/**
 * Feature: dashboard-redesign, Property 11: Claves de traducción existen para los tres idiomas
 *
 * *For any* translation key used in the new dashboard components, the message
 * files `en.json`, `es.json` and `pt.json` must contain a corresponding entry.
 *
 * **Validates: Requirements 5.5**
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import en from '../../../messages/en.json';
import es from '../../../messages/es.json';
import pt from '../../../messages/pt.json';

// ── Required translation keys for new dashboard components ──────────

/**
 * Accede a un valor anidado en un objeto JSON usando una ruta separada por puntos.
 * @param obj - Objeto JSON raíz (ej: contenido de `en.json`)
 * @param path - Ruta separada por puntos (ej: `"Dashboard.providers.title"`)
 * @returns El valor encontrado o `undefined` si la ruta no existe
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object' && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * All translation keys used by the new dashboard components.
 * These are dot-separated paths rooted at the Dashboard namespace.
 */
const REQUIRED_KEYS: string[] = [
  // ProviderStatusPanel keys (Dashboard.providers.*)
  'Dashboard.providers.title',
  'Dashboard.providers.configure',
  'Dashboard.providers.count',
  'Dashboard.providers.active',
  'Dashboard.providers.inactive',
  'Dashboard.providers.emptyTitle',
  'Dashboard.providers.emptyDescription',
  'Dashboard.providers.addProvider',
  'Dashboard.providers.testFailed',

  // ProcessFlowPanel keys (Dashboard.processFlow.*)
  'Dashboard.processFlow.title',
  'Dashboard.processFlow.stepCounter',

  // ProcessFlowPanel also uses these Dashboard-level keys
  'Dashboard.processStepUpload',
  'Dashboard.processStepUploadDesc',
  'Dashboard.processStepMapping',
  'Dashboard.processStepMappingDesc',
  'Dashboard.processStepValidation',
  'Dashboard.processStepValidationDesc',
  'Dashboard.processStepReport',
  'Dashboard.processStepReportDesc',

  // LiveLogsPanel keys (Dashboard.logs.*)
  'Dashboard.logs.title',
  'Dashboard.logs.clear',
  'Dashboard.logs.emptyTitle',
  'Dashboard.logs.emptyDescription',
  'Dashboard.logs.type_agent-start',
  'Dashboard.logs.type_agent-complete',
  'Dashboard.logs.type_agent-communication',
  'Dashboard.logs.type_error',
  'Dashboard.logs.tokens',
  'Dashboard.logs.latency',

  // LiveSynthesisPanel keys (Dashboard.synthesis.*)
  'Dashboard.synthesis.title',
  'Dashboard.synthesis.emptyTitle',
  'Dashboard.synthesis.emptyDescription',
  'Dashboard.synthesis.loading',
  'Dashboard.synthesis.updating',
  'Dashboard.synthesis.findingsTitle',
  'Dashboard.synthesis.recommendationsTitle',
  'Dashboard.synthesis.agentsTitle',
  'Dashboard.synthesis.risk_low',
  'Dashboard.synthesis.risk_medium',
  'Dashboard.synthesis.risk_high',
];

const LOCALES = [
  { name: 'en', data: en },
  { name: 'es', data: es },
  { name: 'pt', data: pt },
] as const;

// ── Generator ───────────────────────────────────────────────────────

/** Generates an arbitrary key from the required set */
const arbRequiredKey = fc.constantFrom(...REQUIRED_KEYS);

// ── Property Tests ──────────────────────────────────────────────────

describe('Property 11: Claves de traducción existen para los tres idiomas', () => {
  it('for any required translation key, all 3 locale files contain a non-empty string value', () => {
    fc.assert(
      fc.property(arbRequiredKey, (key) => {
        for (const locale of LOCALES) {
          const value = getNestedValue(locale.data as unknown as Record<string, unknown>, key);
          expect(value, `Key "${key}" missing in ${locale.name}.json`).toBeDefined();
          expect(typeof value, `Key "${key}" in ${locale.name}.json is not a string`).toBe('string');
          expect((value as string).length, `Key "${key}" in ${locale.name}.json is empty`).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 },
    );
  });
});
