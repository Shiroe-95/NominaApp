import { z } from 'zod';

// ── Provider ────────────────────────────────────────────────────────

export const ProviderConfigSchema = z.object({
  id: z.string(),
  provider_type: z.enum(['openai', 'anthropic', 'groq', 'google', 'openrouter']),
  api_key: z.string().min(10),
  model_id: z.string().min(1),
  display_name: z.string().min(1).max(100),
  priority: z.number().int().min(0),
  is_active: z.boolean(),
});

// ── Agent Result ────────────────────────────────────────────────────

export const AgentResultSchema = z.object({
  agentName: z.string(),
  success: z.boolean(),
  data: z.unknown(),
  tokensUsed: z.number().int().min(0),
  providerUsed: z.string(),
  latencyMs: z.number().int().min(0),
});

// ── Chat Message ────────────────────────────────────────────────────

export const ChatMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string(),
});

// ── Orchestrate Request ─────────────────────────────────────────────

export const OrchestrateRequestSchema = z.object({
  type: z.enum(['chat', 'validate', 'map', 'correct', 'full-analysis']),
  messages: z.array(ChatMessageSchema).optional(),
  payrollData: z.array(z.unknown()).optional(),
  context: z.record(z.unknown()).optional(),
});
