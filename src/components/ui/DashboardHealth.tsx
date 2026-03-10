import { CheckCircle2, AlertTriangle, Users, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

interface DashboardHealthProps {
    certifiable: number;
    noCertifiable: number;
    employeesAtRisk: number;
    rowsWithFindings: number;
}

export function DashboardHealth({ certifiable, noCertifiable, employeesAtRisk, rowsWithFindings }: DashboardHealthProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm text-white drop-shadow-sm">Salud de certificación</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-300">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-light drop-shadow-[0_0_4px_rgba(52,211,153,0.6)]" />
                        <span>Certificables</span>
                    </div>
                    <strong className="text-base text-white">{certifiable}</strong>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-rose-light drop-shadow-[0_0_4px_rgba(251,113,133,0.6)]" />
                        <span>No certificables</span>
                    </div>
                    <strong className="text-base text-white">{noCertifiable}</strong>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-amber-light drop-shadow-[0_0_4px_rgba(252,211,77,0.6)]" />
                        <span>Empleados con riesgo</span>
                    </div>
                    <strong className="text-base text-white">{employeesAtRisk}</strong>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TrendingDown className="h-5 w-5 text-amber-light drop-shadow-[0_0_4px_rgba(252,211,77,0.6)]" />
                        <span>Filas con hallazgos</span>
                    </div>
                    <strong className="text-base text-white">{rowsWithFindings}</strong>
                </div>
            </CardContent>
        </Card>
    );
}
