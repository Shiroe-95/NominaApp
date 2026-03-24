'use client';

import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import {
    LayoutDashboard, UploadCloud, GitMerge, FileCheck2,
    Settings, Zap, BookOpen, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { getPersona } from '@/lib/ai/agent-personas';

type NavigationKey = 'dashboard' | 'upload' | 'reconcile' | 'reports' | 'rules';

const navigation = [
    { name: 'dashboard' as NavigationKey, href: '/dashboard', icon: LayoutDashboard },
    { name: 'upload' as NavigationKey, href: '/upload', icon: UploadCloud },
    { name: 'reconcile' as NavigationKey, href: '/reconcile', icon: GitMerge },
    { name: 'reports' as NavigationKey, href: '/reports', icon: FileCheck2 },
    { name: 'rules' as NavigationKey, href: '/rules', icon: BookOpen },
];

const flowSteps = [
    { label: 'Cargar nómina', href: '/upload', agentId: 'mapper', tip: 'Gyoru mapea tus columnas' },
    { label: 'Auditar y corregir', href: '/reconcile', agentId: 'auditor', tip: 'Juli audita · Wil corrige' },
    { label: 'Generar reporte', href: '/reports', agentId: 'writer', tip: 'Ana redacta tu reporte' },
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
    const dianis = getPersona('master');

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
                    <p className="text-[11px] font-medium text-[#958da1] tracking-wide uppercase">Auditoría Inteligente</p>
                </div>
            </div>

            {/* Agent-powered Flow */}
            <div className="relative px-4 pb-5">
                <div className="rounded-xl bg-[#181b26] p-3">
                    {/* Dianis header */}
                    <div className="flex items-center gap-2 mb-2.5">
                        <AgentAvatar agentId="master" size={22} animate={false} />
                        <p className="text-[10px] font-bold uppercase tracking-widest text-[#958da1]">
                            {dianis.emoji} {dianis.name} te guía
                        </p>
                    </div>
                    <div className="space-y-1">
                        {flowSteps.map((step, index) => {
                            const done = flowIndex > index + 1;
                            const active = flowIndex === index + 1;
                            const persona = getPersona(step.agentId);
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
                                        'flex h-6 w-6 items-center justify-center rounded-full text-[10px] transition-all shrink-0',
                                        done ? 'bg-[#10B981]/20 text-[#4edea3]'
                                            : active ? 'bg-[#7C3AED]/20 text-[#d2bbff] shadow-[0_0_8px_rgba(124,58,237,0.3)]'
                                                : 'bg-[#0a0e18] text-[#4a4455]',
                                    )}>
                                        {done ? <CheckCircle2 className="h-3 w-3" /> : (
                                            <AgentAvatar agentId={step.agentId} size={18} animate={active} />
                                        )}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <span className="block leading-tight">{step.label}</span>
                                        <span className={cn(
                                            'block text-[9px] leading-tight mt-0.5',
                                            active ? 'text-[#958da1]' : 'text-[#4a4455]',
                                        )}>
                                            {persona.emoji} {step.tip}
                                        </span>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Nav items */}
            <nav className="relative flex-1 space-y-0.5 px-3 overflow-y-auto">
                {navigation.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.name}
                            href={item.href}
                            className={cn(
                                'group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200',
                                isActive
                                    ? 'bg-[#7C3AED]/[0.08] text-white'
                                    : 'text-[#958da1] hover:bg-[#1c1f2a] hover:text-[#ccc3d8]',
                            )}
                        >
                            <div className={cn('p-1.5 rounded-lg transition-colors', isActive ? 'bg-[#7C3AED]/20 text-[#d2bbff]' : 'text-[#4a4455] group-hover:text-[#958da1]')}>
                                <item.icon className="h-4 w-4 shrink-0" />
                            </div>
                            <span className="text-sm font-semibold">{t(item.name)}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Bottom */}
            <div className="relative mt-2 border-t border-[#4a4455]/[0.1] p-4 bg-[#0a0e18]">
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
                {/* Agent team mini-strip */}
                <div className="mt-3 rounded-xl bg-[#181b26] p-3">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4455] mb-2">Tu equipo IA</p>
                    <div className="flex items-center gap-1">
                        {['master', 'auditor', 'writer', 'corrector', 'mapper', 'payroll-expert', 'researcher'].map((id) => (
                            <AgentAvatar key={id} agentId={id} size={20} animate={false} />
                        ))}
                    </div>
                </div>
            </div>
        </aside>
    );
}
