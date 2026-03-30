/**
 * RecommendationEngine Agent — Generates prioritized, contextual recommendations.
 *
 * Registered in AgentBus v2 as 'recommender'.
 * Generates up to 5 prioritized recommendations per dashboard load.
 * Categories: urgent_action, optimization, informative, preventive.
 * Dismiss with 30-day cooldown (recommendation_dismissals table).
 * Learns from user actions (accept/dismiss patterns).
 * Clear explanations: what, why, suggested action.
 * Integration with Dianis sidebar as contextual suggestions.
 *
 * Requirements: 39.1, 39.2, 39.3, 39.4, 39.5, 39.6
 */

import { generateText } from 'ai';
import type { LanguageModel } from 'ai';
import type { AgentContext, AgentDefinition, AgentResult, ToolDefinition } from '@/lib/ai/types';
import { createAdminClient } from '@/lib/supabase/admin';

// ── Types ───────────────────────────────────────────────────────────

export type RecommendationCategory =
  | 'urgent_action'
  | 'optimization'
  | 'informative'
  | 'preventive';

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  priority: number; // 1 = highest
  title: string;
  description: string;
  why: string;
  suggestedAction: string;
  recommendationType: string;
  recommendationKey: string;
  metadata: Record<string, unknown>;
}

export interface UserActionPattern {
  category: RecommendationCategory;
  acceptCount: number;
  dismissCount: number;
  acceptRate: number;
}

export interface RecommendationContext {
  workspaceId: string;
  userId: string;
  countryCode: string;
  anomalies?: AnomalySummary[];
  unresolvedFindings?: FindingSummary[];
  recentPayrolls?: PayrollSummary[];
}

interface AnomalySummary {
  category: string;
  confidence: string;
  description: string;
  count: number;
}

interface FindingSummary {
  severity: string;
  type: string;
  count: number;
  oldestDays: number;
}

interface PayrollSummary {
  companyName: string;
  periodYear: number;
  periodMonth: number;
  riskScore: number;
  totalFindings: number;
}

// ── Constants ───────────────────────────────────────────────────────

const MAX_RECOMMENDATIONS = 5;
const DISMISSAL_COOLDOWN_DAYS = 30;

const CATEGORY_BASE_PRIORITY: Record<RecommendationCategory, number> = {
  urgent_action: 1,
  preventive: 2,
  optimization: 3,
  informative: 4,
};

const RECOMMENDATION_SYSTEM_PROMPT = `Eres un motor de recomendaciones inteligente para NominaSmart, una plataforma de auditoría de nómina. Tu trabajo es generar recomendaciones priorizadas y accionables basadas en datos de nómina, anomalías detectadas y patrones del usuario.

Para cada recomendación debes generar:
1. Un título conciso y claro
2. Una descripción de lo que se detectó
3. Una explicación de por qué es importante
4. Una acción sugerida específica

Categorías:
- urgent_action: hallazgos críticos no resueltos que requieren atención inmediata
- optimization: mejoras de configuración o proceso que ahorran tiempo/dinero
- informative: cambios regulatorios próximos o información relevante
- preventive: patrones de riesgo detectados que podrían convertirse en problemas

Siempre sé específico con datos concretos (valores, porcentajes, fechas). Responde en español.`;


// ── Dismissal Management ────────────────────────────────────────────

/**
 * Fetch active dismissals for a user (not yet expired).
 */
export async function fetchDismissals(
  userId: string,
): Promise<Set<string>> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('recommendation_dismissals')
      .select('recommendation_key')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString());

    if (error || !data) return new Set();
    return new Set(data.map((d: { recommendation_key: string }) => d.recommendation_key));
  } catch {
    return new Set();
  }
}

/**
 * Dismiss a recommendation with a 30-day cooldown.
 */
export async function dismissRecommendation(
  userId: string,
  recommendationType: string,
  recommendationKey: string,
): Promise<void> {
  const supabase = createAdminClient();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + DISMISSAL_COOLDOWN_DAYS);

  const { error } = await supabase.from('recommendation_dismissals').upsert(
    {
      user_id: userId,
      recommendation_type: recommendationType,
      recommendation_key: recommendationKey,
      dismissed_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
    },
    { onConflict: 'user_id,recommendation_key' },
  );

  if (error) {
    throw new Error(`Failed to dismiss recommendation: ${error.message}`);
  }
}

