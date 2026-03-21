import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error)
    return String((error as { message: unknown }).message);
  return fallback;
}

/** GET /api/admin/finance — Financial overview: tokens, costs, revenue, profitability */
export async function GET(req: Request) {
  const supabase = createAdminClient();

  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get('from');
    const to = searchParams.get('to');

    // ── 1. Fetch usage logs ────────────────────────────────────────
    let usageQuery = supabase
      .from('ai_usage_logs')
      .select('provider_type, model_id, agent_name, task_type, tokens_input, tokens_output, success, created_at');

    if (from) usageQuery = usageQuery.gte('created_at', from);
    if (to) usageQuery = usageQuery.lte('created_at', to);

    const { data: logs, error: logsError } = await usageQuery;

    if (logsError) {
      return NextResponse.json(
        { error: getErrorMessage(logsError, 'Failed to fetch usage logs') },
        { status: 500 },
      );
    }

    // ── 2. Fetch token rates ───────────────────────────────────────
    const { data: rates, error: ratesError } = await supabase
      .from('provider_token_rates')
      .select('provider_type, model_id, cost_per_1k_input_tokens, cost_per_1k_output_tokens')
      .order('effective_date', { ascending: false });

    if (ratesError) {
      return NextResponse.json(
        { error: getErrorMessage(ratesError, 'Failed to fetch token rates') },
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

    // ── 5. Build rate lookup (latest rate per provider+model) ──────
    const rateMap = new Map<string, { input: number; output: number }>();
    for (const r of rates ?? []) {
      const key = `${r.provider_type}::${r.model_id}`;
      if (!rateMap.has(key)) {
        rateMap.set(key, {
          input: Number(r.cost_per_1k_input_tokens),
          output: Number(r.cost_per_1k_output_tokens),
        });
      }
    }

    // ── 6. Aggregate tokens by provider ────────────────────────────
    const byProvider = new Map<string, { tokens_input: number; tokens_output: number; calls: number }>();
    const byAgent = new Map<string, { tokens_input: number; tokens_output: number; calls: number }>();
    const taskCounts = new Map<string, number>();

    for (const log of logs ?? []) {
      const tokIn = Number(log.tokens_input);
      const tokOut = Number(log.tokens_output);

      // By provider
      const pKey = log.provider_type as string;
      const pAgg = byProvider.get(pKey) ?? { tokens_input: 0, tokens_output: 0, calls: 0 };
      pAgg.tokens_input += tokIn;
      pAgg.tokens_output += tokOut;
      pAgg.calls += 1;
      byProvider.set(pKey, pAgg);

      // By agent
      const aKey = log.agent_name as string;
      const aAgg = byAgent.get(aKey) ?? { tokens_input: 0, tokens_output: 0, calls: 0 };
      aAgg.tokens_input += tokIn;
      aAgg.tokens_output += tokOut;
      aAgg.calls += 1;
      byAgent.set(aKey, aAgg);

      // Task counts for revenue
      if (log.success) {
        const tKey = log.task_type as string;
        taskCounts.set(tKey, (taskCounts.get(tKey) ?? 0) + 1);
      }
    }

    // ── 7. Calculate costs per provider+model ──────────────────────
    let totalCost = 0;
    const costBreakdown: Array<{
      provider_type: string;
      model_id: string;
      tokens_input: number;
      tokens_output: number;
      cost: number;
    }> = [];

    const modelAgg = new Map<string, { tokens_input: number; tokens_output: number }>();
    for (const log of logs ?? []) {
      const key = `${log.provider_type}::${log.model_id}`;
      const agg = modelAgg.get(key) ?? { tokens_input: 0, tokens_output: 0 };
      agg.tokens_input += Number(log.tokens_input);
      agg.tokens_output += Number(log.tokens_output);
      modelAgg.set(key, agg);
    }

    for (const [key, agg] of modelAgg) {
      const [providerType, modelId] = key.split('::');
      const rate = rateMap.get(key);
      const cost = rate
        ? (agg.tokens_input / 1000) * rate.input + (agg.tokens_output / 1000) * rate.output
        : 0;
      totalCost += cost;
      costBreakdown.push({
        provider_type: providerType,
        model_id: modelId,
        tokens_input: agg.tokens_input,
        tokens_output: agg.tokens_output,
        cost: round(cost),
      });
    }

    // ── 8. Calculate revenue from tasks ────────────────────────────
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

    // ── 9. Infrastructure totals ───────────────────────────────────
    const totalInfraCost = (infraCosts ?? []).reduce(
      (sum, c) => sum + Number(c.monthly_cost),
      0,
    );

    // ── 10. Profitability ──────────────────────────────────────────
    const totalTasks = Array.from(taskCounts.values()).reduce((a, b) => a + b, 0);
    const costPerPayroll = totalTasks > 0 ? totalCost / totalTasks : 0;

    return NextResponse.json({
      tokens_by_provider: Object.fromEntries(byProvider),
      tokens_by_agent: Object.fromEntries(byAgent),
      cost_breakdown: costBreakdown,
      total_ai_cost: round(totalCost),
      revenue_breakdown: revenueBreakdown,
      total_revenue: round(totalRevenue),
      infrastructure_cost_monthly: round(totalInfraCost),
      profitability: {
        gross_profit: round(totalRevenue - totalCost),
        net_profit: round(totalRevenue - totalCost - totalInfraCost),
        margin_percent: totalRevenue > 0
          ? round(((totalRevenue - totalCost - totalInfraCost) / totalRevenue) * 100)
          : 0,
        cost_per_payroll: round(costPerPayroll),
      },
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

function round(n: number, decimals = 4): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}
