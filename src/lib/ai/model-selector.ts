import type { ProviderConfig, OrchestrateRequest } from './types';
import { createAdminClient } from '../supabase/admin';

// ── Types ───────────────────────────────────────────────────────────

export interface TaskComplexity {
  level: 'simple' | 'moderate' | 'complex';
  score: number; // 0.0 - 1.0
  factors: string[];
}

export interface ModelCandidate {
  providerId: string;
  providerType: ProviderConfig['provider_type'];
  modelId: string;
  estimatedCostPer1kTokens: number;
  qualityScore: number; // 0.0 - 1.0 based on history
  tier: 'economy' | 'standard' | 'premium';
}

export interface ModelSelection {
  providerId: string;
  providerType: string;
  modelId: string;
  reason: string;
  estimatedCost: number;
  complexityAssessed: TaskComplexity;
}

export interface ModelRoutingRule {
  id: string;
  task_type: string;
  agent_name: string;
  complexity_level: 'simple' | 'moderate' | 'complex';
  preferred_provider_type: string;
  preferred_model_id: string;
  max_cost_per_1k_tokens: number;
  min_quality_score: number;
  is_active: boolean;
}

export interface OptimizationConfig {
  strategy: 'cost-first' | 'quality-first' | 'balanced';
  cost_weight: number;      // 0.0 - 1.0
  quality_weight: number;   // 0.0 - 1.0
  max_cost_per_task_usd: number;
  min_quality_threshold: number; // 0.0 - 1.0
  enable_auto_routing: boolean;
}

export interface TaskContext {
  taskType: OrchestrateRequest['type'];
  agentName: string;
  dataSize?: number;        // number of payroll rows
  messageCount?: number;    // number of chat messages
  hasPayrollData: boolean;
  countryCode: string;
  previousStepComplexity?: TaskComplexity;
}

// ── Constants ───────────────────────────────────────────────────────

const BASE_COMPLEXITY: Record<string, number> = {
  'chat': 0.2,
  'map': 0.3,
  'validate': 0.5,
  'correct': 0.6,
  'full-analysis': 0.8,
};

const AGENT_COMPLEXITY_BOOST: Record<string, number> = {
  'auditor': 0.1,
  'writer': 0.05,
  'corrector': 0.1,
  'mapper': -0.05,
  'payroll-expert': 0,
  'researcher': 0.1,
};

// ── Functions ───────────────────────────────────────────────────────

/**
 * Evaluates the complexity of a task based on its type, data volume,
 * agent role, and country context.
 *
 * Returns a TaskComplexity with a normalized score [0, 1], a classification
 * level (simple / moderate / complex), and the list of contributing factors.
 */
export function assessComplexity(
  taskType: string,
  context: TaskContext,
): TaskComplexity {
  const factors: string[] = [];
  let score = 0;

  // Factor 1: Base complexity by task type
  score = BASE_COMPLEXITY[taskType] ?? 0.5;
  factors.push(`base_type:${taskType}=${score}`);

  // Factor 2: Data volume
  if (context.dataSize !== undefined) {
    if (context.dataSize > 500) {
      score += 0.15;
      factors.push('large_dataset:>500_rows');
    } else if (context.dataSize > 100) {
      score += 0.05;
      factors.push('medium_dataset:>100_rows');
    }
  }

  // Factor 3: Agent-specific boost
  const agentBoost = AGENT_COMPLEXITY_BOOST[context.agentName] ?? 0;
  score += agentBoost;
  if (agentBoost !== 0) {
    factors.push(`agent_boost:${context.agentName}=${agentBoost}`);
  }

  // Factor 4: Multi-country factor
  if (context.countryCode !== 'CO') {
    score += 0.05;
    factors.push(`non_default_country:${context.countryCode}`);
  }

  // Normalize score to [0, 1]
  score = Math.max(0, Math.min(1, score));

  // Classify level
  const level: TaskComplexity['level'] =
    score < 0.35 ? 'simple' :
    score < 0.65 ? 'moderate' :
    'complex';

  return { level, score, factors };
}

// ── Default config (used when DB query fails) ───────────────────────

