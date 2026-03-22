import { createAdminClient } from '@/lib/supabase/admin';
import { getBreakdown, type FinanceFilters } from '@/lib/ai/cost-calculator';
import { NextResponse } from 'next/server';
import { requireAdmin, applyRateLimit, RATE_LIMITS } from '@/lib/api/guard';

/** Costo mensual de infraestructura por defecto (USD) cuando no existen registros en BD */
const DEFAULT_INFRASTRUCTURE_COST_USD = 50;

/**
 * Extrae un mensaje legible de un error desconocido.
 *
 * @param error - Valor capturado en un bloque catch.
 * @param fallback - Mensaje por defecto si el error no contiene `.message`.
 * @returns Mensaje de error como string.
 */
function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error)
    return String((error as { message: unknown }).message);
  return fallback;
}

/**
 * GET /api/admin/finance — Resumen financiero de IA.
 *
 * Requiere rol `admin`. Aplica rate limiting con preset `read`.
 *
 * Query params opcionales:
 * - `from` (ISO date) — Inicio del rango de fechas.
 * - `to` (ISO date) — Fin del rango de fechas.
 * - `company_id` (UUID) — Filtrar por empresa.
 *
 * @returns JSON con KPIs (costo IA, ingresos, márgenes, costo por nómina),
 *          desgloses por proveedor/agente/cliente, breakdown de ingresos,
 *          rentabilidad y metadatos del período.
 *          Retorna 401 si no autenticado, 403 si no es admin, 429 si excede rate limit.
 */
export async function GET(req: Request) {
  const rl = await applyRateLimit(req, 'admin-finance', RATE_LIMITS.read);
  if (rl) return rl;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdminClient();

  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const companyId = searchParams.get('company_id');

    // ── 1. Use getBreakdown for aggregated cost data ───────────────
    const filters: FinanceFilters = {};
    if (from) filters.from = from;
    if (to) filters.to = to;
    if (companyId) filters.company_id = companyId;

    const breakdown = await getBreakdown(filters);

    // ── 2. Fetch usage logs for calls count per provider + revenue calc
    let usageQuery = supabase
      .from('ai_usage_logs')
      .select('provider_type, model_id, agent_name, task_type, tokens_input, tokens_output, cost_usd, success, company_id, created_at');

    if (from) usageQuery = usageQuery.gte('created_at', from);
    if (to) usageQuery = usageQuery.lte('created_at', to);
    if (companyId) usageQuery = usageQuery.eq('company_id', companyId);

    const { data: logs, error: logsError } = await usageQuery;

    if (logsError) {
      return NextResponse.json(
        { error: getErrorMessage(logsError, 'Failed to fetch usage logs') },
        { status: 500 },
      );
    }

    // ── 3. Fetch task pricing ──────────────────────────────────────
    const { data: pricing, error: pricingError } = await supabase
      .from('task_pricing')
      .select('task_type, price_per_execution, currency_code')
      .eq('is_active', true);

    if (pricingError) {
      return NextResponse.json(
        { error: getErrorMessage(pricingError, 'Failed to fetch task pricing') },
        { status: 500 },
      );
    }

    // ── 4. Fetch infrastructure costs ──────────────────────────────
    const { data: infraCosts, error: infraError } = await supabase
      .from('infrastructure_costs')
      .select('cost_type, monthly_cost, currency_code')
      .eq('is_active', true);

    if (infraError) {
      return NextResponse.json(
        { error: getErrorMessage(infraError, 'Failed to fetch infrastructure costs') },
        { status: 500 },
      );
    }

    // ── 5. Enhance by_provider with calls count ────────────────────
    const providerCallsMap = new Map<string, number>();
    const taskCounts = new Map<string, number>();

    for (const log of logs ?? []) {
      // Calls per provider+model
      const pKey = `${log.provider_type}::${log.model_id}`;
      providerCallsMap.set(pKey, (providerCallsMap.get(pKey) ?? 0) + 1);

      // Task counts for revenue
      if (log.success) {
        const tKey = log.task_type as string;
        taskCounts.set(tKey, (taskCounts.get(tKey) ?? 0) + 1);
      }
    }

    const by_provider = breakdown.by_provider.map((p) => ({
      ...p,
      calls: providerCallsMap.get(`${p.provider_type}::${p.model_id}`) ?? 0,
    }));

    // ── 6. Calculate total AI cost from real cost_usd ──────────────
    const totalAiCost = breakdown.total_cost_usd;

    // ── 7. Calculate revenue from tasks ────────────────────────────
    const priceMap = new Map(
      (pricing ?? []).map((p) => [p.task_type as string, Number(p.price_per_execution)]),
    );

    let totalRevenue = 0;
    const revenueBreakdown: Array<{ task_type: string; count: number; price_per_task: number; revenue: number }> = [];

    for (const [taskType, count] of taskCounts) {
      const price = priceMap.get(taskType) ?? 0;
      const revenue = count * price;
      totalRevenue += revenue;
      revenueBreakdown.push({
        task_type: taskType,
        count,
        price_per_task: price,
        revenue: round(revenue),
      });
    }

    // ── 8. Infrastructure totals ───────────────────────────────────
    const infraTotal = (infraCosts ?? []).reduce(
      (sum, c) => sum + Number(c.monthly_cost),
      0,
    );
    const infrastructureCost = infraTotal > 0 ? infraTotal : DEFAULT_INFRASTRUCTURE_COST_USD;

    // ── 9. KPIs ────────────────────────────────────────────────────
    const totalPayrolls = Array.from(taskCounts.values()).reduce((a, b) => a + b, 0);
    const grossMargin = totalRevenue - totalAiCost;
    const netMargin = totalRevenue - totalAiCost - infrastructureCost;
    const costPerPayroll = totalPayrolls > 0 ? totalAiCost / totalPayrolls : 0;

    return NextResponse.json({
      // KPIs
      total_ai_cost: round(totalAiCost, 6),
      total_revenue: round(totalRevenue),
      gross_margin: round(grossMargin),
      net_margin: round(netMargin),
      cost_per_payroll: round(costPerPayroll, 6),
      infrastructure_cost_monthly: round(infrastructureCost),

      // Breakdowns
      by_provider,
      by_agent: breakdown.by_agent,
      by_client: breakdown.by_client,
      revenue_breakdown: revenueBreakdown,

      // Profitability (kept for backward compat)
      profitability: {
        gross_profit: round(grossMargin),
        net_profit: round(netMargin),
        margin_percent: totalRevenue > 0
          ? round(((totalRevenue - totalAiCost - infrastructureCost) / totalRevenue) * 100)
          : 0,
        cost_per_payroll: round(costPerPayroll, 6),
      },

      // Metadata
      period: { from: from ?? null, to: to ?? null },
      total_logs: (logs ?? []).length,
    });
  } catch (error) {
    console.error('Finance GET error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to generate financial report') },
      { status: 500 },
    );
  }
}

/**
 * Redondea un número a la cantidad de decimales indicada.
 *
 * @param n - Número a redondear.
 * @param decimals - Cantidad de decimales (por defecto 4).
 * @returns Número redondeado.
 */
function round(n: number, decimals = 4): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
