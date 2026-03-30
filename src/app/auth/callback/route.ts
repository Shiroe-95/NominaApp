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
 * Valida que una URL de redirección sea una ruta relativa segura.
 * Previene ataques de open redirect rechazando URLs absolutas,
 * protocol-relative URLs (//), y rutas que apunten al login (loop).
 */
export function isValidRedirectPath(path: string | null | undefined): path is string {
    if (!path || typeof path !== 'string') return false
    // Debe empezar con / (ruta relativa)
    if (!path.startsWith('/')) return false
    // Rechazar protocol-relative URLs (//example.com)
    if (path.startsWith('//')) return false
    // Rechazar rutas que contengan /login para evitar loops
    if (path.includes('/login')) return false
    return true
}

/**
 * Callback de autenticación OAuth de Supabase.
 *
 * Endpoint: GET /auth/callback
 *
 * Query params:
 *  - code        — Código de autorización proporcionado por Supabase Auth.
 *  - redirectTo  — Ruta de destino tras el login (establecida por el middleware).
 *  - next        — Alias legacy de redirectTo (backward compat).
 *
 * Flujo:
 *  1. Intercambia el código OAuth por una sesión válida.
 *  2. Si el usuario no tiene perfil en `user_profiles`, crea uno con rol 'client' (upsert).
 *  3. Redirige al destino validando que sea una ruta relativa segura.
 *     Si `redirectTo` es inválido o ausente, redirige a `/dashboard`.
 */
export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    // Leer redirectTo (preferido) o next (legacy) del query
    const redirectTo = requestUrl.searchParams.get('redirectTo')
        ?? requestUrl.searchParams.get('next')

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
                    ignoreDuplicates: true,
                }
            )
        }
    }

    // Determinar destino: usar redirectTo si es válido, sino /dashboard
    const destination = isValidRedirectPath(redirectTo) ? redirectTo : '/dashboard'

    // Garantizar que la URL de destino incluya un prefijo de locale válido
    const hasLocale = SUPPORTED_LOCALES.some(
        (l) => destination === `/${l}` || destination.startsWith(`/${l}/`)
    )
    const finalPath = hasLocale ? destination : `/${DEFAULT_LOCALE}${destination}`

    return NextResponse.redirect(new URL(finalPath, requestUrl.origin))
}
