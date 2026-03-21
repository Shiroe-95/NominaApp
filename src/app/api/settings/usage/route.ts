import { NextRequest, NextResponse } from 'next/server';
import { getUsageStats } from '@/lib/ai/usage-logger';
import type { UsageStatsFilters } from '@/lib/ai/usage-logger';

/** GET /api/settings/usage — aggregated usage statistics by provider */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;

    const filters: UsageStatsFilters = {};

    const providerType = searchParams.get('provider_type');
    if (providerType) filters.provider_type = providerType;

    const agentName = searchParams.get('agent_name');
    if (agentName) filters.agent_name = agentName;

    const from = searchParams.get('from');
    if (from) filters.from = from;

    const to = searchParams.get('to');
    if (to) filters.to = to;

    const stats = await getUsageStats(filters);

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Usage GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch usage stats' },
      { status: 500 },
    );
  }
}
