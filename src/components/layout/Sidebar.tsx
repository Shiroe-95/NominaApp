'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import {
    LayoutDashboard,
    UploadCloud,
    GitMerge,
    FileCheck2,
    Settings,
    Zap,
    BookOpen,
    CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavigationKey = 'dashboard' | 'upload' | 'reconcile' | 'reports' | 'rules';

const navigation = [
    { name: 'dashboard' as NavigationKey, href: '/', icon: LayoutDashboard, hint: 'Visión ejecutiva' },
    { name: 'upload' as NavigationKey, href: '/upload', icon: UploadCloud, hint: 'Sube y normaliza datos' },
    { name: 'reconcile' as NavigationKey, href: '/reconcile', icon: GitMerge, hint: 'Revisión y acciones' },
    { name: 'reports' as NavigationKey, href: '/reports', icon: FileCheck2, hint: 'Reporte de certificación' },
    { name: 'rules' as NavigationKey, href: '/rules', icon: BookOpen, hint: 'Marco normativo' },
];

const flowSteps = [
    { label: '1. Cargar planilla', href: '/upload' },
    { label: '2. Revisar hallazgos', href: '/reconcile' },
    { label: '3. Emitir reporte', href: '/reports' },
];

function getFlowIndex(pathname: string) {
    if (pathname.startsWith('/reports')) return 3;
    if (pathname.startsWith('/reconcile')) return 2;
    if (pathname.startsWith('/upload')) return 1;
    return 0;
}

export default function Sidebar() {
    const t = useTranslations('Navigation');
    const pathname = usePathname();
    const flowIndex = getFlowIndex(pathname);

    return (
        <aside className="relative flex h-full flex-col overflow-hidden border-r border-white/10 bg-gradient-to-b from-[#060913] via-[#0A0F24] to-[#060913] glass-panel z-10">
            <div className="pointer-events-none absolute -top-20 -right-14 h-52 w-52 rounded-full bg-violet-600/20 blur-[80px]" />
            <div className="pointer-events-none absolute -bottom-20 -left-14 h-52 w-52 rounded-full bg-emerald-500/20 blur-[80px]" />

            <div className="relative flex items-center gap-3 px-5 py-6">
                <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-[0_0_15px_rgba(139,92,246,0.6)] animate-pulse-glow">
                    <Zap className="h-5 w-5 text-white drop-shadow-md" strokeWidth={2.5} />
                    <div className="absolute inset-0 rounded-xl ring-1 ring-white/20"></div>
                </div>
                <div>
                    <p className="text-base font-bold tracking-tight text-white drop-shadow-sm">NominaSmart</p>
                    <p className="text-[11px] font-medium text-violet-200/70 tracking-wide uppercase">Auditoría UGPP</p>
                </div>
            </div>

            <div className="relative px-4 pb-6">
                <div className="rounded-xl border border-white/10 glass-panel bg-black/20 p-3 shadow-inner">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Flujo recomendado</p>
                    <div className="mt-2 space-y-1.5">
                        {flowSteps.map((step, index) => {
                            const done = flowIndex > index + 1;
                            const active = flowIndex === index + 1;
                            return (
                                <Link
                                    key={step.href}
                                    href={step.href}
                                    className={cn(
                                        'flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs font-medium transition-all duration-300',
                                        active ? 'bg-white/10 text-white shadow-[0_0_10px_rgba(255,255,255,0.05)]' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                                    )}
                                >
                                    <span className={cn(
                                        'flex h-5 w-5 items-center justify-center rounded-full border text-[10px] transition-all duration-300',
                                        done ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300 shadow-[0_0_8px_rgba(52,211,153,0.4)]'
                                            : active ? 'border-violet-400/50 bg-violet-600/30 text-violet-200 shadow-[0_0_8px_rgba(139,92,246,0.5)] ring-1 ring-violet-500/50'
                                                : 'border-white/10 bg-black/40 text-slate-500',
                                    )}>
                                        {done ? <CheckCircle2 className="h-3 w-3" /> : index + 1}
                                    </span>
                                    <span className={cn(active && 'drop-shadow-md')}>{step.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="relative px-4 pb-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">Navegacion</p>
            </div>

            <nav className="relative flex-1 space-y-1 px-3">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                'group flex flex-col rounded-xl border px-3 py-2.5 transition-all duration-300',
                                isActive
                                    ? 'border-violet-500/40 bg-violet-950/30 text-white shadow-[0_0_15px_rgba(139,92,246,0.15)] glass-panel overflow-hidden relative'
                                    : 'border-transparent text-slate-400 hover:border-white/10 hover:bg-white/5 hover:text-white',
                            )}
                        >
                            {isActive && <div className="absolute inset-0 bg-gradient-to-r from-violet-600/10 to-transparent pointer-events-none" />}
                            <div className="flex items-center gap-3 relative z-10">
                                <div className={cn('p-1.5 rounded-lg transition-colors', isActive ? 'bg-violet-600/20 text-violet-300' : 'text-slate-500 group-hover:text-slate-300 group-hover:bg-white/5')}>
                                    <item.icon className="h-4 w-4 shrink-0" />
                                </div>
                                <span className="text-sm font-semibold tracking-wide">{t(item.name)}</span>
                            </div>
                            <p className={cn(
                                'mt-1 pl-10 text-[11px] transition-colors relative z-10',
                                isActive ? 'text-violet-200/70' : 'text-slate-500 group-hover:text-slate-400'
                            )}>{item.hint}</p>
                        </Link>
                    );
                })}
            </nav>

            <div className="relative mt-4 border-t border-white/10 p-4 bg-black/20 backdrop-blur-md">
                <Link
                    href="/settings"
                    className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-300',
                        pathname === '/settings' ? 'bg-white/10 text-white shadow-inner' : 'text-slate-400 hover:bg-white/5 hover:text-white',
                    )}
                >
                    <Settings className={cn('h-4 w-4', pathname === '/settings' && 'animate-spin-slow')} />
                    {t('settings')}
                </Link>
                <div className="mt-4 rounded-xl border border-white/5 bg-white/5 p-3 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 to-emerald-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <p className="text-[10px] leading-relaxed text-slate-400 relative z-10 font-medium">
                        Objetivo detectado: <span className="text-emerald-400 font-bold">Riesgo Cero</span><br />
                        Corección y trazabilidad en tiempo real.
                    </p>
                </div>
            </div>
        </aside>
    );
}
