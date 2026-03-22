import { createAdminClient } from '@/lib/supabase/admin';
import { getBreakdown, type FinanceFilters } from '@/lib/ai/cost-calculator';
import { NextResponse } from 'next/server';
import { requireAdmin, applyRateLimit, RATE_LIMITS } from '@/lib/api/guard';

/** Default monthly infrastructure cost in USD when no DB records exist */
const DEFAULT_INFRASTRUCTURE_COST_USD = 50;

function round(n: number, decimals = 4): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

function escapeCsv(value: string | number): string {
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** GET /api/admin/finance/export — Download CSV with full financial breakdown */
export async function GET(req: Request) {
  const rl = await applyRateLimit(req, 'admin-finance-export', RATE_LIMITS.read);
  if (rl) return rl;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdminClient();

  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const companyId = searchParams.get('company_id');

    // ── 1. Build filters (same as main finance route) ──────────────
    const filters: FinanceFilters = {};
    if (from) filters.from = from;
    if (to) filters.to = to;
    if (companyId) filters.company_id = companyId;

    const breakdown = await getBreakdown(filters);

    // ── 2. Fetch usage logs for revenue + KPI calculation ──────────
    let usageQuery = supabase
      .from('ai_usage_logs')
      .select('provider_type, model_id, task_type, cost_usd, success');

    if (from) usageQuery = usageQuery.gte('created_at', from);
    if (to) usageQuery = usageQuery.lte('created_at', to);
    if (companyId) usageQuery = usageQuery.eq('company_id', companyId);

    const { data: logs } = await usageQuery;

    // ── 3. Fetch task pricing ──────────────────────────────────────
    const { data: pricing } = await supabase
      .from('task_pricing')
      .select('task_type, price_per_execution')
      .eq('is_active', true);

    // ── 4. Fetch infrastructure costs ──────────────────────────────
    const { data: infraCosts } = await supabase
      .from('infrastructure_costs')
      .select('monthly_cost')
      .eq('is_active', true);

    // ── 5. Calculate KPIs ──────────────────────────────────────────
    const taskCounts = new Map<string, number>();
    for (const log of logs ?? []) {
      if (log.success) {
        const tKey = log.task_type as string;
        taskCounts.set(tKey, (taskCounts.get(tKey) ?? 0) + 1);
      }
    }

    const priceMap = new Map(
      (pricing ?? []).map((p) => [p.task_type as string, Number(p.price_per_execution)]),
    );

    let totalRevenue = 0;
    for (const [taskType, count] of taskCounts) {
      totalRevenue += count * (priceMap.get(taskType) ?? 0);
    }

    const infraTotal = (infraCosts ?? []).reduce((sum, c) => sum + Number(c.monthly_cost), 0);
    const infrastructureCost = infraTotal > 0 ? infraTotal : DEFAULT_INFRASTRUCTURE_COST_USD;

    const totalAiCost = breakdown.total_cost_usd;
    const totalPayrolls = Array.from(taskCounts.values()).reduce((a, b) => a + b, 0);
    const grossMargin = totalRevenue - totalAiCost;
    const netMargin = totalRevenue - totalAiCost - infrastructureCost;
    const costPerPayroll = totalPayrolls > 0 ? totalAiCost / totalPayrolls : 0;

    // ── 6. Build CSV ───────────────────────────────────────────────
    const lines: string[] = [];

    // Section 1: KPIs
    lines.push('Section: KPIs');
    lines.push('metric,value');
    lines.push(`total_ai_cost,${round(totalAiCost, 6)}`);
    lines.push(`total_revenue,${round(totalRevenue)}`);
    lines.push(`gross_margin,${round(grossMargin)}`);
    lines.push(`net_margin,${round(netMargin)}`);
    lines.push(`cost_per_payroll,${round(costPerPayroll, 6)}`);
    lines.push('');

    // Section 2: By Provider
    lines.push('Section: By Provider');
    lines.push('provider_type,model_id,tokens_input,tokens_output,cost_usd');
    for (const p of breakdown.by_provider) {
      lines.push(
        [escapeCsv(p.provider_type), escapeCsv(p.model_id), p.tokens_input, p.tokens_output, p.cost_usd].join(','),
      );
    }
    lines.push('');

    // Section 3: By Agent
    lines.push('Section: By Agent');
    lines.push('agent_name,tokens_total,cost_usd,calls');
    for (const a of breakdown.by_agent) {
      lines.push(
        [escapeCsv(a.agent_name), a.tokens_total, a.cost_usd, a.calls].join(','),
      );
    }
    lines.push('');

    // Section 4: By Client
    lines.push('Section: By Client');
    lines.push('company_id,company_name,tokens_total,cost_usd');
    for (const c of breakdown.by_client) {
      lines.push(
        [escapeCsv(c.company_id), escapeCsv(c.company_name), c.tokens_total, c.cost_usd].join(','),
      );
    }

    const csv = lines.join('\n');

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="finance-report.csv"',
      },
    });
  } catch (error) {
    console.error('Finance export error:', error);
    return new Response('Failed to generate CSV export', { status: 500 });
  }
}
