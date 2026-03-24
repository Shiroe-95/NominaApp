import { type LanguageModel } from 'ai';
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
import { AgentBusV2 } from './agent-bus';
import type { AgentMessage } from './agent-bus';
import { getAgentLabel as getPersonaLabel } from '@/lib/ai/agent-personas';
import { selectModel, type ModelSelection, type TaskContext } from '../model-selector';
import { calculateCost } from '../cost-calculator';
import { logAiUsage } from '../usage-logger';
import { createAdminClient } from '../../supabase/admin';
import {
  classifyIntentContextual,
  LOW_CONFIDENCE_THRESHOLD,
} from './intent-classifier';
import { buildDynamicPlan, evaluateAndAdapt } from './dynamic-planner';
import type { PlanContext } from './dynamic-planner';
import { crossValidateCorrections, crossValidateReport } from './cross-validator';
import type { DynamicPlan } from '../plan-serializer';
import type { AuditReport } from './auditor';
import type { CorrectionReport } from './corrector';
import type { WriterReport } from './writer';

// Re-export UserIntent from the canonical source (intent-classifier)
export type { UserIntent } from './intent-classifier';
import type { UserIntent } from './intent-classifier';

// ── Intent classification ───────────────────────────────────────────

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
- **Nómina**: Asistente conversacional de normativa laboral multi-país y cálculos de nómina

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

