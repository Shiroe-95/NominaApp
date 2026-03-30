/**
 * Cliente de traducción usando LibreTranslate.
 * Se usa como fallback cuando una clave de traducción no existe en el idioma destino.
 *
 * Configuración via env vars:
 *   NEXT_PUBLIC_LIBRETRANSLATE_URL - URL de la instancia (default: https://libretranslate.com)
 *   LIBRETRANSLATE_API_KEY - API key (opcional para instancias self-hosted)
 */

const LT_URL = process.env.NEXT_PUBLIC_LIBRETRANSLATE_URL || 'https://libretranslate.com';
const LT_API_KEY = process.env.LIBRETRANSLATE_API_KEY || '';

// In-memory cache to avoid repeated translations
const cache = new Map<string, string>();

function cacheKey(text: string, source: string, target: string): string {
  return `${source}:${target}:${text}`;
}

/**
 * Traduce un texto usando LibreTranslate.
 * Incluye cache en memoria para evitar llamadas repetidas.
 *
 * @param text - Texto a traducir
 * @param source - Código de idioma fuente ('es', 'en', 'pt')
 * @param target - Código de idioma destino ('es', 'en', 'pt')
 * @returns Texto traducido, o el original si falla
 */
export async function translateText(
  text: string,
  source: string,
  target: string,
): Promise<string> {
  if (source === target || !text.trim()) return text;

  const key = cacheKey(text, source, target);
  const cached = cache.get(key);
  if (cached) return cached;

  try {
    const body: Record<string, string> = {
      q: text,
      source,
      target,
      format: 'text',
    };
    if (LT_API_KEY) body.api_key = LT_API_KEY;

    const res = await fetch(`${LT_URL}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) return text;

    const data = await res.json();
    const translated = data.translatedText || text;
    cache.set(key, translated);
    return translated;
  } catch {
    return text;
  }
}

/**
 * Traduce un lote de textos en una sola operación.
 * Útil para traducir múltiples claves de una página de una vez.
 */
export async function translateBatch(
  texts: string[],
  source: string,
  target: string,
): Promise<string[]> {
  if (source === target) return texts;
  return Promise.all(texts.map((t) => translateText(t, source, target)));
}
