'use client';

import { cn } from '@/lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

export interface ForecastDataPoint {
  period: string;
  actual?: number;
  expected: number;
  optimistic: number;
  pessimistic: number;
}

export interface ForecastChartProps {
  data: ForecastDataPoint[];
  title?: string;
  className?: string;
}

export function ForecastChart({ data, title = 'Cost Forecast', className }: ForecastChartProps) {
  return (
    <div className={cn('rounded-xl border border-white/10 bg-[#181b26] p-4', className)}>
      <h3 className="mb-4 text-sm font-semibold text-white">{title}</h3>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="period" tick={{ fill: '#958da1', fontSize: 11 }} />
          <YAxis tick={{ fill: '#958da1', fontSize: 11 }} />
          <RechartsTooltip
            contentStyle={{ backgroundColor: '#181b26', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8 }}
            labelStyle={{ color: '#fff' }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Area type="monotone" dataKey="pessimistic" stroke="#E11D48" fill="#E11D48" fillOpacity={0.08} name="Pessimistic" />
          <Area type="monotone" dataKey="expected" stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.15} name="Expected" />
          <Area type="monotone" dataKey="optimistic" stroke="#10B981" fill="#10B981" fillOpacity={0.08} name="Optimistic" />
          {data.some((d) => d.actual !== undefined) && (
            <Area type="monotone" dataKey="actual" stroke="#F59E0B" fill="none" strokeWidth={2} strokeDasharray="5 5" name="Actual" />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
