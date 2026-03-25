/**
 * API Route: /api/ai/orchestrate
 *
 * Orquestación multi-agente de IA con streaming SSE.
 * Ejecuta clasificación contextual de intención, planificación dinámica
 * adaptativa y emite eventos de progreso en tiempo real.
 *
 * Requiere autenticación. Rate limited con preset `ai` (20/min).
 *
 * - POST — Ejecuta pipeline de orquestación multi-agente (SSE stream)
 * - Fallback JSON: si el header Accept no incluye text/event-stream,
 *   o si el query param ?format=json está presente, retorna JSON clásico.
 *
 * Requirements: 11.1, 12.1, 12.2, 12.3, 12.4
 *
 * @module api/ai/orchestrate
 */
import { NextResponse } from 'next/server';
import { OrchestrateRequestSchema } from '@/lib/ai/schemas';
import { buildRegistry } from '@/lib/ai/providers';
import { executeWithFallback } from '@/lib/ai/fallback';
import { logAiUsage } from '@/lib/ai/usage-logger';
import { createMasterAgent } from '@/lib/ai/agents/master';
import { classifyRequestType, consolidateResults } from '@/lib/ai/agents/master';
import { classifyIntentContextual, LOW_CONFIDENCE_THRESHOLD } from '@/lib/ai/agents/intent-classifier';
import type { UserIntent } from '@/lib/ai/agents/intent-classifier';
import { buildDynamicPlan, evaluateAndAdapt } from '@/lib/ai/agents/dynamic-planner';
import type { PlanContext } from '@/lib/ai/agents/dynamic-planner';
import { PipelineStreamEmitter } from '@/lib/ai/streaming';
import { AgentBusV2 } from '@/lib/ai/agents/agent-bus';
import { crossValidateCorrections, crossValidateReport } from '@/lib/ai/agents/cross-validator';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AgentContext, AgentResult, OrchestrateRequest, OrchestrateResponse, ChatMessage } from '@/lib/ai/types';
import { decryptApiKey } from '@/lib/ai/encryption';
import type { ProviderConfig } from '@/lib/ai/types';
import { applyRateLimit, requireAuth, RATE_LIMITS } from '@/lib/api/guard';
import { createAuditorAgent } from '@/lib/ai/agents/auditor';
import { createWriterAgent } from '@/lib/ai/agents/writer';
import { createCorrectorAgent } from '@/lib/ai/agents/corrector';
import { createMapperAgent } from '@/lib/ai/agents/mapper';
import { createPayrollExpertAgent } from '@/lib/ai/agents/payroll-expert';
import { createResearcherAgent } from '@/lib/ai/agents/researcher';
import { selectModel, type ModelSelection, type TaskContext } from '@/lib/ai/model-selector';
import { calculateCost } from '@/lib/ai/cost-calculator';
import type { AgentDefinition } from '@/lib/ai/types';
import type { DynamicPlan } from '@/lib/ai/plan-serializer';
import type { AuditReport } from '@/lib/ai/agents/auditor';
import type { CorrectionReport } from '@/lib/ai/agents/corrector';
import type { WriterReport } from '@/lib/ai/agents/writer';

// ── SSE Headers ─────────────────────────────────────────────────────

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
};

// ── Agent registry builder ──────────────────────────────────────────

/**
 * Construye el registro de agentes disponibles para el pipeline de orquestación.
 *
 * Cada agente se registra con su nombre clave (usado en planes dinámicos y AgentBus)
 * y su definición (factory). Los 6 agentes registrados son:
 * - `auditor`        — Juli: 14 verificaciones matemáticas y normativas.
 * - `writer`         — Ana: generación de reportes ejecutivos narrativos.
 * - `corrector`      — Wil: correcciones numéricas determinísticas.
 * - `mapper`         — Gyoru: mapeo de columnas Excel a campos estándar.
 * - `payroll-expert` — Luni: asistente conversacional de normativa laboral.
 * - `researcher`     — Soul: investigación regulatoria por país/año con búsqueda web.
 *
 * @returns Mapa nombre→AgentDefinition con los 6 agentes del sistema.
 */
