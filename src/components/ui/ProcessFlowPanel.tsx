'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { colors, spacing, elevation } from '@/lib/design-tokens';
import { cn } from '@/lib/utils';
import type { ProcessStep } from '@/lib/types/pipeline';

export interface ProcessFlowPanelProps {
  currentStep: number;
  steps: ProcessStep[];
  onStepClick?: (stepIndex: number) => void;
}

/**
 * Panel de flujo de proceso con agentes IA para el dashboard.
 *
 * Muestra los 4 pasos del pipeline (carga, mapeo, validación, corrección)
 * con indicadores visuales de estado, avatares de agentes asignados,
 * y navegación a secciones completadas.
 *
 * Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
 */
export function ProcessFlowPanel({ currentStep, steps, onStepClick }: ProcessFlowPanelProps) {
  const t = useTranslations('Dashboard.processFlow');

  return (
    <Card data-testid="process-flow-panel" style={{ boxShadow: elevation.low }}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <span style={{ color: colors.primary }}>⚡</span>
          {t('title')}
        </CardTitle>
        {currentStep < steps.length && (
          <span
            className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full"
            style={{
              color: colors.secondary,
              backgroundColor: `${colors.primary}15`,
            }}
          >
            {t('stepCounter', { current: currentStep + 1, total: steps.length })}
          </span>
        )}
      </CardHeader>

      <CardContent>
        <div className="flex items-start" style={{ gap: spacing.xs }}>
          {steps.map((step, i) => (
            <div key={step.id} className="flex items-start flex-1 min-w-0">
              <StepItem
                step={step}
                index={i}
                currentStep={currentStep}
                onStepClick={onStepClick}
              />
              {i < steps.length - 1 && (
                <div className="flex items-center pt-6 px-0.5 shrink-0">
                  <ChevronRight
                    className="w-3.5 h-3.5 transition-colors"
                    style={{
                      color: i < currentStep ? colors.success : `${colors.onSurface}25`,
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}


/** Elemento individual de paso del flujo con avatar(es) de agente y estado visual. */
function StepItem({
  step,
  index,
  currentStep,
  onStepClick,
}: {
  step: ProcessStep;
  index: number;
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const isCompleted = step.status === 'completed';
  const isActive = step.status === 'active';
  const isPending = step.status === 'pending';

  const content = (
    <div
      data-testid={`process-step-${step.id}`}
      role="button"
      tabIndex={isCompleted ? 0 : -1}
      onClick={() => isCompleted && onStepClick?.(index)}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && isCompleted) {
          onStepClick?.(index);
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'flex flex-col items-center text-center w-full p-2.5 rounded-xl transition-all duration-300 relative',
        isCompleted && 'cursor-pointer hover:bg-[#005236]/10',
        isActive && 'shadow-[0_0_20px_rgba(160,120,255,0.12)]',
        isPending && 'opacity-40 cursor-default',
      )}
      style={{
        backgroundColor: isActive ? colors.surfaceContainer.high : undefined,
      }}
    >
      {/* Step indicator circle */}
      <div
        className={cn(
          'w-11 h-11 rounded-full flex items-center justify-center mb-2 transition-all duration-300',
        )}
        style={{
          backgroundColor: isCompleted
            ? '#005236' + '40'
            : isActive
              ? colors.surfaceContainer.max
              : colors.surfaceContainer.low,
          color: isCompleted
            ? colors.success
            : isActive
              ? colors.secondary
              : `${colors.onSurface}33`,
          boxShadow: isActive ? `0 0 15px ${colors.primary}33` : undefined,
        }}
      >
        {isCompleted ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : isActive ? (
          <AgentAvatar agentId={step.agents[0]?.id ?? 'master'} size={30} animate />
        ) : (
          <span className="text-sm font-bold">{index + 1}</span>
        )}
      </div>

      {/* Step title */}
      <span
        className="text-[11px] font-semibold leading-tight mb-1.5"
        style={{
          color: isCompleted
            ? colors.success
            : isActive
              ? colors.onSurface
              : `${colors.onSurface}33`,
        }}
      >
        {step.title}
      </span>

      {/* Agent avatars */}
      <div className="flex items-center justify-center -space-x-1.5 mb-1">
        {step.agents.map((agent) => (
          <div
            key={agent.id}
            data-testid={`step-agent-${agent.id}`}
            className="relative"
          >
            <AgentAvatar
              agentId={agent.id}
              size={22}
              animate={isActive}
            />
          </div>
        ))}
      </div>

      {/* Agent names + emojis */}
      <div className="flex flex-col items-center gap-0.5">
        {step.agents.map((agent) => (
          <span
            key={agent.id}
            className="text-[9px] leading-tight whitespace-nowrap"
            style={{
              color: isActive
                ? `${colors.onSurface}cc`
                : isPending
                  ? `${colors.onSurface}33`
                  : `${colors.onSurface}88`,
            }}
          >
            {agent.emoji} {agent.name}
          </span>
        ))}
      </div>

      {/* Active step progress animation */}
      {isActive && (
        <div
          className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full overflow-hidden"
          style={{ backgroundColor: `${colors.primary}22` }}
        >
          <div
            className="h-full rounded-full animate-pulse"
            style={{
              backgroundColor: colors.primary,
              width: '60%',
              animation: 'processFlowProgress 2s ease-in-out infinite',
            }}
          />
        </div>
      )}
    </div>
  );

  // Wrap completed steps in a Link for navigation
  if (isCompleted && step.href) {
    return (
      <Link href={step.href} className="flex-1 min-w-0 no-underline">
        {content}
      </Link>
    );
  }

  return <div className="flex-1 min-w-0">{content}</div>;
}