// ── User Action Pattern Learning ────────────────────────────────────

/**
 * Fetch user action patterns to learn from accept/dismiss behavior.
 * Analyzes the ratio of accepted vs dismissed recommendations per category.
 */
export async function fetchUserActionPatterns(
  userId: string,
): Promise<UserActionPattern[]> {
  try {
    const supabase = createAdminClient();

    // Count dismissals per recommendation_type (category)
    const { data: dismissals, error: dismissError } = await supabase
      .from('recommendation_dismissals')
      .select('recommendation_type')
      .eq('user_id', userId);

    if (dismissError) return [];

    // Build pattern map
    const patternMap = new Map<RecommendationCategory, { accept: number; dismiss: number }>();
    const categories: RecommendationCategory[] = ['urgent_action', 'optimization', 'informative', 'preventive'];
    for (const cat of categories) {
      patternMap.set(cat, { accept: 0, dismiss: 0 });
    }

    if (dismissals) {
      for (const d of dismissals as { recommendation_type: string }[]) {
        const cat = d.recommendation_type as RecommendationCategory;
        const entry = patternMap.get(cat);
        if (entry) entry.dismiss++;
      }
    }

    // Fetch activity_log for accepted recommendations
    const { data: accepts, error: acceptError } = await supabase
      .from('activity_log')
      .select('metadata')
      .eq('user_id', userId)
      .eq('activity_type', 'recommendation_accepted');

    if (!acceptError && accepts) {
      for (const a of accepts as { metadata: { category?: string } | null }[]) {
        const cat = a.metadata?.category as RecommendationCategory | undefined;
        if (cat) {
          const entry = patternMap.get(cat);
          if (entry) entry.accept++;
        }
      }
    }

    return categories.map((cat) => {
      const entry = patternMap.get(cat)!;
      const total = entry.accept + entry.dismiss;
      return {
        category: cat,
        acceptCount: entry.accept,
        dismissCount: entry.dismiss,
        acceptRate: total > 0 ? entry.accept / total : 0.5,
      };
    });
  } catch {
    return [];
  }
}


// ── Data Gathering ──────────────────────────────────────────────────

/**
 * Fetch anomaly summaries for the workspace.
 */
async function fetchAnomalySummaries(
  workspaceId: string,
): Promise<AnomalySummary[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('anomaly_detections')
      .select('category, confidence, description')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error || !data) return [];

    // Group by category
    const grouped = new Map<string, { confidence: string; description: string; count: number }>();
    for (const row of data as { category: string; confidence: string; description: string }[]) {
      const existing = grouped.get(row.category);
      if (existing) {
        existing.count++;
      } else {
        grouped.set(row.category, {
          confidence: row.confidence,
          description: row.description,
          count: 1,
        });
      }
    }

    return Array.from(grouped.entries()).map(([category, info]) => ({
      category,
      confidence: info.confidence,
      description: info.description,
      count: info.count,
    }));
  } catch {
    return [];
  }
}

/**
 * Fetch recent payroll summaries for the workspace.
 */
async function fetchRecentPayrolls(
  workspaceId: string,
): Promise<PayrollSummary[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('payroll_uploads')
      .select('company_id, period_year, period_month, risk_score, total_findings')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !data) return [];

    return (data as {
      company_id: string;
      period_year: number;
      period_month: number;
      risk_score: number | null;
      total_findings: number | null;
    }[]).map((p) => ({
      companyName: p.company_id,
      periodYear: p.period_year,
      periodMonth: p.period_month,
      riskScore: p.risk_score ?? 0,
      totalFindings: p.total_findings ?? 0,
    }));
  } catch {
    return [];
  }
}

// ── Recommendation Generation ───────────────────────────────────────

/**
 * Generate rule-based recommendations from workspace data patterns.
 * These are deterministic recommendations based on data analysis.
 */