const DEFAULT_CONFIG: OptimizationConfig = {
  strategy: 'balanced',
  cost_weight: 0.5,
  quality_weight: 0.5,
  max_cost_per_task_usd: 0.5,
  min_quality_threshold: 0.7,
  enable_auto_routing: true,
};

// ── Tier classification by cost ─────────────────────────────────────

function classifyTier(costPer1k: number): ModelCandidate['tier'] {
  if (costPer1k < 0.002) return 'economy';
  if (costPer1k < 0.01) return 'standard';
  return 'premium';
}

// ── getCandidates ───────────────────────────────────────────────────

/**
 * Queries active providers and their token rates to build a list of
 * model candidates with estimated cost and quality scores.
 */
export async function getCandidates(
  agentName: string,
  complexity: TaskComplexity,
): Promise<ModelCandidate[]> {
  const supabase = createAdminClient();

  // Get active providers
  const { data: providers, error: provErr } = await supabase
    .from('ai_providers')
    .select('id, provider_type, model_id, is_active')
    .eq('is_active', true);

  if (provErr || !providers || providers.length === 0) {
    console.error('[model-selector] Failed to fetch providers:', provErr?.message);
    return [];
  }

  // Get token rates for cost estimation
  const { data: rates } = await supabase
    .from('provider_token_rates')
    .select('provider_type, model_id, cost_per_1k_input_tokens, cost_per_1k_output_tokens')
    .order('effective_date', { ascending: false });

  // Build a rate map (latest rate per provider+model)
  const rateMap = new Map<string, number>();
  for (const r of rates ?? []) {
    const key = `${r.provider_type}::${r.model_id}`;
    if (!rateMap.has(key)) {
      const avgCostPer1k =
        (Number(r.cost_per_1k_input_tokens) + Number(r.cost_per_1k_output_tokens)) / 2;
      rateMap.set(key, avgCostPer1k);
    }
  }

  // Get quality metrics
  const { data: metrics } = await supabase
    .from('quality_metrics')
    .select('provider_type, model_id, agent_name, task_type, success_rate');

  const qualityMap = new Map<string, number>();
  for (const m of metrics ?? []) {
    const key = `${m.provider_type}::${m.model_id}::${m.agent_name}::${m.task_type}`;
    qualityMap.set(key, Number(m.success_rate));
  }

  // Build candidates
  const candidates: ModelCandidate[] = [];
  for (const p of providers) {
    const rateKey = `${p.provider_type}::${p.model_id}`;
    const costPer1k = rateMap.get(rateKey) ?? 0;

    // Look for a quality score specific to this agent; fall back to a general score
    const qualityKey = `${p.provider_type}::${p.model_id}::${agentName}::${complexity.level}`;
    const qualityScore = qualityMap.get(qualityKey) ?? 0.8; // default 0.8 for unknown

    candidates.push({
      providerId: p.id as string,
      providerType: p.provider_type as ProviderConfig['provider_type'],
      modelId: p.model_id as string,
      estimatedCostPer1kTokens: costPer1k,
      qualityScore,
      tier: classifyTier(costPer1k),
    });
  }

  return candidates;
}

// ── selectModel ─────────────────────────────────────────────────────

/**
 * Selects the optimal AI model for a given task by evaluating complexity,
 * checking explicit routing rules, and scoring candidates on cost vs quality.
 *
 * Steps:
 * 1. Assess task complexity
 * 2. Load optimization config from DB
 * 3. Check for explicit routing rules
 * 4. Get model candidates
 * 5. Score and rank candidates by composite score
 * 6. Return the best match with a documented reason
 */
