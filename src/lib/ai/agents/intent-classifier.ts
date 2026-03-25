import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';
import type { ChatMessage } from '../types';

// ── Types ───────────────────────────────────────────────────────────

export type UserIntent =
  | 'audit'
  | 'mapping'
  | 'consultation'
  | 'correction'
  | 'report'
  | 'full-analysis'
  | 'rule-update';

export interface IntentClassificationResult {
  intent: UserIntent;
  confidence: number;       // 0.0 – 1.0
  reasoning: string;
  contextUsed: number;      // cantidad de mensajes de historial usados
}

export interface PayrollContext {
  hasData: boolean;
  countryCode: string;
}

// ── Constants ───────────────────────────────────────────────────────

/** Maximum number of conversation history messages to consider (Req 6.1) */
const MAX_CONTEXT_MESSAGES = 5;

/** Confidence threshold below which clarification is needed (Req 6.3) */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

/** Intents prioritized when payroll data is present (Req 6.4) */
const PAYROLL_PRIORITY_INTENTS: ReadonlySet<UserIntent> = new Set([
  'audit',
  'correction',
  'full-analysis',
]);

// ── Zod schema for AI classification ────────────────────────────────

const IntentClassificationSchema = z.object({
  intent: z
    .enum(['audit', 'mapping', 'consultation', 'correction', 'report', 'full-analysis', 'rule-update'])
    .describe('The classified user intent'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score between 0.0 and 1.0'),
  reasoning: z
    .string()
    .describe('Brief explanation of why this intent was chosen'),
});

// ── System prompt ───────────────────────────────────────────────────

const CLASSIFICATION_SYSTEM_PROMPT = `Eres un clasificador de intenciones para NóminaSmart, un sistema de auditoría y gestión de nómina.

Analiza la conversación del usuario y clasifica su intención en una de las siguientes categorías:
- audit: El usuario quiere validar/auditar registros de nómina
- mapping: El usuario quiere mapear columnas de un archivo a campos estándar
- consultation: El usuario tiene una pregunta sobre normativa laboral o cálculos
- correction: El usuario quiere corregir errores detectados en la nómina
- report: El usuario quiere un reporte ejecutivo de auditoría
- full-analysis: El usuario quiere un análisis completo (auditoría + reporte + correcciones)
- rule-update: El usuario quiere actualizar, investigar o sincronizar reglas normativas/fiscales

Considera TODO el contexto conversacional proporcionado, no solo el último mensaje.
Asigna un nivel de confianza entre 0.0 y 1.0 basado en qué tan clara es la intención.
Si la intención es ambigua o poco clara, asigna una confianza baja (< 0.6).`;


// ── Build classification prompt ─────────────────────────────────────

function buildClassificationPrompt(
  messages: ChatMessage[],
  payrollContext: PayrollContext,
): string {
  const conversationText = messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  let prompt = `Clasifica la intención del usuario basándote en la conversación:\n\n${conversationText}`;

  if (payrollContext.hasData) {
    prompt += `\n\nContexto adicional: El usuario tiene datos de nómina cargados (país: ${payrollContext.countryCode}). Prioriza intenciones relacionadas con auditoría, corrección o análisis completo sobre consultas generales.`;
  }

  return prompt;
}

// ── Post-processing: payroll priority boost (Req 6.4) ───────────────

function applyPayrollPriorityBoost(
  result: IntentClassificationResult,
  payrollContext: PayrollContext,
): IntentClassificationResult {
  if (!payrollContext.hasData) return result;

  // If the AI already chose a payroll-priority intent, no adjustment needed
  if (PAYROLL_PRIORITY_INTENTS.has(result.intent)) return result;

  // If confidence is moderate and payroll data exists, boost toward audit
  // This implements Req 6.4: prioritize audit/correction when payroll data is present
  if (result.confidence < 0.75 && result.intent === 'consultation') {
    return {
      ...result,
      intent: 'audit',
      confidence: Math.min(result.confidence + 0.1, 1.0),
      reasoning: `${result.reasoning}. Reclasificado a auditoría porque hay datos de nómina cargados y la intención original tenía confianza moderada.`,
    };
  }

  return result;
}

// ── Main classification function ────────────────────────────────────

/**
 * Classifies user intent considering conversational context (Req 6.1–6.4).
 *
 * - Uses the last 5 messages from history (Req 6.1)
 * - Includes confidence score 0–1 (Req 6.2)
 * - Prioritizes audit/correction intents when payroll data is present (Req 6.4)
 *
 * Note: The clarification logic (Req 6.3, confidence < 0.6) is handled by the
 * caller (master agent / orchestrator) based on the returned confidence value.
 */
export async function classifyIntentContextual(
  messages: ChatMessage[],
  payrollContext: PayrollContext,
  model: LanguageModel,
): Promise<IntentClassificationResult> {
  // Take at most the last 5 messages (Req 6.1)
  const contextMessages = messages.slice(-MAX_CONTEXT_MESSAGES);
  const contextUsed = contextMessages.length;

  // Handle empty messages — fallback to consultation with low confidence
  if (contextMessages.length === 0) {
    return {
      intent: 'consultation',
      confidence: 0.3,
      reasoning: 'No hay mensajes en el historial para clasificar.',
      contextUsed: 0,
    };
  }

  const prompt = buildClassificationPrompt(contextMessages, payrollContext);

  const result = await generateObject({
    model,
    system: CLASSIFICATION_SYSTEM_PROMPT,
    prompt,
    schema: IntentClassificationSchema,
  });

  const parsed = result.object;

  // Clamp confidence to [0, 1] as a safety measure
  const clampedConfidence = Math.max(0, Math.min(1, parsed.confidence));

  let classification: IntentClassificationResult = {
    intent: parsed.intent as UserIntent,
    confidence: clampedConfidence,
    reasoning: parsed.reasoning,
    contextUsed,
  };

  // Apply payroll priority boost (Req 6.4)
  classification = applyPayrollPriorityBoost(classification, payrollContext);

  return classification;
}
