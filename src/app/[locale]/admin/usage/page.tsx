'use client';

import { useEffect, useState, useCallback } from 'react';
import { MetricCard } from '@/components/ui/MetricCard';

interface UsageStat {
  provider_type: string;
  total_calls: number;
  total_tokens: number;
  error_rate: number;
  avg_latency_ms: number;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/** Simple CSS bar for visual comparison */
function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const width = max > 0 ? Math.max((value / max) * 100, 2) : 0;
  return (
    <div className="h-5 w-full rounded-md bg-slate-100 overflow-hidden">
      <div
        className={`h-full rounded-md transition-all duration-500 ${color}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export default function UsagePage() {
  const [stats, setStats] = useState<UsageStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/usage');
      const data = await res.json();
      if (res.ok) setStats(data.stats ?? []);
      else setError(data.error ?? 'Error al cargar estadísticas');
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Totals
  const totalCalls = stats.reduce((s, r) => s + r.total_calls, 0);
  const totalTokens = stats.reduce((s, r) => s + r.total_tokens, 0);
  const totalErrors = stats.reduce((s, r) => s + Math.round(r.error_rate * r.total_calls), 0);
  const overallErrorRate = totalCalls > 0 ? totalErrors / totalCalls : 0;
  const avgLatency = totalCalls > 0
    ? Math.round(stats.reduce((s, r) => s + r.avg_latency_ms * r.total_calls, 0) / totalCalls)
    : 0;

  const maxCalls = Math.max(...stats.map((s) => s.total_calls), 1);
  const maxTokens = Math.max(...stats.map((s) => s.total_tokens), 1);

  return (
    <div className="space-y-5 max-w-4xl">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Estadísticas de uso</h1>
        <p className="text-sm text-slate-400 mt-0.5">Consumo de tokens, llamadas y tasas de error por proveedor.</p>
      </div>

      {error && (
        <div className="p-3 rounded-xl border border-rose-200 bg-rose-50 text-sm text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-400 py-8 text-center">Cargando estadísticas…</div>
      ) : stats.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-slate-500">Sin datos de uso todavía.</p>
          <p className="text-xs text-slate-400 mt-1">Las estadísticas aparecerán cuando se realicen llamadas a la IA.</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetricCard label="Total llamadas" value={formatNumber(totalCalls)} />
            <MetricCard label="Total tokens" value={formatNumber(totalTokens)} />
            <MetricCard label="Tasa de error" value={pct(overallErrorRate)} />
            <MetricCard label="Latencia prom." value={`${avgLatency}ms`} />
          </div>

          {/* Per-provider breakdown */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100">
              <h2 className="text-sm font-semibold text-slate-800">Desglose por proveedor</h2>
            </div>

            <div className="divide-y divide-slate-100">
              {stats.map((s) => (
                <div key={s.provider_type} className="px-5 py-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800 capitalize">{s.provider_type}</span>
                    <span className="text-xs text-slate-400">{s.avg_latency_ms}ms prom.</span>
                  </div>

                  {/* Calls bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Llamadas</span>
                      <span className="font-mono">{formatNumber(s.total_calls)}</span>
                    </div>
                    <Bar value={s.total_calls} max={maxCalls} color="bg-violet-500" />
                  </div>

                  {/* Tokens bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Tokens</span>
                      <span className="font-mono">{formatNumber(s.total_tokens)}</span>
                    </div>
                    <Bar value={s.total_tokens} max={maxTokens} color="bg-cyan-500" />
                  </div>

                  {/* Error rate inline */}
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-slate-500">Errores:</span>
                    <span className={s.error_rate > 0.1 ? 'text-rose-600 font-semibold' : 'text-slate-600'}>
                      {pct(s.error_rate)}
                    </span>
                    <span className="text-slate-300">|</span>
                    <span className="text-slate-500">Fallbacks:</span>
                    <span className="text-slate-600">
                      {Math.round(s.error_rate * s.total_calls)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
