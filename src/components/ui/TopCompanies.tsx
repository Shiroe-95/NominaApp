import { Building2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export interface TopCompanyData {
    company: string;
    total: number;
    certifiable: number;
    riskAvg: number;
}

interface TopCompaniesProps {
    data: TopCompanyData[];
}

export function TopCompanies({ data }: TopCompaniesProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-sm text-white drop-shadow-sm">Empresas con mayor volumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {data.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-6 text-slate-400">
                        <Building2 className="mb-2 h-8 w-8 opacity-20" />
                        <p className="text-sm">No hay información suficiente.</p>
                    </div>
                )}
                {data.map((c) => (
                    <div key={c.company} className="flex items-center justify-between rounded-lg border border-white/5 bg-black/20 p-3 text-sm shadow-sm transition-all hover:border-violet/40 hover:bg-white/5 hover:-translate-y-0.5 hover:shadow-[0_0_15px_rgba(139,92,246,0.15)]">
                        <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white/5 text-slate-300 drop-shadow-md border border-white/10">
                                <Building2 className="h-4 w-4" />
                            </div>
                            <span className="font-medium text-white">{c.company}</span>
                        </div>
                        <div className="flex flex-col items-end text-xs text-slate-300">
                            <span>{c.total} planillas <span className="text-emerald-light drop-shadow-[0_0_2px_rgba(52,211,153,0.8)]">({c.certifiable} cert.)</span></span>
                            <span className="text-slate-400">Riesgo <strong className="text-violet-light drop-shadow-[0_0_2px_rgba(139,92,246,0.8)]">{c.riskAvg.toFixed(1)}</strong></span>
                        </div>
                    </div>
                ))}
            </CardContent>
        </Card>
    );
}
