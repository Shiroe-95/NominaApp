/**
 * Header — Barra superior principal de la aplicación.
 *
 * Muestra el título contextual de la página actual, indicador de etapa del pipeline,
 * controles de idioma, notificaciones, menú de perfil de usuario y menú móvil con Sidebar.
 * El contenido se adapta dinámicamente según la ruta activa usando `pageMeta`.
 *
 * @remarks
 * - Obtiene la sesión del usuario desde Supabase para mostrar email e inicial.
 * - Incluye logout con redirección completa (window.location) para limpiar estado del cliente.
 * - En pantallas pequeñas, despliega el Sidebar como overlay.
 */
'use client';

import { Menu, ChevronDown, Settings, LogOut, ArrowRight } from 'lucide-react';
import LanguageToggle from '../ui/LanguageToggle';
import NotificationBell from '../ui/NotificationBell';
import { ThemeToggle } from './ThemeToggle';
import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

/** Metadatos contextuales por ruta: título, subtítulo, CTA opcional y etapa del pipeline. */
const pageMeta: Record<string, { title: string; subtitle: string; ctaLabel?: string; ctaHref?: string; stage?: string }> = {
    '/': {
        title: 'Centro de control de nomina',
        subtitle: 'Monitorea riesgo normativo, desviaciones y estado de certificacion en un solo lugar.',
        ctaLabel: 'Cargar planilla',
        ctaHref: '/upload',
        stage: 'Inicio',
    },
    '/upload': {
        title: 'Ingestion guiada',
        subtitle: 'Sube tus archivos, mapea campos y valida estructura antes de guardar.',
        stage: 'Paso 1 de 3',
    },
    '/reconcile': {
        title: 'Revision y conciliacion',
        subtitle: 'Prioriza hallazgos, asigna acciones y deja evidencia de resolucion.',
        stage: 'Paso 2 de 3',
    },
    '/reports': {
        title: 'Reporte ejecutivo',
        subtitle: 'Consolida trazabilidad, hallazgos y estado final de certificacion.',
        stage: 'Paso 3 de 3',
    },
    '/rules': {
        title: 'Reglas normativas',
        subtitle: 'Gestiona campos, calculos y controles que usa el motor de validacion.',
    },
    '/settings': {
        title: 'Configuracion',
        subtitle: 'Ajusta idioma, parametros y preferencias de la plataforma.',
    },
};

/**
 * Hook que ejecuta un callback al hacer clic fuera del elemento referenciado.
 * @param ref - Referencia al elemento DOM a monitorear.
 * @param handler - Función a ejecutar cuando se detecta un clic externo.
 */
function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
    useEffect(() => {
        function handleMouseDown(event: MouseEvent) {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                handler();
            }
        }
        document.addEventListener('mousedown', handleMouseDown);
        return () => document.removeEventListener('mousedown', handleMouseDown);
    }, [ref, handler]);
}

