'use client';

import { useState } from 'react';
import { Lock, Mail, ArrowRight, ShieldCheck, Zap, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useRouter } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        const supabase = createClient();
        const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

        if (authError) {
            setError('Correo o contraseña incorrectos. Por favor verifica tus credenciales.');
            setIsLoading(false);
            return;
        }

        router.push('/');
        router.refresh();
    };

    return (
        <div className="min-h-screen flex bg-navy-dark">

            {/* Left panel - brand */}
            <div className="hidden lg:flex lg:w-[480px] xl:w-[520px] flex-col justify-between p-12 relative overflow-hidden flex-shrink-0">
                {/* Background gradient orbs */}
                <div className="absolute top-0 left-0 w-full h-full">
                    <div className="absolute top-1/4 -left-20 w-96 h-96 bg-violet/20 rounded-full blur-3xl" />
                    <div className="absolute bottom-1/4 left-1/2 w-72 h-72 bg-emerald/10 rounded-full blur-3xl" />
                </div>

                {/* Logo */}
                <div className="relative flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-emerald to-violet rounded-xl flex items-center justify-center shadow-lg">
                        <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
                    </div>
                    <span className="text-white font-bold text-xl tracking-tight">NóminaSmart</span>
                </div>

                {/* Hero text */}
                <div className="relative space-y-6">
                    <div>
                        <h1 className="text-4xl font-bold text-white leading-tight">
                            Auditoría de nómina<br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-light to-violet-light">
                                con inteligencia artificial
                            </span>
                        </h1>
                        <p className="mt-4 text-slate-400 text-base leading-relaxed max-w-sm">
                            Verifica cumplimiento UGPP, detecta inconsistencias y certifica tu nómina en minutos.
                        </p>
                    </div>

                    {/* Feature pills */}
                    <div className="flex flex-wrap gap-2">
                        {['UGPP 2026', 'Triple Match', 'AI Mapping', 'Riesgo IBC'].map((f) => (
                            <span key={f} className="px-3 py-1.5 rounded-full bg-white/10 text-white text-xs font-medium border border-white/10 backdrop-blur-sm">
                                {f}
                            </span>
                        ))}
                    </div>
                </div>

                {/* Footer copy */}
                <p className="relative text-slate-600 text-xs">
                    © 2026 NóminaSmart · Colombia & México
                </p>
            </div>

            {/* Right panel - form */}
            <div className="flex-1 flex items-center justify-center p-6 bg-navy-dark">
                <div className="w-full max-w-md">

                    {/* Mobile logo */}
                    <div className="flex items-center gap-3 mb-8 lg:hidden">
                        <div className="w-9 h-9 bg-gradient-to-br from-emerald to-violet rounded-xl flex items-center justify-center">
                            <Zap className="w-4.5 h-4.5 text-white" strokeWidth={2.5} />
                        </div>
                        <span className="text-navy font-bold text-lg tracking-tight">NóminaSmart</span>
                    </div>

                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-white">Bienvenido de vuelta</h2>
                        <p className="text-slate-400 text-sm mt-1">Inicia sesión para continuar</p>
                    </div>

                    <form className="space-y-4" onSubmit={handleLogin}>
                        {/* Auth error */}
                        {error && (
                            <div className="flex items-start gap-2.5 rounded-xl border border-rose/30 bg-rose/10 px-4 py-3">
                                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose" />
                                <p className="text-sm text-rose">{error}</p>
                            </div>
                        )}

                        {/* Email */}
                        <div className="space-y-1.5">
                            <label htmlFor="email" className="text-sm font-medium text-slate-300">
                                Correo electrónico
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Mail className="h-4 w-4 text-slate-500" />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="block w-full pl-10 pr-4 h-11 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet/30 focus:border-violet transition-all"
                                    placeholder="tu@empresa.com"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div className="space-y-1.5">
                            <label htmlFor="password" className="text-sm font-medium text-slate-300">
                                Contraseña
                            </label>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Lock className="h-4 w-4 text-slate-500" />
                                </div>
                                <input
                                    id="password"
                                    name="password"
                                    type="password"
                                    autoComplete="current-password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="block w-full pl-10 pr-4 h-11 rounded-xl border border-white/10 bg-white/5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet/30 focus:border-violet transition-all"
                                    placeholder="••••••••"
                                />
                            </div>
                        </div>

                        {/* Submit */}
                        <Button
                            type="submit"
                            size="lg"
                            className="w-full mt-2 group"
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    Ingresar al sistema
                                    <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                </>
                            )}
                        </Button>
                    </form>

                    {/* Trust badge */}
                    <div className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-400">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-light" />
                        Protegido por Supabase Auth · Datos cifrados en tránsito
                    </div>
                </div>
            </div>
        </div>
    );
}
