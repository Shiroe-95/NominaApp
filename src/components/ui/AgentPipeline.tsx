'use client';

/**
 * AgentPipeline v2 — Visualización en tiempo real del pipeline de agentes IA.
 *
 * Muestra el progreso de ejecución de los agentes del sistema multi-agente,
 * con soporte para streaming SSE, animaciones de comunicación inter-agente
 * e indicadores de adaptación dinámica del plan.
 *
 * Utiliza tokens del sistema de diseño premium (design-tokens.ts) en lugar
 * de valores hardcodeados, garantizando consistencia visual con Obsidian Ledger.
 *
 * @see src/lib/design-tokens.ts — Tokens de diseño centralizados
 * @see src/lib/ai/streaming.ts — Motor de streaming SSE
 * @see Requirements 2.1, 2.2, 2.3, 2.4, 2.5
 */

import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { getPersona } from '@/lib/ai/agent-personas';
import { colors, cssVars, spacing, elevation } from '@/lib/design-tokens';
import type { StreamEvent } from '@/lib/ai/streaming';
import { cn } from '@/lib/utils';
import { CheckCircle2, Loader2, Clock, ArrowRight, MessageSquare, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef } from 'react';

// ── Types ───────────────────────────────────────────────────────────

/** Estado de un paso individual del pipeline */
export type PipelineStepStatus = 'pending' | 'running' | 'done' | 'error';

/** Configuración de un paso del pipeline de agentes */
export interface PipelineStep {
  agentId: string;
  label: string;
  detail?: string;
  status: PipelineStepStatus;
  /** Tokens consumidos por el agente en este paso */
  tokens?: number;
  /** Latencia de ejecución en milisegundos */
  latencyMs?: number;
  /** Cantidad de resultados producidos (hallazgos, correcciones, etc.) */
  resultCount?: number;
  /** Etiqueta para los resultados (ej: "hallazgos", "correcciones") */
  resultLabel?: string;
}

/** Mensaje de comunicación inter-agente visualizado en el pipeline */
export interface InterAgentMessage {
  from: string;
  to: string;
  type: string;
  timestamp?: number;
}

/**
 * Props del componente AgentPipeline.
 *
 * @param steps - Pasos del pipeline con estado de cada agente
 * @param messages - Mensajes de comunicación inter-agente para visualizar conexiones
 * @param compact - Variante compacta para espacios reducidos
 * @param className - Clases CSS adicionales
 * @param onStreamEvent - Callback para recibir eventos SSE y actualizar estado en tiempo real
 * @param planAdapted - Indicador visual de que el plan fue adaptado dinámicamente
 */
interface AgentPipelineProps {
  steps: PipelineStep[];
  messages?: InterAgentMessage[];
  compact?: boolean;
  className?: string;
  /** Callback for receiving streaming events and updating state in real-time */
  onStreamEvent?: (event: StreamEvent) => void;
  /** Visual indicator for dynamic plan adaptation */
  planAdapted?: boolean;
}

// ── Token-based surface classes ─────────────────────────────────────
// Clases de superficie derivadas de design-tokens.ts via CSS custom properties.
// Reemplazan los valores hexadecimales hardcodeados del diseño anterior.

const OL = {
  surface:       `bg-[${cssVars.colors.surface}]`,
  containerLow:  `bg-[${cssVars.colors.containerLow}]`,
  container:     `bg-[${cssVars.colors.container}]`,
  containerHigh: `bg-[${cssVars.colors.containerHigh}]`,
  containerMax:  `bg-[${cssVars.colors.containerMax}]`,
  bright:        `bg-[${colors.surfaceContainer.max}]`,
  onSurface:     `text-[${cssVars.colors.onSurface}]`,
  onSurfaceVar:  'text-[#cbc3d7]',
  ghostBorder:   'border border-[rgba(73,68,84,0.15)]',
} as const;

// ── Estilos inline usando tokens de diseño ──────────────────────────
// Para propiedades CSS que no se pueden expresar como clases Tailwind.

const tokenStyles = {
  activeGlow: { boxShadow: `0 0 20px ${colors.primary}1f` },
  errorBg: { backgroundColor: `${colors.error}26` },
  summaryElevation: { boxShadow: elevation.low },
} as const;