function getAgentRegistry(): Map<string, AgentDefinition> {
  const registry = new Map<string, AgentDefinition>();
  registry.set('auditor', createAuditorAgent());
  registry.set('writer', createWriterAgent());
  registry.set('corrector', createCorrectorAgent());
  registry.set('mapper', createMapperAgent());
  registry.set('payroll-expert', createPayrollExpertAgent());
  registry.set('researcher', createResearcherAgent());
  return registry;
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Check if the client wants SSE streaming (default) or JSON fallback */
function wantsJsonFallback(req: Request): boolean {
  const url = new URL(req.url);
  if (url.searchParams.get('format') === 'json') return true;
  const accept = req.headers.get('accept') ?? '';
  // If Accept explicitly requests JSON and does NOT include event-stream, use JSON
  if (accept.includes('application/json') && !accept.includes('text/event-stream')) return true;
  return false;
}

/** Log an error with full context (Req 12.3) */
function logPipelineError(
  agentName: string,
  stepDescription: string,
  error: unknown,
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error('[orchestrate] Pipeline error:', {
    agent: agentName,
    step: stepDescription,
    error: message,
    stack,
    timestamp: new Date().toISOString(),
  });
}

// ── POST /api/ai/orchestrate ────────────────────────────────────────

export async function POST(req: Request) {
  const rl = await applyRateLimit(req, 'ai-orchestrate', RATE_LIMITS.ai);
  if (rl) return rl;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  // ── Parse and validate request body ─────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: 'Solicitud inválida: JSON malformado' },
      { status: 400 },
    );
  }

  const parsed = OrchestrateRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Solicitud inválida', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const request = parsed.data;

  // ── Load provider configs from DB ───────────────────────────────
  // Carga todos los proveedores activos globalmente (sin filtrar por user_id).
  // Esto permite que cualquier usuario autenticado use los proveedores
  // configurados por administradores, habilitando una configuración centralizada.
  const admin = createAdminClient();
  const { data: providers, error: provError } = await admin
    .from('ai_providers')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (provError) {
    console.error('[orchestrate] Failed to load providers:', provError.message);
    return NextResponse.json(
      { error: 'Error al cargar proveedores de IA' },
      { status: 500 },
    );
  }

  if (!providers || providers.length === 0) {
    return NextResponse.json(
      { error: 'No hay proveedores de IA configurados. Configura al menos uno en Ajustes → Proveedores.' },
      { status: 422 },
    );
  }

  // Decrypt API keys and build ProviderConfig[]
  const configs: ProviderConfig[] = providers.map((p) => ({
    id: p.id as string,
    provider_type: p.provider_type as ProviderConfig['provider_type'],
    api_key: decryptApiKey(p.api_key_encrypted as string),
    model_id: p.model_id as string,
    display_name: p.display_name as string,
    priority: p.priority as number,
    is_active: true,
  }));

  const registry = buildRegistry(configs);

  // ── JSON fallback path ──────────────────────────────────────────
  if (wantsJsonFallback(req)) {
    return executeJsonFallback(request, registry, auth.userId);
  }

  // ── SSE streaming path ──────────────────────────────────────────
  return executeStreamingPipeline(request, registry, auth.userId);
}

// ── JSON Fallback (backward-compatible) ─────────────────────────────

