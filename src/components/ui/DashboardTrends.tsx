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
import { colors, elevation } from '@/lib/design-tokens';

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
        <Card className="lg:col-span-2" style={{ boxShadow: elevation.low }}>
            <CardHeader>
                <CardTitle className="text-sm font-semibold" style={{ color: colors.onSurface }}>
                    Tendencia de Certificación (%)
                </CardTitle>
            </CardHeader>
            <CardContent>
                {data.length === 0 ? (
                    <div className="flex h-[250px] flex-col items-center justify-center" style={{ color: colors.onSurface, opacity: 0.4 }}>
                        <BarChart3 className="mb-2 h-8 w-8 opacity-20" />
                        <p className="text-sm">Sin datos para los filtros actuales.</p>
                    </div>
                ) : (
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorCert" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={colors.success} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={colors.success} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.surfaceContainer.high} />
                                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: colors.onSurface, fontSize: 12, opacity: 0.6 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: colors.onSurface, fontSize: 12, opacity: 0.6 }} domain={[0, 100]} />
                                <RechartsTooltip
                                    cursor={{ stroke: colors.surfaceContainer.max, strokeWidth: 1, strokeDasharray: '3 3' }}
                                    contentStyle={{
                                        borderRadius: '12px',
                                        border: `1px solid ${colors.surfaceContainer.high}`,
                                        background: colors.surfaceContainer.default,
                                        backdropFilter: 'blur(12px)',
                                        boxShadow: elevation.medium,
                                        color: colors.onSurface,
                                    }}
                                    itemStyle={{ color: colors.onSurface }}
                                    formatter={(value: number | string) => [`${Number(value).toFixed(1)}%`, 'Certificable']}
                                    labelStyle={{ color: colors.onSurface, opacity: 0.7, marginBottom: '4px' }}
                                />
                                <Area type="monotone" dataKey="certPct" stroke={colors.success} strokeWidth={2} fillOpacity={1} fill="url(#colorCert)" animationDuration={400} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
