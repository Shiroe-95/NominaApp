'use client';

/**
 * Panel de Consumo de Tokens — Análisis Multidimensional.
 *
 * Muestra métricas agregadas (llamadas, tokens, tasa de error, latencia),
 * filtros por proveedor/agente/rango de fechas, y tabs con desglose por:
 * proveedor, agente, tipo de tarea y cliente.
 *
 * Consume `GET /api/settings/usage` con filtros opcionales.
 * Requisitos: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6
 */

import { useEffect, useState, useCallback } from 'react';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Phone,
  Coins,
  AlertTriangle,
  Clock,
  Calendar,
  Filter,
  BarChart3,
  Bot,
  ListChecks,
  Building2,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar as RechartsBar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts';

// ── Types ────────────────────────────────────────────────────────────

interface UsageStat {
  provider_type: string; // group key (provider name, agent name, task type, or company_id)
  total_calls: number;
  total_tokens: number;
  error_rate: number;
  avg_latency_ms: number;
  cost_usd: number;
}

interface Aggregated {
  total_calls: number;
  total_tokens: number;
  total_cost_usd: number;
  global_error_rate: number;
  avg_latency_ms: number;
}

interface UsageResponse {
  stats: UsageStat[];       // by provider
  by_agent: UsageStat[];
  by_task: UsageStat[];
  by_client: UsageStat[];
  aggregated: Aggregated;
}

type TabKey = 'provider' | 'agent' | 'task' | 'client' | 'sync';

interface SyncHistoryEntry {
  id: string;
  country_code: string;
  rule_year: number;
  status: 'in_progress' | 'completed' | 'failed';
  trigger_type: 'automatic' | 'manual';
  started_at: string;
  completed_at: string | null;
  changes_detected: number;
  confidence: string | null;
  error_message: string | null;
  retry_count: number;
}


// ── Helpers ──────────────────────────────────────────────────────────

/** Formatea un número grande con sufijos K/M para legibilidad. */
function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Convierte una tasa decimal (0–1) a porcentaje con un decimal. */
function pct(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

/** Formatea un valor numérico como dólares con 4 decimales. */
function usd(v: number): string {
  return `$${v.toFixed(4)}`;
}

/** Simple CSS bar for visual comparison */
function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const width = max > 0 ? Math.max((value / max) * 100, 2) : 0;
  return (
    <div className="h-4 w-full rounded-md bg-white/5 overflow-hidden">
      <div
        className={`h-full rounded-md transition-all duration-500 ${color}`}
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

// ── Tab definitions ─────────────────────────────────────────────────

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: 'provider', label: 'Por Proveedor', icon: BarChart3 },
  { key: 'agent', label: 'Por Agente', icon: Bot },
  { key: 'task', label: 'Por Tarea', icon: ListChecks },
  { key: 'client', label: 'Por Cliente', icon: Building2 },
  { key: 'sync', label: 'Sincronizaciones', icon: RefreshCw },
];

// ── Recharts tooltip style ──────────────────────────────────────────

const tooltipStyle = {
  borderRadius: '12px',
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(15,23,42,0.85)',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 0 20px rgba(0,0,0,0.5)',
};
const tooltipItemStyle = { color: '#F8FAFC' };
const tooltipLabelStyle = { color: '#94A3B8', marginBottom: '4px' };

// ── Page Component ──────────────────────────────────────────────────

/**
 * Página principal de consumo de tokens con análisis multidimensional.
 *
 * Gestiona el estado de filtros (proveedor, agente, rango de fechas),
 * muestra tarjetas de métricas agregadas y un sistema de tabs para
 * alternar entre desgloses por proveedor, agente, tipo de tarea y cliente.
 *
 * Ruta: `/[locale]/admin/usage`
 */
