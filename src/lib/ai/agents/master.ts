import { generateObject, type LanguageModel } from 'ai';
import { z } from 'zod';
import type {
  AgentContext,
  AgentDefinition,
  AgentResult,
  OrchestratorPlan,
  OrchestrateRequest,
  OrchestrateResponse,
  ChatMessage,
} from '../types';
import { createAuditorAgent } from './auditor';
import { createWriterAgent } from './writer';
import { createCorrectorAgent } from './corrector';
import { createMapperAgent } from './mapper';
import { createPayrollExpertAgent } from './payroll-expert';
import { AgentBus } from './agent-bus';
import { getAgentLabel as getPersonaLabel } from '@/lib/ai/agent-personas';

// ── Intent classification ───────────────────────────────────────────

export type UserIntent =
  | 'audit'
  | 'mapping'
  | 'consultation'
  | 'correction'
  | 'report'
  | 'full-analysis';

/**
 * Maps OrchestrateRequest.type to a UserIntent.
 * This is the primary classification path — deterministic, no AI needed.
 */
export function classifyRequestType(type: OrchestrateRequest['type']): UserIntent {
  switch (type) {
    case 'validate':
      return 'audit';
    case 'map':
      return 'mapping';
    case 'correct':
      return 'correction';
    case 'chat':
      return 'consultation';
    case 'full-analysis':
      return 'full-analysis';
    default:
      return 'consultation';
  }
}

// ── Zod schema for AI-based intent classification (chat messages) ───

const IntentClassificationSchema = z.object({
  intent: z
    .enum(['audit', 'mapping', 'consultation', 'correction', 'report', 'full-analysis'])
    .describe('The classified user intent'),
  reasoning: z.string().describe('Brief explanation of why this intent was chosen'),
});

// ── Plan builders ───────────────────────────────────────────────────

/**
 * Creates an execution plan based on the classified intent.
 * Each plan defines which agents to run and in what order,
 * including data dependencies between them (inputFrom).
 */
export function buildPlan(intent: UserIntent): OrchestratorPlan {
  switch (intent) {
    case 'audit':
      return {
        steps: [
          {
            agentName: 'auditor',
            description: 'Ejecutar validaciones matemáticas y normativas sobre los registros de nómina',
          },
        ],
      };

    case 'mapping':
      return {
        steps: [
          {
            agentName: 'mapper',
            description: 'Mapear columnas del archivo a campos estándar del sistema',
          },
        ],
      };

    case 'consultation':
      return {
        steps: [
          {
            agentName: 'payroll-expert',
            description: 'Responder consulta del usuario sobre normativa laboral o cálculos de nómina',
          },
        ],
      };

    case 'correction':
      return {
        steps: [
          {
            agentName: 'auditor',
            description: 'Identificar hallazgos que requieren corrección',
          },
          {
            agentName: 'corrector',
            inputFrom: 'auditor',
            description: 'Proponer correcciones numéricas para los hallazgos detectados',
          },
        ],
      };

    case 'report':
      return {
        steps: [
          {
            agentName: 'auditor',
            description: 'Ejecutar validaciones para generar hallazgos',
          },
          {
            agentName: 'writer',
            inputFrom: 'auditor',
            description: 'Generar reporte ejecutivo narrativo a partir de los hallazgos',
          },
        ],
      };

    case 'full-analysis':
      return {
        steps: [
          {
            agentName: 'auditor',
            description: 'Ejecutar validaciones matemáticas y normativas completas',
          },
          {
            agentName: 'writer',
            inputFrom: 'auditor',
            description: 'Generar reporte ejecutivo con hallazgos agrupados y priorizados',
          },
          {
            agentName: 'corrector',
            inputFrom: 'auditor',
            description: 'Proponer correcciones numéricas determinísticas',
          },
        ],
      };

    default:
      return {
        steps: [
          {
            agentName: 'payroll-expert',
            description: 'Responder consulta general del usuario',
          },
        ],
      };
  }
}

// ── Agent registry ──────────────────────────────────────────────────

/**
 * Lazily creates and caches agent definitions by name.
 * This avoids re-creating agents on every orchestration call.
 */
function getAgentRegistry(): Map<string, AgentDefinition> {
  const registry = new Map<string, AgentDefinition>();

  registry.set('auditor', createAuditorAgent());
  registry.set('writer', createWriterAgent());
  registry.set('corrector', createCorrectorAgent());
  registry.set('mapper', createMapperAgent());
  registry.set('payroll-expert', createPayrollExpertAgent());

  return registry;
}

// ── System prompt ───────────────────────────────────────────────────

