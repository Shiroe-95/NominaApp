import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';
import { isPublicRoute, hasPermission, type UserRole } from './lib/auth/user-profile';

const intlMiddleware = createIntlMiddleware(routing);

/**
 * Extract the pathname without the locale prefix.
 * e.g. "/es/upload" → "/upload", "/en/admin/usage" → "/admin/usage"
 */
function stripLocale(pathname: string): string {
  const locales = routing.locales as readonly string[];
  for (const locale of locales) {
    const prefix = `/${locale}`;
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return pathname.slice(prefix.length) || '/';
    }
  }
  return pathname;
}

/**
 * Detect the locale from the pathname, falling back to the default.
 */
function getLocaleFromPath(pathname: string): string {
  const locales = routing.locales as readonly string[];
  for (const locale of locales) {
    if (pathname === `/${locale}` || pathname.startsWith(`/${locale}/`)) {
      return locale;
    }
  }
  return routing.defaultLocale;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Let the intl middleware handle locale detection/redirect for the root
  // and let API/auth/static routes pass through (handled by matcher config)
  const pathWithoutLocale = stripLocale(pathname);

  // 1. Public routes — no auth required
  if (isPublicRoute(pathWithoutLocale)) {
    return applyIntlMiddleware(request);
  }

  // 2. For protected routes, validate Supabase session
  let response = NextResponse.next({ request });
  let userId: string | null = null;

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            response = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    // Auth error — treat as unauthenticated
  }

  // 3. No session → redirect to login
  if (!userId) {
    const locale = getLocaleFromPath(pathname);
    const loginUrl = new URL(`/${locale}/login`, request.url);
    loginUrl.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Fetch user role from user_profiles
  //    We use the admin client via a direct fetch to avoid importing
  //    Node.js-only modules in Edge middleware. Instead, we query Supabase
  //    REST API directly with the service role key.
  let role: UserRole = 'client'; // default fallback
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    const profileRes = await fetch(
      `${supabaseUrl}/rest/v1/user_profiles?id=eq.${userId}&select=role`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    );

    if (profileRes.ok) {
      const profiles = await profileRes.json();
      if (profiles.length > 0 && profiles[0].role) {
        role = profiles[0].role as UserRole;
      }
    }
  } catch {
    // If profile fetch fails, use default role (client)
  }

  // 5. Check role-based access
  if (!hasPermission(role, pathWithoutLocale)) {
    const locale = getLocaleFromPath(pathname);
    const dashboardUrl = new URL(`/${locale}/dashboard`, request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  // 6. Authorized — apply intl middleware and forward
  return applyIntlMiddleware(request, response);
}

/**
 * Apply the next-intl middleware and copy any auth cookies to the response.
 */
function applyIntlMiddleware(
  request: NextRequest,
  existingResponse?: NextResponse
): NextResponse {
  const intlResponse = intlMiddleware(request);

  if (intlResponse && existingResponse) {
    // Copy auth cookies from the Supabase response to the intl response
    existingResponse.cookies.getAll().forEach((cookie) => {
      intlResponse.cookies.set(cookie.name, cookie.value);
    });
  }

  return intlResponse || existingResponse || NextResponse.next({ request });
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|auth|.*\\..*).*)'],
};
