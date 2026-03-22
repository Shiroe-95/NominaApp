/**
 * Rate limiter con soporte distribuido (Upstash Redis) y fallback in-memory.
 *
 * ## Comportamiento:
 * - Si `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` están configurados,
 *   usa Redis para rate limiting distribuido (compatible con Vercel serverless).
 * - Si no, usa un store in-memory (funcional para single-instance).
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
 * @module lib/api/rate-limit
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// ─── In-memory store (fallback) ─────────────────────────────────────────────

const memoryStore = new Map<string, RateLimitEntry>();

if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore) {
      if (now > entry.resetAt) memoryStore.delete(key);
    }
  }, 60_000);
}

// ─── Upstash Redis client (lazy init) ───────────────────────────────────────

interface UpstashConfig {
  url: string;
  token: string;
}

function getUpstashConfig(): UpstashConfig | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return { url, token };
  return null;
}

/**
 * Execute an Upstash Redis REST command.
 * Uses the HTTP REST API so no npm dependency is needed.
 */
async function upstashCommand(
  config: UpstashConfig,
  command: string[],
): Promise<{ result: unknown }> {
  const res = await fetch(`${config.url}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!res.ok) throw new Error(`Upstash error: ${res.status}`);
  return res.json() as Promise<{ result: unknown }>;
}

// ─── Config & presets ───────────────────────────────────────────────────────

export interface RateLimitConfig {
  /** Máximo de requests permitidos en la ventana */
  limit: number;
  /** Duración de la ventana en segundos */
  windowSeconds: number;
}

/** Presets por tipo de endpoint */
export const RATE_LIMITS = {
  auth: { limit: 10, windowSeconds: 60 },
  ai: { limit: 20, windowSeconds: 60 },
  aiChat: { limit: 30, windowSeconds: 60 },
  adminWrite: { limit: 30, windowSeconds: 60 },
  read: { limit: 60, windowSeconds: 60 },
  write: { limit: 40, windowSeconds: 60 },
  cron: { limit: 5, windowSeconds: 60 },
} as const;

// ─── IP extraction ──────────────────────────────────────────────────────────

/**
 * Extrae la IP del cliente desde los headers del request.
 * Prioriza `x-forwarded-for` (proxies/load balancers), luego `x-real-ip`.
 *
 * @param req - Request HTTP entrante
 * @returns Dirección IP del cliente, o `'unknown'` si no se puede determinar
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

// ─── Rate limit result ──────────────────────────────────────────────────────

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ─── In-memory check ────────────────────────────────────────────────────────

function checkRateLimitMemory(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const entry = memoryStore.get(key);

  if (!entry || now > entry.resetAt) {
    memoryStore.set(key, { count: 1, resetAt: now + config.windowSeconds * 1000 });
    return { allowed: true, remaining: config.limit - 1, resetAt: now + config.windowSeconds * 1000 };
  }

  entry.count++;

  if (entry.count > config.limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  return { allowed: true, remaining: config.limit - entry.count, resetAt: entry.resetAt };
}

// ─── Redis check (sliding window via INCR + EXPIRE) ─────────────────────────

async function checkRateLimitRedis(
  key: string,
  config: RateLimitConfig,
  upstash: UpstashConfig,
): Promise<RateLimitResult> {
  const redisKey = `rl:${key}`;
  const now = Date.now();

  try {
    // INCR atomically increments and returns the new count
    const incrRes = await upstashCommand(upstash, ['INCR', redisKey]);
    const count = Number(incrRes.result);

    // If this is the first request in the window, set expiry
    if (count === 1) {
      await upstashCommand(upstash, ['EXPIRE', redisKey, String(config.windowSeconds)]);
    }

    if (count > config.limit) {
      // Get TTL to calculate resetAt
      const ttlRes = await upstashCommand(upstash, ['TTL', redisKey]);
      const ttl = Number(ttlRes.result);
      return { allowed: false, remaining: 0, resetAt: now + ttl * 1000 };
    }

    return {
      allowed: true,
      remaining: config.limit - count,
      resetAt: now + config.windowSeconds * 1000,
    };
  } catch {
    // Redis unavailable — fallback to in-memory
    return checkRateLimitMemory(key, config);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Verifica si un request está dentro del rate limit.
 * Usa Redis (Upstash) si está configurado, in-memory como fallback.
 *
 * @param key - Identificador único del rate limit (ej: `"ai:192.168.1.1"`)
 * @param config - Configuración con `limit` y `windowSeconds`
 * @returns Resultado con `allowed`, `remaining` y `resetAt` (timestamp ms)
 */
export async function checkRateLimit(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
  const upstash = getUpstashConfig();
  if (upstash) {
    return checkRateLimitRedis(key, config, upstash);
  }
  return checkRateLimitMemory(key, config);
}

/**
 * Versión síncrona para compatibilidad con código existente.
 * Solo usa in-memory store (no Redis).
 *
 * @param key - Identificador único del rate limit
 * @param config - Configuración con `limit` y `windowSeconds`
 * @returns Resultado con `allowed`, `remaining` y `resetAt` (timestamp ms)
 */
export function checkRateLimitSync(key: string, config: RateLimitConfig): RateLimitResult {
  return checkRateLimitMemory(key, config);
}
