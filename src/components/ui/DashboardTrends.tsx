'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { BarChart3, TrendingUp } from 'lucide-react';
import {
    AreaChart,
    Area,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
} from 'recharts';
import { colors, elevation } from '@/lib/design-tokens';

/** Data point for certification trend (monthly aggregated). */
export interface TrendData {
    key: string;
    label: string;
    total: number;
    certifiable: number;
    critical: number;
}

/** Data point for risk trend (per-payroll, last 30). */
export interface RiskTrendData {
    key: string;
    label: string;
    riskScore: number;
}

interface DashboardTrendsProps {
    /** Monthly certification trend data */
    data: TrendData[];
    /** Per-payroll risk scores for last 30 payrolls (Req 2.2) */
    riskData?: RiskTrendData[];
}

/**
 * Gráficos de tendencia del dashboard (Req 2.2):
 * 1. Tendencia de riesgo — LineChart con scores de las últimas 30 planillas
 * 2. Tendencia de certificación — AreaChart con % certificable por período
 */
export function DashboardTrends({ data, riskData = [] }: DashboardTrendsProps) {
    const t = useTranslations('Dashboard');

    const certChartData = data.map(item => ({
        ...item,
        certPct: item.total > 0 ? (item.certifiable / item.total) * 100 : 0,
    }));

    const tooltipStyle = {
        borderRadius: '12px',
        border: `1px solid ${colors.surfaceContainer.high}`,
        background: colors.surfaceContainer.default,
        backdropFilter: 'blur(12px)',
        boxShadow: elevation.medium,
        color: colors.onSurface,
    };

    return (
        <Card className="lg:col-span-2" style={{ boxShadow: elevation.low }}>
            <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: colors.onSurface }}>
                    <TrendingUp className="h-4 w-4" style={{ color: colors.primary }} />
                    {t('riskTrendTitle')}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Risk trend chart — last 30 payrolls (Req 2.2) */}
                {riskData.length === 0 ? (
                    <div className="flex h-[200px] flex-col items-center justify-center" style={{ color: colors.onSurface, opacity: 0.4 }}>
                        <BarChart3 className="mb-2 h-8 w-8 opacity-20" />
                        <p className="text-sm">{t('noRiskData')}</p>
                    </div>
                ) : (
                    <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={riskData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.surfaceContainer.high} />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: colors.onSurface, fontSize: 11, opacity: 0.6 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: colors.onSurface, fontSize: 11, opacity: 0.6 }} domain={[0, 100]} />
                                <RechartsTooltip
                                    cursor={{ stroke: colors.surfaceContainer.max, strokeWidth: 1, strokeDasharray: '3 3' }}
                                    contentStyle={tooltipStyle}
                                    itemStyle={{ color: colors.onSurface }}
                                    formatter={(value) => [`${Number(value).toFixed(1)}`, t('averageRisk')]}
                                    labelStyle={{ color: colors.onSurface, opacity: 0.7, marginBottom: '4px' }}
                                />
                                <Line type="monotone" dataKey="riskScore" stroke={colors.error} strokeWidth={2} dot={{ r: 3, fill: colors.error }} animationDuration={400} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {/* Certification trend chart */}
                {data.length > 0 && (
                    <>
                        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: colors.onSurface, opacity: 0.6 }}>
                            {t('certTrendTitle')}
                        </p>
                        <div className="h-[200px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={certChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorCert" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor={colors.success} stopOpacity={0.3} />
                                            <stop offset="95%" stopColor={colors.success} stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.surfaceContainer.high} />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: colors.onSurface, fontSize: 11, opacity: 0.6 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: colors.onSurface, fontSize: 11, opacity: 0.6 }} domain={[0, 100]} />
                                    <RechartsTooltip
                                        cursor={{ stroke: colors.surfaceContainer.max, strokeWidth: 1, strokeDasharray: '3 3' }}
                                        contentStyle={tooltipStyle}
                                        itemStyle={{ color: colors.onSurface }}
                                        formatter={(value) => [`${Number(value).toFixed(1)}%`, t('certifiable')]}
                                        labelStyle={{ color: colors.onSurface, opacity: 0.7, marginBottom: '4px' }}
                                    />
                                    <Area type="monotone" dataKey="certPct" stroke={colors.success} strokeWidth={2} fillOpacity={1} fill="url(#colorCert)" animationDuration={400} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
