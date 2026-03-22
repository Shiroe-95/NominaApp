/**
 * Middleware de Next.js — Autenticación, autorización por rol e internacionalización.
 *
 * Responsabilidades:
 * 1. Detectar/redirigir el locale del usuario (next-intl).
 * 2. Permitir acceso libre a rutas públicas (landing, pricing, login, etc.).
 * 3. Validar sesión de Supabase para rutas protegidas.
 * 4. Verificar permisos basados en rol (admin, analyst, client).
 *
 * Las constantes ADMIN_ONLY y ANALYST_ONLY definen las restricciones de acceso
 * por rol. Consultar `src/lib/auth/user-profile.ts` para la lógica completa
 * de permisos reutilizable fuera del middleware.
 *
 * @module middleware
 */
import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';

// ─── Configuración ──────────────────────────────────────────────────────────

const LOCALES = routing.locales as readonly string[];
const DEFAULT_LOCALE = routing.defaultLocale;

/** Rutas públicas (sin locale) que no requieren autenticación */
const PUBLIC_PATHS = new Set(['/', '/pricing', '/contact', '/about', '/login']);
const PUBLIC_PREFIXES = ['/login', '/auth'];

/** Rutas restringidas a admin — solo usuarios con rol 'admin' */
const ADMIN_ONLY = ['/admin', '/settings/providers', '/settings/users'];
/** Rutas restringidas a analyst+ — accesibles por 'admin' y 'analyst', no por 'client' */
const ANALYST_ONLY = ['/upload', '/reconcile', '/rules'];

const intlMiddleware = createIntlMiddleware(routing);

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Elimina el prefijo de locale de un pathname.
 *
 * @param pathname - Ruta completa (ej: `/es/upload`)
 * @returns Ruta sin locale (ej: `/upload`). Devuelve `/` si solo queda el prefijo.
 */
function stripLocale(pathname: string): string {
  for (const locale of LOCALES) {
    const prefix = `/${locale}`;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return pathname.slice(prefix.length) || '/';
    }
  }
  return pathname;
}

/**
 * Detecta el locale desde el pathname, con fallback al locale por defecto.
 *
 * @param pathname - Ruta completa (ej: `/en/dashboard`)
 * @returns Código de locale (ej: `en`, `es`, `pt`)
 */
function getLocale(pathname: string): string {
  for (const locale of LOCALES) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale;
    }
  }
  return DEFAULT_LOCALE;
}

/**
 * Determina si una ruta (sin prefijo de locale) es pública.
 *
 * Se consideran públicas las rutas en PUBLIC_PATHS y las que comienzan
 * con alguno de los PUBLIC_PREFIXES (`/login`, `/auth`).
 *
 * @param pathWithoutLocale - Ruta sin locale (ej: `/pricing`)
 * @returns `true` si la ruta no requiere autenticación
 */
function isPublic(pathWithoutLocale: string): boolean {
  if (PUBLIC_PATHS.has(pathWithoutLocale)) return true;
  return PUBLIC_PREFIXES.some((p) => pathWithoutLocale.startsWith(p));
}

type Role = 'admin' | 'analyst' | 'client';

function checkPermission(role: Role, path: string): boolean {
  if (role === 'admin') return true;
  if (ADMIN_ONLY.some((p) => path.startsWith(p))) return false;
  if (role === 'analyst') return true;
  if (ANALYST_ONLY.some((p) => path.startsWith(p))) return false;
  return true;
}

// ─── Auth: crear cliente Supabase en Edge ───────────────────────────────────

function createSupabaseMiddlewareClient(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Actualizar cookies en el request (para que downstream las vea)
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Recrear response con las cookies actualizadas
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  return { supabase, getResponse: () => response };
}

// ─── Role fetch via REST (Edge-compatible, no Node imports) ─────────────────

async function fetchUserRole(userId: string): Promise<Role> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const res = await fetch(
      `${url}/rest/v1/user_profiles?id=eq.${userId}&select=role`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } }
    );

    if (res.ok) {
      const rows = await res.json();
      if (rows.length > 0 && rows[0].role) return rows[0].role as Role;
    }
  } catch {
    // fallback silencioso
  }
  return 'client';
}

// ─── Intl + cookies merge ───────────────────────────────────────────────────

function applyIntl(request: NextRequest, authResponse?: NextResponse): NextResponse {
  const intlResponse = intlMiddleware(request);

  // Copiar cookies de auth (token refresh) al response de intl
  if (intlResponse && authResponse) {
    for (const cookie of authResponse.cookies.getAll()) {
      intlResponse.cookies.set(cookie.name, cookie.value);
    }
  }

  return intlResponse || authResponse || NextResponse.next({ request });
}

// ─── Middleware principal ───────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const pathWithoutLocale = stripLocale(pathname);

  // 1. Rutas públicas → solo intl, sin auth
  if (isPublic(pathWithoutLocale)) {
    return applyIntl(request);
  }

  // 2. Validar sesión Supabase
  const { supabase, getResponse } = createSupabaseMiddlewareClient(request);

  let userId: string | null = null;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // sin sesión
  }

  // 3. Sin sesión → redirect a login con redirectTo
  if (!userId) {
    const locale = getLocale(pathname);
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    // Copiar cookies de auth refresh al redirect
    const redirectResponse = NextResponse.redirect(loginUrl);
    for (const cookie of getResponse().cookies.getAll()) {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    }
    return redirectResponse;
  }

  // 4. Verificar permisos por rol
  const role = await fetchUserRole(userId);

  if (!checkPermission(role, pathWithoutLocale)) {
    const locale = getLocale(pathname);
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, request.url));
  }

  // 5. Autorizado → intl + cookies de auth
  return applyIntl(request, getResponse());
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|auth|.*\\..*).*)'],
};
