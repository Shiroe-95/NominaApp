'use client';

import { useTranslations } from 'next-intl';
import { Brain, AlertTriangle, Lightbulb, Loader2 } from 'lucide-react';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { colors, spacing, elevation } from '@/lib/design-tokens';
import type { SynthesisResult } from '@/lib/types/pipeline';

export interface LiveSynthesisPanelProps {
  synthesis: SynthesisResult | null;
  isRunning: boolean;
}

/** Color mapping for risk level badges. */
function getRiskColor(level: SynthesisResult['riskLevel']): string {
  switch (level) {
    case 'low':
      return colors.success;
    case 'medium':
      return colors.warning;
    case 'high':
      return colors.error;
  }
}

/**
 * Panel de síntesis en tiempo real para el dashboard.
 *
 * Muestra el resumen consolidado cuando el pipeline completa,
 * estado vacío cuando no hay resultados, e indicador de carga
 * durante la ejecución.
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 4.4
 */
export function LiveSynthesisPanel({ synthesis, isRunning }: LiveSynthesisPanelProps) {
  const t = useTranslations('Dashboard.synthesis');

  return (
    <Card data-testid="live-synthesis-panel" style={{ boxShadow: elevation.low }}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Brain className="h-4 w-4" style={{ color: colors.primary }} />
          {t('title')}
        </CardTitle>
      </CardHeader>

      <CardContent>
        {isRunning && !synthesis && <LoadingState />}
        {!isRunning && !synthesis && <EmptyState />}
        {synthesis && <SynthesisContent synthesis={synthesis} isRunning={isRunning} />}
      </CardContent>
    </Card>
  );
}


/** Estado vacío cuando no hay resultados de síntesis. */
function EmptyState() {
  const t = useTranslations('Dashboard.synthesis');

  return (
    <div
      data-testid="synthesis-empty-state"
      className="flex flex-col items-center text-center py-6"
      style={{ gap: spacing.md }}
    >
      <div
        className="rounded-full p-3"
        style={{ backgroundColor: `${colors.primary}15` }}
      >
        <Brain className="h-6 w-6" style={{ color: colors.primary }} />
      </div>
      <div>
        <p className="text-sm font-medium" style={{ color: colors.onSurface }}>
          {t('emptyTitle')}
        </p>
        <p className="text-xs mt-1" style={{ color: `${colors.onSurface}99` }}>
          {t('emptyDescription')}
        </p>
      </div>
    </div>
  );
}

/** Indicador de carga durante ejecución del pipeline. */
function LoadingState() {
  const t = useTranslations('Dashboard.synthesis');

  return (
    <div
      data-testid="synthesis-loading"
      className="flex flex-col items-center text-center py-6"
      style={{ gap: spacing.md }}
    >
      <Loader2
        className="h-8 w-8 animate-spin"
        style={{ color: colors.primary }}
      />
      <p className="text-sm font-medium" style={{ color: colors.onSurface }}>
        {t('loading')}
      </p>
    </div>
  );
}

/** Contenido completo de la síntesis. */
function SynthesisContent({ synthesis, isRunning }: { synthesis: SynthesisResult; isRunning: boolean }) {
  const t = useTranslations('Dashboard.synthesis');
  const riskColor = getRiskColor(synthesis.riskLevel);

  return (
    <div className="flex flex-col" style={{ gap: spacing.md }}>
      {/* Loading overlay when updating */}
      {isRunning && (
        <div data-testid="synthesis-loading" className="flex items-center gap-2">
          <Loader2 className="h-3.5 w-3.5 animate-spin" style={{ color: colors.primary }} />
          <span className="text-xs" style={{ color: `${colors.onSurface}99` }}>
            {t('updating')}
          </span>
        </div>
      )}

      {/* Summary */}
      <div data-testid="synthesis-summary">
        <p className="text-sm leading-relaxed" style={{ color: colors.onSurface }}>
          {synthesis.summary}
        </p>
      </div>

      {/* Risk Level Badge */}
      <div data-testid="synthesis-risk-level" className="flex items-center gap-2">
        <span
          className="text-xs font-semibold uppercase tracking-wider px-2 py-1 rounded"
          style={{
            color: riskColor,
            backgroundColor: `${riskColor}15`,
          }}
        >
          {t(`risk_${synthesis.riskLevel}`)}
        </span>
      </div>

      {/* Findings */}
      {synthesis.findings.length > 0 && (
        <div data-testid="synthesis-findings" className="flex flex-col" style={{ gap: spacing.sm }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: `${colors.onSurface}88` }}>
            {t('findingsTitle')}
          </p>
          <div className="flex flex-col" style={{ gap: spacing.xs }}>
            {synthesis.findings.map((finding, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 rounded-lg px-3 py-2"
                style={{ backgroundColor: colors.surfaceContainer.low }}
              >
                <AlertTriangle
                  className="h-3.5 w-3.5 shrink-0 mt-0.5"
                  style={{ color: colors.warning }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs" style={{ color: colors.onSurface }}>
                    {finding.description}
                  </p>
                  <span
                    className="text-[10px] font-medium uppercase"
                    style={{ color: `${colors.onSurface}77` }}
                  >
                    {finding.severity}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {synthesis.recommendations.length > 0 && (
        <div data-testid="synthesis-recommendations" className="flex flex-col" style={{ gap: spacing.sm }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: `${colors.onSurface}88` }}>
            {t('recommendationsTitle')}
          </p>
          <div className="flex flex-col" style={{ gap: spacing.xs }}>
            {synthesis.recommendations.map((rec, idx) => (
              <div
                key={idx}
                className="flex items-start gap-2 rounded-lg px-3 py-2"
                style={{ backgroundColor: colors.surfaceContainer.low }}
              >
                <Lightbulb
                  className="h-3.5 w-3.5 shrink-0 mt-0.5"
                  style={{ color: colors.success }}
                />
                <p className="text-xs" style={{ color: colors.onSurface }}>
                  {rec}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contributing Agents */}
      {synthesis.contributingAgents.length > 0 && (
        <div data-testid="synthesis-agents" className="flex flex-col" style={{ gap: spacing.sm }}>
          <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: `${colors.onSurface}88` }}>
            {t('agentsTitle')}
          </p>
          <div className="flex flex-wrap items-center" style={{ gap: spacing.sm }}>
            {synthesis.contributingAgents.map((agent) => (
              <div key={agent.id} className="flex items-center gap-1.5">
                <AgentAvatar agentId={agent.id} size={22} animate={false} />
                <span className="text-xs" style={{ color: `${colors.onSurface}aa` }}>
                  {agent.emoji} {agent.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
