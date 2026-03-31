/**
 * Stub/skeleton widget components for the customizable dashboard.
 *
 * Each widget shows its type, icon, and a placeholder.
 * Full data fetching is NOT implemented here — these are structural stubs.
 */
'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import {
  type ForecastBand,
  type ForecastChartPoint,
  type CostAlert,
  type HistoricalCost,
  detectCostAlerts,
  buildChartData,
  formatCurrency,
} from '@/lib/forecast/forecast-service';

interface StubWidgetProps {
  className?: string;
}

interface AnomalyDisplayItem {
  id: string;
  category: string;
  confidence: string;
  description: string;
  recommendation: string;
}

function WidgetShell({ icon, label, children, className }: StubWidgetProps & { icon: string; label: string; children?: React.ReactNode }) {
  return (
    <div className={cn('p-4', className)}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">{icon}</span>
        <h3 className="text-sm font-semibold text-[var(--foreground)]">{label}</h3>
      </div>
      {children ?? (
        <div className="flex h-20 items-center justify-center rounded-lg bg-[var(--muted)]/20 text-xs text-[var(--muted-foreground)]">
          Loading data…
        </div>
      )}
    </div>
  );
}

export function MetricsWidget({ className }: StubWidgetProps) {
  return (
    <WidgetShell icon="📊" label="Key Metrics" className={className}>
      <div className="grid grid-cols-2 gap-2">
        {['Total Payrolls', 'Cert. Rate', 'Avg Risk', 'Findings'].map((m) => (
          <div key={m} className="rounded-lg bg-[var(--muted)]/20 p-2 text-center">
            <p className="text-xs text-[var(--muted-foreground)]">{m}</p>
            <p className="text-lg font-bold text-[var(--foreground)]">—</p>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

export function RiskTrendWidget({ className }: StubWidgetProps) {
  return (
    <WidgetShell icon="📈" label="Risk Trend" className={className}>
      <div className="flex h-24 items-center justify-center rounded-lg bg-[var(--muted)]/20 text-xs text-[var(--muted-foreground)]">
        Risk trend chart placeholder
      </div>
    </WidgetShell>
  );
}

export function AnomaliesWidget({ className }: StubWidgetProps) {
  return (
    <WidgetShell icon="🔮" label="Anomalies" className={className}>
      <AnomaliesContent />
    </WidgetShell>
  );
}

/** Confidence badge colors */
const CONFIDENCE_STYLES: Record<string, string> = {
  high: 'bg-red-500/20 text-red-400',
  medium: 'bg-amber-500/20 text-amber-400',
  low: 'bg-blue-500/20 text-blue-400',
};

/** Category labels */
const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  potential_fraud: { label: 'Fraud', icon: '🚨' },
  systematic_error: { label: 'Error', icon: '⚠️' },
  seasonal_variation: { label: 'Seasonal', icon: '📅' },
  legitimate_change: { label: 'Change', icon: '✅' },
};

function AnomaliesContent() {
  const [anomalies, setAnomalies] = React.useState<AnomalyDisplayItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [filter, setFilter] = React.useState<string>('all');

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch('/api/v1/anomalies?workspace_id=default');
        if (!res.ok) throw new Error('Failed to load');
        const data = await res.json();
        if (!cancelled) {
          setAnomalies(
            (data.anomalies ?? []).map((a: Record<string, unknown>) => ({
              id: a.id as string,
              category: a.category as string,
              confidence: a.confidence as string,
              description: a.description as string,
              recommendation: a.recommendation as string,
            })),
          );
        }
      } catch {
        if (!cancelled) setError('Failed to load anomalies');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-8 rounded-lg bg-[var(--muted)]/20 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg bg-red-500/10 text-xs text-red-400">
        {error}
      </div>
    );
  }

  if (anomalies.length === 0) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg bg-emerald-500/10 text-xs text-emerald-400">
        ✅ No anomalies detected
      </div>
    );
  }

  const filtered = filter === 'all' ? anomalies : anomalies.filter((a: AnomalyDisplayItem) => a.confidence === filter);

  // Summary by category
  const byCategory = anomalies.reduce<Record<string, number>>((acc: Record<string, number>, a: AnomalyDisplayItem) => {
    acc[a.category] = (acc[a.category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      {/* Confidence filter */}
      <div className="flex gap-1">
        {['all', 'high', 'medium', 'low'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
              filter === f
                ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                : 'bg-[var(--muted)]/20 text-[var(--muted-foreground)] hover:bg-[var(--muted)]/40',
            )}
          >
            {f === 'all' ? `All (${anomalies.length})` : `${f.charAt(0).toUpperCase() + f.slice(1)} (${anomalies.filter((a: AnomalyDisplayItem) => a.confidence === f).length})`}
          </button>
        ))}
      </div>

      {/* Category summary */}
      <div className="flex flex-wrap gap-1">
        {Object.entries(byCategory).map(([cat, count]) => {
          const info = CATEGORY_LABELS[cat] ?? { label: cat, icon: '❓' };
          return (
            <span key={cat} className="inline-flex items-center gap-1 rounded bg-[var(--muted)]/20 px-1.5 py-0.5 text-[10px] text-[var(--muted-foreground)]">
              {info.icon} {info.label}: {count}
            </span>
          );
        })}
      </div>

      {/* Anomaly list */}
      <div className="max-h-40 space-y-1 overflow-y-auto">
        {filtered.slice(0, 10).map((a: AnomalyDisplayItem) => {
          const confStyle = CONFIDENCE_STYLES[a.confidence] ?? 'bg-[var(--muted)]/20 text-[var(--muted-foreground)]';
          const catInfo = CATEGORY_LABELS[a.category] ?? { label: a.category, icon: '❓' };
          return (
            <div key={a.id} className="rounded-lg bg-[var(--muted)]/10 p-2 text-xs">
              <div className="flex items-center gap-1 mb-0.5">
                <span className={cn('rounded px-1 py-0.5 text-[10px] font-medium', confStyle)}>
                  {a.confidence.toUpperCase()}
                </span>
                <span className="text-[10px] text-[var(--muted-foreground)]">{catInfo.icon} {catInfo.label}</span>
              </div>
              <p className="text-[var(--foreground)] line-clamp-2">{a.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ForecastWidget({ className }: StubWidgetProps) {
  return (
    <WidgetShell icon="📉" label="Forecast" className={className}>
      <ForecastContent />
    </WidgetShell>
  );
}

/** Horizon options for the forecast widget */
const HORIZON_OPTIONS = [
  { label: '3M', value: 3 as const },
  { label: '6M', value: 6 as const },
  { label: '12M', value: 12 as const },
];

function ForecastContent() {
  const [horizon, setHorizon] = React.useState<3 | 6 | 12>(6);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [chartData, setChartData] = React.useState<ForecastChartPoint[]>([]);
  const [alerts, setAlerts] = React.useState<CostAlert[]>([]);
  const [summary, setSummary] = React.useState<{ trend: string; trendPct: number } | null>(null);

  const loadForecast = React.useCallback(async (h: 3 | 6 | 12) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch historical costs from forecast API
      const res = await fetch('/api/v1/forecast?workspace_id=default');
      if (!res.ok) throw new Error('Failed to load forecast data');
      const data = await res.json();

      const forecasts = data.forecasts ?? [];
      if (forecasts.length === 0) {
        // Generate demo data when no real data exists
        const now = new Date();
        const demoHistorical: HistoricalCost[] = Array.from({ length: 6 }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - 6 + i, 1);
          return {
            year: d.getFullYear(),
            month: d.getMonth() + 1,
            totalCost: 50000 + Math.round(Math.random() * 10000) + i * 2000,
          };
        });
        runForecastCalc(demoHistorical, h);
        return;
      }

      // Use forecast snapshots as historical data
      const historical: HistoricalCost[] = forecasts.slice(0, 6).reverse().map((f: Record<string, unknown>, i: number) => ({
        year: (f.period_year as number) ?? new Date().getFullYear(),
        month: (f.period_month as number) ?? i + 1,
        totalCost: (f.total_cost as number) ?? 50000 + i * 2000,
      }));

      runForecastCalc(historical, h);
    } catch {
      setError('Failed to load forecast');
      setLoading(false);
    }
  }, []);

  const runForecastCalc = (historical: HistoricalCost[], h: 3 | 6 | 12) => {
    // Use the forecast worker functions inline (simplified for widget)
    const costs = historical.map(c => c.totalCost);
    const avgCost = costs.reduce((s, v) => s + v, 0) / costs.length;
    const lastCost = costs[costs.length - 1];
    const lastPeriod = historical[historical.length - 1];

    // Simple trend detection
    const firstCost = costs[0];
    const trendPct = firstCost > 0 ? ((lastCost - firstCost) / firstCost) * 100 : 0;
    const trend = trendPct > 2 ? 'increasing' : trendPct < -2 ? 'decreasing' : 'stable';

    // Generate bands
    const slope = costs.length >= 2 ? (lastCost - firstCost) / (costs.length - 1) : 0;
    const bands: ForecastBand[] = [];
    let cm = lastPeriod.month;
    let cy = lastPeriod.year;

    for (let i = 1; i <= h; i++) {
      cm++;
      if (cm > 12) { cm = 1; cy++; }
      const base = Math.max(0, lastCost + slope * i);
      bands.push({
        month: cm,
        year: cy,
        optimistic: Math.round(base * 0.85),
        expected: Math.round(base),
        pessimistic: Math.round(base * 1.20),
      });
    }

    const costAlerts = detectCostAlerts(bands, lastCost);
    const points = buildChartData(historical, bands);

    setChartData(points);
    setAlerts(costAlerts);
    setSummary({ trend, trendPct: Number(trendPct.toFixed(1)) });
    setLoading(false);
  };

  React.useEffect(() => {
    loadForecast(horizon);
  }, [horizon, loadForecast]);

  if (loading) {
    return (
      <div className="space-y-2">
        <div className="h-32 rounded-lg bg-[var(--muted)]/20 animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-20 items-center justify-center rounded-lg bg-red-500/10 text-xs text-red-400">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Horizon selector */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {HORIZON_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setHorizon(opt.value)}
              className={cn(
                'rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
                horizon === opt.value
                  ? 'bg-[var(--primary)] text-[var(--primary-foreground)]'
                  : 'bg-[var(--muted)]/20 text-[var(--muted-foreground)] hover:bg-[var(--muted)]/40',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {summary && (
          <span className={cn(
            'text-[10px] font-medium',
            summary.trend === 'increasing' ? 'text-amber-400' : summary.trend === 'decreasing' ? 'text-emerald-400' : 'text-[var(--muted-foreground)]',
          )}>
            {summary.trend === 'increasing' ? '↑' : summary.trend === 'decreasing' ? '↓' : '→'} {Math.abs(summary.trendPct)}%
          </span>
        )}
      </div>

      {/* Chart */}
      <ForecastChart data={chartData} />

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2">
          <p className="text-[10px] font-bold text-amber-400 mb-1">⚠️ Cost Alerts</p>
          {alerts.slice(0, 2).map((a, i) => (
            <p key={i} className="text-[10px] text-amber-300/80 truncate">
              +{a.projectedIncrease}% in {a.month}/{a.year}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/** Recharts-based forecast line chart with confidence bands */
function ForecastChart({ data }: { data: ForecastChartPoint[] }) {
  // Lazy import check — recharts may not be available in test env
  const [RechartsModule, setRechartsModule] = React.useState<typeof import('recharts') | null>(null);

  React.useEffect(() => {
    import('recharts').then(setRechartsModule).catch(() => {});
  }, []);

  if (!RechartsModule || data.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg bg-[var(--muted)]/10 text-[10px] text-[var(--muted-foreground)]">
        {data.length === 0 ? 'No data' : 'Loading chart…'}
      </div>
    );
  }

  const { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid } = RechartsModule;

  return (
    <div className="h-36 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => formatCurrency(v)}
            width={45}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              fontSize: '10px',
            }}
            formatter={(value: number) => formatCurrency(value)}
          />
          {/* Confidence band (pessimistic - optimistic area) */}
          <Area
            dataKey="pessimistic"
            stroke="none"
            fill="rgba(139, 92, 246, 0.1)"
            fillOpacity={1}
          />
          <Area
            dataKey="optimistic"
            stroke="none"
            fill="var(--card)"
            fillOpacity={1}
          />
          {/* Actual historical line */}
          <Line
            dataKey="actual"
            stroke="#34d399"
            strokeWidth={2}
            dot={{ r: 3, fill: '#34d399' }}
            connectNulls={false}
          />
          {/* Expected forecast line */}
          <Line
            dataKey="expected"
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

export function ActivityWidget({ className }: StubWidgetProps) {
  return (
    <WidgetShell icon="📋" label="Activity Feed" className={className}>
      <div className="space-y-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-6 rounded bg-[var(--muted)]/20 animate-pulse" />
        ))}
      </div>
    </WidgetShell>
  );
}

export function AIProvidersWidget({ className }: StubWidgetProps) {
  return (
    <WidgetShell icon="🤖" label="AI Providers" className={className}>
      <div className="space-y-1">
        {['OpenAI', 'Anthropic', 'Google'].map((p) => (
          <div key={p} className="flex items-center justify-between rounded px-2 py-1 text-xs">
            <span className="text-[var(--foreground)]">{p}</span>
            <span className="text-emerald-400">●</span>
          </div>
        ))}
      </div>
    </WidgetShell>
  );
}

export function ActionItemsWidget({ className }: StubWidgetProps) {
  return (
    <WidgetShell icon="✅" label="Action Items" className={className}>
      <div className="space-y-1">
        {[1, 2].map((i) => (
          <div key={i} className="h-6 rounded bg-[var(--muted)]/20 animate-pulse" />
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-[var(--muted-foreground)]">0 pending</p>
    </WidgetShell>
  );
}

export function SystemHealthWidget({ className }: StubWidgetProps) {
  return (
    <WidgetShell icon="💚" label="System Health" className={className}>
      <div className="flex items-center justify-center gap-2 py-2">
        <span className="text-2xl">✓</span>
        <span className="text-sm font-medium text-emerald-400">All systems operational</span>
      </div>
    </WidgetShell>
  );
}

/** Map widget type to its component. */
export const WIDGET_COMPONENTS: Record<string, React.ComponentType<StubWidgetProps>> = {
  'metrics': MetricsWidget,
  'risk-trend': RiskTrendWidget,
  'anomalies': AnomaliesWidget,
  'forecast': ForecastWidget,
  'activity': ActivityWidget,
  'ai-providers': AIProvidersWidget,
  'action-items': ActionItemsWidget,
  'system-health': SystemHealthWidget,
};