const MASTER_SYSTEM_PROMPT = `Eres el Agente Maestro de NóminaSmart, el orquestador central que coordina a los agentes especializados.

Tu rol es:
1. Analizar la solicitud del usuario y clasificar su intención
2. Determinar qué agentes especializados necesitan intervenir
3. Coordinar la ejecución secuencial de los agentes
4. Consolidar los resultados en una respuesta unificada

Agentes disponibles:
- **Auditor**: Valida registros de nómina contra reglas normativas (14 verificaciones matemáticas)
- **Redactor**: Genera reportes ejecutivos narrativos a partir de hallazgos de auditoría
- **Corrector**: Propone correcciones numéricas determinísticas basadas en fórmulas normativas
- **Mapeador**: Mapea columnas de archivos Excel a campos estándar del sistema
- **Nómina**: Asistente conversacional de normativa laboral colombiana y cálculos de nómina

Tipos de intención:
- audit: El usuario quiere validar registros de nómina
- mapping: El usuario quiere mapear columnas de un archivo
- consultation: El usuario tiene una pregunta sobre normativa o cálculos
- correction: El usuario quiere corregir errores detectados
- report: El usuario quiere un reporte ejecutivo de auditoría
- full-analysis: El usuario quiere un análisis completo (auditoría + reporte + correcciones)

Clasifica la intención basándote en el contenido del mensaje del usuario.`;

// ── Consolidation ───────────────────────────────────────────────────

/**
 * Consolidates results from all executed agents into a human-readable reply.
 * Each agent's contribution is identified in the response (Req 4.4).
 */
export function consolidateResults(
  results: AgentResult[],
  plan: OrchestratorPlan,
): string {
  if (results.length === 0) {
    return 'No se ejecutaron agentes para esta solicitud.';
  }

  const parts: string[] = [];

  for (const result of results) {
    const step = plan.steps.find((s) => s.agentName === result.agentName);
    const label = getAgentLabel(result.agentName);

    if (!result.success) {
      parts.push(`**${label}**: ⚠️ Error durante la ejecución.`);
      continue;
    }

    parts.push(formatAgentResult(result, step?.description));
  }

  return parts.join('\n\n---\n\n');
}

function getAgentLabel(agentName: string): string {
  return getPersonaLabel(agentName);
}

function formatAgentResult(result: AgentResult, description?: string): string {
  const label = getAgentLabel(result.agentName);
  const data = result.data as Record<string, unknown> | undefined;

  const header = description
    ? `**${label}** — ${description}`
    : `**${label}**`;

  switch (result.agentName) {
    case 'auditor': {
      const summary = data?.['summary'] as Record<string, unknown> | undefined;
      const interpretation = data?.['aiInterpretation'] as string | undefined;
      const totalFindings = summary?.['totalFindings'] ?? 0;
      const bySeverity = summary?.['bySeverity'] as Record<string, number> | undefined;

      let body = `${totalFindings} hallazgo(s) detectado(s)`;
      if (bySeverity) {
        body += ` — Alta: ${bySeverity['alta'] ?? 0}, Media: ${bySeverity['media'] ?? 0}, Baja: ${bySeverity['baja'] ?? 0}`;
      }
      if (interpretation) {
        body += `\n\n${interpretation}`;
      }
      return `${header}\n${body}`;
    }

    case 'writer': {
      const executiveSummary = data?.['executiveSummary'] as string | undefined;
      const recommendations = data?.['recommendations'] as string[] | undefined;

      let body = executiveSummary ?? 'Reporte generado.';
      if (recommendations && recommendations.length > 0) {
        body += '\n\n**Recomendaciones:**\n' + recommendations.map((r) => `• ${r}`).join('\n');
      }
      return `${header}\n${body}`;
    }

    case 'corrector': {
      const corrections = data?.['corrections'] as unknown[] | undefined;
      const skipped = data?.['skipped'] as number | undefined;
      const aiSummary = data?.['aiSummary'] as string | undefined;

      let body = `${corrections?.length ?? 0} corrección(es) propuesta(s)`;
      if (skipped) body += `, ${skipped} omitida(s) (no determinísticas)`;
      if (aiSummary) body += `\n\n${aiSummary}`;
      return `${header}\n${body}`;
    }

    case 'mapper': {
      const totalColumns = data?.['totalColumns'] as number | undefined;
      const synonymMatches = data?.['synonymMatches'] as number | undefined;
      const aiMatches = data?.['aiMatches'] as number | undefined;
      const createdFields = data?.['createdFields'] as number | undefined;

      const body =
        `${totalColumns ?? 0} columna(s) mapeada(s): ` +
        `${synonymMatches ?? 0} por diccionario, ${aiMatches ?? 0} por IA, ${createdFields ?? 0} creada(s)`;
      return `${header}\n${body}`;
    }

    case 'payroll-expert': {
      const reply = data?.['reply'] as string | undefined;
      return `${header}\n${reply ?? 'Consulta procesada.'}`;
    }

    default:
      return `${header}\nResultado disponible.`;
  }
}

// ── Master agent factory ────────────────────────────────────────────