export async function selectModel(
  agentName: string,
  taskType: string,
  context: TaskContext,
): Promise<ModelSelection> {
  const supabase = createAdminClient();

  // Step 1: Assess complexity
  const complexity = assessComplexity(taskType, context);

  // Step 2: Load optimization config
  const { data: configRow } = await supabase
    .from('optimization_config')
    .select('*')
    .limit(1)
    .maybeSingle();

  const config: OptimizationConfig = configRow
    ? {
        strategy: configRow.strategy as OptimizationConfig['strategy'],
        cost_weight: Number(configRow.cost_weight),
        quality_weight: Number(configRow.quality_weight),
        max_cost_per_task_usd: Number(configRow.max_cost_per_task_usd),
        min_quality_threshold: Number(configRow.min_quality_threshold),
        enable_auto_routing: configRow.enable_auto_routing as boolean,
      }
    : DEFAULT_CONFIG;

  // Step 3: Check for explicit routing rules
  const { data: rules } = await supabase
    .from('model_routing_rules')
    .select('*')
    .eq('task_type', taskType)
    .eq('agent_name', agentName)
    .eq('complexity_level', complexity.level)
    .eq('is_active', true);

  // Step 4: Get candidates
  const candidates = await getCandidates(agentName, complexity);

  if (candidates.length === 0) {
    // No providers available — return a minimal fallback
    return {
      providerId: '',
      providerType: '',
      modelId: '',
      reason: 'fallback:no_providers_available',
      estimatedCost: 0,
      complexityAssessed: complexity,
    };
  }

  // Step 3b: If explicit rule found and auto-routing enabled, use it
  const explicitRule = rules?.[0] as ModelRoutingRule | undefined;
  if (explicitRule && config.enable_auto_routing) {
    const matchingCandidate = candidates.find(
      (c) =>
        c.providerType === explicitRule.preferred_provider_type &&
        c.modelId === explicitRule.preferred_model_id,
    );
    if (matchingCandidate) {
      return {
        providerId: matchingCandidate.providerId,
        providerType: matchingCandidate.providerType,
        modelId: matchingCandidate.modelId,
        reason: `explicit_rule:${explicitRule.id}`,
        estimatedCost: matchingCandidate.estimatedCostPer1kTokens,
        complexityAssessed: complexity,
      };
    }
  }

  // Step 5: Load quality metrics for scoring
  const { data: qualityRows } = await supabase
    .from('quality_metrics')
    .select('provider_type, model_id, agent_name, task_type, success_rate');

  const qualityMetrics = new Map<string, number>();
  for (const q of qualityRows ?? []) {
    const key = `${q.provider_type}::${q.model_id}::${q.agent_name}::${q.task_type}`;
    qualityMetrics.set(key, Number(q.success_rate));
  }

  // Step 6: Filter candidates that meet min quality threshold
  const qualifiedCandidates = candidates.filter((c) => {
    const qualityKey = `${c.providerType}::${c.modelId}::${agentName}::${taskType}`;
    const quality = qualityMetrics.get(qualityKey) ?? c.qualityScore;
    return quality >= config.min_quality_threshold;
  });

  // Fallback: no candidates meet threshold → pick highest qualityScore
  if (qualifiedCandidates.length === 0) {
    const bestQuality = candidates.reduce((best, c) =>
      c.qualityScore > best.qualityScore ? c : best,
    );
    return {
      providerId: bestQuality.providerId,
      providerType: bestQuality.providerType,
      modelId: bestQuality.modelId,
      reason: 'fallback:no_candidates_meet_threshold',
      estimatedCost: bestQuality.estimatedCostPer1kTokens,
      complexityAssessed: complexity,
    };
  }

  // Step 7: Calculate composite score for each qualified candidate
  const maxCost = Math.max(
    ...qualifiedCandidates.map((c) => c.estimatedCostPer1kTokens),
  );

  const scored = qualifiedCandidates.map((c) => {
    const qualityKey = `${c.providerType}::${c.modelId}::${agentName}::${taskType}`;
    const quality = qualityMetrics.get(qualityKey) ?? c.qualityScore;

    // costScore: inverted so lower cost = higher score
    const costScore = maxCost > 0 ? 1 - c.estimatedCostPer1kTokens / maxCost : 1;

    const compositeScore =
      costScore * config.cost_weight + quality * config.quality_weight;

    return { ...c, compositeScore };
  });

  // Sort by composite score descending
  scored.sort((a, b) => b.compositeScore - a.compositeScore);

  const winner = scored[0];

  return {
    providerId: winner.providerId,
    providerType: winner.providerType,
    modelId: winner.modelId,
    reason: `optimized:strategy=${config.strategy},score=${winner.compositeScore.toFixed(3)}`,
    estimatedCost: winner.estimatedCostPer1kTokens,
    complexityAssessed: complexity,
  };
}
