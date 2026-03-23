/**
 * Guard centralizado para API routes.
 *
 * Provee: autenticación, autorización por rol, rate limiting,
 * sanitización de input y helpers de respuesta.
 *
 * ## Uso típico en una API route:
 * ```ts
 * export async function GET(req: Request) {
 *   const rl = await applyRateLimit(req, 'my-route', RATE_LIMITS.read);
 *   if (rl) return rl;
 *
 *   const auth = await requireAuth();
 *   if (auth instanceof NextResponse) return auth;
 *
 *   // auth.userId disponible aquí
 * }
 * ```
 *
 * ## Funciones de autenticación:
 * - `requireAuth()` — Verifica sesión Supabase, retorna `{ userId }` o 401.
 * - `requireAuthWithRole()` — Verifica sesión + obtiene rol desde `user_profiles`, retorna `AuthContext` o 401.
 * - `requireAdmin()` — Verifica sesión + rol admin, retorna `AuthContext` o 401/403.
 * - `requireAnalystOrAdmin()` — Verifica sesión + rol admin o analyst, retorna `AuthContext` o 401/403.
 *
 * ## Funciones de sanitización:
 * - `sanitizeString(value, maxLength)` — Trim, limita longitud, elimina caracteres de control.
 * - `sanitizeEmail(value)` — Lowercase, trim, validación de formato con TLD mínimo 2 chars.
 * - `sanitizeNumber(value, min, max)` — Parsea y valida rango numérico.
 * - `sanitizeStringArray(value, maxItems, maxItemLength)` — Sanitiza array de strings.
 * - `isValidUuid(value)` — Valida formato UUID v4.
 * - `isValidCountryCode(value)` — Valida código ISO 3166-1 alpha-2.
 *
 * @module lib/api/guard
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { type UserRole } from '@/lib/auth/user-profile';
import {
  checkRateLimit,
  checkRateLimitSync,
  getClientIp,
  RATE_LIMITS,
  type RateLimitConfig,
} from './rate-limit';

type Role = UserRole;

export interface AuthContext {
  userId: string;
  role: Role;
}

// ─── Respuestas estándar ────────────────────────────────────────────────────

function rateLimitResponse(resetAt: number) {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  return NextResponse.json(
    { error: 'Too many requests' },
    {
      status: 429,
      headers: { 'Retry-After': String(retryAfter) },
    },
  );
}

function unauthorizedResponse(msg = 'Unauthorized') {
  return NextResponse.json({ error: msg }, { status: 401 });
}

function forbiddenResponse(msg = 'Forbidden') {
  return NextResponse.json({ error: msg }, { status: 403 });
}

// ─── Rate limit check ───────────────────────────────────────────────────────

/**
 * Aplica rate limiting a un request.
 *
 * Usa Redis distribuido (Upstash) si está configurado, o in-memory como fallback.
 *
 * @param req - Request entrante (se extrae la IP del header `x-forwarded-for`).
 * @param routeKey - Identificador de la ruta (ej. `'actions'`, `'ai-chat'`).
 * @param config - Configuración de límite; por defecto `RATE_LIMITS.read` (60 req/min).
 * @returns `NextResponse` 429 con header `Retry-After` si excede el límite, o `null` si está permitido.
 */
export async function applyRateLimit(
  req: Request,
  routeKey: string,
  config: RateLimitConfig = RATE_LIMITS.read,
): Promise<NextResponse | null> {
  const ip = getClientIp(req);
  const key = `${ip}:${routeKey}`;
  const result = await checkRateLimit(key, config);

  if (!result.allowed) {
    return rateLimitResponse(result.resetAt);
  }
  return null;
}

// ─── Auth check ─────────────────────────────────────────────────────────────

/**
 * Verifica autenticación del usuario via Supabase session.
 *
 * @returns `{ userId: string }` si la sesión es válida, o `NextResponse` 401 en caso contrario.
 */
export async function requireAuth(
): Promise<{ userId: string } | NextResponse> {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) return unauthorizedResponse();
    return { userId: user.id };
  } catch {
    return unauthorizedResponse();
  }
}

/**
 * Verifica autenticación y obtiene el rol del usuario desde `user_profiles`.
 *
 * Si no existe perfil, asigna rol `'client'` por defecto.
 *
 * @returns `AuthContext` con `userId` y `role`, o `NextResponse` 401.
 */
