import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface MetricsProps {
    total: number;
    certRate: number;
    avgRisk: number;
    criticalFindings: number;
}

export function DashboardMetrics({ total, certRate, avgRisk, criticalFindings }: MetricsProps) {
    return (
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wide text-slate-400">Planillas filtradas</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-bold text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.4)]">
                    {total}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wide text-slate-400">Certificación</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-bold text-emerald-light drop-shadow-[0_0_10px_rgba(52,211,153,0.6)]">
                    {certRate.toFixed(1)}%
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wide text-slate-400">Riesgo promedio</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-bold text-violet-light drop-shadow-[0_0_10px_rgba(139,92,246,0.6)]">
                    {avgRisk.toFixed(1)}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="pb-2">
                    <CardTitle className="text-xs uppercase tracking-wide text-slate-400">Hallazgos críticos</CardTitle>
                </CardHeader>
                <CardContent className="text-3xl font-bold text-rose-light drop-shadow-[0_0_10px_rgba(251,113,133,0.6)]">
                    {criticalFindings}
                </CardContent>
            </Card>
        </section>
    );
}