export function generateRuleBasedRecommendations(
  anomalies: AnomalySummary[],
  payrolls: PayrollSummary[],
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Urgent: High-confidence fraud anomalies
  const fraudAnomalies = anomalies.filter(
    (a) => a.category === 'potential_fraud' && a.confidence === 'high',
  );
  if (fraudAnomalies.length > 0) {
    const totalCount = fraudAnomalies.reduce((sum, a) => sum + a.count, 0);
    recommendations.push({
      id: crypto.randomUUID(),
      category: 'urgent_action',
      priority: 1,
      title: 'Anomalías de fraude potencial detectadas',
      description: `Se detectaron ${totalCount} anomalía(s) clasificadas como fraude potencial con alta confianza.`,
      why: 'Las anomalías de fraude potencial requieren investigación inmediata para prevenir pérdidas financieras y cumplir con regulaciones.',
      suggestedAction: 'Revisar las anomalías en el panel de detección y verificar los datos contra documentos fuente.',
      recommendationType: 'urgent_action',
      recommendationKey: 'fraud_anomalies_detected',
      metadata: { anomalyCount: totalCount },
    });
  }

  // Urgent: High-risk payrolls
  const highRiskPayrolls = payrolls.filter((p) => p.riskScore >= 80);
  if (highRiskPayrolls.length > 0) {
    recommendations.push({
      id: crypto.randomUUID(),
      category: 'urgent_action',
      priority: 1,
      title: 'Planillas con riesgo alto sin resolver',
      description: `${highRiskPayrolls.length} planilla(s) tienen un score de riesgo ≥80 y requieren atención.`,
      why: 'Las planillas con alto riesgo pueden contener errores significativos que afectan el cumplimiento normativo.',
      suggestedAction: 'Priorizar la revisión de estas planillas y resolver los hallazgos críticos.',
      recommendationType: 'urgent_action',
      recommendationKey: 'high_risk_payrolls',
      metadata: { payrollCount: highRiskPayrolls.length },
    });
  }

  // Preventive: Systematic errors detected
  const systematicErrors = anomalies.filter((a) => a.category === 'systematic_error');
  if (systematicErrors.length > 0) {
    const totalCount = systematicErrors.reduce((sum, a) => sum + a.count, 0);
    recommendations.push({
      id: crypto.randomUUID(),
      category: 'preventive',
      priority: 2,
      title: 'Patrón de errores sistemáticos detectado',
      description: `Se identificaron ${totalCount} error(es) sistemático(s) que podrían repetirse en futuros periodos.`,
      why: 'Los errores sistemáticos tienden a repetirse si no se corrige la causa raíz, generando costos acumulados.',
      suggestedAction: 'Investigar la causa raíz de los errores y ajustar las reglas de validación o el proceso de carga.',
      recommendationType: 'preventive',
      recommendationKey: 'systematic_errors_pattern',
      metadata: { errorCount: totalCount },
    });
  }

  // Optimization: Many payrolls with findings
  const payrollsWithFindings = payrolls.filter((p) => p.totalFindings > 0);
  if (payrollsWithFindings.length > 3) {
    const avgFindings =
      payrollsWithFindings.reduce((sum, p) => sum + p.totalFindings, 0) /
      payrollsWithFindings.length;
    recommendations.push({
      id: crypto.randomUUID(),
      category: 'optimization',
      priority: 3,
      title: 'Optimizar proceso de carga de nómina',
      description: `${payrollsWithFindings.length} planillas recientes tienen hallazgos (promedio: ${avgFindings.toFixed(1)} por planilla).`,
      why: 'Un alto número de hallazgos recurrentes sugiere que el proceso de preparación de datos puede mejorarse.',
      suggestedAction: 'Revisar los tipos de hallazgos más frecuentes y crear plantillas de carga con validaciones previas.',
      recommendationType: 'optimization',
      recommendationKey: 'optimize_upload_process',
      metadata: { avgFindings: Number(avgFindings.toFixed(1)) },
    });
  }

  // Informative: Seasonal variation detected
  const seasonalVariations = anomalies.filter((a) => a.category === 'seasonal_variation');
  if (seasonalVariations.length > 0) {
    recommendations.push({
      id: crypto.randomUUID(),
      category: 'informative',
      priority: 4,
      title: 'Variaciones estacionales identificadas',
      description: `Se detectaron ${seasonalVariations.reduce((s, a) => s + a.count, 0)} variación(es) estacional(es) en los datos recientes.`,
      why: 'Las variaciones estacionales son normales pero es importante monitorearlas para distinguirlas de anomalías reales.',
      suggestedAction: 'Revisar las variaciones para confirmar que corresponden a patrones esperados (bonificaciones, primas, etc.).',
      recommendationType: 'informative',
      recommendationKey: 'seasonal_variations',
      metadata: { variationCount: seasonalVariations.reduce((s, a) => s + a.count, 0) },
    });
  }

  return recommendations;
}


