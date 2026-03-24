'use client';

import { useEffect, useState } from 'react';
import { User, Bell, Globe2, Shield, Info, CheckCircle2, Sparkles, Key, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { Link, useRouter, usePathname } from '@/i18n/routing';

/** Roles disponibles en la plataforma con su descripción para el selector de rol activo. */
const ROLES = [
    { id: 'admin', label: 'Administrador', desc: 'Acceso total: cargar, corregir, reportes y configurar reglas.' },
    { id: 'payroll', label: 'Nómina', desc: 'Puede cargar y corregir planillas.' },
    { id: 'auditor', label: 'Auditor', desc: 'Solo lectura: reportes y validaciones.' },
];

/** Tipos de notificación configurables por el usuario con su estado por defecto. */
const NOTIFICATIONS = [
    { id: 'hallazgo_alto', label: 'Hallazgos de severidad alta', defaultOn: true },
    { id: 'planilla_guardada', label: 'Planilla guardada correctamente', defaultOn: true },
    { id: 'reporte_listo', label: 'Reporte de certificación listo', defaultOn: true },
    { id: 'hallazgo_medio', label: 'Hallazgos de severidad media', defaultOn: false },
];

/**
 * Página de configuración del usuario.
 *
 * Permite gestionar:
 * - Acceso rápido a la configuración de proveedores de IA (CTA destacado).
 * - Datos de cuenta (nombre, correo) y selección de rol activo.
 * - Preferencia de idioma de la interfaz.
 * - Toggles de notificaciones por tipo de alerta.
 *
 * Obtiene el usuario autenticado desde Supabase al montar el componente.
 *
 * @returns Página de configuración renderizada como componente cliente.
 */
export default function SettingsPage() {
    const router = useRouter();
    const pathname = usePathname();
    const [activeRole, setActiveRole] = useState('admin');
    const [notifs, setNotifs] = useState<Record<string, boolean>>(
        Object.fromEntries(NOTIFICATIONS.map((n) => [n.id, n.defaultOn]))
    );
    const [saved, setSaved] = useState(false);
    const [userEmail, setUserEmail] = useState('');
    const [displayName, setDisplayName] = useState('');

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
            if (data.user?.email) {
                setUserEmail(data.user.email);
                setDisplayName(data.user.user_metadata?.full_name ?? data.user.email.split('@')[0]);
            }
        });
    }, []);

    const handleSave = () => {
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    return (
        <div className="space-y-5 max-w-2xl">
            <div>
                <h1 className="text-xl font-bold text-white leading-tight drop-shadow-sm">Configuración</h1>
                <p className="text-sm text-slate-400 mt-0.5">Preferencias de tu cuenta y notificaciones.</p>
            </div>

            {/* AI Providers — Prominent CTA */}
            <div className="rounded-2xl border-2 border-violet/30 bg-violet/10 p-5 shadow-lg shadow-black/20 space-y-3">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-violet/20 flex items-center justify-center flex-shrink-0">
                        <Key className="w-4 h-4 text-violet-light" />
                    </div>
                    <div className="flex-1">
                        <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                            Proveedores de IA
                            <Sparkles className="w-3.5 h-3.5 text-violet-light" />
                        </h2>
                        <p className="text-xs text-slate-400">Configura tus API keys para activar los agentes de IA. Se cifran con AES-256-GCM.</p>
                    </div>
                </div>
                <div className="flex items-center gap-3 pl-12">
                    <div className="flex gap-1.5">
                        {['OpenRouter', 'OpenAI', 'Anthropic', 'Groq', 'Google'].map((p) => (
                            <span key={p} className="px-2 py-1 rounded-md bg-white/10 text-[10px] font-medium text-slate-300">{p}</span>
                        ))}
                    </div>
                </div>
                <div className="pl-12">
                    <Link
                        href="/settings/providers"
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-violet text-white text-sm font-semibold hover:bg-violet/90 transition-colors shadow-sm"
                    >
                        Configurar proveedores
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>
            </div>

            {/* Account */}
            <div className="rounded-2xl border border-white/10 glass-panel p-5 shadow-lg shadow-black/20 space-y-4">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-violet/20 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-violet-light" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-white">Mi cuenta</h2>
                        <p className="text-xs text-slate-400">Información de acceso y rol activo</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Nombre</label>
                            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="h-10 w-full px-3 rounded-lg border border-white/10 bg-black/20 text-white text-sm outline-none focus:ring-2 focus:ring-violet/30" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Correo</label>
                            <input value={userEmail} type="email" className="h-10 w-full px-3 rounded-lg border border-white/10 bg-black/20 text-slate-400 text-sm outline-none" readOnly />
                        </div>
                </div>

                <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                        <Shield className="w-3.5 h-3.5" /> Rol activo
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        {ROLES.map((role) => (
                            <button
                                key={role.id}
                                onClick={() => setActiveRole(role.id)}
                                className={cn(
                                    'text-left p-3 rounded-xl border text-xs transition-all',
                                    activeRole === role.id
                                        ? 'border-violet bg-violet/10 text-violet-light'
                                        : 'border-white/10 text-slate-400 hover:border-white/20 hover:bg-white/5'
                                )}
                            >
                                <p className="font-semibold mb-0.5">{role.label}</p>
                                <p className="text-slate-500 leading-snug">{role.desc}</p>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Language */}
            <div className="rounded-2xl border border-white/10 glass-panel p-5 shadow-lg shadow-black/20 space-y-3">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-emerald/20 flex items-center justify-center flex-shrink-0">
                        <Globe2 className="w-4 h-4 text-emerald-light" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-white">Idioma</h2>
                        <p className="text-xs text-slate-400">Cambia el idioma de la interfaz</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    {([
                        { code: 'es' as const, label: 'Español' },
                        { code: 'en' as const, label: 'English' },
                        { code: 'pt' as const, label: 'Português' },
                    ]).map((lang) => (
                        <button
                            key={lang.code}
                            onClick={() => router.replace(pathname, { locale: lang.code })}
                            className={cn(
                                'px-4 py-2 rounded-lg text-sm font-medium border transition-all',
                                'border-white/10 text-slate-300 hover:border-emerald/30 hover:bg-emerald/10 hover:text-emerald-light'
                            )}
                        >
                            {lang.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Notifications */}
            <div className="rounded-2xl border border-white/10 glass-panel p-5 shadow-lg shadow-black/20 space-y-3">
                <div className="flex items-center gap-3 mb-1">
                    <div className="w-9 h-9 rounded-xl bg-amber/20 flex items-center justify-center flex-shrink-0">
                        <Bell className="w-4 h-4 text-amber-light" />
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-white">Notificaciones</h2>
                        <p className="text-xs text-slate-400">Elige qué alertas quieres recibir</p>
                    </div>
                </div>
                <div className="space-y-2">
                    {NOTIFICATIONS.map((n) => (
                        <label key={n.id} className="flex items-center justify-between p-3 rounded-xl border border-white/10 hover:bg-white/5 cursor-pointer transition-colors">
                            <span className="text-sm text-slate-300">{n.label}</span>
                            <button
                                role="switch"
                                aria-checked={notifs[n.id]}
                                onClick={() => setNotifs((prev) => ({ ...prev, [n.id]: !prev[n.id] }))}
                                className={cn(
                                    'relative w-10 h-5 rounded-full transition-colors flex-shrink-0',
                                    notifs[n.id] ? 'bg-violet' : 'bg-white/20'
                                )}
                            >
                                <span className={cn(
                                    'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform',
                                    notifs[n.id] ? 'translate-x-5' : 'translate-x-0'
                                )} />
                            </button>
                        </label>
                    ))}
                </div>
            </div>

            {/* Rules admin tip */}
            <div className="flex items-start gap-3 p-4 rounded-xl border border-violet/20 bg-violet/10 text-xs text-violet-light">
                <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <p>Para administrar reglas normativas (campos requeridos, cálculos, verificaciones) ve a la sección <strong>Reglas Normativas</strong> en el menú lateral.</p>
            </div>

            <div className="flex items-center justify-end gap-3">
                {saved && (
                    <span className="flex items-center gap-1.5 text-sm text-emerald-light font-medium">
                        <CheckCircle2 className="w-4 h-4" /> Guardado
                    </span>
                )}
                <Button onClick={handleSave}>Guardar preferencias</Button>
            </div>
        </div>
    );
}
