'use client';

/**
 * Panel Financiero de Administración.
 *
 * Página exclusiva para usuarios con rol `admin` que muestra métricas
 * financieras del consumo de IA: tokens consumidos, costos estimados,
 * ingresos por tareas, margen de ganancia y costo promedio por nómina.
 *
 * Consume el endpoint `GET /api/admin/finance` con filtros opcionales
 * de rango de fechas (`from`, `to`) como query params ISO.
 *
 * Ruta: `/[locale]/admin/finance`
 * Acceso: Solo rol `admin` (protegido por middleware).
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { DollarSign, TrendingUp, Activity, BarChart3, Calendar } from 'lucide-react';

// ── Tipos de datos del endpoint /api/admin/finance ──────────────────

/** Resumen agregado de métricas financieras de IA. */
interface Summary {
  totalTokens: number;
  estimatedCost: number;
  totalRevenue: number;
  profitMargin: number;
  costPerPayroll: number;
}

/** Desglose de consumo de tokens y costo por proveedor de IA. */
interface ProviderRow {
  provider_name: string;
  total_tokens: number;
  estimated_cost: number;
}

/** Desglose de consumo de tokens y llamadas por agente especializado. */
interface AgentRow {
  agent_name: string;
  total_tokens: number;
  call_count: number;
}

/** Respuesta completa del endpoint `/api/admin/finance`. */
interface FinanceData {
  summary: Summary;
  byProvider: ProviderRow[];
  byAgent: AgentRow[];
}

/**
 * Genera la configuración de tarjetas de métricas a partir del resumen financiero.
 * Cada tarjeta incluye etiqueta, valor formateado, icono y color.
 */
const metricCards = (s: Summary) => [
  { label: 'Tokens consumidos', value: s.totalTokens.toLocaleString(), icon: Activity, color: 'text-violet-600' },
  { label: 'Costo estimado (USD)', value: `$${s.estimatedCost.toFixed(2)}`, icon: DollarSign, color: 'text-emerald-600' },
  { label: 'Ingresos por tareas', value: `$${s.totalRevenue.toFixed(2)}`, icon: TrendingUp, color: 'text-blue-600' },
  { label: 'Margen de ganancia', value: `${s.profitMargin.toFixed(1)}%`, icon: BarChart3, color: 'text-amber-600' },
  { label: 'Costo por nómina', value: `$${s.costPerPayroll.toFixed(2)}`, icon: DollarSign, color: 'text-rose-600' },
];

/**
 * Página del Panel Financiero.
 *
 * Muestra cinco métricas clave en tarjetas, una tabla de consumo por proveedor
 * de IA y una tabla de consumo por agente especializado. Incluye filtros de
 * rango de fechas para acotar el período de análisis.
 *
 * @returns Componente de página con dashboard financiero de IA.
 */
export default function FinancePage() {
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  /** Obtiene datos financieros del endpoint con filtros de fecha opcionales. */
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

  useEffect(() => { fetchData(); }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Panel Financiero</h1>
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-slate-400" />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700" />
          <span className="text-slate-400">—</span>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700" />
          <Button onClick={fetchData}>Filtrar</Button>
        </div>
      </div>

      {loading && <p className="text-center text-slate-500 py-12">Cargando datos financieros…</p>}
      {error && <p className="text-center text-red-500 py-12">{error}</p>}

      {data && !loading && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {metricCards(data.summary).map((m) => (
              <div key={m.label} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <m.icon className={`h-5 w-5 ${m.color}`} />
                  <span className="text-xs font-medium text-slate-500">{m.label}</span>
                </div>
                <span className="text-2xl font-semibold text-slate-800">{m.value}</span>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Tokens por proveedor */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Tokens por proveedor</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="pb-2">Proveedor</th>
                    <th className="pb-2 text-right">Tokens</th>
                    <th className="pb-2 text-right">Costo (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.byProvider.map((r) => (
                    <tr key={r.provider_name}>
                      <td className="py-2 text-slate-700 capitalize">{r.provider_name}</td>
                      <td className="py-2 text-right text-slate-600">{r.total_tokens.toLocaleString()}</td>
                      <td className="py-2 text-right text-slate-600">${r.estimated_cost.toFixed(2)}</td>
                    </tr>
                  ))}
                  {data.byProvider.length === 0 && (
                    <tr><td colSpan={3} className="py-4 text-center text-slate-400">Sin datos</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Tokens por agente */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-lg font-semibold text-slate-800 mb-4">Tokens por agente</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-slate-500 border-b border-slate-100">
                    <th className="pb-2">Agente</th>
                    <th className="pb-2 text-right">Tokens</th>
                    <th className="pb-2 text-right">Llamadas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.byAgent.map((r) => (
                    <tr key={r.agent_name}>
                      <td className="py-2 text-slate-700 capitalize">{r.agent_name}</td>
                      <td className="py-2 text-right text-slate-600">{r.total_tokens.toLocaleString()}</td>
                      <td className="py-2 text-right text-slate-600">{r.call_count}</td>
                    </tr>
                  ))}
                  {data.byAgent.length === 0 && (
                    <tr><td colSpan={3} className="py-4 text-center text-slate-400">Sin datos</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
