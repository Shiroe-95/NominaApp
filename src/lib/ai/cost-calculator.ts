import { createAdminClient } from '../supabase/admin';

// ── Types ───────────────────────────────────────────────────────────

export interface CostEstimate {
  provider_type: string;
  model_id: string;
  estimated_input_tokens: number;
  estimated_output_tokens: number;
  estimated_cost_usd: number;
}

export interface CostBreakdown {
  by_provider: Array<{
    provider_type: string;
    model_id: string;
    tokens_input: number;
    tokens_output: number;
    cost_usd: number;
  }>;
  by_agent: Array<{
    agent_name: string;
    tokens_total: number;
    cost_usd: number;
    calls: number;
  }>;
  by_client: Array<{
    company_id: string;
    company_name: string;
    tokens_total: number;
    cost_usd: number;
  }>;
  total_cost_usd: number;
}

export interface FinanceFilters {
  from?: string;   // ISO date string
  to?: string;     // ISO date string
  company_id?: string;
  provider_type?: string;
  agent_name?: string;
}

// ── Rate cache ──────────────────────────────────────────────────────

interface TokenRate {
  input: number;
  output: number;
}

/** In-memory cache: key = "providerType::modelId" → rate per 1k tokens */
const rateCache = new Map<string, TokenRate>();

// ── Helpers ─────────────────────────────────────────────────────────

function buildCacheKey(providerType: string, modelId: string): string {
  return `${providerType}::${modelId}`;
}

/**
 * Fetches the latest token rate for a provider+model from `provider_token_rates`.
 * Returns null if no rate is configured.
 */
async function fetchLatestRate(
  providerType: string,
  modelId: string,
): Promise<TokenRate | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('provider_token_rates')
    .select('cost_per_1k_input_tokens, cost_per_1k_output_tokens')
    .eq('provider_type', providerType)
    .eq('model_id', modelId)
    .order('effective_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('[cost-calculator] Failed to fetch rate:', error.message);
    return null;
  }

  if (!data) return null;

  return {
    input: Number(data.cost_per_1k_input_tokens),
    output: Number(data.cost_per_1k_output_tokens),
  };
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Calculates the actual cost in USD for a completed AI call.
 *
 * Formula: (tokensInput / 1000) × rate_input + (tokensOutput / 1000) × rate_output
 * Rounded to 6 decimal places. Returns 0 if no rate is configured.
 */
export async function calculateCost(
  providerType: string,
  modelId: string,
  tokensInput: number,
  tokensOutput: number,
): Promise<number> {
  const cacheKey = buildCacheKey(providerType, modelId);
  let rate = rateCache.get(cacheKey);

  if (!rate) {
    const dbRate = await fetchLatestRate(providerType, modelId);
    if (!dbRate) return 0;
    rate = dbRate;
    rateCache.set(cacheKey, rate);
  }

  const cost = (tokensInput / 1000) * rate.input + (tokensOutput / 1000) * rate.output;
  return Math.round(cost * 1_000_000) / 1_000_000;
}

/**
 * Estimates the cost in USD for a planned AI call before execution.
 *
 * Splits estimatedTokens roughly 60% input / 40% output.
 * Uses the same rate cache as calculateCost.
 * Returns a CostEstimate with estimated_cost_usd = 0 if no rate is configured.
 */
export async function estimateCost(
  providerType: string,
  modelId: string,
  estimatedTokens: number,
): Promise<CostEstimate> {
  const estimatedInput = Math.round(estimatedTokens * 0.6);
  const estimatedOutput = estimatedTokens - estimatedInput;

  const costUsd = await calculateCost(providerType, modelId, estimatedInput, estimatedOutput);

  return {
    provider_type: providerType,
    model_id: modelId,
    estimated_input_tokens: estimatedInput,
    estimated_output_tokens: estimatedOutput,
    estimated_cost_usd: costUsd,
  };
}

/**
 * Aggregates costs from `ai_usage_logs` by provider, agent, and client.
 *
 * Accepts optional FinanceFilters (date range, company_id, etc.).
 * Returns a CostBreakdown with by_provider, by_agent, by_client arrays and total_cost_usd.
 */
