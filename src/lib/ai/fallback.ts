import type { ProviderRegistryResult } from './providers';
import type { AnyLanguageModel } from './providers';

// ── Types ───────────────────────────────────────────────────────────

export interface FallbackOptions {
  agentName: string;
  taskType: string;
}

export interface FallbackEvent {
  fromProvider: string;
  fromProviderType: string;
  toProvider: string;
  toProviderType: string;
  reason: string;
}

export interface FallbackResult<T> {
  result: T;
  providerUsed: string;
  providerType: string;
  modelId: string;
  fallbackEvents: FallbackEvent[];
  latencyMs: number;
}

// ── executeWithFallback ─────────────────────────────────────────────

/**
 * Tries each provider in priority order until one succeeds.
 * On failure, logs the fallback event and moves to the next provider.
 * If all providers fail, throws an error with combined info.
 */
export async function executeWithFallback<T>(
  registry: ProviderRegistryResult,
  taskFn: (model: AnyLanguageModel) => Promise<T>,
  options: FallbackOptions,
): Promise<FallbackResult<T>> {
  const { entries } = registry;

  if (entries.length === 0) {
    throw new Error('No active AI providers configured');
  }

  const fallbackEvents: FallbackEvent[] = [];
  const errors: Array<{ providerId: string; error: unknown }> = [];
  const startTime = Date.now();

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const model = entry.getModel(entry.config.model_id);

    try {
      const result = await taskFn(model);
      return {
        result,
        providerUsed: entry.config.id,
        providerType: entry.config.provider_type,
        modelId: entry.config.model_id,
        fallbackEvents,
        latencyMs: Date.now() - startTime,
      };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      errors.push({ providerId: entry.config.id, error: err });

      // If there's a next provider, record the fallback event
      if (i + 1 < entries.length) {
        const next = entries[i + 1];
        fallbackEvents.push({
          fromProvider: entry.config.id,
          fromProviderType: entry.config.provider_type,
          toProvider: next.config.id,
          toProviderType: next.config.provider_type,
          reason,
        });
      }
    }
  }

  // All providers failed
  const summary = errors
    .map((e) => `${e.providerId}: ${e.error instanceof Error ? e.error.message : String(e.error)}`)
    .join('; ');

  throw new Error(
    `All AI providers failed for ${options.agentName}/${options.taskType}. Errors: ${summary}`,
  );
}
