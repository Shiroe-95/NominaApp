/**
 * AI agent wiring helpers.
 * Register new agents in AgentBus and wire dashboard panels.
 *
 * Requirements: 7.1, 8.1, 9.1, 39.6
 * @module lib/integration/wire-ai-agents
 */

export interface AgentDefinition {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
}

/**
 * New AI agents to register in the AgentBus v2.
 */
export const NEW_AGENTS: AgentDefinition[] = [
  {
    id: 'anomaly-detector',
    name: 'Anomaly Detector',
    description: 'Detects outliers, inter-period variations, and suspicious patterns',
    capabilities: ['detect_anomalies', 'classify_anomalies', 'compare_periods'],
  },
  {
    id: 'predictive',
    name: 'Predictive Analytics',
    description: 'Generates 3/6/12-month cost forecasts from historical data',
    capabilities: ['forecast_costs', 'trend_analysis', 'scenario_modeling'],
  },
  {
    id: 'nlq',
    name: 'NLQ Engine',
    description: 'Translates natural language queries to data lookups',
    capabilities: ['parse_query', 'execute_lookup', 'clarify_ambiguity'],
  },
  {
    id: 'recommender',
    name: 'Recommendation Engine',
    description: 'Generates prioritized recommendations based on patterns',
    capabilities: ['generate_recommendations', 'prioritize', 'learn_preferences'],
  },
];

/**
 * Register all new agents into an existing agent registry map.
 */
export function registerNewAgents(
  registry: Map<string, AgentDefinition>,
): Map<string, AgentDefinition> {
  for (const agent of NEW_AGENTS) {
    registry.set(agent.id, agent);
  }
  return registry;
}

/**
 * Dashboard panel configuration for AI widgets.
 * Maps agent IDs to their dashboard component identifiers.
 */
export const AI_DASHBOARD_PANELS = {
  'anomaly-detector': { component: 'AnomalyPanel', defaultPosition: { x: 0, y: 0, w: 6, h: 4 } },
  'predictive': { component: 'ForecastChart', defaultPosition: { x: 6, y: 0, w: 6, h: 4 } },
  'recommender': { component: 'RecommendationCards', defaultPosition: { x: 0, y: 4, w: 12, h: 3 } },
} as const;

/**
 * Route a query to the appropriate AI agent based on intent.
 */
export function routeToAgent(intent: string): string {
  const intentMap: Record<string, string> = {
    anomaly: 'anomaly-detector',
    outlier: 'anomaly-detector',
    forecast: 'predictive',
    predict: 'predictive',
    cost: 'predictive',
    question: 'nlq',
    query: 'nlq',
    recommend: 'recommender',
    suggestion: 'recommender',
  };

  const lower = intent.toLowerCase();
  for (const [keyword, agentId] of Object.entries(intentMap)) {
    if (lower.includes(keyword)) return agentId;
  }
  return 'nlq'; // default to NLQ for general queries
}