export async function getBreakdown(filters?: FinanceFilters): Promise<CostBreakdown> {
  const supabase = createAdminClient();

  let query = supabase
    .from('ai_usage_logs')
    .select('provider_type, model_id, agent_name, tokens_input, tokens_output, cost_usd, company_id');

  if (filters?.from) query = query.gte('created_at', filters.from);
  if (filters?.to) query = query.lte('created_at', filters.to);
  if (filters?.company_id) query = query.eq('company_id', filters.company_id);
  if (filters?.provider_type) query = query.eq('provider_type', filters.provider_type);
  if (filters?.agent_name) query = query.eq('agent_name', filters.agent_name);

  const { data: logs, error } = await query;

  if (error) {
    console.error('[cost-calculator] Failed to fetch usage logs for breakdown:', error.message);
    return { by_provider: [], by_agent: [], by_client: [], total_cost_usd: 0 };
  }

  if (!logs || logs.length === 0) {
    return { by_provider: [], by_agent: [], by_client: [], total_cost_usd: 0 };
  }

  // ── Aggregate by provider + model ──
  const providerMap = new Map<string, { tokens_input: number; tokens_output: number; cost_usd: number }>();
  // ── Aggregate by agent ──
  const agentMap = new Map<string, { tokens_total: number; cost_usd: number; calls: number }>();
  // ── Aggregate by client (company_id) ──
  const clientMap = new Map<string, { tokens_total: number; cost_usd: number }>();

  let totalCost = 0;

  for (const log of logs) {
    const tokIn = Number(log.tokens_input) || 0;
    const tokOut = Number(log.tokens_output) || 0;
    const cost = Number(log.cost_usd) || 0;
    totalCost += cost;

    // By provider+model
    const pKey = `${log.provider_type}::${log.model_id}`;
    const pAgg = providerMap.get(pKey) ?? { tokens_input: 0, tokens_output: 0, cost_usd: 0 };
    pAgg.tokens_input += tokIn;
    pAgg.tokens_output += tokOut;
    pAgg.cost_usd += cost;
    providerMap.set(pKey, pAgg);

    // By agent
    const aKey = log.agent_name as string;
    const aAgg = agentMap.get(aKey) ?? { tokens_total: 0, cost_usd: 0, calls: 0 };
    aAgg.tokens_total += tokIn + tokOut;
    aAgg.cost_usd += cost;
    aAgg.calls += 1;
    agentMap.set(aKey, aAgg);

    // By client
    const companyId = log.company_id as string | null;
    if (companyId) {
      const cAgg = clientMap.get(companyId) ?? { tokens_total: 0, cost_usd: 0 };
      cAgg.tokens_total += tokIn + tokOut;
      cAgg.cost_usd += cost;
      clientMap.set(companyId, cAgg);
    }
  }

  // ── Resolve company names ──
  const companyIds = Array.from(clientMap.keys());
  const companyNames = new Map<string, string>();

  if (companyIds.length > 0) {
    const { data: companies } = await supabase
      .from('companies')
      .select('id, name')
      .in('id', companyIds);

    for (const c of companies ?? []) {
      companyNames.set(c.id as string, c.name as string);
    }
  }

  // ── Build result arrays ──
  const by_provider = Array.from(providerMap.entries()).map(([key, agg]) => {
    const [provider_type, model_id] = key.split('::');
    return {
      provider_type,
      model_id,
      tokens_input: agg.tokens_input,
      tokens_output: agg.tokens_output,
      cost_usd: Math.round(agg.cost_usd * 1_000_000) / 1_000_000,
    };
  });

  const by_agent = Array.from(agentMap.entries()).map(([agent_name, agg]) => ({
    agent_name,
    tokens_total: agg.tokens_total,
    cost_usd: Math.round(agg.cost_usd * 1_000_000) / 1_000_000,
    calls: agg.calls,
  }));

  const by_client = Array.from(clientMap.entries()).map(([company_id, agg]) => ({
    company_id,
    company_name: companyNames.get(company_id) ?? 'Unknown',
    tokens_total: agg.tokens_total,
    cost_usd: Math.round(agg.cost_usd * 1_000_000) / 1_000_000,
  }));

  return {
    by_provider,
    by_agent,
    by_client,
    total_cost_usd: Math.round(totalCost * 1_000_000) / 1_000_000,
  };
}

/**
 * Clears the in-memory rate cache. Useful for testing or after rate updates.
 */
export function clearRateCache(): void {
  rateCache.clear();
}

/**
 * Exposes the rate cache for testing purposes.
 */
export function getRateCache(): Map<string, TokenRate> {
  return rateCache;
}
