import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGroq } from '@ai-sdk/groq';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import type { ProviderConfig } from './types';
import { OPENROUTER_FREE_ROUTER } from './openrouter-models';

// ── Types ───────────────────────────────────────────────────────────

/**
 * A model instance returned by any AI SDK provider.
 * We use a loose type here because the provider packages (v3) return
 * LanguageModelV3 while the `ai` core package still aliases LanguageModel
 * to LanguageModelV1. Both are accepted by generateText / streamText at
 * runtime, so we keep the registry type-agnostic.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyLanguageModel = any;

type ProviderFactory = (apiKey: string) => (modelId: string) => AnyLanguageModel;

// ── Factory map ─────────────────────────────────────────────────────

const providerFactories: Record<ProviderConfig['provider_type'], ProviderFactory> = {
  openai: (apiKey) => {
    const provider = createOpenAI({ apiKey });
    return (modelId) => provider(modelId);
  },
  anthropic: (apiKey) => {
    const provider = createAnthropic({ apiKey });
    return (modelId) => provider(modelId);
  },
  groq: (apiKey) => {
    const provider = createGroq({ apiKey });
    return (modelId) => provider(modelId);
  },
  google: (apiKey) => {
    const provider = createGoogleGenerativeAI({ apiKey });
    return (modelId) => provider(modelId);
  },
  openrouter: (apiKey) => {
    const provider = createOpenRouter({ apiKey });
    return (modelId) => provider.chat(modelId);
  },
};

// ── Registry entry ──────────────────────────────────────────────────

interface RegistryEntry {
  config: ProviderConfig;
  getModel: (modelId: string) => AnyLanguageModel;
}

// ── Build result ────────────────────────────────────────────────────

export interface ProviderRegistryResult {
  /** Get a model from a specific provider by its config id. */
  getModel: (providerId: string, modelId?: string) => AnyLanguageModel;
  /** Try providers in priority order until one succeeds. */
  getModelWithFallback: () => AnyLanguageModel;
  /** All active entries sorted by priority (for fallback iteration). */
  entries: ReadonlyArray<Readonly<RegistryEntry>>;
  /**
   * For OpenRouter providers: get a model using the free router
   * (`openrouter/free`) which auto-selects the best free model.
   */
  getOpenRouterFreeModel: () => AnyLanguageModel | null;
  /**
   * For OpenRouter providers: get a model with a specific alternative model ID.
   * Useful for retrying with a different free model when one fails.
   */
  getOpenRouterModel: (modelId: string) => AnyLanguageModel | null;
}

// ── buildRegistry ───────────────────────────────────────────────────

/**
 * Builds a lightweight provider registry from a list of ProviderConfig objects.
 * Only active configs are included. Entries are sorted by ascending priority.
 */
export function buildRegistry(configs: ProviderConfig[]): ProviderRegistryResult {
  const entries: RegistryEntry[] = configs
    .filter((c) => c.is_active)
    .sort((a, b) => a.priority - b.priority)
    .map((config) => {
      const factory = providerFactories[config.provider_type];
      if (!factory) {
        throw new Error(`Unsupported provider type: ${config.provider_type}`);
      }
      return {
        config,
        getModel: factory(config.api_key),
      };
    });

  function getModel(providerId: string, modelId?: string): AnyLanguageModel {
    const entry = entries.find((e) => e.config.id === providerId);
    if (!entry) {
      throw new Error(`Provider "${providerId}" not found or inactive`);
    }
    return entry.getModel(modelId ?? entry.config.model_id);
  }

  function getModelWithFallback(): AnyLanguageModel {
    if (entries.length === 0) {
      throw new Error('No active AI providers configured');
    }
    // Return the highest-priority (lowest number) model.
    // Actual fallback execution (try/catch loop) lives in fallback.ts.
    const first = entries[0];
    return first.getModel(first.config.model_id);
  }

  function getOpenRouterFreeModel(): AnyLanguageModel | null {
    const orEntry = entries.find((e) => e.config.provider_type === 'openrouter');
    if (!orEntry) return null;
    return orEntry.getModel(OPENROUTER_FREE_ROUTER);
  }

  function getOpenRouterModel(modelId: string): AnyLanguageModel | null {
    const orEntry = entries.find((e) => e.config.provider_type === 'openrouter');
    if (!orEntry) return null;
    return orEntry.getModel(modelId);
  }

  return { getModel, getModelWithFallback, entries, getOpenRouterFreeModel, getOpenRouterModel };
}
