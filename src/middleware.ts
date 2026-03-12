import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

// Routes that don't require authentication
const PUBLIC_PATHS = ['/login'];

export async function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Strip locale prefix to get clean path for matching
    const locales = routing.locales as readonly string[];
    let cleanPath = pathname;
    for (const locale of locales) {
        if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
            cleanPath = pathname.slice(locale.length + 1) || '/';
            break;
        }
    }

    // Create a response to potentially modify cookies
    let response = NextResponse.next({ request });

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() { return request.cookies.getAll() },
                setAll(cookiesToSet) {
                    cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
                    response = NextResponse.next({ request });
                    cookiesToSet.forEach(({ name, value, options }) =>
                        response.cookies.set(name, value, options)
                    );
                },
            },
        }
    );

    // Refresh session (required for Supabase SSR)
    const { data: { user } } = await supabase.auth.getUser();

    const isPublicPath = PUBLIC_PATHS.some(p => cleanPath === p || cleanPath.startsWith(p + '/'));

    // Redirect unauthenticated users to login
    if (!user && !isPublicPath) {
        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = `/${request.nextUrl.pathname.split('/')[1]}/login`;
        return NextResponse.redirect(loginUrl);
    }

    // Redirect authenticated users away from login
    if (user && isPublicPath) {
        const homeUrl = request.nextUrl.clone();
        homeUrl.pathname = `/${request.nextUrl.pathname.split('/')[1]}`;
        return NextResponse.redirect(homeUrl);
    }

    // Apply i18n middleware
    const intlResponse = intlMiddleware(request);
    if (intlResponse) {
        // Copy auth cookies to the intl response
        response.cookies.getAll().forEach(cookie => {
            intlResponse.cookies.set(cookie.name, cookie.value);
        });
        return intlResponse;
    }

    return response;
}

export const config = {
    matcher: ['/((?!api|_next|_vercel|auth|.*\\..*).*)']
};

