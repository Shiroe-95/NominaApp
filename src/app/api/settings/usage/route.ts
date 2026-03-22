/**
 * API Route: /api/settings/usage
 *
 * Estadísticas agregadas de uso de IA con desgloses multidimensionales.
 * Requiere rol admin. Soporta filtros por proveedor, agente, fechas,
 * empresa, complejidad y tipo de tarea.
 *
 * - GET — Retorna estadísticas agregadas (por proveedor, agente, tarea, cliente)
 *
 * @module api/settings/usage
 */
import { NextRequest, NextResponse } from 'next/server';
import { getUsageStats } from '@/lib/ai/usage-logger';
import type { EnhancedUsageStatsFilters, GroupByDimension } from '@/lib/ai/usage-logger';
import { applyRateLimit, requireAdmin, RATE_LIMITS } from '@/lib/api/guard';

/** Dimensiones válidas para agrupar estadísticas de uso */
const VALID_GROUP_BY: GroupByDimension[] = ['provider', 'agent', 'task', 'client', 'model'];

/**
 * GET /api/settings/usage — Estadísticas agregadas de uso de IA con desgloses multidimensionales.
 *
 * Requiere rol de administrador. Aplica rate limiting de lectura.
 *
 * @param req - NextRequest con los siguientes query params opcionales:
 *   - `provider_type` — Filtrar por tipo de proveedor IA (ej: "openai", "anthropic")
 *   - `agent_name` — Filtrar por nombre de agente (ej: "auditor", "mapper")
 *   - `from` — Fecha inicio del rango (ISO 8601)
 *   - `to` — Fecha fin del rango (ISO 8601)
 *   - `company_id` — Filtrar por ID de empresa/cliente
 *   - `complexity_level` — Filtrar por nivel de complejidad de tarea
 *   - `task_type` — Filtrar por tipo de tarea
 *   - `group_by` — Dimensión de agrupación: "provider" | "agent" | "task" | "client" | "model"
 *
 * @returns Si `group_by` está presente: `{ stats: UsageStat[] }` agrupado por esa dimensión.
 *   Si no: respuesta multidimensional con `{ stats, by_agent, by_task, by_client, aggregated }`.
 *   `aggregated` incluye: total_calls, total_tokens, total_cost_usd, global_error_rate, avg_latency_ms.
 *   En caso de error: `{ error: string }` con status 400 o 500.
 */
export async function GET(req: NextRequest) {
  const rl = await applyRateLimit(req, 'settings-usage', RATE_LIMITS.read);
  if (rl) return rl;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const { searchParams } = req.nextUrl;

    // Construir filtros base a partir de query params
    const baseFilters: EnhancedUsageStatsFilters = {};

    const providerType = searchParams.get('provider_type');
    if (providerType) baseFilters.provider_type = providerType;

    const agentName = searchParams.get('agent_name');
    if (agentName) baseFilters.agent_name = agentName;

    const from = searchParams.get('from');
    if (from) baseFilters.from = from;

    const to = searchParams.get('to');
    if (to) baseFilters.to = to;

    const companyId = searchParams.get('company_id');
    if (companyId) baseFilters.company_id = companyId;

    const complexityLevel = searchParams.get('complexity_level');
    if (complexityLevel) baseFilters.complexity_level = complexityLevel;

    const taskType = searchParams.get('task_type');
    if (taskType) baseFilters.task_type = taskType;

    // Modo de agrupación única: retorna stats agrupados por una sola dimensión
    const groupBy = searchParams.get('group_by') as GroupByDimension | null;

    if (groupBy) {
      if (!VALID_GROUP_BY.includes(groupBy)) {
        return NextResponse.json(
          { error: `Invalid group_by value. Must be one of: ${VALID_GROUP_BY.join(', ')}` },
          { status: 400 },
        );
      }

      const stats = await getUsageStats({ ...baseFilters, group_by: groupBy });
      return NextResponse.json({ stats });
    }

    // Respuesta multidimensional: consulta paralela por proveedor, agente, tarea y cliente
    const [byProvider, byAgent, byTask, byClient] = await Promise.all([
      getUsageStats({ ...baseFilters, group_by: 'provider' }),
      getUsageStats({ ...baseFilters, group_by: 'agent' }),
      getUsageStats({ ...baseFilters, group_by: 'task' }),
      getUsageStats({ ...baseFilters, group_by: 'client' }),
    ]);

    // Calcular totales agregados a partir del desglose por proveedor
    const totalCalls = byProvider.reduce((sum, s) => sum + s.total_calls, 0);
    const totalTokens = byProvider.reduce((sum, s) => sum + s.total_tokens, 0);
    const totalCost = byProvider.reduce((sum, s) => sum + s.cost_usd, 0);
    const totalFailures = byProvider.reduce(
      (sum, s) => sum + Math.round(s.error_rate * s.total_calls),
      0,
    );
    const globalErrorRate = totalCalls > 0 ? totalFailures / totalCalls : 0;
    const avgLatency =
      totalCalls > 0
        ? byProvider.reduce((sum, s) => sum + s.avg_latency_ms * s.total_calls, 0) / totalCalls
        : 0;

    return NextResponse.json({
      stats: byProvider,
      by_agent: byAgent,
      by_task: byTask,
      by_client: byClient,
      aggregated: {
        total_calls: totalCalls,
        total_tokens: totalTokens,
        total_cost_usd: Math.round(totalCost * 1_000_000) / 1_000_000,
        global_error_rate: Math.round(globalErrorRate * 10_000) / 10_000,
        avg_latency_ms: Math.round(avgLatency),
      },
    });
  } catch (error) {
    console.error('Usage GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch usage stats' },
      { status: 500 },
    );
  }
}
