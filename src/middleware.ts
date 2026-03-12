import { type NextRequest, NextResponse } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { createServerClient } from '@supabase/ssr';
import { routing } from './i18n/routing';

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
    // Create a response to potentially modify cookies
    let response = NextResponse.next({ request });

    try {
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
        await supabase.auth.getUser();
    } catch {
        // Continue without auth if there's an error
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

