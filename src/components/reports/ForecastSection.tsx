/**
 * Forecast section for the Reports page.
 *
 * Shows the same forecast data as the dashboard widget, plus
 * adjustable parameters: growth rate, salary increase, and
 * regulatory changes. Recalculates in real-time on parameter change.
 *
 * Requirements: 13.3, 13.6, 13.7
 *
 * @module components/reports/ForecastSection
 */
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  type ForecastParameters,
  type ForecastHorizon,
  type ForecastChartPoint,
  type RegulatoryChange,
  formatCurrency,
  DEFAULT_PARAMETERS,
} from '@/lib/forecast/forecast-service';
import { useForecast } from '@/lib/forecast/use-forecast';

export function ForecastSection() {
  const {
    chartData,
    bands,
    alerts,
    loading,
    error,
    horizon,
    parameters,
    setHorizon,
    setParameters,
  } = useForecast({ autoRecalculate: true });

  const handleGrowthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) / 100;
    if (!isNaN(val)) setParameters({ ...parameters, growthRate: val });
  };

  const handleSalaryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value) / 100;
    if (!isNaN(val)) setParameters({ ...parameters, salaryIncrease: val });
  };

  const handleResetParams = () => {
    setParameters(DEFAULT_PARAMETERS);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📉</span>
          <h3 className="text-sm font-bold text-[var(--foreground)]">Cost Forecast</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* Horizon selector */}
          {([3, 6, 12] as ForecastHorizon[]).map(h => (
            <button
              key={h}
              onClick={() => setHorizon(h)}
              className={cn(
                'rounded px-3 py-1 text-xs font-medium transition-colors',
                horizon === h
                  ? 'bg-violet text-white'
                  : 'bg-white/5 text-slate-400 hover:bg-white/10',
              )}
            >
              {h}M
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="h-48 rounded-lg bg-[var(--muted)]/20 animate-pulse" />
      )}

      {error && (
        <div className="flex h-20 items-center justify-center rounded-lg bg-red-500/10 text-xs text-red-400">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Chart */}
          <ForecastReportsChart data={chartData} />

          {/* Parameters panel */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-xl border border-white/10 bg-black/10 p-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Growth Rate (%)
              </label>
              <input
                type="number"
                step="0.5"
                min="-10"
                max="50"
                value={(parameters.growthRate * 100).toFixed(1)}
                onChange={handleGrowthChange}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white focus:border-violet focus:outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Salary Increase (%)
              </label>
              <input
                type="number"
                step="0.5"
                min="-10"
                max="50"
                value={(parameters.salaryIncrease * 100).toFixed(1)}
                onChange={handleSalaryChange}
                className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-white focus:border-violet focus:outline-none"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={handleResetParams}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-slate-400 hover:bg-white/10 transition-colors"
              >
                Reset Defaults
              </button>
            </div>
          </div>

          {/* Bands table */}
          {bands.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400">
                    <th className="py-2 text-left font-bold">Period</th>
                    <th className="py-2 text-right font-bold">Optimistic</th>
                    <th className="py-2 text-right font-bold">Expected</th>
                    <th className="py-2 text-right font-bold">Pessimistic</th>
                  </tr>
                </thead>
                <tbody>
                  {bands.map((b, i) => (
                    <tr key={i} className="border-b border-white/5 text-slate-300">
                      <td className="py-1.5">{b.month}/{b.year}</td>
                      <td className="py-1.5 text-right text-emerald-400">{formatCurrency(b.optimistic)}</td>
                      <td className="py-1.5 text-right text-white font-medium">{formatCurrency(b.expected)}</td>
                      <td className="py-1.5 text-right text-amber-400">{formatCurrency(b.pessimistic)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Alerts */}
          {alerts.length > 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 space-y-1">
              <p className="text-xs font-bold text-amber-400">⚠️ Cost Alerts</p>
              {alerts.map((a, i) => (
                <p key={i} className="text-xs text-amber-300/80">
                  Projected increase of {a.projectedIncrease}% for {a.month}/{a.year}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Recharts-based forecast chart for the Reports page (larger) */
function ForecastReportsChart({ data }: { data: ForecastChartPoint[] }) {
  const [Recharts, setRecharts] = React.useState<typeof import('recharts') | null>(null);

  React.useEffect(() => {
    import('recharts').then(setRecharts).catch(() => {});
  }, []);

  if (!Recharts || data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg bg-[var(--muted)]/10 text-xs text-[var(--muted-foreground)]">
        {data.length === 0 ? 'No data available' : 'Loading chart…'}
      </div>
    );
  }

  const { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } = Recharts;

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatCurrency(v)}
            width={55}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '11px',
            }}
            formatter={(value: number) => formatCurrency(value)}
          />
          <Legend wrapperStyle={{ fontSize: '10px' }} />
          <Area
            dataKey="pessimistic"
            name="Pessimistic"
            stroke="none"
            fill="rgba(139, 92, 246, 0.1)"
            fillOpacity={1}
          />
          <Area
            dataKey="optimistic"
            name="Optimistic"
            stroke="none"
            fill="var(--card)"
            fillOpacity={1}
          />
          <Line
            dataKey="actual"
            name="Actual"
            stroke="#34d399"
            strokeWidth={2}
            dot={{ r: 3, fill: '#34d399' }}
            connectNulls={false}
          />
          <Line
            dataKey="expected"
            name="Expected"
            stroke="#8b5cf6"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={{ r: 2, fill: '#8b5cf6' }}
            connectNulls={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
