import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

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
        const { data } = await supabase.auth.exchangeCodeForSession(code)

        // Ensure user_profiles row exists with role='client' default
        if (data?.user) {
            const admin = createClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
                { auth: { persistSession: false } }
            )
            const { data: profile } = await admin
                .from('user_profiles')
                .select('id')
                .eq('id', data.user.id)
                .single()

            if (!profile) {
                await admin.from('user_profiles').insert({
                    id: data.user.id,
                    role: 'client',
                    display_name: data.user.user_metadata?.display_name
                        ?? data.user.email?.split('@')[0]
                        ?? '',
                })
            }
        }
    }

    return NextResponse.redirect(new URL(next, requestUrl.origin))
}
