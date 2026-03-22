'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import {
    ArrowRight, Shield, FileText, Users, Activity,
    AlertTriangle, CheckCircle, Clock, TrendingUp,
    BarChart3,
} from 'lucide-react';
import { MetricCard } from '@/components/ui/MetricCard';
import { DashboardTrends } from '@/components/ui/DashboardTrends';
import { DashboardHealth } from '@/components/ui/DashboardHealth';
import { TopCompanies } from '@/components/ui/TopCompanies';
import { LatestPayrollCard } from '@/components/ui/LatestPayrollCard';
import type { UserRole } from '@/lib/auth/user-profile';

interface Company {
    id: string;
    name: string;
    nit: string;
}

interface PayrollRow {
    id: string;
    company_id: string;
    company_name: string | null;
    country_code: string;
    period_year: number;
    period_month: number;
    certification_ready: boolean;
    risk_report?: { score?: number; level?: 'low' | 'medium' | 'high' };
    employee_risk_summary?: { employeesWithRisk?: number; employeesAnalyzed?: number };
    calculation_validation_report?: { criticalFindings?: number; rowsWithFindings?: number; rowsAnalyzed?: number };
    created_at: string;
}

function safeNumber(input: unknown) {
    return typeof input === 'number' && Number.isFinite(input) ? input : 0;
}

interface DashboardClientProps {
    role: UserRole;
    initialCompanies: Company[];
    initialPayrolls: PayrollRow[];
}

// Severity color helpers for findings (Req 13.3)
const severityColor = {
    high: 'text-rose-light bg-rose/10 border-rose/20',
    medium: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
    low: 'text-emerald bg-emerald/10 border-emerald/20',
} as const;

function getSeverityFromScore(score: number): 'high' | 'medium' | 'low' {
    if (score >= 70) return 'high';
    if (score >= 40) return 'medium';
    return 'low';
}