/**
 * Formatea el resultado de un agente especializado en texto legible para el usuario.
 *
 * Cada agente produce datos con estructura distinta; esta función extrae los
 * campos relevantes y genera un bloque Markdown con:
 * - Auditor: total de hallazgos, severidad e interpretación IA.
 * - Writer: resumen ejecutivo y recomendaciones.
 * - Corrector: correcciones propuestas, omitidas, resumen IA y guía experta
 *   para hallazgos no determinísticos (`expertGuidance`).
 * - Mapper: columnas mapeadas por diccionario, IA y creadas.
 * - Payroll Expert: respuesta conversacional.
 *
 * @param result - Resultado devuelto por el agente tras su ejecución.
 * @param description - Descripción opcional del paso del plan de orquestación.
 * @returns Bloque de texto Markdown con el resumen del resultado del agente.
 */
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
      const autoCorrections = data?.['autoCorrections'] as Record<string, unknown> | undefined;
      const totalFindings = summary?.['totalFindings'] ?? 0;
      const bySeverity = summary?.['bySeverity'] as Record<string, number> | undefined;

      let body = `${totalFindings} hallazgo(s) detectado(s)`;
      if (bySeverity) {
        body += ` — Alta: ${bySeverity['alta'] ?? 0}, Media: ${bySeverity['media'] ?? 0}, Baja: ${bySeverity['baja'] ?? 0}`;
      }
      if (interpretation) {
        body += `\n\n${interpretation}`;
      }
      if (autoCorrections) {
        const corrCount = (autoCorrections['corrections'] as unknown[] | undefined)?.length ?? 0;
        if (corrCount > 0) {
          body += `\n\n⚙️ **Auto-correcciones sugeridas:** ${corrCount} corrección(es) preparada(s) por el equipo auditor→corrector`;
        }
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
      const expertGuidance = data?.['expertGuidance'] as string | undefined;

      let body = `${corrections?.length ?? 0} corrección(es) propuesta(s)`;
      if (skipped) body += `, ${skipped} omitida(s) (no determinísticas)`;
      if (aiSummary) body += `\n\n${aiSummary}`;
      if (expertGuidance) body += `\n\n💼 **Guía del experto para hallazgos no determinísticos:**\n${expertGuidance}`;
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

    // ── Step 1: Classify intent using contextual classifier (Req 6.1–6.4) ──
    let intent: UserIntent;
    let classificationConfidence = 1.0;

    if (requestType !== 'chat') {
      // Deterministic classification for explicit request types
      intent = classifyRequestType(requestType);
    } else if (messages && messages.length > 0) {
      // Use contextual classifier (considers last 5 messages + payroll context)
      try {
        const classification = await classifyIntentContextual(
          messages as ChatMessage[],
          {
            hasData: (context.payrollData?.length ?? 0) > 0,
            countryCode: context.countryCode,
          },
          model,
        );
        intent = classification.intent;
        classificationConfidence = classification.confidence;
        totalTokens += classification.contextUsed; // approximate token overhead

        // Req 6.3: Low confidence → return clarification response
        if (classificationConfidence < LOW_CONFIDENCE_THRESHOLD) {
          return {
            agentName: 'master',
            success: true,
            data: {
              reply: `No estoy seguro de entender tu solicitud (confianza: ${Math.round(classificationConfidence * 100)}%). ${classification.reasoning}. ¿Podrías ser más específico?`,
              results: [],
              plan: { steps: [] },
              clarificationNeeded: true,
              confidence: classificationConfidence,
            } satisfies OrchestrateResponse & { clarificationNeeded: boolean; confidence: number },
            tokensUsed: totalTokens,
            providerUsed: model.modelId ?? 'unknown',
            latencyMs: Date.now() - startTime,
          };
        }
      } catch {
        intent = 'consultation';
      }
    } else {
      intent = 'consultation';
    }

    // ── Step 2: Build dynamic execution plan (Req 7.1) ──────────────
    const planContext: PlanContext = {
      hasPayrollData: (context.payrollData?.length ?? 0) > 0,
      countryCode: context.countryCode,
    };

    let plan: DynamicPlan = buildDynamicPlan(intent, planContext);

    // ── Step 3: Execute agents sequentially (Req 4.2, 4.3, 7.1–7.5) ──
    const agentRegistry = getAgentRegistry();
    const results: AgentResult[] = [];
    const collectedResults: Record<string, unknown> = {
      ...context.previousResults,
    };

    // Create AgentBus v2 with streaming callback (Req 8.1–8.6)
    const bus = new AgentBusV2({
      maxDepth: 5,
      timeout: 30_000,
      sessionId: `orch-${Date.now()}`,
      onMessage: (_message: AgentMessage) => {
        // In the JSON fallback path, we just record the message.
        // The SSE streaming path in route.ts handles emitting events directly.
      },
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
          bus, // pass bus so nested agents can also communicate
          countryRules: context.countryRules,
        };
        return agent.execute(busContext, model);
      });
    }

    // ── Load country-specific rules from DB ─────────────────────────
    if (!context.countryRules) {
      try {
        const supabase = createAdminClient();
        const { data: ruleRow } = await supabase
          .from('country_year_rules')
          .select('label, checks, required_fields, required_calculations')
          .eq('country_code', context.countryCode)
          .eq('rule_year', context.year)
          .eq('status', 'approved')
          .limit(1)
          .maybeSingle();

        if (ruleRow) {
          context.countryRules = {
            label: ruleRow.label as string,
            checks: ruleRow.checks as string[],
            requiredFields: ruleRow.required_fields as string[],
            requiredCalculations: ruleRow.required_calculations as string[],
          };
        }
      } catch (err) {
        console.warn('[master] Failed to load country rules:', err);
      }
    }

    // Pass user message for consultation-type agents
    if (messages && messages.length > 0) {
      const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
      if (lastUserMessage) {
        collectedResults['userMessage'] = lastUserMessage.content;
      }
    }

    // Store model selection metadata per step for cost calculation and logging (Req 9.1, 9.2)
    const modelSelections: Array<{ agentName: string; selection: ModelSelection }> = [];

    // Track which steps we've already executed (for dynamic plan growth)
    let executedStepCount = 0;

    while (executedStepCount < plan.steps.length) {
      const step = plan.steps[executedStepCount];
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
        executedStepCount++;
        continue;
      }

      // ── Select optimal model for this step (Req 9.1) ──────────────
      const taskContext: TaskContext = {
        taskType: requestType,
        agentName: step.agentName,
        dataSize: context.payrollData?.length,
        hasPayrollData: (context.payrollData?.length ?? 0) > 0,
        countryCode: context.countryCode,
      };

      let modelSelection: ModelSelection | undefined;
      try {
        modelSelection = await selectModel(step.agentName, requestType, taskContext);
        modelSelections.push({ agentName: step.agentName, selection: modelSelection });
      } catch {
        // If model selection fails, continue with the passed-in model
        console.warn(`[master] Model selection failed for ${step.agentName}, using default model`);
      }

      // Build agent-specific context with previous results (Req 4.2)
      const agentContext: AgentContext = {
        payrollData: context.payrollData,
        rules: context.rules,
        previousResults: { ...collectedResults },
        countryCode: context.countryCode,
        year: context.year,
        bus,
        countryRules: context.countryRules,
      };

      // If this step depends on another agent's output, ensure it's available
      if (step.inputFrom && collectedResults[step.inputFrom]) {
        agentContext.previousResults = {
          ...agentContext.previousResults,
          [step.inputFrom]: collectedResults[step.inputFrom],
        };
      }

      try {
        const stepStart = Date.now();
        const agentResult = await agent.execute(agentContext, model);
        const stepLatencyMs = Date.now() - stepStart;
        results.push(agentResult);
        totalTokens += agentResult.tokensUsed;

        // Store result for downstream agents (Req 4.2 — pass results between agents)
        collectedResults[step.agentName] = agentResult.data;

        // Req 7.1–7.3: Evaluate result and adapt plan dynamically
        plan = evaluateAndAdapt(plan, agentResult, executedStepCount, planContext);

        // ── Post-execution: cost calculation, usage logging, quality metrics (Req 9.3, 9.4) ──
        // Fire-and-forget — don't block the pipeline
        const providerType = modelSelection?.providerType || (model.modelId ?? 'unknown');
        const modelId = modelSelection?.modelId || (model.modelId ?? 'unknown');
        const tokensInput = Math.round(agentResult.tokensUsed * 0.6);
        const tokensOutput = agentResult.tokensUsed - tokensInput;
        const companyId = (request?.context?.companyId as string) ?? undefined;

        void (async () => {
          try {
            // 1. Calculate real cost
            const costUsd = await calculateCost(providerType, modelId, tokensInput, tokensOutput);

            // 2. Log usage with extended fields
            await logAiUsage({
              provider_id: modelSelection?.providerId,
              provider_type: providerType,
              model_id: modelId,
              agent_name: step.agentName,
              task_type: requestType,
              tokens_input: tokensInput,
              tokens_output: tokensOutput,
              latency_ms: stepLatencyMs,
              success: agentResult.success,
              error_message: agentResult.success ? undefined : String((agentResult.data as Record<string, unknown>)?.error ?? ''),
              cost_usd: costUsd,
              company_id: companyId,
              complexity_level: modelSelection?.complexityAssessed.level,
              complexity_score: modelSelection?.complexityAssessed.score,
              model_selection_reason: modelSelection?.reason,
            });

            // 3. Update quality_metrics with success/failure and latency
            const supabase = createAdminClient();
            const { data: existing } = await supabase
              .from('quality_metrics')
              .select('id, success_rate, avg_latency_ms, sample_count')
              .eq('provider_type', providerType)
              .eq('model_id', modelId)
              .eq('agent_name', step.agentName)
              .eq('task_type', requestType)
              .maybeSingle();

            if (existing) {
              const newCount = (existing.sample_count as number) + 1;
              const oldRate = existing.success_rate as number;
              const newRate = oldRate + ((agentResult.success ? 1 : 0) - oldRate) / newCount;
              const oldLatency = existing.avg_latency_ms as number;
              const newLatency = Math.round(oldLatency + (stepLatencyMs - oldLatency) / newCount);

              await supabase
                .from('quality_metrics')
                .update({
                  success_rate: Math.round(newRate * 10000) / 10000,
                  avg_latency_ms: newLatency,
                  sample_count: newCount,
                  last_calculated_at: new Date().toISOString(),
                })
                .eq('id', existing.id);
            } else {
              await supabase.from('quality_metrics').insert({
                provider_type: providerType,
                model_id: modelId,
                agent_name: step.agentName,
                task_type: requestType,
                success_rate: agentResult.success ? 1.0 : 0.0,
                avg_latency_ms: stepLatencyMs,
                sample_count: 1,
              });
            }
          } catch (postExecErr) {
            console.error('[master] Post-execution tracking failed:', postExecErr);
          }
        })();
      } catch (error) {
        // Req 7.4, 12.1: Sub-agent failure — record and continue the pipeline.
        const errorResult: AgentResult = {
          agentName: step.agentName,
          success: false,
          data: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
          tokensUsed: 0,
          providerUsed: model.modelId ?? 'unknown',
          latencyMs: 0,
        };
        results.push(errorResult);

        // Evaluate even failed results so the plan can continue (Req 7.4)
        plan = evaluateAndAdapt(plan, errorResult, executedStepCount, planContext);
      }

      executedStepCount++;
    }

    // ── Step 4: Cross-validation (Req 9.1, 9.2, 9.3) ───────────────
    const warnings: string[] = [];

    const auditorData = collectedResults['auditor'] as Record<string, unknown> | undefined;
    const correctorData = collectedResults['corrector'] as Record<string, unknown> | undefined;
    const writerData = collectedResults['writer'] as Record<string, unknown> | undefined;

    if (correctorData && auditorData) {
      try {
        const { warning } = crossValidateCorrections(
          correctorData as unknown as CorrectionReport,
          auditorData as unknown as AuditReport,
        );
        if (warning) {
          warnings.push(warning.message);
        }
      } catch (err) {
        console.warn('[master] Cross-validation (corrections) failed:', err);
      }
    }

    if (writerData && auditorData) {
      try {
        const { warning } = crossValidateReport(
          writerData as unknown as WriterReport,
          auditorData as unknown as AuditReport,
        );
        if (warning) {
          warnings.push(warning.message);
        }
      } catch (err) {
        console.warn('[master] Cross-validation (report) failed:', err);
      }
    }

    // ── Step 5: Consolidate response (Req 4.4) ─────────────────────
    const orchestratorPlan: OrchestratorPlan = {
      steps: plan.steps.map((s) => ({
        agentName: s.agentName,
        inputFrom: s.inputFrom,
        description: s.description,
      })),
    };

    let reply = consolidateResults(results, orchestratorPlan);

    if (warnings.length > 0) {
      reply += '\n\n' + warnings.join('\n');
    }

    const response: OrchestrateResponse = {
      reply,
      results,
      plan: orchestratorPlan,
    };

    // Attach model selection metadata for cost calculation and logging (task 6.2)
    (response as OrchestrateResponse & { modelSelections: typeof modelSelections }).modelSelections = modelSelections;

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