export default function Header() {
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [userInitial, setUserInitial] = useState('U');

    useEffect(() => {
        const supabase = createClient();
        supabase.auth.getUser().then(({ data }) => {
            if (data.user?.email) {
                setUserEmail(data.user.email);
                setUserInitial(data.user.email[0].toUpperCase());
            }
        });
    }, []);

    const pathname = usePathname();
    const router = useRouter();
    const meta = useMemo(() => pageMeta[pathname] ?? { title: 'NominaSmart', subtitle: 'Auditoria inteligente de nomina.' }, [pathname]);

    const profileRef = useRef<HTMLDivElement>(null);

    useClickOutside(profileRef, () => setProfileOpen(false));

/**
 * Cierra la sesión del usuario y redirige a la página de login.
 * Usa `window.location.href` en lugar de router.push para forzar
 * una navegación completa que limpie el estado del cliente y pase por el middleware.
 */
    function handleLogout() {
        setProfileOpen(false);
        const supabase = createClient();
        supabase.auth.signOut().finally(() => {
            // Full navigation para limpiar estado del cliente y pasar por middleware
            window.location.href = '/login';
        });
    }

    return (
        <header className="sticky top-0 z-30 border-b border-white/10 glass-panel">
            <div className="flex h-14 items-center gap-x-4 px-4 sm:px-6">
                <button
                    type="button"
                    className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-white/5 hover:text-white md:hidden"
                    onClick={() => setMobileMenuOpen(true)}
                >
                    <span className="sr-only">Abrir menu</span>
                    <Menu className="h-5 w-5" aria-hidden="true" />
                </button>

                <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-white drop-shadow-sm">{meta.title}</p>
                </div>

                {meta.stage && (
                    <span className="hidden rounded-full border border-violet/20 bg-violet/10 px-2.5 py-1 text-xs font-semibold text-violet-dark sm:inline-flex">
                        {meta.stage}
                    </span>
                )}

                <div className="flex items-center gap-1">
                    <NotificationBell />

                    <ThemeToggle />

                    <LanguageToggle />
                    <div className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />

                    <div ref={profileRef} className="relative">
                        <button
                            onClick={() => { setProfileOpen((v) => !v); }}
                            className="group flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-white/5"
                        >
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet to-violet-light text-xs font-semibold text-white shadow-[0_0_10px_rgba(139,92,246,0.5)]">
                                {userInitial}
                            </div>
                            <span className="hidden text-sm font-medium text-slate-300 transition-colors group-hover:text-white sm:block">
                                {userEmail ? userEmail.split('@')[0] : 'Usuario'}
                            </span>
                                <ChevronDown className={cn('hidden h-3.5 w-3.5 text-slate-400 transition-all duration-150 group-hover:text-slate-200 sm:block', profileOpen && 'rotate-180')} />
                        </button>

                        {profileOpen && (
                            <div className="absolute right-0 mt-1 w-56 overflow-hidden rounded-2xl border border-white/10 glass-panel shadow-2xl shadow-black/50">
                                <div className="border-b border-white/10 px-4 py-3">
                                    <p className="text-sm font-semibold text-white">{userEmail ? userEmail.split('@')[0] : 'Usuario'}</p>
                                    <p className="mt-0.5 text-xs text-slate-400">{userEmail ?? ''}</p>
                                </div>
                                <div className="py-1.5">
                                    <button
                                        onClick={() => { setProfileOpen(false); router.push('/settings'); }}
                                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                                    >
                                        <Settings className="h-4 w-4 text-slate-400" />
                                        Configuración
                                    </button>
                                </div>
                                <div className="border-t border-white/10 py-1.5">
                                    <button
                                        onClick={handleLogout}
                                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-rose-light transition-colors hover:bg-white/5 hover:text-rose"
                                    >
                                        <LogOut className="h-4 w-4" />
                                        Cerrar sesion
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="hidden items-center justify-between gap-4 border-t border-white/10 bg-black/20 px-6 py-2.5 lg:flex backdrop-blur-md">
                <p className="text-xs text-slate-300">{meta.subtitle}</p>
                {meta.ctaHref && meta.ctaLabel && (
                    <Link
                        href={meta.ctaHref}
                        className="inline-flex items-center gap-1 rounded-full border border-violet/30 bg-violet/20 px-3 py-1 text-xs font-semibold text-violet-light transition-colors hover:bg-violet/30 hover:shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                    >
                        {meta.ctaLabel}
                        <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                )}
            </div>

            {mobileMenuOpen && (
                <div className="relative z-50 lg:hidden">
                    <div
                        className="fixed inset-0 bg-navy-dark/60 backdrop-blur-sm"
                        onClick={() => setMobileMenuOpen(false)}
                    />
                    <div className="fixed inset-y-0 left-0 z-50 w-72 shadow-2xl transition-transform">
                        <Sidebar />
                    </div>
                </div>
            )}
        </header>
    );
}