export default function UsagePage() {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('provider');
  const [syncHistory, setSyncHistory] = useState<SyncHistoryEntry[]>([]);
  const [syncLoading, setSyncLoading] = useState(false);

  // Filters
  const [filterProvider, setFilterProvider] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filterProvider) params.set('provider_type', filterProvider);
      if (filterAgent) params.set('agent_name', filterAgent);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const qs = params.toString();
      const res = await fetch(`/api/settings/usage${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [filterProvider, filterAgent, from, to]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch sync history when sync tab is active
  useEffect(() => {
    if (activeTab !== 'sync') return;
    setSyncLoading(true);
    fetch('/api/sync/history')
      .then((res) => res.json())
      .then((json) => {
        if (Array.isArray(json.history)) setSyncHistory(json.history);
      })
      .catch(() => { /* silent */ })
      .finally(() => setSyncLoading(false));
  }, [activeTab]);

  // Derive unique providers and agents for filter dropdowns
  const providerOptions = data?.stats?.map((s) => s.provider_type).filter(Boolean) ?? [];
  const agentOptions = data?.by_agent?.map((s) => s.provider_type).filter(Boolean) ?? [];

  // Get data for active tab
  const tabData = (): UsageStat[] => {
    if (!data) return [];
    switch (activeTab) {
      case 'provider': return data.stats ?? [];
      case 'agent': return data.by_agent ?? [];
      case 'task': return data.by_task ?? [];
      case 'client': return data.by_client ?? [];
    }
  };

  const currentData = tabData();
  const agg = data?.aggregated;

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div>
        <h1 className="page-heading text-2xl">Consumo de Tokens</h1>
        <p className="text-sm text-slate-400 mt-1">
          Análisis multidimensional de uso de IA: tokens, llamadas, costos y tasas de error.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-3 rounded-xl border border-rose/30 bg-rose/10 text-sm text-rose-light">
          {error}
        </div>
      )}

      {/* ── Filter Bar ─────────────────────────────────────── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Filter className="h-4 w-4 text-slate-400 mt-1" />

            {/* Provider filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Proveedor</label>
              <select
                value={filterProvider}
                onChange={(e) => setFilterProvider(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-sm bg-white/5 border border-white/10 text-slate-200"
              >
                <option value="">Todos</option>
                {providerOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Agent filter */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Agente</label>
              <select
                value={filterAgent}
                onChange={(e) => setFilterAgent(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-sm bg-white/5 border border-white/10 text-slate-200"
              >
                <option value="">Todos</option>
                {agentOptions.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>

            {/* Date range */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Desde</label>
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-lg px-3 py-1.5 text-sm bg-white/5 border border-white/10 text-slate-200"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">Hasta</label>
              <div className="flex items-center gap-2">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded-lg px-3 py-1.5 text-sm bg-white/5 border border-white/10 text-slate-200"
                />
              </div>
            </div>

            <Button size="sm" onClick={fetchData}>
              Filtrar
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-center text-slate-400 py-12">Cargando estadísticas…</p>
      ) : !data || (data.stats.length === 0 && data.by_agent.length === 0) ? (
        <div className="rounded-2xl border border-dashed border-white/10 glass-panel p-8 text-center">
          <p className="text-sm text-slate-400">Sin datos de uso todavía.</p>
          <p className="text-xs text-slate-500 mt-1">
            Las estadísticas aparecerán cuando se realicen llamadas a la IA.
          </p>
        </div>
      ) : (
        <>
          {/* ── Aggregated Metric Cards ────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <MetricCard
              label="Total Llamadas"
              value={formatNumber(agg?.total_calls ?? 0)}
              icon={<Phone className="h-5 w-5" />}
            />
            <MetricCard
              label="Total Tokens"
              value={formatNumber(agg?.total_tokens ?? 0)}
              icon={<Coins className="h-5 w-5" />}
            />
            <MetricCard
              label="Tasa de Error"
              value={pct(agg?.global_error_rate ?? 0)}
              icon={<AlertTriangle className="h-5 w-5" />}
            />
            <MetricCard
              label="Latencia Prom."
              value={`${agg?.avg_latency_ms ?? 0}ms`}
              icon={<Clock className="h-5 w-5" />}
            />
          </div>

          {/* ── Tab Bar ────────────────────────────────────────── */}
          <div className="flex gap-1 p-1 rounded-xl bg-white/5 w-fit">
            {TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                  ${activeTab === tab.key
                    ? 'bg-violet/20 text-violet-light border border-violet/30 shadow-[0_0_10px_rgba(124,58,237,0.2)]'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }
                `}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* ── Tab Content ────────────────────────────────────── */}
          {activeTab === 'provider' && <ProviderBreakdown data={currentData} />}
          {activeTab === 'agent' && <AgentBreakdown data={currentData} />}
          {activeTab === 'task' && <TaskBreakdown data={currentData} />}
          {activeTab === 'client' && <ClientBreakdown data={currentData} />}
          {activeTab === 'sync' && <SyncHistoryBreakdown data={syncHistory} loading={syncLoading} />}
        </>
      )}
    </div>
  );
}


// ── Provider Breakdown (Req 6.2) ────────────────────────────────────

