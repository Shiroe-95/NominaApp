import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

/** Locales soportados por la aplicación */
const SUPPORTED_LOCALES = ['en', 'es', 'pt']
/** Locale por defecto cuando la URL no incluye prefijo de idioma */
const DEFAULT_LOCALE = 'es'

/**
 * Callback de autenticación OAuth de Supabase.
 *
 * Endpoint: GET /auth/callback
 *
 * Query params:
 *  - code  — Código de autorización proporcionado por Supabase Auth.
 *  - next  — Ruta de destino tras el login (por defecto "/").
 *
 * Flujo:
 *  1. Intercambia el código OAuth por una sesión válida.
 *  2. Si el usuario no tiene perfil en `user_profiles`, crea uno con rol 'client' (upsert).
 *  3. Redirige al destino asegurando que la URL incluya un prefijo de locale válido.
 */
export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const next = requestUrl.searchParams.get('next') ?? '/'

    if (code) {
        const cookieStore = await cookies()
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll() },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        )
                    },
                },
            }
        )

        const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

        if (exchangeError) {
            // Si falla el intercambio, redirigir al login
            return NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}/login`, requestUrl.origin))
        }

        // Crea perfil de usuario con rol 'client' si no existe aún.
        // Usa upsert con onConflict para evitar race conditions si dos
        // requests llegan simultáneamente.
        if (data?.user) {
            const admin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                { auth: { persistSession: false } }
            )

            await admin.from('user_profiles').upsert(
                {
                    id: data.user.id,
                    role: 'client',
                    display_name: data.user.user_metadata?.display_name
                        ?? data.user.email?.split('@')[0]
                        ?? '',
                },
                {
                    onConflict: 'id',
                    // No sobreescribir si ya existe — preservar rol y nombre actualizados
                    ignoreDuplicates: true,
                }
            )
        }
    }

    // Garantiza que la URL de destino incluya un prefijo de locale válido
    const hasLocale = SUPPORTED_LOCALES.some(
        (l) => next === `/${l}` || next.startsWith(`/${l}/`)
    )
    const destination = hasLocale ? next : `/${DEFAULT_LOCALE}${next === '/' ? '' : next}`

    return NextResponse.redirect(
        new URL(destination || `/${DEFAULT_LOCALE}/dashboard`, requestUrl.origin)
    )
}
