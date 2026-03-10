import { CalendarClock, ShieldCheck, BarChart3, FileCheck2, ArrowRight } from 'lucide-react';
import { Link } from '@/i18n/routing';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export interface LatestPayrollData {
    id: string;
    company_name: string | null;
    period_year: number;
    period_month: number;
    certification_ready: boolean;
    risk_report?: { score?: number };
    calculation_validation_report?: { criticalFindings?: number };
}

interface LatestPayrollCardProps {
    latest?: LatestPayrollData;
}

function safeNumber(input: unknown) {
    return typeof input === 'number' && Number.isFinite(input) ? input : 0;
}

export function LatestPayrollCard({ latest }: LatestPayrollCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm text-white drop-shadow-sm">Última planilla del filtro</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-slate-300">
                {!latest && <p className="text-slate-400">No hay planillas para los filtros seleccionados.</p>}
                {latest && (
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3 rounded-lg border border-white/5 bg-black/20 p-3 shadow-inner">
                            <CalendarClock className="h-5 w-5 text-violet-light drop-shadow-[0_0_3px_rgba(139,92,246,0.5)]" />
                            <div className="flex flex-col">
                                <span className="font-medium text-white drop-shadow-sm">{latest.company_name ?? 'Sin empresa'}</span>
                                <span className="text-xs text-slate-400">{String(latest.period_month).padStart(2, '0')}/{latest.period_year}</span>
                            </div>
                        </div>

                        <div className="ml-2 space-y-2">
                            <p className="flex items-center gap-2">
                                <ShieldCheck className={`h-4 w-4 ${latest.certification_ready ? 'text-emerald-light drop-shadow-[0_0_4px_rgba(52,211,153,0.6)]' : 'text-slate-400'}`} />
                                Estado: <strong className={latest.certification_ready ? 'text-emerald-light drop-shadow-[0_0_4px_rgba(52,211,153,0.6)]' : ''}>{latest.certification_ready ? 'Certificable' : 'No certificable'}</strong>
                            </p>
                            <p className="flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-slate-400" />
                                Riesgo: <strong className="text-white drop-shadow-sm">{safeNumber(latest.risk_report?.score)}</strong>
                            </p>
                            <p className="flex items-center gap-2">
                                <FileCheck2 className="h-4 w-4 text-slate-400" />
                                Críticos: <strong className="text-rose-light drop-shadow-[0_0_4px_rgba(251,113,133,0.6)]">{safeNumber(latest.calculation_validation_report?.criticalFindings)}</strong>
                            </p>
                        </div>

                        <div className="pt-3 border-t border-white/10">
                            <Link href="/reconcile" className="inline-flex items-center gap-1.5 text-sm font-semibold text-violet-light hover:text-white drop-shadow-[0_0_5px_rgba(139,92,246,0.5)] transition-colors">
                                Abrir y corregir ahora
                                <ArrowRight className="h-3.5 w-3.5" />
                            </Link>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
