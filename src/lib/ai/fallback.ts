import type { ProviderRegistryResult } from './providers';
import type { AnyLanguageModel } from './providers';
import { selectBestFreeModel, OPENROUTER_FREE_ROUTER } from './openrouter-models';

// ── Types ───────────────────────────────────────────────────────────

export interface FallbackOptions {
  agentName: string;
  taskType: string;
  /** Si true (default), para OpenRouter intenta modelos gratuitos alternativos antes de saltar al siguiente proveedor. */
  enableOpenRouterModelFallback?: boolean;
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

// ── OpenRouter model fallback ───────────────────────────────────────

interface EntryLike {
  config: { id: string; provider_type: string; model_id: string };
  getModel: (modelId: string) => AnyLanguageModel;
}

/**
 * Intenta ejecutar la tarea con modelos gratuitos alternativos de OpenRouter.
 * Si el modelo configurado falla, prueba:
 * 1. El router automatico openrouter/free
 * 2. El mejor modelo gratuito disponible segun la API de OpenRouter
 */
async function tryOpenRouterAlternatives<T>(
  entry: EntryLike,
  taskFn: (model: AnyLanguageModel) => Promise<T>,
  originalError: string,
): Promise<{ result: T; modelId: string } | null> {
  const alternativeModels: string[] = [];

  // 1. Try the free router (auto-selects best free model)
  if (entry.config.model_id !== OPENROUTER_FREE_ROUTER) {
    alternativeModels.push(OPENROUTER_FREE_ROUTER);
  }

  // 2. Try dynamically discovered best free model
  try {
    const bestFree = await selectBestFreeModel({ requireToolCalling: true });
    if (bestFree !== entry.config.model_id && !alternativeModels.includes(bestFree)) {
      alternativeModels.push(bestFree);
    }
  } catch {
    // Ignore — we'll try with what we have
  }

  for (const altModelId of alternativeModels) {
    try {
      console.log(
        `[fallback] OpenRouter: retrying with ${altModelId} (original ${entry.config.model_id} failed: ${originalError})`,
      );
      const model = entry.getModel(altModelId);
      const result = await taskFn(model);
      return { result, modelId: altModelId };
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      console.warn(`[fallback] OpenRouter alternative ${altModelId} also failed: ${reason}`);
    }
  }

  return null;
}

// ── executeWithFallback ─────────────────────────────────────────────

/**
 * Tries each provider in priority order until one succeeds.
 * For OpenRouter providers, automatically tries alternative free models
 * before falling back to the next provider.
 * If all providers fail, throws an error with combined info.
 */
export async function executeWithFallback<T>(
  registry: ProviderRegistryResult,
  taskFn: (model: AnyLanguageModel) => Promise<T>,
  options: FallbackOptions,
): Promise<FallbackResult<T>> {
  const { entries } = registry;
  const enableORFallback = options.enableOpenRouterModelFallback !== false;

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

      // For OpenRouter: try alternative free models before moving to next provider
      if (enableORFallback && entry.config.provider_type === 'openrouter') {
        const altResult = await tryOpenRouterAlternatives(entry, taskFn, reason);
        if (altResult) {
          fallbackEvents.push({
            fromProvider: entry.config.id,
            fromProviderType: 'openrouter',
            toProvider: entry.config.id,
            toProviderType: 'openrouter',
            reason: `model_fallback:${entry.config.model_id}->${altResult.modelId} (${reason})`,
          });
          return {
            result: altResult.result,
            providerUsed: entry.config.id,
            providerType: 'openrouter',
            modelId: altResult.modelId,
            fallbackEvents,
            latencyMs: Date.now() - startTime,
          };
        }
      }

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