/**
 * Middleware de Next.js — Autenticación, autorización por rol e internacionalización.
 *
 * Responsabilidades:
 * 1. Detectar/redirigir el locale del usuario (next-intl).
 * 2. Permitir acceso libre a rutas públicas (landing, pricing, login, etc.).
 * 3. Refrescar sesión de Supabase para rutas protegidas.
 * 4. Verificar permisos basados en rol (admin, analyst, client).
 *
 * La lógica de permisos se centraliza en `src/lib/auth/user-profile.ts`.
 *
 * @module middleware
 */
import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';
import {
  isPublicRoute,
  hasPermission,
  fetchUserRoleEdge,
  type UserRole,
} from './lib/auth/user-profile';

// ─── Configuración ──────────────────────────────────────────────────────────

const LOCALES = routing.locales as readonly string[];
const DEFAULT_LOCALE = routing.defaultLocale;

const intlMiddleware = createIntlMiddleware(routing);

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Elimina el prefijo de locale de un pathname.
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
 */
function getLocale(pathname: string): string {
  for (const locale of LOCALES) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale;
    }
  }
  return DEFAULT_LOCALE;
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
  if (isPublicRoute(pathWithoutLocale)) {
    return applyIntl(request);
  }

  // 2. Crear cliente Supabase y refrescar sesión
  //    getUser() valida el token con el servidor de Supabase y refresca
  //    automáticamente si el access token expiró (setAll actualiza las cookies).
  const { supabase, getResponse } = createSupabaseMiddlewareClient(request);

  const { data: { user }, error } = await supabase.auth.getUser();

  // 3. Sin sesión válida → redirect a login con redirectTo
  if (error || !user) {
    const locale = getLocale(pathname);
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    // Copiar cookies de auth refresh al redirect (importante para limpiar tokens expirados)
    const redirectResponse = NextResponse.redirect(loginUrl);
    for (const cookie of getResponse().cookies.getAll()) {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    }
    return redirectResponse;
  }

  // 4. Verificar permisos por rol — retornar 403 si no tiene acceso
  const role = await fetchUserRoleEdge(user.id);

  if (!hasPermission(role, pathWithoutLocale)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  // 5. Autorizado → intl + cookies de auth
  return applyIntl(request, getResponse());
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|auth|.*\\..*).*)'],
};
