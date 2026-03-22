/**
 * Rate limiter in-memory para API routes de Next.js.
 *
 * Implementa un sliding window por IP con limpieza periódica de entradas expiradas.
 *
 * ## Presets disponibles (`RATE_LIMITS`):
 * | Preset       | Límite | Ventana | Uso                          |
 * |-------------|--------|---------|------------------------------|
 * | `auth`      | 10/min | 60s     | Login, auth callback         |
 * | `ai`        | 20/min | 60s     | Endpoints de IA (costosos)   |
 * | `aiChat`    | 30/min | 60s     | Chat AI conversacional       |
 * | `adminWrite`| 30/min | 60s     | Escrituras admin             |
 * | `read`      | 60/min | 60s     | Lecturas generales           |
 * | `write`     | 40/min | 60s     | Escrituras generales         |
 * | `cron`      | 5/min  | 60s     | Sync/cron (muy restrictivo)  |
 *
 * ## Nota de producción:
 * En producción con múltiples instancias (Vercel serverless), este rate limiter
 * in-memory no comparte estado entre instancias. Para rate limiting distribuido,
 * reemplazar por Redis (Upstash) o similar.
 *
 * @module lib/api/rate-limit
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Limpieza periódica de entradas expiradas (cada 60s)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now > entry.resetAt) store.delete(key);
    }
  }, 60_000);
}

/**
 * Configuración de rate limiting para un endpoint.
 */
export interface RateLimitConfig {
  /** Máximo de requests permitidos en la ventana */
  limit: number;
  /** Duración de la ventana en segundos */
  windowSeconds: number;
}

/** Presets por tipo de endpoint */
export const RATE_LIMITS = {
  /** Login, auth callback */
  auth: { limit: 10, windowSeconds: 60 },
  /** Endpoints de AI (costosos) */
  ai: { limit: 20, windowSeconds: 60 },
  /** Chat AI */
  aiChat: { limit: 30, windowSeconds: 60 },
  /** Escrituras admin */
  adminWrite: { limit: 30, windowSeconds: 60 },
  /** Lecturas generales */
  read: { limit: 60, windowSeconds: 60 },
  /** Escrituras generales */
  write: { limit: 40, windowSeconds: 60 },
  /** Sync/cron (muy restrictivo) */
  cron: { limit: 5, windowSeconds: 60 },
} as const;

/**
 * Extrae la IP del cliente desde los headers del request.
 * Prioriza `x-forwarded-for` (Vercel/proxy), luego `x-real-ip`,
 * y usa `'unknown'` como fallback.
 *
 * @param req - Objeto Request de la API route.
 * @returns La dirección IP del cliente como string.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

/**
 * Verifica si un request está dentro del rate limit.
 *
 * @param key - Identificador único (normalmente `${ip}:${routePrefix}`)
 * @param config - Configuración de límite
 * @returns Resultado con allowed, remaining y resetAt
 */
export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    // Nueva ventana
    store.set(key, { count: 1, resetAt: now + config.windowSeconds * 1000 });
    return { allowed: true, remaining: config.limit - 1, resetAt: now + config.windowSeconds * 1000 };
  }

  entry.count++;

  if (entry.count > config.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: config.limit - entry.count, resetAt: entry.resetAt };
}