export function DashboardClient({ role, initialCompanies, initialPayrolls }: DashboardClientProps) {
    const t = useTranslations('Dashboard');
    const [companyId, setCompanyId] = useState('all');
    const [countryCode, setCountryCode] = useState<string>('all');
    const [year, setYear] = useState<'all' | number>('all');
    const [month, setMonth] = useState<'all' | number>('all');

    const availableYears = useMemo(() => Array.from(new Set(initialPayrolls.map((p) => p.period_year))).sort((a, b) => b - a), [initialPayrolls]);
    const availableMonths = useMemo(() => Array.from(new Set(initialPayrolls.map((p) => p.period_month))).sort((a, b) => a - b), [initialPayrolls]);

    const filtered = useMemo(() => {
        return initialPayrolls.filter((row) => {
            if (companyId !== 'all' && row.company_id !== companyId) return false;
            if (countryCode !== 'all' && row.country_code !== countryCode) return false;
            if (year !== 'all' && row.period_year !== year) return false;
            if (month !== 'all' && row.period_month !== month) return false;
            return true;
        });
    }, [initialPayrolls, companyId, countryCode, year, month]);

    const metrics = useMemo(() => {
        const total = filtered.length;
        const certifiable = filtered.filter((p) => p.certification_ready).length;
        const noCertifiable = total - certifiable;
        const certRate = total > 0 ? (certifiable / total) * 100 : 0;
        const avgRisk = total > 0
            ? filtered.reduce((acc, p) => acc + safeNumber(p.risk_report?.score), 0) / total
            : 0;
        const criticalFindings = filtered.reduce(
            (acc, p) => acc + safeNumber(p.calculation_validation_report?.criticalFindings), 0
        );
        const rowsWithFindings = filtered.reduce(
            (acc, p) => acc + safeNumber(p.calculation_validation_report?.rowsWithFindings), 0
        );
        const employeesAtRisk = filtered.reduce(
            (acc, p) => acc + safeNumber(p.employee_risk_summary?.employeesWithRisk), 0
        );
        const uniqueCompanies = new Set(filtered.map((p) => p.company_id)).size;
        const pendingPayrolls = filtered.filter((p) => !p.certification_ready).length;

        return {
            total, certifiable, noCertifiable, certRate, avgRisk,
            criticalFindings, rowsWithFindings, employeesAtRisk,
            uniqueCompanies, pendingPayrolls,
        };
    }, [filtered]);

    const monthlySeries = useMemo(() => {
        const map = new Map<string, { key: string; label: string; total: number; certifiable: number; critical: number }>();
        for (const row of filtered) {
            const key = `${row.period_year}-${String(row.period_month).padStart(2, '0')}`;
            const label = `${String(row.period_month).padStart(2, '0')}/${row.period_year}`;
            if (!map.has(key)) map.set(key, { key, label, total: 0, certifiable: 0, critical: 0 });
            const entry = map.get(key)!;
            entry.total += 1;
            if (row.certification_ready) entry.certifiable += 1;
            entry.critical += safeNumber(row.calculation_validation_report?.criticalFindings);
        }
        return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key)).slice(-8);
    }, [filtered]);

    const companyBreakdown = useMemo(() => {
        const map = new Map<string, { company: string; total: number; certifiable: number; riskAvg: number }>();
        for (const row of filtered) {
            const key = row.company_name ?? 'Sin empresa';
            if (!map.has(key)) map.set(key, { company: key, total: 0, certifiable: 0, riskAvg: 0 });
            const item = map.get(key)!;
            item.total += 1;
            if (row.certification_ready) item.certifiable += 1;
            item.riskAvg += safeNumber(row.risk_report?.score);
        }
        return Array.from(map.values())
            .map((x) => ({ ...x, riskAvg: x.total > 0 ? x.riskAvg / x.total : 0 }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 6);
    }, [filtered]);

    // Recent findings with severity for Req 13.3
    const recentFindings = useMemo(() => {
        return filtered
            .filter((p) => safeNumber(p.calculation_validation_report?.criticalFindings) > 0 || safeNumber(p.risk_report?.score) > 0)
            .slice(0, 5)
            .map((p) => ({
                id: p.id,
                company: p.company_name ?? t('unknownCompany'),
                period: `${String(p.period_month).padStart(2, '0')}/${p.period_year}`,
                criticalFindings: safeNumber(p.calculation_validation_report?.criticalFindings),
                riskScore: safeNumber(p.risk_report?.score),
                severity: getSeverityFromScore(safeNumber(p.risk_report?.score)),
                certReady: p.certification_ready,
            }));
    }, [filtered, t]);

    const latest = filtered[0];

    // --- Hero section varies by role ---
    const heroConfig = {
        admin: {
            badge: t('adminPanel'),
            title: t('adminHeroTitle'),
            subtitle: t('adminHeroSubtitle'),
        },
        analyst: {
            badge: t('analystPanel'),
            title: t('analystHeroTitle'),
            subtitle: t('analystHeroSubtitle'),
        },
        client: {
            badge: t('clientPanel'),
            title: t('clientHeroTitle'),
            subtitle: t('clientHeroSubtitle'),
        },
    }[role];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Hero */}
            <section className="rounded-3xl border border-white/10 glass-panel px-6 py-6 shadow-2xl shadow-black/40">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <p className="text-xs font-semibold uppercase tracking-widest text-violet-light drop-shadow-sm">{heroConfig.badge}</p>
                        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white drop-shadow-md lg:text-3xl">
                            {heroConfig.title}
                        </h1>
                        <p className="mt-2 text-sm text-slate-300">{heroConfig.subtitle}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(role === 'admin' || role === 'analyst') && (
                            <Link href="/upload" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet to-violet-dark px-4 py-2 text-sm font-semibold text-white shadow-[0_0_15px_rgba(139,92,246,0.5)] hover:shadow-[0_0_25px_rgba(139,92,246,0.7)] hover:-translate-y-0.5 transition-all">
                                {t('uploadPayroll')}
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        )}
                        <Link href="/reconcile" className="inline-flex items-center gap-2 rounded-xl border border-white/10 glass-panel px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:-translate-y-0.5 transition-all">
                            {role === 'client' ? t('viewReports') : t('correctLive')}
                        </Link>
                    </div>
                </div>
            </section>

            {/* Filters — Req 13.2: filtering by period and company */}
            <section className="rounded-2xl border border-white/10 glass-panel p-4 shadow-xl shadow-black/20">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('filters')}</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    {/* Company filter — admin/analyst see all, client sees only their company */}
                    {role !== 'client' && (
                        <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white focus:border-violet-light focus:ring-1 focus:ring-violet-light outline-none transition-shadow shadow-inner">
                            <option value="all">{t('allCompanies')}</option>
                            {initialCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    )}
                    <select value={countryCode} onChange={(e) => setCountryCode(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white focus:border-violet-light focus:ring-1 focus:ring-violet-light outline-none transition-shadow shadow-inner">
                        <option value="all">{t('allCountries')}</option>
                        <option value="CO">🇨🇴 Colombia</option>
                        <option value="MX">🇲🇽 México</option>
                        <option value="PE">🇵🇪 Perú</option>
                        <option value="CL">🇨🇱 Chile</option>
                        <option value="BR">🇧🇷 Brasil</option>
                        <option value="AR">🇦🇷 Argentina</option>
                        <option value="US">🇺🇸 Estados Unidos</option>
                    </select>
                    <select value={year === 'all' ? 'all' : year} onChange={(e) => setYear(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white focus:border-violet-light focus:ring-1 focus:ring-violet-light outline-none transition-shadow shadow-inner">
                        <option value="all">{t('allYears')}</option>
                        {availableYears.map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={month === 'all' ? 'all' : month} onChange={(e) => setMonth(e.target.value === 'all' ? 'all' : Number(e.target.value))} className="h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white focus:border-violet-light focus:ring-1 focus:ring-violet-light outline-none transition-shadow shadow-inner">
                        <option value="all">{t('allMonths')}</option>
                        {availableMonths.map((m) => <option key={m} value={m}>{String(m).padStart(2, '0')}</option>)}
                    </select>
                </div>
            </section>

            {/* Role-specific metric cards — Req 13.1 */}
            <div className="animate-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both delay-100">
                {role === 'admin' && <AdminMetrics metrics={metrics} t={t} />}
                {role === 'analyst' && <AnalystMetrics metrics={metrics} t={t} />}
                {role === 'client' && <ClientMetrics metrics={metrics} t={t} />}
            </div>

            {/* Charts and trends */}
            <div className="animate-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both delay-200">
                <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <DashboardHealth
                        certifiable={metrics.certifiable}
                        noCertifiable={metrics.noCertifiable}
                        employeesAtRisk={metrics.employeesAtRisk}
                        rowsWithFindings={metrics.rowsWithFindings}
                    />
                    <DashboardTrends data={monthlySeries} />
                </section>
            </div>

            {/* Recent findings with severity color coding — Req 13.3 */}
            {recentFindings.length > 0 && (
                <div className="animate-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both delay-250">
                    <RecentFindingsSummary findings={recentFindings} t={t} />
                </div>
            )}

            <div className="animate-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both delay-300">
                <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 mt-4">
                    {role !== 'client' && <TopCompanies data={companyBreakdown} />}
                    <LatestPayrollCard latest={latest as any} />
                    {role === 'client' && (
                        <CertificationStatusCard
                            certRate={metrics.certRate}
                            certifiable={metrics.certifiable}
                            total={metrics.total}
                            t={t}
                        />
                    )}
                </section>
            </div>
        </div>
    );
}


// ─── Admin Metrics: Global overview (all companies), AI usage, active providers, total payrolls ───
function AdminMetrics({ metrics, t }: { metrics: any; t: any }) {
    return (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
                label={t('totalPayrolls')}
                value={metrics.total}
                icon={<FileText className="h-5 w-5" />}
                trend={metrics.total > 0 ? { direction: 'up', value: `${metrics.total}` } : undefined}
            />
            <MetricCard
                label={t('activeCompanies')}
                value={metrics.uniqueCompanies}
                icon={<Users className="h-5 w-5" />}
            />
            <MetricCard
                label={t('criticalFindings')}
                value={metrics.criticalFindings}
                icon={<AlertTriangle className="h-5 w-5" />}
                className={metrics.criticalFindings > 0 ? 'border-rose/20' : ''}
            />
            <MetricCard
                label={t('certificationRate')}
                value={`${metrics.certRate.toFixed(1)}%`}
                icon={<Shield className="h-5 w-5" />}
                trend={metrics.certRate >= 80
                    ? { direction: 'up', value: `${metrics.certRate.toFixed(0)}%` }
                    : { direction: 'down', value: `${metrics.certRate.toFixed(0)}%` }
                }
            />
        </section>
    );
}

// ─── Analyst Metrics: Pending payrolls, recent findings, pending actions, quick upload ───
function AnalystMetrics({ metrics, t }: { metrics: any; t: any }) {
    return (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
                label={t('pendingPayrolls')}
                value={metrics.pendingPayrolls}
                icon={<Clock className="h-5 w-5" />}
                className={metrics.pendingPayrolls > 0 ? 'border-amber-400/20' : ''}
            />
            <MetricCard
                label={t('criticalFindings')}
                value={metrics.criticalFindings}
                icon={<AlertTriangle className="h-5 w-5" />}
                className={metrics.criticalFindings > 0 ? 'border-rose/20' : ''}
            />
            <MetricCard
                label={t('rowsWithFindings')}
                value={metrics.rowsWithFindings}
                icon={<Activity className="h-5 w-5" />}
            />
            <MetricCard
                label={t('totalPayrolls')}
                value={metrics.total}
                icon={<FileText className="h-5 w-5" />}
            />
        </section>
    );
}

// ─── Client Metrics: Company-specific, certification status, prioritized findings, risk trends ───
function ClientMetrics({ metrics, t }: { metrics: any; t: any }) {
    return (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
                label={t('certificationRate')}
                value={`${metrics.certRate.toFixed(1)}%`}
                icon={<Shield className="h-5 w-5" />}
                trend={metrics.certRate >= 80
                    ? { direction: 'up', value: `${metrics.certRate.toFixed(0)}%` }
                    : { direction: 'down', value: `${metrics.certRate.toFixed(0)}%` }
                }
            />
            <MetricCard
                label={t('averageRisk')}
                value={metrics.avgRisk.toFixed(1)}
                icon={<TrendingUp className="h-5 w-5" />}
                trend={metrics.avgRisk < 40
                    ? { direction: 'down', value: t('lowRisk') }
                    : { direction: 'up', value: t('highRisk') }
                }
            />
            <MetricCard
                label={t('criticalFindings')}
                value={metrics.criticalFindings}
                icon={<AlertTriangle className="h-5 w-5" />}
                className={metrics.criticalFindings > 0 ? 'border-rose/20' : ''}
            />
            <MetricCard
                label={t('employeesAtRisk')}
                value={metrics.employeesAtRisk}
                icon={<Users className="h-5 w-5" />}
            />
        </section>
    );
}

// ─── Recent Findings Summary with color-coded severity (Req 13.3) ───
interface FindingSummary {
    id: string;
    company: string;
    period: string;
    criticalFindings: number;
    riskScore: number;
    severity: 'high' | 'medium' | 'low';
    certReady: boolean;
}

function RecentFindingsSummary({ findings, t }: { findings: FindingSummary[]; t: any }) {
    return (
        <section className="rounded-2xl border border-white/10 glass-panel p-5 shadow-xl shadow-black/20">
            <div className="flex items-center gap-2 mb-4">
                <BarChart3 className="h-4 w-4 text-violet-light" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                    {t('recentFindings')}
                </h3>
            </div>
            <div className="space-y-2">
                {findings.map((f) => (
                    <div
                        key={f.id}
                        className="flex items-center justify-between rounded-xl border border-white/5 bg-black/20 px-4 py-3 transition-colors hover:bg-white/5"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <span
                                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-xs font-semibold ${severityColor[f.severity]}`}
                            >
                                {f.severity === 'high' && <AlertTriangle className="h-3 w-3" />}
                                {f.severity === 'medium' && <Activity className="h-3 w-3" />}
                                {f.severity === 'low' && <CheckCircle className="h-3 w-3" />}
                                {t(`severity_${f.severity}`)}
                            </span>
                            <span className="text-sm text-white truncate">{f.company}</span>
                            <span className="text-xs text-slate-500">{f.period}</span>
                        </div>
                        <div className="flex items-center gap-4 shrink-0">
                            <span className="text-xs text-slate-400">
                                {f.criticalFindings} {t('findingsLabel')}
                            </span>
                            <span className="text-xs text-slate-500">
                                {t('riskLabel')}: {f.riskScore.toFixed(0)}
                            </span>
                            {f.certReady ? (
                                <CheckCircle className="h-4 w-4 text-emerald" />
                            ) : (
                                <Clock className="h-4 w-4 text-amber-400" />
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}

// ─── Certification Status Card (Client role) — Req 13.1 ───
function CertificationStatusCard({ certRate, certifiable, total, t }: { certRate: number; certifiable: number; total: number; t: any }) {
    const status = certRate >= 90 ? 'excellent' : certRate >= 70 ? 'good' : 'needsWork';
    const statusColors = {
        excellent: 'text-emerald border-emerald/20 bg-emerald/10',
        good: 'text-amber-400 border-amber-400/20 bg-amber-400/10',
        needsWork: 'text-rose-light border-rose/20 bg-rose/10',
    };

    return (
        <div className="glass-panel rounded-2xl border border-white/10 p-5 shadow-xl shadow-black/20">
            <div className="flex items-center gap-2 mb-4">
                <Shield className="h-4 w-4 text-violet-light" />
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                    {t('certificationStatus')}
                </h3>
            </div>
            <div className="flex items-center gap-4">
                <div className={`rounded-xl border px-4 py-3 text-center ${statusColors[status]}`}>
                    <p className="text-2xl font-bold">{certRate.toFixed(1)}%</p>
                    <p className="text-xs mt-1">{t(`certStatus_${status}`)}</p>
                </div>
                <div className="text-sm text-slate-300 space-y-1">
                    <p>{certifiable} / {total} {t('certifiable')}</p>
                    <p className="text-xs text-slate-500">{t('certificationExplanation')}</p>
                </div>
            </div>
        </div>
    );
}
