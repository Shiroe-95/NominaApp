'use client';

import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/routing';
import {
  LayoutDashboard, UploadCloud, GitMerge, FileCheck2,
  Settings, Zap, BookOpen, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { getPersona } from '@/lib/ai/agent-personas';
import { hasPermission, type UserRole } from '@/lib/auth/user-profile';
import { createClient } from '@/lib/supabase/client';

// ─── Types ──────────────────────────────────────────────────────────────────

type NavigationKey = 'dashboard' | 'upload' | 'reconcile' | 'reports' | 'rules';

interface NavItem {
  name: NavigationKey;
  href: string;
  icon: typeof LayoutDashboard;
}

// ─── Constants ──────────────────────────────────────────────────────────────

const navigation: NavItem[] = [
  { name: 'dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'upload', href: '/upload', icon: UploadCloud },
  { name: 'reconcile', href: '/reconcile', icon: GitMerge },
  { name: 'reports', href: '/reports', icon: FileCheck2 },
  { name: 'rules', href: '/rules', icon: BookOpen },
];

const flowSteps = [
  { labelKey: 'flowUpload' as const, href: '/upload', agentId: 'mapper', tipKey: 'flowUploadTip' as const },
  { labelKey: 'flowReconcile' as const, href: '/reconcile', agentId: 'auditor', tipKey: 'flowReconcileTip' as const },
  { labelKey: 'flowReports' as const, href: '/reports', agentId: 'writer', tipKey: 'flowReportsTip' as const },
];

// ─── Exported helpers ───────────────────────────────────────────────────────

/**
 * Returns the flow step index for a given pathname.
 * 0 = outside flow, 1 = /upload, 2 = /reconcile, 3 = /reports
 */
export function getFlowIndex(pathname: string): number {
  if (pathname.startsWith('/reports')) return 3;
  if (pathname.startsWith('/reconcile')) return 2;
  if (pathname.startsWith('/upload')) return 1;
  return 0;
}

// ─── Props ──────────────────────────────────────────────────────────────────

export interface SidebarProps {
  /** Optional role override — if not provided, fetched from Supabase client. */
  role?: UserRole;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function Sidebar({ role: roleProp }: SidebarProps = {}) {
  const t = useTranslations('Navigation');
  const tSidebar = useTranslations('Sidebar');
  const pathname = usePathname();
  const [fetchedRole, setFetchedRole] = useState<UserRole | null>(null);

  // Fetch user role from Supabase if not provided via prop
  useEffect(() => {
    if (roleProp) return;
    let cancelled = false;
    async function loadRole() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled || !user) return;
        const { data } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (!cancelled && data?.role) {
          setFetchedRole(data.role as UserRole);
        }
      } catch {
        // Fallback: keep null → show all links (safe default for rendering)
      }
    }
    loadRole();
    return () => { cancelled = true; };
  }, [roleProp]);

  const role = roleProp ?? fetchedRole;

  // Flow index updates synchronously on every render (pathname change) → <100ms
  const flowIndex = getFlowIndex(pathname);
  const dianis = getPersona('master');

  // Filter navigation links based on role
  const visibleNavItems = useMemo(() => {
    if (!role) return navigation; // While loading, show all (middleware already protects)
    return navigation.filter((item) => hasPermission(role, item.href));
  }, [role]);

  // Filter flow steps based on role
  const visibleFlowSteps = useMemo(() => {
    if (!role) return flowSteps;
    return flowSteps.filter((step) => hasPermission(role, step.href));
  }, [role]);

  // Settings link visibility
  const showSettings = !role || hasPermission(role, '/settings');

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
          <p className="text-[11px] font-medium text-[#958da1] tracking-wide uppercase">
            {tSidebar('tagline')}
          </p>
        </div>
      </div>

      {/* Agent-powered Flow — only show if there are visible flow steps */}
      {visibleFlowSteps.length > 0 && (
        <div className="relative px-4 pb-5">
          <div className="rounded-xl bg-[#181b26] p-3">
            {/* Dianis header */}
            <div className="flex items-center gap-2 mb-2.5">
              <AgentAvatar agentId="master" size={22} animate={false} />
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#958da1]">
                {dianis.emoji} {tSidebar('guidedBy', { name: dianis.name })}
              </p>
            </div>
            <div className="space-y-1">
              {visibleFlowSteps.map((step, index) => {
                // Calculate the step's position in the full flow for progress tracking
                const fullFlowIndex = flowSteps.indexOf(step) + 1;
                const done = flowIndex > fullFlowIndex;
                const active = flowIndex === fullFlowIndex;
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
                      <span className="block leading-tight">{tSidebar(step.labelKey)}</span>
                      <span className={cn(
                        'block text-[9px] leading-tight mt-0.5',
                        active ? 'text-[#958da1]' : 'text-[#4a4455]',
                      )}>
                        {persona.emoji} {tSidebar(step.tipKey)}
                      </span>
                    </div>
                    {/* Progress indicator dot */}
                    {done && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#10B981] shrink-0" />
                    )}
                    {active && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#7C3AED] animate-pulse shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
            {/* Progress bar */}
            <div className="mt-2.5 h-1 rounded-full bg-[#0a0e18] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#10B981] transition-all duration-200"
                style={{ width: `${Math.min((flowIndex / 3) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Nav items */}
      <nav className="relative flex-1 space-y-0.5 px-3 overflow-y-auto">
        {visibleNavItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
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
        {showSettings && (
          <Link
            href="/settings"
            className={cn(
              'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200',
              pathname === '/settings' || pathname.startsWith('/settings/')
                ? 'bg-[#1c1f2a] text-white'
                : 'text-[#958da1] hover:bg-[#1c1f2a] hover:text-white',
            )}
          >
            <Settings className="h-4 w-4" />
            {t('settings')}
          </Link>
        )}
        {/* Agent team mini-strip */}
        <div className="mt-3 rounded-xl bg-[#181b26] p-3">
          <p className="text-[9px] font-bold uppercase tracking-widest text-[#4a4455] mb-2">
            {tSidebar('aiTeam')}
          </p>
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