async function executeJsonFallback(
  request: OrchestrateRequest,
  registry: ReturnType<typeof buildRegistry>,
  _userId: string,
): Promise<Response> {
  try {
    const context: AgentContext = {
      payrollData: request.payrollData as AgentContext['payrollData'],
      previousResults: {
        request,
        ...(request.context ?? {}),
      },
      countryCode: (request.context?.['countryCode'] as string) ?? 'CO',
      year: (request.context?.['year'] as number) ?? new Date().getFullYear(),
    };

    const masterAgent = createMasterAgent();

    const fallbackResult = await executeWithFallback(
      registry,
      (model) => masterAgent.execute(context, model),
      { agentName: 'master', taskType: request.type },
    );

    const masterResult = fallbackResult.result;
    const orchestrateResponse = masterResult.data as OrchestrateResponse;

    // Log usage for each agent result
    const agentResults = orchestrateResponse.results ?? [];
    for (const agentResult of agentResults) {
      logAiUsage({
        provider_type: fallbackResult.providerType,
        model_id: fallbackResult.modelId,
        agent_name: agentResult.agentName,
        task_type: request.type,
        tokens_input: Math.floor(agentResult.tokensUsed * 0.6),
        tokens_output: Math.floor(agentResult.tokensUsed * 0.4),
        latency_ms: agentResult.latencyMs,
        success: agentResult.success,
        error_message: agentResult.success
          ? undefined
          : ((agentResult.data as Record<string, unknown>)?.['error'] as string) ?? undefined,
      }).catch((err) =>
        console.error('[orchestrate] Failed to log usage for', agentResult.agentName, err),
      );
    }

    // Log fallback events
    for (const event of fallbackResult.fallbackEvents) {
      logAiUsage({
        provider_type: event.toProviderType,
        model_id: fallbackResult.modelId,
        agent_name: 'master',
        task_type: request.type,
        tokens_input: 0,
        tokens_output: 0,
        latency_ms: 0,
        success: true,
        fallback_from: event.fromProvider,
        fallback_reason: event.reason,
      }).catch((err) =>
        console.error('[orchestrate] Failed to log fallback event:', err),
      );
    }

    return NextResponse.json(orchestrateResponse);
  } catch (error) {
    console.error('[orchestrate] JSON fallback error:', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';

    if (message.includes('All AI providers failed')) {
      return NextResponse.json(
        { error: 'El servicio de IA no está disponible temporalmente. Todos los proveedores fallaron.' },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── SSE Streaming Pipeline ──────────────────────────────────────────

function executeStreamingPipeline(
  request: OrchestrateRequest,
  registry: ReturnType<typeof buildRegistry>,
  userId: string,
): Response {
  const { readable, writable } = new TransformStream<Uint8Array>();
  const writer = writable.getWriter();
  const emitter = new PipelineStreamEmitter(writer);

  // Run the pipeline asynchronously — the Response streams as events are emitted
  runStreamingPipeline(request, registry, userId, emitter).catch((err) => {
    console.error('[orchestrate] Streaming pipeline fatal error:', err);
    emitter.emit({
      type: 'error',
      data: {
        error: err instanceof Error ? err.message : 'Error interno del servidor',
        fatal: true,
      },
      timestamp: Date.now(),
    });
    emitter.close();
  });

  return new Response(readable, { headers: SSE_HEADERS });
}

async function runStreamingPipeline(
  request: OrchestrateRequest,
  registry: ReturnType<typeof buildRegistry>,
  _userId: string,
  emitter: PipelineStreamEmitter,
): Promise<void> {
  const requestType = request.type;

  // ── Build AgentContext ───────────────────────────────────────────
  const context: AgentContext = {
    payrollData: request.payrollData as AgentContext['payrollData'],
    previousResults: {
      request,
      ...(request.context ?? {}),
    },
    countryCode: (request.context?.['countryCode'] as string) ?? 'CO',
    year: (request.context?.['year'] as number) ?? new Date().getFullYear(),
  };

  // ── Execute with provider fallback (Req 12.2) ──────────────────
  try {
    const fallbackResult = await executeWithFallback(
      registry,
      (model) => executePipelineWithModel(request, context, model, emitter),
      { agentName: 'master-streaming', taskType: requestType },
    );

    // Log fallback events if any occurred
    for (const event of fallbackResult.fallbackEvents) {
      logAiUsage({
        provider_type: event.toProviderType,
        model_id: fallbackResult.modelId,
        agent_name: 'master',
        task_type: requestType,
        tokens_input: 0,
        tokens_output: 0,
        latency_ms: 0,
        success: true,
        fallback_from: event.fromProvider,
        fallback_reason: event.reason,
      }).catch((err) =>
        console.error('[orchestrate] Failed to log fallback event:', err),
      );
    }
  } catch (error) {
    // Req 12.4: All providers failed — emit descriptive error
    const message = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[orchestrate] All providers failed:', message);

    emitter.emit({
      type: 'error',
      data: {
        error: 'El servicio de IA no está disponible temporalmente. Todos los proveedores fallaron.',
        suggestion: 'Verifica la configuración de tus proveedores de IA en Ajustes → Proveedores.',
        fatal: true,
      },
      timestamp: Date.now(),
    });
  } finally {
    emitter.close();
  }
}

// ── Core pipeline execution with a specific model ───────────────────

async function executePipelineWithModel(
  request: OrchestrateRequest,
  context: AgentContext,
  model: import('ai').LanguageModel,
  emitter: PipelineStreamEmitter,
): Promise<OrchestrateResponse> {
  const pipelineStart = Date.now();
  const requestType = request.type;
  const messages = request.messages;
  let totalTokens = 0;

  // ── Step 1: Classify intent (Req 6.1–6.4) ────────────────────
  let intent: UserIntent;
  let classificationConfidence = 1.0;

  if (requestType !== 'chat') {
    // Deterministic classification for explicit request types
    intent = classifyRequestType(requestType) as UserIntent;
  } else if (messages && messages.length > 0) {
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

      // Req 6.3: Low confidence → emit clarification-needed event
      if (classificationConfidence < LOW_CONFIDENCE_THRESHOLD) {
        emitter.emit({
          type: 'clarification-needed',
          data: {
            intent,
            confidence: classificationConfidence,
            reasoning: classification.reasoning,
            message: 'La intención no es clara. ¿Podrías ser más específico sobre lo que necesitas?',
          },
          timestamp: Date.now(),
        });
        // Return early with clarification response
        return {
          reply: `No estoy seguro de entender tu solicitud (confianza: ${Math.round(classificationConfidence * 100)}%). ${classification.reasoning}. ¿Podrías ser más específico?`,
          results: [],
          plan: { steps: [] },
        };
      }
    } catch (err) {
      console.warn('[orchestrate] Intent classification failed, defaulting to consultation:', err);
      intent = 'consultation';
    }
  } else {
    intent = 'consultation';
  }

  // ── Step 2: Build dynamic plan (Req 7.1) ──────────────────────
  const planContext: PlanContext = {
    hasPayrollData: (context.payrollData?.length ?? 0) > 0,
    countryCode: context.countryCode,
    onPlanUpdated: (plan, adaptation) => {
      // Req 7.5: Emit plan-updated event when plan adapts
      emitter.emit({
        type: 'plan-updated',
        data: {
          version: plan.version,
          totalSteps: plan.steps.length,
          adaptation: {
            trigger: adaptation.trigger,
            action: adaptation.action,
            reason: adaptation.reason,
            stepAdded: adaptation.stepAdded?.agentName,
          },
        },
        timestamp: Date.now(),
      });
    },
  };

  let plan: DynamicPlan = buildDynamicPlan(intent, planContext);

  // ── Step 3: Set up agent registry and bus ─────────────────────
  const agentRegistry = getAgentRegistry();
  const results: AgentResult[] = [];
  const collectedResults: Record<string, unknown> = {
    ...context.previousResults,
  };

  // Create AgentBus v2 with streaming callback (Req 8.1–8.6, 11.4)
  const bus = new AgentBusV2({
    maxDepth: 5,
    timeout: 30_000,
    sessionId: `orch-${Date.now()}`,
    onMessage: (message) => {
      // Req 11.4: Emit agent-communication event
      emitter.emit({
        type: 'agent-communication',
        data: {
          fromAgent: message.fromAgent,
          toAgent: message.toAgent,
          queryType: message.queryType,
        },
        timestamp: Date.now(),
      });
    },
  });

  // Register all agents on the bus
  for (const [name, agent] of agentRegistry) {
    bus.register(name, async (payload) => {
      const busContext: AgentContext = {
        payrollData: context.payrollData,
        rules: context.rules,
        previousResults: { ...(payload as Record<string, unknown> ?? {}) },
        countryCode: context.countryCode,
        year: context.year,
        bus,
        countryRules: context.countryRules,
      };
      return agent.execute(busContext, model);
    });
  }

  // ── Load country-specific rules from DB ───────────────────────
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

  // ── Step 4: Execute agents sequentially with streaming ──────────
  // Track which steps we've already executed (for dynamic plan growth)
  let executedStepCount = 0;

  while (executedStepCount < plan.steps.length) {
    const step = plan.steps[executedStepCount];
    const agent = agentRegistry.get(step.agentName);

    if (!agent) {
      const errorResult: AgentResult = {
        agentName: step.agentName,
        success: false,
        data: { error: `Agent "${step.agentName}" not found in registry` },
        tokensUsed: 0,
        providerUsed: 'none',
        latencyMs: 0,
      };
      results.push(errorResult);
      logPipelineError(step.agentName, step.description, new Error('Agent not found'));
      executedStepCount++;
      continue;
    }

    // Req 11.2: Emit agent-start event
    emitter.emit({
      type: 'agent-start',
      data: {
        agentName: step.agentName,
        description: step.description,
        stepIndex: executedStepCount,
        totalSteps: plan.steps.length,
      },
      timestamp: Date.now(),
    });

    // Build agent-specific context
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

    // Model selection for this step
    const taskContext: TaskContext = {
      taskType: request.type,
      agentName: step.agentName,
      dataSize: context.payrollData?.length,
      hasPayrollData: (context.payrollData?.length ?? 0) > 0,
      countryCode: context.countryCode,
    };

    let modelSelection: ModelSelection | undefined;
    try {
      modelSelection = await selectModel(step.agentName, request.type, taskContext);
    } catch {
      console.warn(`[orchestrate] Model selection failed for ${step.agentName}, using default`);
    }

    const stepStart = Date.now();

    try {
      const agentResult = await agent.execute(agentContext, model);
      const stepLatencyMs = Date.now() - stepStart;

      results.push(agentResult);
      totalTokens += agentResult.tokensUsed;
      collectedResults[step.agentName] = agentResult.data;

      // Req 11.3: Emit agent-complete event
      emitter.emit({
        type: 'agent-complete',
        data: {
          agentName: step.agentName,
          success: agentResult.success,
          tokensUsed: agentResult.tokensUsed,
          latencyMs: stepLatencyMs,
          hasData: agentResult.data != null,
        },
        timestamp: Date.now(),
      });

      // Req 7.1–7.3: Evaluate result and adapt plan dynamically
      plan = evaluateAndAdapt(plan, agentResult, executedStepCount, planContext);

      // Fire-and-forget: log usage and update quality metrics
      void logStepUsage(
        agentResult,
        step,
        request.type,
        stepLatencyMs,
        modelSelection,
        model,
        request,
      );
    } catch (error) {
      // Req 12.1: Preserve results from successful agents, record failure
      const stepLatencyMs = Date.now() - stepStart;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logPipelineError(step.agentName, step.description, error);

      const errorResult: AgentResult = {
        agentName: step.agentName,
        success: false,
        data: { error: errorMessage },
        tokensUsed: 0,
        providerUsed: model.modelId ?? 'unknown',
        latencyMs: stepLatencyMs,
      };
      results.push(errorResult);

      // Emit agent-complete with failure
      emitter.emit({
        type: 'agent-complete',
        data: {
          agentName: step.agentName,
          success: false,
          error: errorMessage,
          latencyMs: stepLatencyMs,
        },
        timestamp: Date.now(),
      });

      // Req 7.4: Evaluate even failed results (plan continues)
      plan = evaluateAndAdapt(plan, errorResult, executedStepCount, planContext);
    }

    executedStepCount++;
  }

  // ── Step 5: Cross-validation (Req 9.1, 9.2, 9.3) ───────────────
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
      console.warn('[orchestrate] Cross-validation (corrections) failed:', err);
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
      console.warn('[orchestrate] Cross-validation (report) failed:', err);
    }
  }

  // ── Step 6: Consolidate and emit pipeline-complete ────────────
  const orchestratorPlan = {
    steps: plan.steps.map((s) => ({
      agentName: s.agentName,
      inputFrom: s.inputFrom,
      description: s.description,
    })),
  };

  const reply = consolidateResults(results, orchestratorPlan);
  const successfulResults = results.filter((r) => r.success);
  const failedResults = results.filter((r) => !r.success);

  // Req 12.4: If all agents failed, provide descriptive message
  let finalReply = reply;
  if (successfulResults.length === 0 && results.length > 0) {
    const failedAgents = failedResults.map((r) => r.agentName).join(', ');
    finalReply = `No se pudieron completar las operaciones solicitadas. Los siguientes agentes fallaron: ${failedAgents}. ` +
      'Sugerencia: verifica la configuración de tus proveedores de IA o intenta de nuevo más tarde.';
  }

  if (warnings.length > 0) {
    finalReply += '\n\n' + warnings.join('\n');
  }

  const response: OrchestrateResponse = {
    reply: finalReply,
    results,
    plan: orchestratorPlan,
  };

  // Attach bus communication history for traceability
  const busHistory = bus.getHistory();
  if (busHistory.length > 0) {
    (response as OrchestrateResponse & { busHistory: unknown[] }).busHistory = busHistory;
  }

  // Emit pipeline-complete event (Req 11.1)
  emitter.emit({
    type: 'pipeline-complete',
    data: {
      totalAgents: results.length,
      successfulAgents: successfulResults.length,
      failedAgents: failedResults.length,
      totalTokens,
      totalLatencyMs: Date.now() - pipelineStart,
      warnings: warnings.length > 0 ? warnings : undefined,
      response,
    },
    timestamp: Date.now(),
  });

  return response;
}

// ── Usage logging helper ────────────────────────────────────────────

async function logStepUsage(
  agentResult: AgentResult,
  step: { agentName: string; description: string },
  taskType: string,
  stepLatencyMs: number,
  modelSelection: ModelSelection | undefined,
  model: import('ai').LanguageModel,
  request: OrchestrateRequest,
): Promise<void> {
  try {
    const providerType = modelSelection?.providerType || (model.modelId ?? 'unknown');
    const modelId = modelSelection?.modelId || (model.modelId ?? 'unknown');
    const tokensInput = Math.round(agentResult.tokensUsed * 0.6);
    const tokensOutput = agentResult.tokensUsed - tokensInput;
    const companyId = (request.context?.companyId as string) ?? undefined;

    // Calculate real cost
    const costUsd = await calculateCost(providerType, modelId, tokensInput, tokensOutput);

    // Log usage
    await logAiUsage({
      provider_id: modelSelection?.providerId,
      provider_type: providerType,
      model_id: modelId,
      agent_name: step.agentName,
      task_type: taskType,
      tokens_input: tokensInput,
      tokens_output: tokensOutput,
      latency_ms: stepLatencyMs,
      success: agentResult.success,
      error_message: agentResult.success
        ? undefined
        : String((agentResult.data as Record<string, unknown>)?.error ?? ''),
      cost_usd: costUsd,
      company_id: companyId,
      complexity_level: modelSelection?.complexityAssessed.level,
      complexity_score: modelSelection?.complexityAssessed.score,
      model_selection_reason: modelSelection?.reason,
    });

    // Update quality_metrics
    const supabase = createAdminClient();
    const { data: existing } = await supabase
      .from('quality_metrics')
      .select('id, success_rate, avg_latency_ms, sample_count')
      .eq('provider_type', providerType)
      .eq('model_id', modelId)
      .eq('agent_name', step.agentName)
      .eq('task_type', taskType)
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
        task_type: taskType,
        success_rate: agentResult.success ? 1.0 : 0.0,
        avg_latency_ms: stepLatencyMs,
        sample_count: 1,
      });
    }
  } catch (postExecErr) {
    console.error('[orchestrate] Post-execution tracking failed:', postExecErr);
  }
}
