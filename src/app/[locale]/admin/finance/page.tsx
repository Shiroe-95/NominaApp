'use client';

/**
 * Panel Financiero de Administración.
 *
 * Dashboard financiero con KPIs mejorados (costo IA, ingresos, márgenes,
 * costo por nómina), gráfico de tendencia temporal, gráfico comparativo
 * por proveedor y tablas de desglose.
 *
 * Consume el endpoint `GET /api/admin/finance` con filtros opcionales
 * de rango de fechas (`from`, `to`) como query params ISO.
 *
 * Ruta: `/[locale]/admin/finance`
 * Acceso: Solo rol `admin` (protegido por middleware).
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  Calendar,
  Percent,
  Download,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from 'recharts';

// ── Types matching the new API response ─────────────────────────────

interface ProviderRow {
  provider_type: string;
  model_id: string;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  calls: number;
}

interface AgentRow {
  agent_name: string;
  tokens_total: number;
  cost_usd: number;
  calls: number;
}

interface ClientRow {
  company_id: string;
  company_name: string;
  tokens_total: number;
  cost_usd: number;
}

interface Profitability {
  gross_profit: number;
  net_profit: number;
  margin_percent: number;
  cost_per_payroll: number;
}

interface FinanceData {
  total_ai_cost: number;
  total_revenue: number;
  gross_margin: number;
  net_margin: number;
  cost_per_payroll: number;
  infrastructure_cost_monthly: number;
  by_provider: ProviderRow[];
  by_agent: AgentRow[];
  by_client: ClientRow[];
  profitability: Profitability;
  period: { from: string | null; to: string | null };
  total_logs: number;
}

// ── KPI card config ─────────────────────────────────────────────────

interface KpiCard {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  glowColor: string;
}

function buildKpiCards(d: FinanceData): KpiCard[] {
  return [
    {
      label: 'Costo Total IA',
      value: `$${d.total_ai_cost.toFixed(2)}`,
      icon: DollarSign,
      color: 'text-rose-light',
      glowColor: 'rgba(225,29,72,0.15)',
    },
    {
      label: 'Ingresos Totales',
      value: `$${d.total_revenue.toFixed(2)}`,
      icon: TrendingUp,
      color: 'text-emerald',
      glowColor: 'rgba(16,185,129,0.15)',
    },
    {
      label: 'Margen Bruto',
      value: `$${d.gross_margin.toFixed(2)}`,
      icon: BarChart3,
      color: 'text-violet-light',
      glowColor: 'rgba(139,92,246,0.15)',
    },
    {
      label: 'Margen Neto',
      value: `$${d.net_margin.toFixed(2)}`,
      icon: d.net_margin >= 0 ? TrendingUp : TrendingDown,
      color: d.net_margin >= 0 ? 'text-emerald-light' : 'text-rose-light',
      glowColor: d.net_margin >= 0 ? 'rgba(52,211,153,0.15)' : 'rgba(251,113,133,0.15)',
    },
    {
      label: 'Costo por Nómina',
      value: `$${d.cost_per_payroll.toFixed(4)}`,
      icon: Percent,
      color: 'text-cyan',
      glowColor: 'rgba(6,182,212,0.15)',
    },
  ];
}

// ── Placeholder trend data (no time-series from API yet) ────────────

const PLACEHOLDER_TREND = [
  { month: 'Ene', cost: 0, revenue: 0 },
  { month: 'Feb', cost: 0, revenue: 0 },
  { month: 'Mar', cost: 0, revenue: 0 },
  { month: 'Abr', cost: 0, revenue: 0 },
  { month: 'May', cost: 0, revenue: 0 },
  { month: 'Jun', cost: 0, revenue: 0 },
];

// ── Recharts tooltip style (dark glassmorphism) ─────────────────────

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

export default function FinancePage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      const qs = params.toString();
      const res = await fetch(`/api/admin/finance${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error(`Error ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExportCsv = () => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    const url = `/api/admin/finance/export${qs ? `?${qs}` : ''}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = 'finance-report.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header + date filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="page-heading text-2xl">Panel Financiero</h1>
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-slate-400" />
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-sm"
          />
          <span className="text-slate-500">—</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg px-3 py-1.5 text-sm"
          />
          <Button size="sm" onClick={fetchData}>
            Filtrar
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportCsv}>
            <Download className="h-4 w-4 mr-1" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {loading && (
        <p className="text-center text-slate-400 py-12">Cargando datos financieros…</p>
      )}
      {error && (
        <p className="text-center text-rose py-12">{error}</p>
      )}

      {data && !loading && (
        <>
          {/* ── KPI Cards ──────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {buildKpiCards(data).map((kpi) => (
              <div
                key={kpi.label}
                className="glass-panel rounded-2xl p-5 flex flex-col gap-2 transition-all duration-300 hover:-translate-y-1"
                style={{ boxShadow: `0 0 20px ${kpi.glowColor}` }}
              >
                <div className="flex items-center gap-2">
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                  <span className="text-xs font-medium text-slate-400">{kpi.label}</span>
                </div>
                <span className="text-2xl font-semibold text-white">{kpi.value}</span>
              </div>
            ))}
          </div>

          {/* ── Charts Row ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Trend Chart (placeholder) */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald" />
                  Tendencia de Costos e Ingresos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={PLACEHOLDER_TREND}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="colorCost" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#E11D48" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#E11D48" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="rgba(255,255,255,0.05)"
                      />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94A3B8', fontSize: 12 }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94A3B8', fontSize: 12 }}
                      />
                      <RechartsTooltip
                        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                        contentStyle={tooltipStyle}
                        itemStyle={tooltipItemStyle}
                        labelStyle={tooltipLabelStyle}
                      />
                      <Area
                        type="monotone"
                        dataKey="cost"
                        stroke="#E11D48"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorCost)"
                        name="Costo IA"
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="#10B981"
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#colorRevenue)"
                        name="Ingresos"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-xs text-slate-500 mt-2 text-center">
                  Datos de tendencia temporal no disponibles aún — placeholder
                </p>
              </CardContent>
            </Card>

            {/* Provider Comparison Bar Chart */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-violet-light" />
                  Costo por Proveedor
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.by_provider.length === 0 ? (
                  <div className="flex h-[260px] flex-col items-center justify-center text-slate-400">
                    <BarChart3 className="mb-2 h-8 w-8 opacity-20" />
                    <p className="text-sm">Sin datos de proveedores</p>
                  </div>
                ) : (
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={data.by_provider.map((p) => ({
                          name: `${p.provider_type}/${p.model_id.split('/').pop() ?? p.model_id}`,
                          cost: Number(p.cost_usd.toFixed(4)),
                          calls: p.calls,
                        }))}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="rgba(255,255,255,0.05)"
                        />
                        <XAxis
                          dataKey="name"
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#94A3B8', fontSize: 11 }}
                          dy={10}
                          interval={0}
                          angle={-15}
                        />
                        <YAxis
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: '#94A3B8', fontSize: 12 }}
                        />
                        <RechartsTooltip
                          cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                          contentStyle={tooltipStyle}
                          itemStyle={tooltipItemStyle}
                          labelStyle={tooltipLabelStyle}
                          formatter={(value, name) => [
                            name === 'cost' ? `$${value}` : value,
                            name === 'cost' ? 'Costo USD' : 'Llamadas',
                          ]}
                        />
                        <Bar
                          dataKey="cost"
                          fill="#7C3AED"
                          radius={[4, 4, 0, 0]}
                          name="cost"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ── Tables Row ─────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* By Provider Table */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Desglose por Proveedor</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-slate-400 border-b border-white/5">
                      <th className="pb-2">Proveedor</th>
                      <th className="pb-2 text-right">Input</th>
                      <th className="pb-2 text-right">Output</th>
                      <th className="pb-2 text-right">Llamadas</th>
                      <th className="pb-2 text-right">Costo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data.by_provider.map((r) => (
                      <tr key={`${r.provider_type}-${r.model_id}`}>
                        <td className="py-2 text-slate-200 capitalize">{r.provider_type}</td>
                        <td className="py-2 text-right text-slate-300">
                          {r.tokens_input.toLocaleString()}
                        </td>
                        <td className="py-2 text-right text-slate-300">
                          {r.tokens_output.toLocaleString()}
                        </td>
                        <td className="py-2 text-right text-slate-300">{r.calls}</td>
                        <td className="py-2 text-right text-emerald">
                          ${r.cost_usd.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                    {data.by_provider.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-slate-500">
                          Sin datos
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* By Agent Table */}
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
                    {data.by_agent.map((r) => (
                      <tr key={r.agent_name}>
                        <td className="py-2 text-slate-200 capitalize">{r.agent_name}</td>
                        <td className="py-2 text-right text-slate-300">
                          {r.tokens_total.toLocaleString()}
                        </td>
                        <td className="py-2 text-right text-slate-300">{r.calls}</td>
                        <td className="py-2 text-right text-emerald">
                          ${r.cost_usd.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                    {data.by_agent.length === 0 && (
                      <tr>
                        <td colSpan={4} className="py-4 text-center text-slate-500">
                          Sin datos
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          {/* ── Client Breakdown Table ─────────────────────────── */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Desglose por Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-400 border-b border-white/5">
                    <th className="pb-2">Cliente</th>
                    <th className="pb-2 text-right">Tokens Totales</th>
                    <th className="pb-2 text-right">Costo USD</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {data.by_client.map((c) => (
                    <tr key={c.company_id}>
                      <td className="py-2 text-slate-200">{c.company_name}</td>
                      <td className="py-2 text-right text-slate-300">
                        {c.tokens_total.toLocaleString()}
                      </td>
                      <td className="py-2 text-right text-emerald">
                        ${c.cost_usd.toFixed(4)}
                      </td>
                    </tr>
                  ))}
                  {data.by_client.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-slate-500">
                        Sin datos de clientes
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
