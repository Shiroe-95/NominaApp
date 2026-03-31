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
import { z, ZodError } from 'zod';
import { randomUUID } from 'crypto';
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

// ─── Standard API Error Format (Requirement 6) ─────────────────────────────

/**
 * Standard error response format for all API endpoints.
 * Every error response must conform to this interface.
 */
export interface ApiErrorResponse {
  error: string;
  code: string;
  details?: Record<string, unknown>;
  requestId: string;
}

/** Standard error codes used across all API endpoints */
export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

/**
 * Creates a standard API error response object.
 *
 * @param code - Error code (e.g. 'VALIDATION_ERROR', 'UNAUTHORIZED')
 * @param message - Human-readable error message
 * @param details - Optional additional details (field errors, required role, etc.)
 * @param requestId - Optional request ID; generates a new UUID v4 if not provided
 * @returns ApiErrorResponse conforming to the standard format
 */
export function createApiError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
  requestId?: string,
): ApiErrorResponse {
  const response: ApiErrorResponse = {
    error: message,
    code,
    requestId: requestId ?? randomUUID(),
  };
  if (details !== undefined) {
    response.details = details;
  }
  return response;
}

/**
 * Maps an ApiErrorCode to its corresponding HTTP status code.
 */
function errorCodeToStatus(code: string): number {
  switch (code) {
    case 'VALIDATION_ERROR': return 400;
    case 'UNAUTHORIZED': return 401;
    case 'FORBIDDEN': return 403;
    case 'NOT_FOUND': return 404;
    case 'RATE_LIMITED': return 429;
    case 'INTERNAL_ERROR': return 500;
    default: return 500;
  }
}

/**
 * Wraps an API route handler with consistent error handling.
 *
 * - Generates a unique `X-Request-Id` (UUID v4) for every response
 * - Catches all unhandled exceptions and returns a 500 with standard format (no stack traces)
 * - Handles ZodError as 400 VALIDATION_ERROR with field details
 * - Injects the requestId into the handler context
 *
 * @param handler - Async function receiving (req, context) where context includes requestId
 * @returns Wrapped Next.js route handler
 */
export function withApiHandler(
  handler: (
    req: Request,
    context: { params?: Record<string, string>; requestId: string },
  ) => Promise<NextResponse>,
) {
  return async (
    req: Request,
    routeContext?: { params?: Record<string, string> },
  ): Promise<NextResponse> => {
    const requestId = randomUUID();
    const headers: Record<string, string> = { 'X-Request-Id': requestId };

    try {
      const response = await handler(req, {
        params: routeContext?.params,
        requestId,
      });

      // Ensure X-Request-Id is on every response (including success)
      response.headers.set('X-Request-Id', requestId);
      return response;
    } catch (err) {
      // Zod validation errors → 400 VALIDATION_ERROR
      if (err instanceof ZodError) {
        const fieldErrors = err.errors.map((e: { path: (string | number)[]; message: string; code: string }) => ({
          path: e.path.join('.'),
          message: e.message,
          code: e.code,
        }));
        const body = createApiError(
          'VALIDATION_ERROR',
          'Request validation failed',
          { fields: fieldErrors },
          requestId,
        );
        return NextResponse.json(body, { status: 400, headers });
      }

      // All other exceptions → 500 INTERNAL_ERROR (no stack traces)
      console.error(`[API Error] requestId=${requestId}`, err);
      const body = createApiError(
        'INTERNAL_ERROR',
        'An internal error occurred',
        undefined,
        requestId,
      );
      return NextResponse.json(body, { status: 500, headers });
    }
  };
}

/**
 * Creates a NextResponse with standard error format and X-Request-Id header.
 * Convenience helper for use inside withApiHandler-wrapped routes.
 *
 * @param code - Error code (e.g. 'UNAUTHORIZED', 'FORBIDDEN')
 * @param message - Human-readable error message
 * @param requestId - The request ID from the handler context
 * @param details - Optional additional details
 * @param extraHeaders - Optional extra headers (e.g. Retry-After)
 * @returns NextResponse with standard error body and headers
 */
export function apiErrorResponse(
  code: string,
  message: string,
  requestId: string,
  details?: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
): NextResponse {
  const body = createApiError(code, message, details, requestId);
  const status = errorCodeToStatus(code);
  const headers: Record<string, string> = {
    'X-Request-Id': requestId,
    ...extraHeaders,
  };
  return NextResponse.json(body, { status, headers });
}

// ─── Respuestas estándar ────────────────────────────────────────────────────

function rateLimitResponse(resetAt: number, config?: RateLimitConfig) {
  const retryAfter = Math.ceil((resetAt - Date.now()) / 1000);
  const requestId = randomUUID();
  const body = createApiError('RATE_LIMITED', 'Too many requests', {
    retryAfter,
    ...(config ? { limit: config.limit, windowSeconds: config.windowSeconds } : {}),
  }, requestId);
  return NextResponse.json(body, {
    status: 429,
    headers: {
      'Retry-After': String(retryAfter),
      'X-Request-Id': requestId,
    },
  });
}

function unauthorizedResponse(msg = 'Unauthorized') {
  const requestId = randomUUID();
  const body = createApiError('UNAUTHORIZED', msg, undefined, requestId);
  return NextResponse.json(body, {
    status: 401,
    headers: { 'X-Request-Id': requestId },
  });
}

function forbiddenResponse(msg = 'Forbidden', details?: Record<string, unknown>) {
  const requestId = randomUUID();
  const body = createApiError('FORBIDDEN', msg, details, requestId);
  return NextResponse.json(body, {
    status: 403,
    headers: { 'X-Request-Id': requestId },
  });
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
    return rateLimitResponse(result.resetAt, config);
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
  if (ctx.role !== 'admin') return forbiddenResponse('Admin access required', { requiredRole: 'admin' });
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
    return forbiddenResponse('Analyst or admin access required', { requiredRole: ['admin', 'analyst'] });
  }
  return ctx;
}

// ─── Zod Schemas for Input Validation ────────────────────────────────────────

/** Zod schema para UUID v4 */
export const UuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  'Invalid UUID format',
);

/** Zod schema para código de país ISO 3166-1 alpha-2 */
export const CountryCodeSchema = z.string().regex(
  /^[A-Z]{2}$/,
  'Invalid country code',
);

/** Zod schema para email con TLD mínimo 2 chars */
export const EmailSchema = z.string()
  .max(254)
  .regex(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/, 'Invalid email format');

// ─── Input sanitization ─────────────────────────────────────────────────────

/**
 * Valida que un string sea un UUID v4 válido usando Zod.
 *
 * @param value - String a validar.
 * @returns `true` si cumple el formato UUID v4.
 */
export function isValidUuid(value: string): boolean {
  return UuidSchema.safeParse(value).success;
}

/**
 * Valida código de país ISO 3166-1 alpha-2 (ej. `'CO'`, `'US'`) usando Zod.
 *
 * @param value - String a validar (se convierte a mayúsculas internamente).
 * @returns `true` si cumple el formato de 2 letras mayúsculas.
 */
export function isValidCountryCode(value: string): boolean {
  return CountryCodeSchema.safeParse(value.toUpperCase()).success;
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
 * Sanitiza un email: lowercase, trim, validación de formato con Zod + TLD mínimo 2 chars.
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
  if (!EmailSchema.safeParse(email).success) return null;
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
export type { RateLimitConfig } from './rate-limit';
