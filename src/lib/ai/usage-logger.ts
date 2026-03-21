import { createAdminClient } from '../supabase/admin';

// ── Types ───────────────────────────────────────────────────────────

export interface UsageLogEntry {
  provider_id?: string;
  provider_type: string;
  model_id: string;
  agent_name: string;
  task_type: string;
  tokens_input: number;
  tokens_output: number;
  latency_ms: number;
  success: boolean;
  error_message?: string;
  fallback_from?: string;
  fallback_reason?: string;
}

export interface UsageStats {
  provider_type: string;
  total_calls: number;
  total_tokens: number;
  error_rate: number;
  avg_latency_ms: number;
}

export interface UsageStatsFilters {
  provider_type?: string;
  agent_name?: string;
  from?: string; // ISO date
  to?: string;   // ISO date
}

// ── logAiUsage ──────────────────────────────────────────────────────

/**
 * Inserts a usage log record into the `ai_usage_logs` table.
 */
export async function logAiUsage(entry: UsageLogEntry): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from('ai_usage_logs').insert({
    provider_id: entry.provider_id ?? null,
    provider_type: entry.provider_type,
    model_id: entry.model_id,
    agent_name: entry.agent_name,
    task_type: entry.task_type,
    tokens_input: entry.tokens_input,
    tokens_output: entry.tokens_output,
    latency_ms: entry.latency_ms,
    success: entry.success,
    error_message: entry.error_message ?? null,
    fallback_from: entry.fallback_from ?? null,
    fallback_reason: entry.fallback_reason ?? null,
  });

  if (error) {
    console.error('[usage-logger] Failed to log AI usage:', error.message);
  }
}

// ── getUsageStats ───────────────────────────────────────────────────

/**
 * Aggregates usage stats by provider_type from `ai_usage_logs`.
 * Returns total calls, total tokens, error rate, and average latency per provider.
 */
export async function getUsageStats(filters?: UsageStatsFilters): Promise<UsageStats[]> {
  const supabase = createAdminClient();

  let query = supabase.from('ai_usage_logs').select('*');

  if (filters?.provider_type) {
    query = query.eq('provider_type', filters.provider_type);
  }
  if (filters?.agent_name) {
    query = query.eq('agent_name', filters.agent_name);
  }
  if (filters?.from) {
    query = query.gte('created_at', filters.from);
  }
  if (filters?.to) {
    query = query.lte('created_at', filters.to);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[usage-logger] Failed to fetch usage stats:', error.message);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // Aggregate by provider_type
  const grouped = new Map<string, typeof data>();

  for (const row of data) {
    const key = row.provider_type as string;
    const group = grouped.get(key);
    if (group) {
      group.push(row);
    } else {
      grouped.set(key, [row]);
    }
  }

  const stats: UsageStats[] = [];

  for (const [providerType, rows] of grouped) {
    const totalCalls = rows.length;
    const totalTokens = rows.reduce(
      (sum, r) => sum + (r.tokens_input as number) + (r.tokens_output as number),
      0,
    );
    const failures = rows.filter((r) => r.success === false).length;
    const errorRate = totalCalls > 0 ? failures / totalCalls : 0;
    const avgLatency =
      totalCalls > 0
        ? rows.reduce((sum, r) => sum + (r.latency_ms as number), 0) / totalCalls
        : 0;

    stats.push({
      provider_type: providerType,
      total_calls: totalCalls,
      total_tokens: totalTokens,
      error_rate: errorRate,
      avg_latency_ms: Math.round(avgLatency),
    });
  }

  return stats;
}
