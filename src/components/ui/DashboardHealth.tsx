import { CheckCircle2, AlertTriangle, Users, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { colors, elevation } from '@/lib/design-tokens';

interface DashboardHealthProps {
    certifiable: number;
    noCertifiable: number;
    employeesAtRisk: number;
    rowsWithFindings: number;
}

export function DashboardHealth({ certifiable, noCertifiable, employeesAtRisk, rowsWithFindings }: DashboardHealthProps) {
    return (
        <Card style={{ boxShadow: elevation.low }}>
            <CardHeader>
                <CardTitle className="text-sm font-semibold" style={{ color: colors.onSurface }}>
                    Salud de certificación
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm" style={{ color: colors.onSurface, opacity: 0.8 }}>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5" style={{ color: colors.success }} />
                        <span>Certificables</span>
                    </div>
                    <strong className="text-base" style={{ color: colors.onSurface }}>{certifiable}</strong>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5" style={{ color: colors.error }} />
                        <span>No certificables</span>
                    </div>
                    <strong className="text-base" style={{ color: colors.onSurface }}>{noCertifiable}</strong>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Users className="h-5 w-5" style={{ color: colors.warning }} />
                        <span>Empleados con riesgo</span>
                    </div>
                    <strong className="text-base" style={{ color: colors.onSurface }}>{employeesAtRisk}</strong>
                </div>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TrendingDown className="h-5 w-5" style={{ color: colors.warning }} />
                        <span>Filas con hallazgos</span>
                    </div>
                    <strong className="text-base" style={{ color: colors.onSurface }}>{rowsWithFindings}</strong>
                </div>
            </CardContent>
        </Card>
    );
}