export async function requireAuthWithRole(
): Promise<AuthContext | NextResponse> {
  const authResult = await requireAuth();
  if (authResult instanceof NextResponse) return authResult;

  const admin = createAdminClient();
  const { data } = await admin
    .from('user_profiles')
    .select('role')
    .eq('id', authResult.userId)
    .single();

  const role: Role = (data?.role as Role) ?? 'client';
  return { userId: authResult.userId, role };
}

/**
 * Verifica que el usuario tenga rol `admin`.
 *
 * @returns `AuthContext` si es admin, `NextResponse` 401 (sin sesión) o 403 (sin permisos).
 */
export async function requireAdmin(
): Promise<AuthContext | NextResponse> {
  const ctx = await requireAuthWithRole();
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role !== 'admin') return forbiddenResponse('Admin access required');
  return ctx;
}

/**
 * Verifica que el usuario tenga rol `admin` o `analyst`.
 *
 * @returns `AuthContext` si cumple, `NextResponse` 401 (sin sesión) o 403 (sin permisos).
 */
export async function requireAnalystOrAdmin(
): Promise<AuthContext | NextResponse> {
  const ctx = await requireAuthWithRole();
  if (ctx instanceof NextResponse) return ctx;
  if (ctx.role !== 'admin' && ctx.role !== 'analyst') {
    return forbiddenResponse('Analyst or admin access required');
  }
  return ctx;
}

// ─── Input sanitization ─────────────────────────────────────────────────────

/** Regex para validar UUID v4 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Valida que un string sea un UUID v4 válido.
 *
 * @param value - String a validar.
 * @returns `true` si cumple el formato UUID v4.
 */
export function isValidUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Regex para código de país ISO 3166-1 alpha-2 */
const COUNTRY_CODE_RE = /^[A-Z]{2}$/;

/**
 * Valida código de país ISO 3166-1 alpha-2 (ej. `'CO'`, `'US'`).
 *
 * @param value - String a validar (se convierte a mayúsculas internamente).
 * @returns `true` si cumple el formato de 2 letras mayúsculas.
 */
export function isValidCountryCode(value: string): boolean {
  return COUNTRY_CODE_RE.test(value.toUpperCase());
}

/**
 * Sanitiza un string: trim, limita longitud, elimina caracteres de control.
 *
 * @param value - Valor a sanitizar (si no es string retorna `''`).
 * @param maxLength - Longitud máxima permitida (por defecto 500).
 * @returns String sanitizado.
 */
export function sanitizeString(value: unknown, maxLength = 500): string {
  if (typeof value !== 'string') return '';
  return value
    .trim()
    .slice(0, maxLength)
    // Eliminar caracteres de control excepto newline y tab
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

/**
 * Sanitiza un email: lowercase, trim, validación de formato con TLD mínimo de 2 caracteres.
 *
 * La validación exige el patrón `usuario@dominio.tld` donde el TLD debe ser
 * al menos 2 caracteres alfabéticos (rechaza TLDs de un solo carácter).
 *
 * @param value - Valor a sanitizar.
 * @returns Email sanitizado o `null` si el formato no es válido.
 */
export function sanitizeEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim().toLowerCase().slice(0, 254);
  // Validación de formato: usuario@dominio.tld (TLD mínimo 2 chars)
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(email)) return null;
  return email;
}

/**
 * Sanitiza un valor numérico: parsea y valida rango.
 *
 * @param value - Valor a convertir a número.
 * @param min - Mínimo permitido (opcional).
 * @param max - Máximo permitido (opcional).
 * @returns Número válido dentro del rango, o `null`.
 */
export function sanitizeNumber(value: unknown, min?: number, max?: number): number | null {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (min !== undefined && num < min) return null;
  if (max !== undefined && num > max) return null;
  return num;
}

/**
 * Sanitiza un array de strings: filtra no-strings, limita cantidad e items.
 *
 * @param value - Valor a sanitizar (si no es array retorna `[]`).
 * @param maxItems - Cantidad máxima de elementos (por defecto 100).
 * @param maxItemLength - Longitud máxima por elemento (por defecto 500).
 * @returns Array de strings sanitizados.
 */
export function sanitizeStringArray(value: unknown, maxItems = 100, maxItemLength = 500): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .slice(0, maxItems)
    .filter((item): item is string => typeof item === 'string')
    .map((item) => sanitizeString(item, maxItemLength));
}

// ─── Re-exports ─────────────────────────────────────────────────────────────

export { RATE_LIMITS } from './rate-limit';