export function createMasterAgent(): AgentDefinition {
  async function execute(
    context: AgentContext,
    model: LanguageModel,
  ): Promise<AgentResult> {
    const startTime = Date.now();
    let totalTokens = 0;

    // Extract orchestration request from context
    const request = context.previousResults?.['request'] as OrchestrateRequest | undefined;
    const requestType = request?.type ?? 'chat';
    const messages = request?.messages;

    // ── Step 1: Classify intent (Req 4.1) ───────────────────────────
    let intent: UserIntent;

    if (requestType !== 'chat') {
      // Deterministic classification for explicit request types
      intent = classifyRequestType(requestType);
    } else if (messages && messages.length > 0) {
      // Use AI to classify intent from chat messages
      intent = await classifyIntentFromMessages(messages, model).then((r) => {
        totalTokens += r.tokensUsed;
        return r.intent;
      }).catch(() => 'consultation' as UserIntent);
    } else {
      intent = 'consultation';
    }

    // ── Step 2: Build execution plan (Req 4.1) ─────────────────────
    const plan = buildPlan(intent);

    // ── Step 3: Execute agents sequentially (Req 4.2, 4.3) ─────────
    const agentRegistry = getAgentRegistry();
    const results: AgentResult[] = [];
    const collectedResults: Record<string, unknown> = {
      ...context.previousResults,
    };

    // Create AgentBus for inter-agent communication (Req 25.1–25.4)
    const bus = new AgentBus({
      maxDepth: 5,
      timeout: 30_000,
      sessionId: `orch-${Date.now()}`,
    });

    // Register all agents on the bus so they can call each other
    for (const [name, agent] of agentRegistry) {
      bus.register(name, async (payload) => {
        const busContext: AgentContext = {
          payrollData: context.payrollData,
          rules: context.rules,
          previousResults: { ...(payload as Record<string, unknown> ?? {}) },
          countryCode: context.countryCode,
          year: context.year,
        };
        return agent.execute(busContext, model);
      });
    }

    // Pass user message for consultation-type agents
    if (messages && messages.length > 0) {
      const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
      if (lastUserMessage) {
        collectedResults['userMessage'] = lastUserMessage.content;
      }
    }

    for (const step of plan.steps) {
      const agent = agentRegistry.get(step.agentName);
      if (!agent) {
        results.push({
          agentName: step.agentName,
          success: false,
          data: { error: `Agent "${step.agentName}" not found in registry` },
          tokensUsed: 0,
          providerUsed: 'none',
          latencyMs: 0,
        });
        continue;
      }

      // Build agent-specific context with previous results (Req 4.2)
      const agentContext: AgentContext = {
        payrollData: context.payrollData,
        rules: context.rules,
        previousResults: { ...collectedResults },
        countryCode: context.countryCode,
        year: context.year,
      };

      // If this step depends on another agent's output, ensure it's available
      if (step.inputFrom && collectedResults[step.inputFrom]) {
        agentContext.previousResults = {
          ...agentContext.previousResults,
          [step.inputFrom]: collectedResults[step.inputFrom],
        };
      }

      try {
        const agentResult = await agent.execute(agentContext, model);
        results.push(agentResult);
        totalTokens += agentResult.tokensUsed;

        // Store result for downstream agents (Req 4.2 — pass results between agents)
        collectedResults[step.agentName] = agentResult.data;
      } catch (error) {
        // Agent failure doesn't stop the pipeline (Req 4.3 — decide if additional tasks needed)
        results.push({
          agentName: step.agentName,
          success: false,
          data: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          tokensUsed: 0,
          providerUsed: model.modelId ?? 'unknown',
          latencyMs: 0,
        });
      }
    }

    // ── Step 4: Consolidate response (Req 4.4) ─────────────────────
    const reply = consolidateResults(results, plan);

    const response: OrchestrateResponse = {
      reply,
      results,
      plan,
    };

    // Attach bus communication history for traceability (Req 25.5)
    const busHistory = bus.getHistory();
    if (busHistory.length > 0) {
      (response as OrchestrateResponse & { busHistory: unknown[] }).busHistory = busHistory;
    }

    return {
      agentName: 'master',
      success: results.some((r) => r.success),
      data: response,
      tokensUsed: totalTokens,
      providerUsed: model.modelId ?? 'unknown',
      latencyMs: Date.now() - startTime,
    };
  }

  return {
    name: 'master',
    systemPrompt: MASTER_SYSTEM_PROMPT,
    execute,
  };
}

// ── AI intent classification helper ─────────────────────────────────

async function classifyIntentFromMessages(
  messages: ChatMessage[],
  model: LanguageModel,
): Promise<{ intent: UserIntent; tokensUsed: number }> {
  const lastMessages = messages.slice(-3);
  const conversationText = lastMessages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');

  const result = await generateObject({
    model,
    system: MASTER_SYSTEM_PROMPT,
    prompt: `Clasifica la intención del usuario basándote en la conversación:\n\n${conversationText}`,
    schema: IntentClassificationSchema,
  });

  const parsed = result.object as { intent: string; reasoning: string };

  return {
    intent: parsed.intent as UserIntent,
    tokensUsed: result.usage?.totalTokens ?? 0,
  };
}
