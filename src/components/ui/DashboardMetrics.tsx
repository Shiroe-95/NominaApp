'use client';

import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { colors, elevation, calculateTrend, type TrendResult } from '@/lib/design-tokens';
import { TrendingUp, TrendingDown, Minus, FileText, Shield, AlertTriangle, Activity } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Props del componente DashboardMetrics.
 *
 * Muestra las 4 métricas principales del dashboard (Req 2.1):
 * - Total de planillas
 * - Planillas certificables (tasa de certificación)
 * - Hallazgos críticos
 * - Score de riesgo promedio
 *
 * Los valores `previous*` son opcionales para indicadores de tendencia.
 */
interface MetricsProps {
    total: number;
    certRate: number;
    avgRisk: number;
    criticalFindings: number;
    previousTotal?: number;
    previousCertRate?: number;
    previousAvgRisk?: number;
    previousCriticalFindings?: number;
}

/** Animated numeric transition using cubic ease-out over 400ms. */
function AnimatedValue({ value, format }: { value: number; format?: (v: number) => string }) {
    const [displayed, setDisplayed] = useState(value);
    const prevRef = useRef(value);

    useEffect(() => {
        const from = prevRef.current;
        const to = value;
        if (from === to) return;
        prevRef.current = to;

        const duration = 400;
        const start = performance.now();

        function tick(now: number) {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setDisplayed(from + (to - from) * eased);
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }, [value]);

    const formatted = format ? format(displayed) : Math.round(displayed).toString();
    return <>{formatted}</>;
}

function TrendBadge({ trend }: { trend: TrendResult }) {
    if (trend.direction === 'stable') {
        return (
            <span className="inline-flex items-center gap-1 text-xs" style={{ color: colors.onSurface, opacity: 0.5 }}>
                <Minus className="h-3 w-3" />
                <span>0%</span>
            </span>
        );
    }
    const isUp = trend.direction === 'up';
    const Icon = isUp ? TrendingUp : TrendingDown;
    const color = isUp ? colors.success : colors.error;
    return (
        <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color }}>
            <Icon className="h-3 w-3" />
            <span>{Math.abs(trend.percentage).toFixed(1)}%</span>
        </span>
    );
}

/**
 * Tarjetas de métricas principales del dashboard ejecutivo (Req 2.1).
 *
 * Muestra 4 KPIs con valores animados, iconos y tendencias opcionales:
 * 1. Total planillas
 * 2. Planillas certificables (tasa %)
 * 3. Hallazgos críticos
 * 4. Score de riesgo promedio
 */
export function DashboardMetrics({
    total, certRate, avgRisk, criticalFindings,
    previousTotal, previousCertRate, previousAvgRisk, previousCriticalFindings,
}: MetricsProps) {
    const t = useTranslations('Dashboard');

    const totalTrend = previousTotal != null ? calculateTrend(total, previousTotal) : null;
    const certTrend = previousCertRate != null ? calculateTrend(certRate, previousCertRate) : null;
    const riskTrend = previousAvgRisk != null ? calculateTrend(avgRisk, previousAvgRisk) : null;
    const criticalTrend = previousCriticalFindings != null ? calculateTrend(criticalFindings, previousCriticalFindings) : null;

    const cardStyle = { boxShadow: elevation.low };

    return (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {/* Total planillas */}
            <Card style={cardStyle}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wide flex items-center gap-2" style={{ color: colors.onSurface, opacity: 0.6 }}>
                        <FileText className="h-4 w-4" />
                        {t('totalPayrolls')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold transition-all duration-300" style={{ color: colors.onSurface }}>
                            <AnimatedValue value={total} />
                        </span>
                        {totalTrend && <TrendBadge trend={totalTrend} />}
                    </div>
                </CardContent>
            </Card>

            {/* Planillas certificables */}
            <Card style={cardStyle}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wide flex items-center gap-2" style={{ color: colors.onSurface, opacity: 0.6 }}>
                        <Shield className="h-4 w-4" />
                        {t('certifiable')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold transition-all duration-300" style={{ color: colors.success }}>
                            <AnimatedValue value={certRate} format={(v) => `${v.toFixed(1)}%`} />
                        </span>
                        {certTrend && <TrendBadge trend={certTrend} />}
                    </div>
                </CardContent>
            </Card>

            {/* Hallazgos críticos */}
            <Card style={cardStyle}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wide flex items-center gap-2" style={{ color: colors.onSurface, opacity: 0.6 }}>
                        <AlertTriangle className="h-4 w-4" />
                        {t('criticalFindings')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold transition-all duration-300" style={{ color: colors.error }}>
                            <AnimatedValue value={criticalFindings} />
                        </span>
                        {criticalTrend && <TrendBadge trend={criticalTrend} />}
                    </div>
                </CardContent>
            </Card>

            {/* Score de riesgo promedio */}
            <Card style={cardStyle}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wide flex items-center gap-2" style={{ color: colors.onSurface, opacity: 0.6 }}>
                        <Activity className="h-4 w-4" />
                        {t('averageRisk')}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold transition-all duration-300" style={{ color: colors.primary }}>
                            <AnimatedValue value={avgRisk} format={(v) => v.toFixed(1)} />
                        </span>
                        {riskTrend && <TrendBadge trend={riskTrend} />}
                    </div>
                </CardContent>
            </Card>
        </section>
    );
}