// ── AI Enhancement ──────────────────────────────────────────────────

/**
 * Use AI to generate contextual recommendations based on payroll data patterns.
 * Enhances rule-based recommendations with AI-generated insights.
 */
async function generateAIRecommendations(
  model: LanguageModel,
  anomalies: AnomalySummary[],
  payrolls: PayrollSummary[],
  countryCode: string,
): Promise<Recommendation[]> {
  try {
    const dataSummary = {
      anomalies: anomalies.slice(0, 10).map((a) => `${a.category} (${a.confidence}): ${a.description} [x${a.count}]`),
      payrolls: payrolls.slice(0, 10).map((p) => `${p.companyName} ${p.periodYear}/${p.periodMonth}: riesgo=${p.riskScore}, hallazgos=${p.totalFindings}`),
    };

    const { text } = await generateText({
      model,
      system: RECOMMENDATION_SYSTEM_PROMPT,
      prompt: `País: ${countryCode}

Datos del workspace:
Anomalías: ${dataSummary.anomalies.length > 0 ? dataSummary.anomalies.join('\n') : 'Ninguna'}
Planillas recientes: ${dataSummary.payrolls.length > 0 ? dataSummary.payrolls.join('\n') : 'Ninguna'}

Genera hasta 3 recomendaciones adicionales basadas en estos datos. Enfócate en patrones que las reglas automáticas podrían no detectar.

Responde en formato JSON array:
[{"category": "urgent_action|optimization|informative|preventive", "title": "...", "description": "...", "why": "...", "suggestedAction": "...", "recommendationKey": "ai_..."}]`,
    });

    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]) as {
        category?: string;
        title?: string;
        description?: string;
        why?: string;
        suggestedAction?: string;
        recommendationKey?: string;
      }[];

      const validCategories = new Set(['urgent_action', 'optimization', 'informative', 'preventive']);

      return parsed
        .filter((r) => r.category && validCategories.has(r.category) && r.title && r.description)
        .map((r) => {
          const category = r.category as RecommendationCategory;
          return {
            id: crypto.randomUUID(),
            category,
            priority: CATEGORY_BASE_PRIORITY[category],
            title: r.title!,
            description: r.description!,
            why: r.why ?? '',
            suggestedAction: r.suggestedAction ?? '',
            recommendationType: category,
            recommendationKey: r.recommendationKey ?? `ai_${crypto.randomUUID().slice(0, 8)}`,
            metadata: { source: 'ai' },
          };
        });
    } catch {
      return [];
    }
  } catch {
    return [];
  }
}

// ── Prioritization ──────────────────────────────────────────────────

/**
 * Prioritize recommendations based on category, user patterns, and data.
 * Applies user learning: categories the user frequently accepts get boosted.
 */
export function prioritizeRecommendations(
  recommendations: Recommendation[],
  userPatterns: UserActionPattern[],
  dismissedKeys: Set<string>,
): Recommendation[] {
  // Filter out dismissed recommendations
  const active = recommendations.filter((r) => !dismissedKeys.has(r.recommendationKey));

  // Build pattern lookup
  const patternMap = new Map<RecommendationCategory, number>();
  for (const p of userPatterns) {
    patternMap.set(p.category, p.acceptRate);
  }

  // Score each recommendation
  const scored = active.map((r) => {
    const basePriority = CATEGORY_BASE_PRIORITY[r.category];
    const userBoost = patternMap.get(r.category) ?? 0.5;
    // Lower score = higher priority. User boost reduces score for preferred categories.
    const score = basePriority * (1 - userBoost * 0.3);
    return { recommendation: r, score };
  });

  // Sort by score (ascending = highest priority first)
  scored.sort((a, b) => a.score - b.score);

  // Return top N with updated priority numbers
  return scored.slice(0, MAX_RECOMMENDATIONS).map((s, index) => ({
    ...s.recommendation,
    priority: index + 1,
  }));
}

