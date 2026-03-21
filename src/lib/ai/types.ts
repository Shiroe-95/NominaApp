import type { LanguageModel } from 'ai';

// ── Domain helpers ──────────────────────────────────────────────────

/** Generic payroll row – each key is a column name. */
export type PayrollRow = Record<string, unknown>;

/** A single normative rule check definition. */
export interface RuleCheck {
  id: string;
  label: string;
  checks: string[];
}

// ── Chat ────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

// ── Provider ────────────────────────────────────────────────────────

export interface ProviderConfig {
  id: string;
  provider_type: 'openai' | 'anthropic' | 'groq' | 'google' | 'openrouter';
  api_key: string;
  model_id: string;
  display_name: string;
  priority: number;
  is_active: boolean;
}

// ── Agents ──────────────────────────────────────────────────────────

export interface AgentContext {
  payrollData?: PayrollRow[];
  rules?: RuleCheck[];
  previousResults?: Record<string, unknown>;
  countryCode: string;
  year: number;
  /** BCP-47 locale tag, e.g. "es-CO", "pt-BR" */
  locale?: string;
  /** ISO 4217 currency code, e.g. "COP", "BRL" */
  currencyCode?: string;
}

export interface AgentResult {
  agentName: string;
  success: boolean;
  data: unknown;
  tokensUsed: number;
  providerUsed: string;
  latencyMs: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AgentDefinition {
  name: string;
  systemPrompt: string;
  tools?: ToolDefinition[];
  execute: (context: AgentContext, model: LanguageModel) => Promise<AgentResult>;
}

// ── Orchestration ───────────────────────────────────────────────────

export interface OrchestratorPlan {
  steps: Array<{
    agentName: string;
    inputFrom?: string;
    description: string;
  }>;
}

export interface OrchestrateRequest {
  type: 'chat' | 'validate' | 'map' | 'correct' | 'full-analysis';
  messages?: ChatMessage[];
  payrollData?: unknown[];
  context?: Record<string, unknown>;
}

export interface OrchestrateResponse {
  reply?: string;
  results: AgentResult[];
  plan: OrchestratorPlan;
}
