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
  cost_usd?: number;
  company_id?: string;
  model_selection_reason?: string;
  complexity_level?: string;
  complexity_score?: number;
}

export type GroupByDimension = 'provider' | 'agent' | 'task' | 'client' | 'model';

export interface UsageStats {
  provider_type: string;
  total_calls: number;
  total_tokens: number;
  error_rate: number;
  avg_latency_ms: number;
  cost_usd: number;
}

export interface UsageStatsFilters {
  provider_type?: string;
  agent_name?: string;
  from?: string; // ISO date
  to?: string;   // ISO date
}

export interface EnhancedUsageStatsFilters extends UsageStatsFilters {
  company_id?: string;
  complexity_level?: string;
  task_type?: string;
  group_by?: GroupByDimension;
}

// ── logAiUsage ──────────────────────────────────────────────────────

/**
 * Inserts a usage log record into the `ai_usage_logs` table.
 */
export async function logAiUsage(entry: UsageLogEntry): Promise<void> {
  const supabase = createAdminClient();

  const record: Record<string, unknown> = {
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
  };

  if (entry.cost_usd !== undefined) record.cost_usd = entry.cost_usd;
  if (entry.company_id !== undefined) record.company_id = entry.company_id;
  if (entry.model_selection_reason !== undefined) record.model_selection_reason = entry.model_selection_reason;
  if (entry.complexity_level !== undefined) record.complexity_level = entry.complexity_level;
  if (entry.complexity_score !== undefined) record.complexity_score = entry.complexity_score;

  const { error } = await supabase.from('ai_usage_logs').insert(record);

  if (error) {
    console.error('[usage-logger] Failed to log AI usage:', error.message);
  }
}

// ── Group-by column mapping ─────────────────────────────────────────

const GROUP_BY_COLUMN: Record<GroupByDimension, string> = {
  provider: 'provider_type',
  agent: 'agent_name',
  task: 'task_type',
  client: 'company_id',
  model: 'model_id',
};

// ── getUsageStats ───────────────────────────────────────────────────

/**
 * Aggregates usage stats from `ai_usage_logs`.
 *
 * Supports flexible grouping via `group_by`:
 *   - 'provider' (default): group by provider_type
 *   - 'agent': group by agent_name
 *   - 'task': group by task_type
 *   - 'client': group by company_id
 *   - 'model': group by model_id
 *
 * Each group returns: group key (in `provider_type` for backward compat),
 * total_calls, total_tokens, error_rate, avg_latency_ms, and cost_usd.
 *
 * Callers that don't pass `group_by` get the same provider-grouped behavior.
 */
export async function getUsageStats(
  filters?: UsageStatsFilters | EnhancedUsageStatsFilters,
): Promise<UsageStats[]> {
  const supabase = createAdminClient();

  let query = supabase.from('ai_usage_logs').select('*');

  // ── Base filters (backward-compatible) ──
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

  // ── Enhanced filters ──
  const enhanced = filters as EnhancedUsageStatsFilters | undefined;
  if (enhanced?.company_id) {
    query = query.eq('company_id', enhanced.company_id);
  }
  if (enhanced?.complexity_level) {
    query = query.eq('complexity_level', enhanced.complexity_level);
  }
  if (enhanced?.task_type) {
    query = query.eq('task_type', enhanced.task_type);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[usage-logger] Failed to fetch usage stats:', error.message);
    return [];
  }

  if (!data || data.length === 0) {
    return [];
  }

  // ── Determine grouping column ──
  const dimension: GroupByDimension = enhanced?.group_by ?? 'provider';
  const column = GROUP_BY_COLUMN[dimension];

  // ── Group rows by the chosen column ──
  const grouped = new Map<string, typeof data>();

  for (const row of data) {
    const key = (row[column] as string) ?? 'unknown';
    const group = grouped.get(key);
    if (group) {
      group.push(row);
    } else {
      grouped.set(key, [row]);
    }
  }

  // ── Aggregate each group ──
  const stats: UsageStats[] = [];

  for (const [groupKey, rows] of grouped) {
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
    const costUsd = rows.reduce(
      (sum, r) => sum + ((r.cost_usd as number) ?? 0),
      0,
    );

    stats.push({
      provider_type: groupKey,
      total_calls: totalCalls,
      total_tokens: totalTokens,
      error_rate: errorRate,
      avg_latency_ms: Math.round(avgLatency),
      cost_usd: Math.round(costUsd * 1_000_000) / 1_000_000,
    });
  }

  return stats;
}
