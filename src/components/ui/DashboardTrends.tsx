import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { BarChart3 } from 'lucide-react';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer
} from 'recharts';

export interface TrendData {
    key: string;
    label: string;
    total: number;
    certifiable: number;
    critical: number;
}

interface DashboardTrendsProps {
    data: TrendData[];
}

export function DashboardTrends({ data }: DashboardTrendsProps) {
    const chartData = data.map(item => ({
        ...item,
        certPct: item.total > 0 ? (item.certifiable / item.total) * 100 : 0
    }));

    return (
        <Card className="lg:col-span-2">
            <CardHeader>
                <CardTitle className="text-sm text-white drop-shadow-sm">Tendencia de Certificación (%)</CardTitle>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <div className="flex h-[250px] flex-col items-center justify-center text-slate-400">
                        <BarChart3 className="mb-2 h-8 w-8 opacity-20" />
                        <p className="text-sm">Sin datos para los filtros actuales.</p>
                    </div>
                ) : (
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCert" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} domain={[0, 100]} />
                                <RechartsTooltip
                                    cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1, strokeDasharray: '3 3' }}
                                    contentStyle={{ borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(12px)', boxShadow: '0 0 20px rgba(0,0,0,0.5)' }}
                                    itemStyle={{ color: '#F8FAFC' }}
                                    formatter={(value: any) => [`${Number(value).toFixed(1)}%`, 'Certificable']}
                                    labelStyle={{ color: '#94A3B8', marginBottom: '4px' }}
                                />
                                <Area type="monotone" dataKey="certPct" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#colorCert)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
