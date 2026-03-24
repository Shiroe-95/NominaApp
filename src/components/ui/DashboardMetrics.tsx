'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { colors, elevation, calculateTrend, type TrendResult } from '@/lib/design-tokens';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

/**
 * Props del componente DashboardMetrics.
 *
 * Los valores `previous*` son opcionales: cuando se proporcionan,
 * se calcula y muestra un indicador de tendencia (up/down/stable)
 * junto a cada métrica usando {@link calculateTrend}.
 *
 * @see Requirements 4.1, 4.2
 */
interface MetricsProps {
    /** Total de planillas filtradas en el período actual */
    total: number;
    /** Tasa de certificación (0–100) */
    certRate: number;
    /** Riesgo promedio calculado */
    avgRisk: number;
    /** Cantidad de hallazgos de severidad crítica */
    criticalFindings: number;
    /** Total de planillas del período anterior (para tendencia) */
    previousTotal?: number;
    /** Tasa de certificación del período anterior */
    previousCertRate?: number;
    /** Riesgo promedio del período anterior */
    previousAvgRisk?: number;
    /** Hallazgos críticos del período anterior */
    previousCriticalFindings?: number;
}

/**
 * Anima numéricamente la transición entre un valor anterior y uno nuevo
 * usando easing cúbico (ease-out) durante 400ms con `requestAnimationFrame`.
 *
 * @param value - Valor numérico objetivo
 * @param format - Función opcional de formateo del valor mostrado
 */
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

/**
 * Badge visual que muestra la dirección y porcentaje de una tendencia.
 *
 * Usa iconos de Lucide (TrendingUp/TrendingDown/Minus) y colores semánticos
 * del sistema de diseño premium ({@link colors}).
 *
 * @param trend - Resultado de {@link calculateTrend} con dirección y porcentaje
 */
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
 * Tarjetas de métricas principales del dashboard ejecutivo.
 *
 * Muestra 4 KPIs (planillas, certificación, riesgo, hallazgos críticos)
 * con valores animados y badges de tendencia opcionales. Consume tokens
 * del sistema de diseño premium para colores y elevación.
 *
 * @see Requirements 4.1 (indicadores de tendencia)
 * @see Requirements 4.2 (tooltips y métricas mejoradas)
 */
export function DashboardMetrics({
    total, certRate, avgRisk, criticalFindings,
    previousTotal, previousCertRate, previousAvgRisk, previousCriticalFindings,
}: MetricsProps) {
    const totalTrend = previousTotal != null ? calculateTrend(total, previousTotal) : null;
    const certTrend = previousCertRate != null ? calculateTrend(certRate, previousCertRate) : null;
    const riskTrend = previousAvgRisk != null ? calculateTrend(avgRisk, previousAvgRisk) : null;
    const criticalTrend = previousCriticalFindings != null ? calculateTrend(criticalFindings, previousCriticalFindings) : null;

    const cardStyle = { boxShadow: elevation.low };

    return (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card style={cardStyle}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wide" style={{ color: colors.onSurface, opacity: 0.6 }}>
                        Planillas filtradas
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

            <Card style={cardStyle}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wide" style={{ color: colors.onSurface, opacity: 0.6 }}>
                        Certificación
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

            <Card style={cardStyle}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wide" style={{ color: colors.onSurface, opacity: 0.6 }}>
                        Riesgo promedio
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

            <Card style={cardStyle}>
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wide" style={{ color: colors.onSurface, opacity: 0.6 }}>
                        Hallazgos críticos
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
        </section>
    );
}
