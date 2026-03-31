/**
 * OpenRouter Dynamic Model Discovery & Smart Selection
 *
 * Consulta la API pública de OpenRouter para obtener modelos gratuitos
 * disponibles en tiempo real y selecciona el mejor según la tarea.
 *
 * Features:
 * - Cache en memoria con TTL de 10 minutos
 * - Ranking por capacidades (tool calling, context window, etc.)
 * - Fallback al router `openrouter/free` si la consulta falla
 *
 * @see https://openrouter.ai/docs/guides/routing/routers/free-models-router
 * @module lib/ai/openrouter-models
 */

// ── Types ───────────────────────────────────────────────────────────

export interface OpenRouterModel {
  id: string;
  name: string;
  contextLength: number;
  supportsToolCalling: boolean;
  supportsStreaming: boolean;
  isFree: boolean;
}

interface OpenRouterApiModel {
  id: string;
  name: string;
  context_length: number;
  pricing: { prompt: string; completion: string };
  supported_parameters?: string[];
  description?: string;
}

interface ModelCache {
  models: OpenRouterModel[];
  fetchedAt: number;
}

// ── Constants ───────────────────────────────────────────────────────

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/models';
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

/**
 * Modelo router especial de OpenRouter que selecciona automáticamente
 * un modelo gratuito compatible con las capacidades requeridas.
 */
export const OPENROUTER_FREE_ROUTER = 'openrouter/free';

/**
 * Modelos gratuitos conocidos como fallback estático cuando la API
 * no está disponible. Ordenados por calidad estimada.
 */
const KNOWN_FREE_MODELS: OpenRouterModel[] = [
  { id: 'google/gemini-2.5-flash:free', name: 'Gemini 2.5 Flash', contextLength: 1_000_000, supportsToolCalling: true, supportsStreaming: true, isFree: true },
  { id: 'deepseek/deepseek-chat-v3-0324:free', name: 'DeepSeek V3', contextLength: 65_536, supportsToolCalling: true, supportsStreaming: true, isFree: true },
  { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1', contextLength: 65_536, supportsToolCalling: false, supportsStreaming: true, isFree: true },
  { id: 'meta-llama/llama-4-maverick:free', name: 'Llama 4 Maverick', contextLength: 1_000_000, supportsToolCalling: true, supportsStreaming: true, isFree: true },
  { id: 'qwen/qwen3-235b-a22b:free', name: 'Qwen 3 235B', contextLength: 40_960, supportsToolCalling: true, supportsStreaming: true, isFree: true },
];

// ── Cache ───────────────────────────────────────────────────────────

let modelCache: ModelCache | null = null;

// ── Functions ───────────────────────────────────────────────────────

/**
 * Consulta la API de OpenRouter para obtener todos los modelos gratuitos
 * disponibles. Usa cache en memoria con TTL de 10 minutos.
 */
export async function fetchFreeModels(): Promise<OpenRouterModel[]> {
  // Return cached if fresh
  if (modelCache && Date.now() - modelCache.fetchedAt < CACHE_TTL_MS) {
    return modelCache.models;
  }

  try {
    const res = await fetch(OPENROUTER_API_URL, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn(`[openrouter-models] API returned ${res.status}, using static fallback`);
      return KNOWN_FREE_MODELS;
    }

    const json = await res.json() as { data: OpenRouterApiModel[] };
    const allModels = json.data ?? [];

    // Filter free models (pricing.prompt === "0" and pricing.completion === "0")
    const freeModels: OpenRouterModel[] = allModels
      .filter((m) => m.pricing?.prompt === '0' && m.pricing?.completion === '0')
      .map((m) => ({
        id: m.id,
        name: m.name,
        contextLength: m.context_length ?? 0,
        supportsToolCalling: m.supported_parameters?.includes('tools') ?? false,
        supportsStreaming: true,
        isFree: true,
      }))
      .sort((a, b) => b.contextLength - a.contextLength);

    modelCache = { models: freeModels, fetchedAt: Date.now() };
    console.log(`[openrouter-models] Cached ${freeModels.length} free models`);
    return freeModels;
  } catch (err) {
    console.warn('[openrouter-models] Failed to fetch models, using static fallback:', err);
    return KNOWN_FREE_MODELS;
  }
}

/**
 * Selecciona el mejor modelo gratuito de OpenRouter para una tarea dada.
 *
 * Criterios de selección:
 * 1. Si la tarea requiere tool calling, filtra modelos que lo soporten
 * 2. Prioriza modelos con mayor ventana de contexto
 * 3. Si no hay modelos disponibles, retorna el router `openrouter/free`
 */
export async function selectBestFreeModel(options?: {
  requireToolCalling?: boolean;
  minContextLength?: number;
}): Promise<string> {
  const { requireToolCalling = false, minContextLength = 0 } = options ?? {};

  const models = await fetchFreeModels();

  let candidates = models;

  if (requireToolCalling) {
    const withTools = candidates.filter((m) => m.supportsToolCalling);
    if (withTools.length > 0) candidates = withTools;
  }

  if (minContextLength > 0) {
    const withContext = candidates.filter((m) => m.contextLength >= minContextLength);
    if (withContext.length > 0) candidates = withContext;
  }

  if (candidates.length === 0) {
    // Fallback: use OpenRouter's built-in free router
    return OPENROUTER_FREE_ROUTER;
  }

  // Return the best candidate (already sorted by context length desc)
  return candidates[0].id;
}

/** Invalida el cache de modelos (útil para testing o refresh manual). */
export function invalidateModelCache(): void {
  modelCache = null;
}
