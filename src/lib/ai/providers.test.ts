import { describe, it, expect, vi } from 'vitest';
import type { ProviderConfig } from './types';

// Mock all AI SDK provider packages to avoid zod ESM resolution issues.
// Each factory returns a function that, given a modelId, returns a fake model object.
const mockModel = (provider: string, modelId: string) => ({
  provider,
  modelId,
  specificationVersion: 'v1',
});

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: ({ apiKey }: { apiKey: string }) =>
    (modelId: string) => mockModel('openai', modelId),
}));
vi.mock('@ai-sdk/anthropic', () => ({
  createAnthropic: ({ apiKey }: { apiKey: string }) =>
    (modelId: string) => mockModel('anthropic', modelId),
}));
vi.mock('@ai-sdk/groq', () => ({
  createGroq: ({ apiKey }: { apiKey: string }) =>
    (modelId: string) => mockModel('groq', modelId),
}));
vi.mock('@ai-sdk/google', () => ({
  createGoogleGenerativeAI: ({ apiKey }: { apiKey: string }) =>
    (modelId: string) => mockModel('google', modelId),
}));
vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: ({ apiKey }: { apiKey: string }) =>
    (modelId: string) => mockModel('openrouter', modelId),
}));

// Import after mocks are set up
const { buildRegistry } = await import('./providers');

function makeConfig(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
  return {
    id: 'test-1',
    provider_type: 'openai',
    api_key: 'sk-test-key-1234567890',
    model_id: 'gpt-4o-mini',
    display_name: 'Test OpenAI',
    priority: 0,
    is_active: true,
    ...overrides,
  };
}

describe('buildRegistry', () => {
  it('filters out inactive providers', () => {
    const configs: ProviderConfig[] = [
      makeConfig({ id: 'a', is_active: true }),
      makeConfig({ id: 'b', is_active: false }),
      makeConfig({ id: 'c', is_active: true }),
    ];
    const registry = buildRegistry(configs);
    expect(registry.entries).toHaveLength(2);
    expect(registry.entries.map((e) => e.config.id)).toEqual(['a', 'c']);
  });

  it('sorts entries by ascending priority', () => {
    const configs: ProviderConfig[] = [
      makeConfig({ id: 'low', priority: 10 }),
      makeConfig({ id: 'high', priority: 1 }),
      makeConfig({ id: 'mid', priority: 5 }),
    ];
    const registry = buildRegistry(configs);
    expect(registry.entries.map((e) => e.config.id)).toEqual(['high', 'mid', 'low']);
  });

  it('getModel throws for unknown provider id', () => {
    const registry = buildRegistry([makeConfig({ id: 'known' })]);
    expect(() => registry.getModel('unknown')).toThrow('not found');
  });

  it('getModel returns a model for a known provider', () => {
    const registry = buildRegistry([makeConfig({ id: 'p1', model_id: 'gpt-4o' })]);
    const model = registry.getModel('p1');
    expect(model).toMatchObject({ provider: 'openai', modelId: 'gpt-4o' });
  });

  it('getModel uses custom modelId when provided', () => {
    const registry = buildRegistry([makeConfig({ id: 'p1', model_id: 'gpt-4o' })]);
    const model = registry.getModel('p1', 'gpt-4o-mini');
    expect(model).toMatchObject({ provider: 'openai', modelId: 'gpt-4o-mini' });
  });

  it('getModelWithFallback throws when no active providers', () => {
    const registry = buildRegistry([]);
    expect(() => registry.getModelWithFallback()).toThrow('No active AI providers');
  });

  it('getModelWithFallback returns the highest-priority model', () => {
    const configs: ProviderConfig[] = [
      makeConfig({ id: 'secondary', priority: 2, model_id: 'model-b' }),
      makeConfig({ id: 'primary', priority: 1, model_id: 'model-a' }),
    ];
    const registry = buildRegistry(configs);
    const model = registry.getModelWithFallback();
    expect(model).toMatchObject({ provider: 'openai', modelId: 'model-a' });
    expect(registry.entries[0].config.id).toBe('primary');
  });

  it('supports all five provider types', () => {
    const types: ProviderConfig['provider_type'][] = [
      'openai', 'anthropic', 'groq', 'google', 'openrouter',
    ];
    for (const type of types) {
      const registry = buildRegistry([
        makeConfig({ id: type, provider_type: type, model_id: 'test-model' }),
      ]);
      expect(registry.entries).toHaveLength(1);
      const model = registry.getModel(type);
      expect(model).toMatchObject({ provider: type, modelId: 'test-model' });
    }
  });

  it('handles mixed active/inactive with correct priority order', () => {
    const configs: ProviderConfig[] = [
      makeConfig({ id: 'a', priority: 3, is_active: true }),
      makeConfig({ id: 'b', priority: 1, is_active: false }),
      makeConfig({ id: 'c', priority: 2, is_active: true }),
      makeConfig({ id: 'd', priority: 0, is_active: true }),
    ];
    const registry = buildRegistry(configs);
    expect(registry.entries.map((e) => e.config.id)).toEqual(['d', 'c', 'a']);
  });
});