// ── Main Generation Function ────────────────────────────────────────

/**
 * Generate recommendations for a dashboard load.
 * Combines rule-based and AI-generated recommendations,
 * filters dismissed ones, and applies user learning.
 */
export async function generateRecommendations(
  context: RecommendationContext,
  model: LanguageModel,
): Promise<{ recommendations: Recommendation[]; totalGenerated: number }> {
  // 1. Gather data
  const [anomalies, payrolls, dismissedKeys, userPatterns] = await Promise.all([
    context.anomalies
      ? Promise.resolve(context.anomalies)
      : fetchAnomalySummaries(context.workspaceId),
    context.recentPayrolls
      ? Promise.resolve(context.recentPayrolls)
      : fetchRecentPayrolls(context.workspaceId),
    fetchDismissals(context.userId),
    fetchUserActionPatterns(context.userId),
  ]);

  // 2. Generate rule-based recommendations
  const ruleBased = generateRuleBasedRecommendations(anomalies, payrolls);

  // 3. Generate AI recommendations
  const aiGenerated = await generateAIRecommendations(
    model,
    anomalies,
    payrolls,
    context.countryCode,
  );

  // 4. Combine and prioritize
  const allRecommendations = [...ruleBased, ...aiGenerated];
  const prioritized = prioritizeRecommendations(allRecommendations, userPatterns, dismissedKeys);

  return {
    recommendations: prioritized,
    totalGenerated: allRecommendations.length,
  };
}


// ── Agent Definition ────────────────────────────────────────────────

export function createRecommendationEngineAgent(): AgentDefinition {
  const tools: ToolDefinition[] = [
    {
      name: 'generateRecommendations',
      description:
        'Genera recomendaciones priorizadas basadas en datos de nómina, anomalías detectadas y patrones del usuario.',
      parameters: {
        type: 'object',
        properties: {
          workspaceId: { type: 'string', description: 'ID del workspace activo' },
          userId: { type: 'string', description: 'ID del usuario solicitante' },
          countryCode: { type: 'string', description: 'Código de país ISO 2' },
        },
        required: ['workspaceId', 'userId', 'countryCode'],
      },
    },
    {
      name: 'dismissRecommendation',
      description:
        'Descarta una recomendación con un cooldown de 30 días.',
      parameters: {
        type: 'object',
        properties: {
          userId: { type: 'string', description: 'ID del usuario' },
          recommendationType: { type: 'string', description: 'Categoría de la recomendación' },
          recommendationKey: { type: 'string', description: 'Clave única de la recomendación' },
        },
        required: ['userId', 'recommendationType', 'recommendationKey'],
      },
    },
  ];

  async function execute(
    context: AgentContext,
    model: LanguageModel,
  ): Promise<AgentResult> {
    const startTime = Date.now();

    // Extract workspace and user info from context
    const workspaceId = context.previousResults?.['workspaceId'] as string | undefined;
    const userId = context.previousResults?.['userId'] as string | undefined;

    if (!workspaceId || !userId) {
      return {
        agentName: 'recommender',
        success: false,
        data: { error: 'workspaceId and userId are required in context' },
        tokensUsed: 0,
        providerUsed: model.modelId ?? 'unknown',
        latencyMs: Date.now() - startTime,
      };
    }

    const recContext: RecommendationContext = {
      workspaceId,
      userId,
      countryCode: context.countryCode,
    };

    const { recommendations, totalGenerated } = await generateRecommendations(recContext, model);

    return {
      agentName: 'recommender',
      success: true,
      data: {
        recommendations,
        summary: {
          total: recommendations.length,
          totalGenerated,
          byCategory: {
            urgent_action: recommendations.filter((r) => r.category === 'urgent_action').length,
            optimization: recommendations.filter((r) => r.category === 'optimization').length,
            informative: recommendations.filter((r) => r.category === 'informative').length,
            preventive: recommendations.filter((r) => r.category === 'preventive').length,
          },
        },
      },
      tokensUsed: 0,
      providerUsed: model.modelId ?? 'unknown',
      latencyMs: Date.now() - startTime,
    };
  }

  return {
    name: 'recommender',
    systemPrompt: RECOMMENDATION_SYSTEM_PROMPT,
    tools,
    execute,
  };
}