/**
 * Desglose por proveedor: gráfico de barras de tokens y tabla detallada
 * con llamadas, tokens, costo y tasa de error por proveedor de IA.
 */
function ProviderBreakdown({ data }: { data: UsageStat[] }) {
  const maxTokens = Math.max(...data.map((s) => s.total_tokens), 1);

  const chartData = data.map((s) => ({
    name: s.provider_type,
    tokens: s.total_tokens,
    calls: s.total_calls,
    cost: s.cost_usd,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-violet-light" />
            Tokens por Proveedor
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                  <RechartsBar dataKey="tokens" fill="#7C3AED" radius={[4, 4, 0, 0]} name="Tokens" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Desglose por Proveedor</CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="space-y-4">
              {data.map((s) => (
                <div key={s.provider_type} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-200 capitalize">{s.provider_type}</span>
                    <span className="text-xs text-slate-400">{s.avg_latency_ms}ms prom.</span>
                  </div>
                  <Bar value={s.total_tokens} max={maxTokens} color="bg-violet" />
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-400">
                    <span>Llamadas: <span className="text-slate-200">{formatNumber(s.total_calls)}</span></span>
                    <span>Tokens: <span className="text-slate-200">{formatNumber(s.total_tokens)}</span></span>
                    <span>Costo: <span className="text-emerald">{usd(s.cost_usd)}</span></span>
                    <span>Errores: <span className={s.error_rate > 0.1 ? 'text-rose-light font-semibold' : 'text-slate-300'}>{pct(s.error_rate)}</span></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Agent Breakdown (Req 6.3) ───────────────────────────────────────

/**
 * Desglose por agente IA: gráfico de barras y tabla con tokens,
 * llamadas y costo por cada agente del sistema multi-agente.
 */
function AgentBreakdown({ data }: { data: UsageStat[] }) {
  const chartData = data.map((s) => ({
    name: s.provider_type, // group key = agent_name
    tokens: s.total_tokens,
    cost: s.cost_usd,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Bot className="h-4 w-4 text-cyan" />
            Tokens por Agente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                  <RechartsBar dataKey="tokens" fill="#06B6D4" radius={[4, 4, 0, 0]} name="Tokens" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Desglose por Agente</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-white/5">
                <th className="pb-2">Agente</th>
                <th className="pb-2 text-right">Tokens</th>
                <th className="pb-2 text-right">Llamadas</th>
                <th className="pb-2 text-right">Costo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.map((s) => (
                <tr key={s.provider_type}>
                  <td className="py-2 text-slate-200 capitalize">{s.provider_type}</td>
                  <td className="py-2 text-right text-slate-300">{formatNumber(s.total_tokens)}</td>
                  <td className="py-2 text-right text-slate-300">{s.total_calls}</td>
                  <td className="py-2 text-right text-emerald">{usd(s.cost_usd)}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-slate-500">Sin datos</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Task Breakdown (Req 6.4) ────────────────────────────────────────

/**
 * Desglose por tipo de tarea (chat, map, validate, correct, full-analysis):
 * gráfico de barras y tabla con tokens, llamadas y costo por tipo.
 */
function TaskBreakdown({ data }: { data: UsageStat[] }) {
  const chartData = data.map((s) => ({
    name: s.provider_type, // group key = task_type
    tokens: s.total_tokens,
    cost: s.cost_usd,
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-emerald" />
            Tokens por Tipo de Tarea
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="h-[260px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 11 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94A3B8', fontSize: 12 }} />
                  <RechartsTooltip
                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                    contentStyle={tooltipStyle}
                    itemStyle={tooltipItemStyle}
                    labelStyle={tooltipLabelStyle}
                  />
                  <RechartsBar dataKey="tokens" fill="#10B981" radius={[4, 4, 0, 0]} name="Tokens" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Desglose por Tipo de Tarea</CardTitle>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-white/5">
                <th className="pb-2">Tipo de Tarea</th>
                <th className="pb-2 text-right">Tokens</th>
                <th className="pb-2 text-right">Llamadas</th>
                <th className="pb-2 text-right">Costo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {data.map((s) => (
                <tr key={s.provider_type}>
                  <td className="py-2 text-slate-200 capitalize">{s.provider_type}</td>
                  <td className="py-2 text-right text-slate-300">{formatNumber(s.total_tokens)}</td>
                  <td className="py-2 text-right text-slate-300">{s.total_calls}</td>
                  <td className="py-2 text-right text-emerald">{usd(s.cost_usd)}</td>
                </tr>
              ))}
              {data.length === 0 && (
                <tr><td colSpan={4} className="py-4 text-center text-slate-500">Sin datos</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Client Breakdown (Req 6.5) ──────────────────────────────────────

/**
 * Desglose por cliente (empresa): tabla con tokens totales y costo
 * en USD por cada company_id registrado en los logs de uso.
 */
function ClientBreakdown({ data }: { data: UsageStat[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Building2 className="h-4 w-4 text-amber-400" />
          Desglose por Cliente
        </CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-slate-400 border-b border-white/5">
              <th className="pb-2">Cliente</th>
              <th className="pb-2 text-right">Tokens Totales</th>
              <th className="pb-2 text-right">Costo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {data.map((s) => (
              <tr key={s.provider_type}>
                <td className="py-2 text-slate-200">{s.provider_type || 'Sin asignar'}</td>
                <td className="py-2 text-right text-slate-300">{formatNumber(s.total_tokens)}</td>
                <td className="py-2 text-right text-emerald">{usd(s.cost_usd)}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={3} className="py-4 text-center text-slate-500">Sin datos de clientes</td></tr>
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ── Sync History Breakdown (Req 11.9) ───────────────────────────────

/**
 * Historial de sincronizaciones regulatorias: tabla con estado, país,
 * año, tipo de trigger y conteo de reintentos.
 */
function SyncHistoryBreakdown({ data, loading }: { data: SyncHistoryEntry[]; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-slate-400 text-sm">
          Cargando historial de sincronizaciones…
        </CardContent>
      </Card>
    );
  }

  const statusConfig: Record<string, { label: string; cls: string }> = {
    completed: { label: 'Completada', cls: 'bg-emerald-500/10 text-emerald-400' },
    failed: { label: 'Fallida', cls: 'bg-rose-500/10 text-rose-400' },
    in_progress: { label: 'En progreso', cls: 'bg-amber-500/10 text-amber-400' },
  };

  const triggerLabels: Record<string, string> = {
    automatic: 'Automático',
    manual: 'Manual',
    bootstrap: 'Bootstrap',
    cron: 'Cron',
  };

  const formatDate = (iso: string): string => {
    try {
      return new Date(iso).toLocaleDateString('es', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-violet-light" />
          Historial de Sincronizaciones Regulatorias
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            Sin historial de sincronizaciones.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-white/5">
                  <th className="pb-2 pr-4">Fecha</th>
                  <th className="pb-2 pr-4">País</th>
                  <th className="pb-2 pr-4">Año</th>
                  <th className="pb-2 pr-4">Estado</th>
                  <th className="pb-2 pr-4">Trigger</th>
                  <th className="pb-2 pr-4">Cambios</th>
                  <th className="pb-2 pr-4">Confianza</th>
                  <th className="pb-2 text-right">Reintentos</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.map((entry) => {
                  const cfg = statusConfig[entry.status] ?? statusConfig.failed;
                  return (
                    <tr key={entry.id}>
                      <td className="py-2 pr-4 text-slate-300 text-xs">
                        {formatDate(entry.started_at)}
                      </td>
                      <td className="py-2 pr-4 text-slate-200 font-mono">
                        {entry.country_code}
                      </td>
                      <td className="py-2 pr-4 text-slate-300">
                        {entry.rule_year}
                      </td>
                      <td className="py-2 pr-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-slate-300 text-xs">
                        {triggerLabels[entry.trigger_type] ?? entry.trigger_type}
                      </td>
                      <td className="py-2 pr-4 text-slate-300">
                        {entry.changes_detected > 0 ? (
                          <span className="text-violet-light font-medium">{entry.changes_detected}</span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-xs">
                        {entry.confidence ? (
                          <span className={
                            entry.confidence === 'high' ? 'text-emerald-400' :
                            entry.confidence === 'medium' ? 'text-amber-400' :
                            'text-rose-400'
                          }>
                            {entry.confidence}
                          </span>
                        ) : (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-2 text-right text-slate-300">
                        {entry.retry_count > 0 ? (
                          <span className="text-amber-400">{entry.retry_count}</span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Empty state ─────────────────────────────────────────────────────

/** Placeholder visual cuando no hay datos disponibles para un desglose. */
function EmptyState() {
  return (
    <div className="flex h-[200px] flex-col items-center justify-center text-slate-400">
      <BarChart3 className="mb-2 h-8 w-8 opacity-20" />
      <p className="text-sm">Sin datos disponibles</p>
    </div>
  );
}
