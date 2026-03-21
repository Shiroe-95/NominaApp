import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { OrchestrateRequestSchema } from '@/lib/ai/schemas';
import { buildRegistry } from '@/lib/ai/providers';
import { executeWithFallback } from '@/lib/ai/fallback';
import { logAiUsage } from '@/lib/ai/usage-logger';
import { createMasterAgent } from '@/lib/ai/agents/master';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AgentContext, OrchestrateResponse } from '@/lib/ai/types';
import { decryptApiKey } from '@/lib/ai/encryption';
import type { ProviderConfig } from '@/lib/ai/types';

// ── POST /api/ai/orchestrate ────────────────────────────────────────

export async function POST(req: Request) {
  try {
    // 1. Authenticate user via Supabase session
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 },
      );
    }

    // 2. Validate request body
    const body = await req.json();
    const parsed = OrchestrateRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Solicitud inválida', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const request = parsed.data;

    // 3. Load provider configs from DB
    const admin = createAdminClient();
    const { data: providers, error: provError } = await admin
      .from('ai_providers')
      .select('*')
      .eq('user_id', user.id)
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

    // 4. Build provider registry
    const registry = buildRegistry(configs);

    // 5. Build AgentContext from request
    const context: AgentContext = {
      payrollData: request.payrollData as AgentContext['payrollData'],
      previousResults: {
        request,
        ...(request.context ?? {}),
      },
      countryCode: (request.context?.['countryCode'] as string) ?? 'CO',
      year: (request.context?.['year'] as number) ?? new Date().getFullYear(),
    };

    // 6. Execute master agent with fallback
    const masterAgent = createMasterAgent();

    const fallbackResult = await executeWithFallback(
      registry,
      (model) => masterAgent.execute(context, model),
      { agentName: 'master', taskType: request.type },
    );

    const masterResult = fallbackResult.result;
    const orchestrateResponse = masterResult.data as OrchestrateResponse;

    // 7. Log AI usage for each agent result
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
        fallback_from: undefined,
        fallback_reason: undefined,
      }).catch((err) =>
        console.error('[orchestrate] Failed to log usage for', agentResult.agentName, err),
      );
    }

    // Log fallback events if any occurred
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

    // 8. Return OrchestrateResponse
    return NextResponse.json(orchestrateResponse);
  } catch (error) {
    console.error('[orchestrate] Unhandled error:', error);

    const message =
      error instanceof Error ? error.message : 'Error interno del servidor';

    // Surface "all providers failed" as a 503
    if (message.includes('All AI providers failed')) {
      return NextResponse.json(
        { error: 'El servicio de IA no está disponible temporalmente. Todos los proveedores fallaron.' },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
