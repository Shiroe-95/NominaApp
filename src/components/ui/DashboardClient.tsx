'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { ArrowRight } from 'lucide-react';
import { DashboardMetrics } from '@/components/ui/DashboardMetrics';
import { DashboardTrends } from '@/components/ui/DashboardTrends';
import { DashboardHealth } from '@/components/ui/DashboardHealth';
import { TopCompanies } from '@/components/ui/TopCompanies';
import { LatestPayrollCard } from '@/components/ui/LatestPayrollCard';

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
    initialCompanies: Company[];
    initialPayrolls: PayrollRow[];
}

export function DashboardClient({ initialCompanies, initialPayrolls }: DashboardClientProps) {
    const t = useTranslations('Dashboard');
    const [companyId, setCompanyId] = useState('all');
    const [countryCode, setCountryCode] = useState<'all' | 'CO' | 'MX'>('all');
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

        return {
            total,
            certifiable,
            noCertifiable,
            certRate,
            avgRisk,
            criticalFindings,
            rowsWithFindings,
            employeesAtRisk,
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

    const latest = filtered[0];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <section className="rounded-3xl border border-white/10 glass-panel px-6 py-6 shadow-2xl shadow-black/40">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <p className="text-xs font-semibold uppercase tracking-widest text-violet-light drop-shadow-sm">{t('executiveControl')}</p>
                        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white drop-shadow-md lg:text-3xl">
                            {t('heroTitle')}
                        </h1>
                        <p className="mt-2 text-sm text-slate-300">
                            {t('heroSubtitle')}
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Link href="/upload" className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet to-violet-dark px-4 py-2 text-sm font-semibold text-white shadow-[0_0_15px_rgba(139,92,246,0.5)] hover:shadow-[0_0_25px_rgba(139,92,246,0.7)] hover:-translate-y-0.5 transition-all">
                            {t('uploadPayroll')}
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link href="/reconcile" className="inline-flex items-center gap-2 rounded-xl border border-white/10 glass-panel px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10 hover:shadow-[0_0_15px_rgba(255,255,255,0.1)] hover:-translate-y-0.5 transition-all">
                            {t('correctLive')}
                        </Link>
                    </div>
                </div>
            </section>

            <section className="rounded-2xl border border-white/10 glass-panel p-4 shadow-xl shadow-black/20">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">{t('filters')}</p>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                    <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className="h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white focus:border-violet-light focus:ring-1 focus:ring-violet-light outline-none transition-shadow shadow-inner">
                        <option value="all">{t('allCompanies')}</option>
                        {initialCompanies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <select value={countryCode} onChange={(e) => setCountryCode(e.target.value as 'all' | 'CO' | 'MX')} className="h-10 rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-white focus:border-violet-light focus:ring-1 focus:ring-violet-light outline-none transition-shadow shadow-inner">
                        <option value="all">{t('allCountries')}</option>
                        <option value="CO">{t('colombia')}</option>
                        <option value="MX">{t('mexico')}</option>
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

            <div className="animate-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both delay-100">
                <DashboardMetrics
                    total={metrics.total}
                    certRate={metrics.certRate}
                    avgRisk={metrics.avgRisk}
                    criticalFindings={metrics.criticalFindings}
                />
            </div>

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

            <div className="animate-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both delay-300">
                <section className="grid grid-cols-1 gap-4 lg:grid-cols-2 mt-4">
                    <TopCompanies data={companyBreakdown} />
                    <LatestPayrollCard latest={latest as any} />
                </section>
            </div>
        </div>
    );
}
