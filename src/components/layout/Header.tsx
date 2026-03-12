'use client';

import { Menu, Bell, ChevronDown, Settings, LogOut, User, AlertTriangle, ShieldCheck, CheckCircle2, X, ArrowRight } from 'lucide-react';
import LanguageToggle from '../ui/LanguageToggle';
import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './Sidebar';
import { Link, usePathname, useRouter } from '@/i18n/routing';
import { cn } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';

const pageMeta: Record<string, { title: string; subtitle: string; ctaLabel?: string; ctaHref?: string; stage?: string }> = {
    '/': {
        title: 'Centro de control de nomina',
        subtitle: 'Monitorea riesgo UGPP, desviaciones y estado de certificacion en un solo lugar.',
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

const MOCK_NOTIFICATIONS = [
    {
        id: 1,
        icon: AlertTriangle,
        iconColor: 'text-amber',
        iconBg: 'bg-amber/10',
        title: 'Desviacion detectada',
        desc: '3 empleados con diferencia en aportes de salud',
        time: 'Hace 5 min',
        unread: true,
    },
    {
        id: 2,
        icon: ShieldCheck,
        iconColor: 'text-emerald',
        iconBg: 'bg-emerald/10',
        title: 'Nomina validada',
        desc: 'La nomina de enero 2026 paso controles UGPP',
        time: 'Hace 1 h',
        unread: true,
    },
    {
        id: 3,
        icon: CheckCircle2,
        iconColor: 'text-violet',
        iconBg: 'bg-violet/10',
        title: 'Carga completada',
        desc: 'El archivo nomina_feb.xlsx se proceso correctamente',
        time: 'Ayer',
        unread: false,
    },
];

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
    const [notifOpen, setNotifOpen] = useState(false);
    const [profileOpen, setProfileOpen] = useState(false);
    const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
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

    const notifRef = useRef<HTMLDivElement>(null);
    const profileRef = useRef<HTMLDivElement>(null);

    useClickOutside(notifRef, () => setNotifOpen(false));
    useClickOutside(profileRef, () => setProfileOpen(false));

    const unreadCount = notifications.filter((n) => n.unread).length;

    function markAllRead() {
        setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    }

    function handleLogout() {
        setProfileOpen(false);
        const supabase = createClient();
        supabase.auth.signOut().finally(() => {
            router.push('/login');
            router.refresh();
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
                    <div ref={notifRef} className="relative">
                        <button
                            type="button"
                            onClick={() => { setNotifOpen((v) => !v); setProfileOpen(false); }}
                            className="relative rounded-lg p-2 text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
                        >
                            <span className="sr-only">Notificaciones</span>
                            <Bell className="h-[18px] w-[18px]" aria-hidden="true" />
                            {unreadCount > 0 && (
                                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose ring-2 ring-white" />
                            )}
                        </button>

                        {notifOpen && (
                            <div className="absolute right-0 mt-1 w-80 overflow-hidden rounded-2xl border border-white/10 glass-panel shadow-2xl shadow-black/50">
                                <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
                                    <p className="text-sm font-semibold text-white">Notificaciones</p>
                                    <div className="flex items-center gap-2">
                                        {unreadCount > 0 && (
                                            <button
                                                onClick={markAllRead}
                                                className="text-xs font-medium text-violet transition-colors hover:text-violet-dark"
                                            >
                                                Marcar todas
                                            </button>
                                        )}
                                        <button onClick={() => setNotifOpen(false)} className="rounded p-0.5 text-slate-400 hover:text-slate-600">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <div className="divide-y divide-white/5">
                                    {notifications.map((n) => {
                                        const Icon = n.icon;
                                        return (
                                            <div key={n.id} className={cn('flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/5', n.unread && 'bg-violet/[0.05]')}>
                                                <div className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', n.iconBg)}>
                                                    <Icon className={cn('h-4 w-4', n.iconColor)} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <p className="truncate text-xs font-semibold text-slate-200">{n.title}</p>
                                                        {n.unread && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-violet-light glowing-dot" />}
                                                    </div>
                                                    <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{n.desc}</p>
                                                    <p className="mt-1 text-[11px] text-slate-400">{n.time}</p>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <LanguageToggle />
                    <div className="mx-1 hidden h-5 w-px bg-white/10 sm:block" />

                    <div ref={profileRef} className="relative">
                        <button
                            onClick={() => { setProfileOpen((v) => !v); setNotifOpen(false); }}
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
                                        Configuracion
                                    </button>
                                    <button
                                        onClick={() => setProfileOpen(false)}
                                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 hover:text-white"
                                    >
                                        <User className="h-4 w-4 text-slate-400" />
                                        Mi perfil
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