// ── Componente principal ─────────────────────────────────────────────

/**
 * Visualiza el pipeline de ejecución de agentes IA con estado en tiempo real.
 *
 * Soporta actualización vía streaming SSE, animaciones de comunicación
 * inter-agente y un indicador visual cuando el plan se adapta dinámicamente
 * (ej: el planificador agrega un corrector tras hallazgos de alta severidad).
 *
 * @returns Componente React con el pipeline de agentes
 */
export function AgentPipeline({
  steps,
  messages = [],
  compact = false,
  className = '',
  onStreamEvent,
  planAdapted = false,
}: AgentPipelineProps) {
  const allDone = steps.every(s => s.status === 'done');
  const activeStep = steps.findIndex(s => s.status === 'running');
  const prevStepsRef = useRef<PipelineStep[]>(steps);

  // ── Stream event handler: detect step transitions and emit events ──
  const handleStreamEvent = useCallback((event: StreamEvent) => {
    onStreamEvent?.(event);
  }, [onStreamEvent]);

  // Detect step status changes and fire synthetic stream events
  useEffect(() => {
    if (!onStreamEvent) return;
    const prev = prevStepsRef.current;
    for (let i = 0; i < steps.length; i++) {
      const prevStatus = prev[i]?.status;
      const currStatus = steps[i].status;
      if (prevStatus === currStatus) continue;

      if (currStatus === 'running' && prevStatus !== 'running') {
        handleStreamEvent({
          type: 'agent-start',
          data: { agentId: steps[i].agentId, stepIndex: i },
          timestamp: Date.now(),
        });
      }
      if (currStatus === 'done' && prevStatus !== 'done') {
        handleStreamEvent({
          type: 'agent-complete',
          data: {
            agentId: steps[i].agentId,
            stepIndex: i,
            latencyMs: steps[i].latencyMs,
            resultCount: steps[i].resultCount,
            tokens: steps[i].tokens,
          },
          timestamp: Date.now(),
        });
      }
      if (currStatus === 'error') {
        handleStreamEvent({
          type: 'error',
          data: { agentId: steps[i].agentId, stepIndex: i },
          timestamp: Date.now(),
        });
      }
    }

    // Detect pipeline completion
    const allNowDone = steps.every(s => s.status === 'done');
    const allPrevDone = prev.every(s => s.status === 'done');
    if (allNowDone && !allPrevDone) {
      handleStreamEvent({
        type: 'pipeline-complete',
        data: {
          totalTokens: steps.reduce((a, s) => a + (s.tokens ?? 0), 0),
          totalLatencyMs: steps.reduce((a, s) => a + (s.latencyMs ?? 0), 0),
          agentCount: steps.length,
        },
        timestamp: Date.now(),
      });
    }

    prevStepsRef.current = steps;
  }, [steps, handleStreamEvent, onStreamEvent]);

  if (compact) return <CompactPipeline steps={steps} />;

  // Find active inter-agent communication pairs for connection animation
  const activeCommunications = messages.filter(m => {
    const fromStep = steps.find(s => s.agentId === m.from);
    const toStep = steps.find(s => s.agentId === m.to);
    return fromStep?.status === 'running' || toStep?.status === 'running';
  });

  return (
    <div className={cn(
      'rounded-2xl glass-panel',
      className,
    )} style={{ padding: spacing.xl }}>
      {/* Header — Dianis */}
      <div className="flex items-center gap-3" style={{ marginBottom: spacing.xl }}>
        <AgentAvatar agentId="master" size={36} animate={!allDone} />
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold', OL.onSurface)}>
            {allDone ? '✅ Pipeline completado' : '👑 Dianis coordinando equipo...'}
          </p>
          <p className={`text-[11px] text-[#958ea0]`}>
            {allDone
              ? `${steps.length} agentes ejecutados correctamente`
              : `Paso ${Math.max(1, activeStep + 1)} de ${steps.length}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Plan adaptation indicator */}
          {planAdapted && (
            <span
              className="inline-flex items-center gap-1 text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full animate-[planPulse_2s_ease-in-out_infinite]"
              style={{
                color: colors.warning,
                backgroundColor: `${colors.warning}26`,
              }}
            >
              <RefreshCw className="w-3 h-3" />
              PLAN ADAPTADO
            </span>
          )}
          {!allDone && (
            <span
              className="text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full relative"
              style={{
                color: colors.secondary,
                backgroundColor: `${colors.primary}26`,
              }}
            >
              EN VIVO
              <span
                className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-ping"
                style={{ backgroundColor: colors.primary }}
              />
            </span>
          )}
        </div>
      </div>

      {/* Steps — tonal layering with smooth transitions */}
      <div className="space-y-1.5">
        {steps.map((step, i) => {
          const persona = getPersona(step.agentId);
          const isRunning = step.status === 'running';
          const isDone = step.status === 'done';
          const isError = step.status === 'error';
          const isPending = step.status === 'pending';

          // Check if this step has active inter-agent communication
          const hasActiveComm = activeCommunications.some(
            m => m.from === step.agentId || m.to === step.agentId
          );

          return (
            <div key={`${step.agentId}-${i}`}>
              <div
                className={cn(
                  'flex items-center gap-3 rounded-xl transition-all duration-500 ease-in-out',
                  isRunning && OL.containerHigh,
                  isDone && OL.containerLow,
                  isPending && `${OL.surface} opacity-40`,
                )}
                style={{
                  padding: `${spacing.sm} ${spacing.md}`,
                  ...(isRunning ? tokenStyles.activeGlow : {}),
                  ...(isError ? tokenStyles.errorBg : {}),
                }}
              >
                {/* Avatar */}
                <div className="shrink-0 relative">
                  <AgentAvatar agentId={step.agentId} size={30} animate={isRunning} />
                  {isRunning && (
                    <div
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse"
                      style={{ backgroundColor: colors.primary }}
                    />
                  )}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-semibold transition-colors duration-300', OL.onSurface)}>
                      {persona.emoji} {persona.name}
                    </span>
                    <span className="text-[10px] text-[#958ea0] tracking-wide">— {persona.role}</span>
                  </div>
                  <p className={cn(
                    'text-[11px] leading-tight mt-0.5 transition-colors duration-300',
                    isRunning && 'text-[#cbc3d7]',
                    isDone && `text-[${cssVars.colors.success}]/70`,
                    !isRunning && !isDone && 'text-[#958ea0]/60',
                  )}>
                    {step.detail ?? step.label}
                  </p>
                </div>

                {/* Status with smooth transitions */}
                <div className="shrink-0 flex items-center gap-2.5 transition-all duration-300">
                  {isDone && step.resultCount != null && (
                    <span
                      className="text-[10px] font-medium tracking-wide animate-[fadeSlideIn_0.3s_ease-out]"
                      style={{ color: `${colors.success}cc` }}
                    >
                      {step.resultCount} {step.resultLabel ?? 'items'}
                    </span>
                  )}
                  {isDone && step.latencyMs != null && (
                    <span className="text-[10px] text-[#958ea0] font-mono animate-[fadeSlideIn_0.3s_ease-out]">
                      {step.latencyMs < 1000 ? `${step.latencyMs}ms` : `${(step.latencyMs / 1000).toFixed(1)}s`}
                    </span>
                  )}
                  {isRunning && <Loader2 className="w-4 h-4 animate-spin" style={{ color: colors.primary }} />}
                  {isDone && <CheckCircle2 className="w-4 h-4 animate-[fadeSlideIn_0.3s_ease-out]" style={{ color: colors.success }} />}
                  {isError && (
                    <span className="text-[10px] font-bold tracking-wider" style={{ color: colors.error }}>
                      ERROR
                    </span>
                  )}
                  {isPending && <Clock className="w-3.5 h-3.5 text-[#494454]" />}
                </div>
              </div>

              {/* Inter-agent connection animation */}
              {hasActiveComm && i < steps.length - 1 && (
                <div className="ml-[29px] flex items-center py-0.5">
                  <div
                    className="w-0.5 h-6 rounded-full animate-[connectionPulse_1.5s_ease-in-out_infinite]"
                    style={{ backgroundColor: colors.primary }}
                  />
                  <span
                    className="ml-2 text-[9px] tracking-wider uppercase animate-[fadeSlideIn_0.3s_ease-out]"
                    style={{ color: `${colors.primary}99` }}
                  >
                    comunicando...
                  </span>
                </div>
              )}

              {/* Inter-agent messages */}
              {isDone && messages.filter(m => m.from === step.agentId).map((msg, mi) => {
                const toPersona = getPersona(msg.to);
                return (
                  <div key={mi} className="ml-10 mt-1 mb-1 flex items-center gap-1.5 text-[10px] text-[#958ea0]">
                    <MessageSquare className="w-3 h-3" style={{ color: `${colors.primary}66` }} />
                    <span className="text-[#cbc3d7]">{persona.emoji} {persona.name}</span>
                    <ArrowRight className="w-2.5 h-2.5 text-[#494454]" />
                    <span className="text-[#cbc3d7]">{toPersona.emoji} {toPersona.name}</span>
                    <span className="text-[#494454]">·</span>
                    <span className="text-[#958ea0] tracking-wide">{msg.type}</span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Summary bar */}
      {allDone && (
        <div
          className={cn('flex items-center justify-between', OL.containerLow, 'rounded-xl animate-[fadeSlideIn_0.4s_ease-out]')}
          style={{
            marginTop: spacing.md,
            padding: `${spacing.sm} ${spacing.md}`,
            boxShadow: elevation.low,
          }}
        >
          <div className="flex items-center gap-2">
            {steps.map((step, i) => (
              <AgentAvatar key={i} agentId={step.agentId} size={20} animate={false} />
            ))}
            <span className="text-[10px] text-[#958ea0] ml-1 tracking-wide uppercase">
              {steps.length} agentes · {steps.reduce((a, s) => a + (s.tokens ?? 0), 0)} tokens
            </span>
          </div>
          <span
            className="text-[10px] font-medium font-mono"
            style={{ color: `${colors.success}cc` }}
          >
            {steps.reduce((a, s) => a + (s.latencyMs ?? 0), 0) < 1000
              ? `${steps.reduce((a, s) => a + (s.latencyMs ?? 0), 0)}ms total`
              : `${(steps.reduce((a, s) => a + (s.latencyMs ?? 0), 0) / 1000).toFixed(1)}s total`}
          </span>
        </div>
      )}

      {/* Keyframe animations for pipeline transitions */}
      {/* eslint-disable-next-line react/no-unknown-property */}
      <style>{`
        @keyframes connectionPulse {
          0%, 100% { opacity: 0.4; transform: scaleY(1); }
          50% { opacity: 1; transform: scaleY(1.2); }
        }
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes planPulse {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 1; transform: scale(1.02); }
        }
      `}</style>
    </div>
  );
}

// ── Compact variant ─────────────────────────────────────────────────

function CompactPipeline({ steps }: { steps: PipelineStep[] }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {steps.map((step, i) => {
        const persona = getPersona(step.agentId);
        const isRunning = step.status === 'running';
        const isDone = step.status === 'done';

        return (
          <div key={i} className="flex items-center gap-1">
            <div
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all duration-300',
                isRunning && OL.containerHigh,
                isDone && 'bg-[#005236]/20',
                step.status === 'pending' && OL.containerLow,
              )}
              style={{
                ...(isRunning ? { color: colors.secondary, boxShadow: `0 0 10px ${colors.primary}26` } : {}),
                ...(isDone ? { color: colors.success } : {}),
                ...(step.status === 'pending' ? { color: '#494454' } : {}),
                ...(step.status === 'error' ? { backgroundColor: `${colors.error}26`, color: colors.error } : {}),
              }}
            >
              <AgentAvatar agentId={step.agentId} size={16} animate={isRunning} />
              {persona.name}
              {isRunning && <Loader2 className="w-3 h-3 animate-spin" />}
              {isDone && <CheckCircle2 className="w-3 h-3" />}
            </div>
            {i < steps.length - 1 && (
              <ArrowRight className={cn(
                'w-3 h-3 transition-colors duration-300',
                isDone ? `text-[${colors.success}]/40` : 'text-[#494454]/40',
              )} />
            )}
          </div>
        );
      })}
    </div>
  );
}
