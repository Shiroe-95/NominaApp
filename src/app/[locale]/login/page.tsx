'use client';

import { useState, useEffect } from 'react';
import { Lock, Mail, ArrowRight, ShieldCheck, Zap, AlertCircle } from 'lucide-react';
import { useRouter } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [checkingSession, setCheckingSession] = useState(true);

    // If already logged in, redirect to dashboard
    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
            if (data.user) {
                const redirectTo = searchParams.get('redirectTo');
                if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') && !redirectTo.includes('/login')) {
                    window.location.href = redirectTo;
                } else {
                    router.push('/dashboard');
                }
            } else {
                setCheckingSession(false);
            }
        });
    }, [router, searchParams]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const supabase = createClient();
            const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

            if (authError) {
                setError('Correo o contraseña incorrectos. Por favor verifica tus credenciales.');
                setIsLoading(false);
                return;
            }

            // Respetar redirectTo si el middleware lo puso, sino ir al dashboard.
            // Validar que sea una ruta relativa interna para evitar open redirect.
            const redirectTo = searchParams.get('redirectTo');
            if (redirectTo && redirectTo.startsWith('/') && !redirectTo.startsWith('//') && !redirectTo.includes('/login')) {
                // redirectTo ya tiene locale (ej: /es/dashboard), usar window.location
                // para forzar un full navigation que pase por el middleware
                window.location.href = redirectTo;
            } else {
                router.push('/dashboard');
                router.refresh();
            }
        } catch {
            setError('Error de conexión. Intenta de nuevo.');
            setIsLoading(false);
        }
    };

    const inputClass = "block w-full pl-10 pr-4 h-11 rounded-xl bg-[#0a0e18] border border-[#4a4455]/[0.15] text-sm text-[#e0e2f1] placeholder-[#958da1] focus:outline-none focus:border-[#7C3AED]/60 focus:shadow-[0_0_0_3px_rgba(124,58,237,0.12)] transition-all";

    if (checkingSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#10131d]">
                <div className="w-6 h-6 border-2 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen flex">
            {/* Left panel */}
            <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] flex-col justify-between p-12 relative overflow-hidden flex-shrink-0 bg-[#0a0e18]">
                <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/4 -left-20 w-96 h-96 bg-[#7C3AED]/[0.15] rounded-full blur-[120px]" />
                    <div className="absolute bottom-1/4 left-1/2 w-72 h-72 bg-[#10B981]/[0.08] rounded-full blur-[100px]" />
                </div>

                <div className="relative flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(124,58,237,0.4)]">
                        <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="text-white font-bold text-xl tracking-tight">NóminaSmart</span>
                </div>

                <div className="relative space-y-6">
                    <div>
                        <h1 className="text-4xl font-bold text-[#e0e2f1] leading-tight">
                            Auditoría de nómina<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#4edea3] to-[#d2bbff]">
                                con inteligencia artificial
                            </span>
                        </h1>
                        <p className="mt-4 text-[#958da1] text-base leading-relaxed max-w-sm">
                            Audita tu nómina con agentes de IA especializados. Multi-país, multi-moneda, en minutos.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {['Multi-País', 'Triple Match', 'AI Mapping', '7 Agentes IA'].map((f) => (
                            <span key={f} className="px-3 py-1.5 rounded-full bg-[#1c1f2a] text-[#ccc3d8] text-xs font-medium">
                                {f}
                            </span>
                        ))}
                    </div>
                </div>

                <p className="relative text-[#4a4455] text-xs">© 2026 NóminaSmart · Colombia & México</p>
            </div>

            {/* Right panel */}
            <div className="flex-1 flex items-center justify-center p-6 bg-[#10131d]">
                <div className="w-full max-w-md">
                    <div className="flex items-center gap-3 mb-8 lg:hidden">
                        <div className="w-9 h-9 bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] rounded-xl flex items-center justify-center">
                            <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
                        </div>
                        <span className="text-white font-bold text-lg tracking-tight">NóminaSmart</span>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-[#e0e2f1]">Bienvenido de vuelta</h2>
                        <p className="text-[#958da1] text-sm mt-1">Inicia sesión para continuar</p>
                    </div>

                    <form className="space-y-4" onSubmit={handleLogin}>
                        {error && (
                            <div className="flex items-start gap-2.5 rounded-xl bg-[#E11D48]/10 px-4 py-3">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#ffb3b6]" />
                                <p className="text-sm text-[#ffb3b6]">{error}</p>
                            </div>
                        )}

                        <div className="space-y-1.5">
                            <label htmlFor="email" className="text-sm font-medium text-[#ccc3d8]">Correo electrónico</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Mail className="h-4 w-4 text-[#958da1]" />
                                </div>
                                <input id="email" name="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="tu@empresa.com" />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label htmlFor="password" className="text-sm font-medium text-[#ccc3d8]">Contraseña</label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-[#958da1]" />
                                </div>
                                <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="••••••••" />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full mt-2 inline-flex items-center justify-center gap-2 h-11 px-6 rounded-xl text-sm font-semibold bg-[#7C3AED] text-white shadow-[0_0_20px_rgba(124,58,237,0.35)] hover:shadow-[0_0_30px_rgba(124,58,237,0.55)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none group"
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    Ingresar al sistema
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 flex items-center justify-center gap-2 text-xs text-[#958da1]">
                        <ShieldCheck className="w-3.5 h-3.5 text-[#4edea3]" />
                        Protegido por Supabase Auth · Datos cifrados en tránsito
                    </div>
                </div>
            </div>
        </div>
    );
}
