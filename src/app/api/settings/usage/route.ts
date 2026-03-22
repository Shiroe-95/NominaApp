import { NextRequest, NextResponse } from 'next/server';
import { getUsageStats } from '@/lib/ai/usage-logger';
import type { EnhancedUsageStatsFilters, GroupByDimension } from '@/lib/ai/usage-logger';

const VALID_GROUP_BY: GroupByDimension[] = ['provider', 'agent', 'task', 'client', 'model'];

/** GET /api/settings/usage — aggregated usage statistics with multi-dimensional breakdowns */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    // ── Build base filters ──
    const baseFilters: EnhancedUsageStatsFilters = {};

    const providerType = searchParams.get('provider_type');
    if (providerType) baseFilters.provider_type = providerType;

    const agentName = searchParams.get('agent_name');
    if (agentName) baseFilters.agent_name = agentName;

    const from = searchParams.get('from');
    if (from) baseFilters.from = from;

    const to = searchParams.get('to');
    if (to) baseFilters.to = to;

    const companyId = searchParams.get('company_id');
    if (companyId) baseFilters.company_id = companyId;

    const complexityLevel = searchParams.get('complexity_level');
    if (complexityLevel) baseFilters.complexity_level = complexityLevel;

    const taskType = searchParams.get('task_type');
    if (taskType) baseFilters.task_type = taskType;

    // ── Single group_by mode ──
    const groupBy = searchParams.get('group_by') as GroupByDimension | null;

    if (groupBy) {
      if (!VALID_GROUP_BY.includes(groupBy)) {
        return NextResponse.json(
          { error: `Invalid group_by value. Must be one of: ${VALID_GROUP_BY.join(', ')}` },
          { status: 400 },
        );
      }

      const stats = await getUsageStats({ ...baseFilters, group_by: groupBy });
      return NextResponse.json({ stats });
    }

    // ── Multi-dimensional response (no group_by specified) ──
    const [byProvider, byAgent, byTask, byClient] = await Promise.all([
      getUsageStats({ ...baseFilters, group_by: 'provider' }),
      getUsageStats({ ...baseFilters, group_by: 'agent' }),
      getUsageStats({ ...baseFilters, group_by: 'task' }),
      getUsageStats({ ...baseFilters, group_by: 'client' }),
    ]);

    // ── Compute aggregated totals from provider breakdown ──
    const totalCalls = byProvider.reduce((sum, s) => sum + s.total_calls, 0);
    const totalTokens = byProvider.reduce((sum, s) => sum + s.total_tokens, 0);
    const totalCost = byProvider.reduce((sum, s) => sum + s.cost_usd, 0);
    const totalFailures = byProvider.reduce(
      (sum, s) => sum + Math.round(s.error_rate * s.total_calls),
      0,
    );
    const globalErrorRate = totalCalls > 0 ? totalFailures / totalCalls : 0;
    const avgLatency =
      totalCalls > 0
        ? byProvider.reduce((sum, s) => sum + s.avg_latency_ms * s.total_calls, 0) / totalCalls
        : 0;

    return NextResponse.json({
      stats: byProvider,
      by_agent: byAgent,
      by_task: byTask,
      by_client: byClient,
      aggregated: {
        total_calls: totalCalls,
        total_tokens: totalTokens,
        total_cost_usd: Math.round(totalCost * 1_000_000) / 1_000_000,
        global_error_rate: Math.round(globalErrorRate * 10_000) / 10_000,
        avg_latency_ms: Math.round(avgLatency),
      },
    });
  } catch (error) {
    console.error('Usage GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch usage stats' },
      { status: 500 },
    );
  }
}
