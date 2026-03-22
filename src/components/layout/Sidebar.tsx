'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import {
    LayoutDashboard, UploadCloud, GitMerge, FileCheck2,
    Settings, Zap, BookOpen, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type NavigationKey = 'dashboard' | 'upload' | 'reconcile' | 'reports' | 'rules';

const navigation = [
    { name: 'dashboard' as NavigationKey, href: '/dashboard', icon: LayoutDashboard, hint: 'Visión ejecutiva' },
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
        <aside className="relative flex h-full flex-col overflow-hidden bg-[#0a0e18] border-r border-[#4a4455]/[0.1] z-10">
            {/* Ambient glows */}
            <div className="pointer-events-none absolute -top-20 -right-14 h-52 w-52 rounded-full bg-[#7C3AED]/[0.12] blur-[80px]" />
            <div className="pointer-events-none absolute -bottom-20 -left-14 h-52 w-52 rounded-full bg-[#10B981]/[0.08] blur-[80px]" />

            {/* Logo */}
            <div className="relative flex items-center gap-3 px-5 py-6">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#7C3AED] to-[#5B21B6] shadow-[0_0_20px_rgba(124,58,237,0.4)]">
                    <Zap className="h-5 w-5 text-white" strokeWidth={2.5} />
                </div>
                <div>
                    <p className="text-base font-bold tracking-tight text-[#e0e2f1]">NominaSmart</p>
                    <p className="text-[11px] font-medium text-[#958da1] tracking-wide uppercase">Auditoría UGPP</p>
                </div>
            </div>

            {/* Flow */}
            <div className="relative px-4 pb-6">
                <div className="rounded-xl bg-[#181b26] p-3">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[#958da1] mb-1">Flujo recomendado</p>
                    <div className="mt-2 space-y-1.5">
                        {flowSteps.map((step, index) => {
                            const done = flowIndex > index + 1;
                            const active = flowIndex === index + 1;
                            return (
                                <Link
                                    key={step.href}
                                    href={step.href}
                                    className={cn(
                                        'flex items-center gap-2.5 rounded-lg px-2 py-2 text-xs font-medium transition-all duration-200',
                                        active ? 'bg-[#262a35] text-white' : 'text-[#958da1] hover:bg-[#1c1f2a] hover:text-[#ccc3d8]',
                                    )}
                                >
                                    <span className={cn(
                                        'flex h-5 w-5 items-center justify-center rounded-full text-[10px] transition-all',
                                        done ? 'bg-[#10B981]/20 text-[#4edea3]'
                                            : active ? 'bg-[#7C3AED]/20 text-[#d2bbff] shadow-[0_0_8px_rgba(124,58,237,0.3)]'
                                                : 'bg-[#0a0e18] text-[#4a4455]',
                                    )}>
                                        {done ? <CheckCircle2 className="h-3 w-3" /> : index + 1}
                                    </span>
                                    <span>{step.label}</span>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Nav label */}
            <div className="relative px-4 pb-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-[#4a4455]">Navegación</p>
            </div>

            {/* Nav items */}
            <nav className="relative flex-1 space-y-1 px-3">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                'group flex flex-col rounded-xl px-3 py-2.5 transition-all duration-200',
                                isActive
                                    ? 'bg-[#7C3AED]/[0.08] text-white'
                                    : 'text-[#958da1] hover:bg-[#1c1f2a] hover:text-[#ccc3d8]',
                            )}
                        >
                            <div className="flex items-center gap-3">
                                <div className={cn('p-1.5 rounded-lg transition-colors', isActive ? 'bg-[#7C3AED]/20 text-[#d2bbff]' : 'text-[#4a4455] group-hover:text-[#958da1]')}>
                                    <item.icon className="h-4 w-4 shrink-0" />
                                </div>
                                <span className="text-sm font-semibold">{t(item.name)}</span>
                            </div>
                            <p className={cn(
                                'mt-1 pl-10 text-[11px] transition-colors',
                                isActive ? 'text-[#958da1]' : 'text-[#4a4455] group-hover:text-[#958da1]'
                            )}>{item.hint}</p>
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom */}
            <div className="relative mt-4 border-t border-[#4a4455]/[0.1] p-4 bg-[#0a0e18]">
                <Link
                    href="/settings"
                    className={cn(
                        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
                        pathname === '/settings' ? 'bg-[#1c1f2a] text-white' : 'text-[#958da1] hover:bg-[#1c1f2a] hover:text-white',
                    )}
                >
                    <Settings className="h-4 w-4" />
                    {t('settings')}
                </Link>
                <div className="mt-4 rounded-xl bg-[#181b26] p-3">
                    <p className="text-[10px] leading-relaxed text-[#958da1] font-medium">
                        Objetivo: <span className="text-[#4edea3] font-bold">Riesgo Cero</span><br />
                        Corrección y trazabilidad en tiempo real.
                    </p>
                </div>
            </div>
        </aside>
    );
}
