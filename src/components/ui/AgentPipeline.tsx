'use client';

import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { getPersona } from '@/lib/ai/agent-personas';
import { cn } from '@/lib/utils';
import { CheckCircle2, Loader2, Clock, ArrowRight, MessageSquare } from 'lucide-react';

// ── Types ───────────────────────────────────────────────────────────

export type PipelineStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface PipelineStep {
  agentId: string;
  label: string;
  detail?: string;
  status: PipelineStepStatus;
  tokens?: number;
  latencyMs?: number;
  resultCount?: number;
  resultLabel?: string;
}

export interface InterAgentMessage {
  from: string;
  to: string;
  type: string;
  timestamp?: number;
}

interface AgentPipelineProps {
  steps: PipelineStep[];
  messages?: InterAgentMessage[];
  compact?: boolean;
  className?: string;
}

// ── Obsidian Ledger surface tokens ──────────────────────────────────
const OL = {
  surface:       'bg-[#0b1326]',
  containerLow:  'bg-[#131b2e]',
  container:     'bg-[#171f33]',
  containerHigh: 'bg-[#222a3d]',
  containerMax:  'bg-[#2d3449]',
  bright:        'bg-[#31394d]',
  onSurface:     'text-[#dae2fd]',
  onSurfaceVar:  'text-[#cbc3d7]',
  ghostBorder:   'border border-[rgba(73,68,84,0.15)]',
} as const;

// ── Component ───────────────────────────────────────────────────────

export function AgentPipeline({ steps, messages = [], compact = false, className = '' }: AgentPipelineProps) {
  const allDone = steps.every(s => s.status === 'done');
  const activeStep = steps.findIndex(s => s.status === 'running');

  if (compact) return <CompactPipeline steps={steps} />;

  return (
    <div className={cn(
      'rounded-2xl p-5 glass-panel',
      className,
    )}>
      {/* Header — Dianis */}
      <div className="flex items-center gap-3 mb-5">
        <AgentAvatar agentId="master" size={36} animate={!allDone} />
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold', OL.onSurface)}>
            {allDone ? '✅ Pipeline completado' : '👑 Dianis coordinando equipo...'}
          </p>
          <p className="text-[11px] text-[#958ea0]">
            {allDone
              ? `${steps.length} agentes ejecutados correctamente`
              : `Paso ${Math.max(1, activeStep + 1)} de ${steps.length}`}
          </p>
        </div>
        {!allDone && (
          <span className="text-[10px] font-bold tracking-wider uppercase text-[#d0bcff] bg-[#a078ff]/15 px-2.5 py-1 rounded-full relative">
            EN VIVO
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#a078ff] animate-ping" />
          </span>
        )}
      </div>

      {/* Steps — tonal layering, no hard borders */}
      <div className="space-y-1.5">
        {steps.map((step, i) => {
          const persona = getPersona(step.agentId);
          const isRunning = step.status === 'running';
          const isDone = step.status === 'done';
          const isError = step.status === 'error';
          const isPending = step.status === 'pending';

          return (
            <div key={`${step.agentId}-${i}`}>
              <div
                className={cn(
                  'flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-500',
                  // Tonal layering per state (no solid borders)
                  isRunning && `${OL.containerHigh} shadow-[0_0_20px_rgba(160,120,255,0.12)]`,
                  isDone && OL.containerLow,
                  isError && 'bg-[#93000a]/15',
                  isPending && `${OL.surface} opacity-40`,
                )}
              >
                {/* Avatar */}
                <div className="shrink-0 relative">
                  <AgentAvatar agentId={step.agentId} size={30} animate={isRunning} />
                  {isRunning && <div className="ol-pulse-indicator absolute -bottom-0.5 -right-0.5" />}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-semibold', OL.onSurface)}>
                      {persona.emoji} {persona.name}
                    </span>
                    <span className="text-[10px] text-[#958ea0] tracking-wide">— {persona.role}</span>
                  </div>
                  <p className={cn(
                    'text-[11px] leading-tight mt-0.5',
                    isRunning ? 'text-[#cbc3d7]' : isDone ? 'text-[#4edea3]/70' : 'text-[#958ea0]/60',
                  )}>
                    {step.detail ?? step.label}
                  </p>
                </div>

                {/* Status */}
                <div className="shrink-0 flex items-center gap-2.5">
                  {isDone && step.resultCount != null && (
                    <span className="text-[10px] text-[#4edea3]/80 font-medium tracking-wide">
                      {step.resultCount} {step.resultLabel ?? 'items'}
                    </span>
                  )}
                  {isDone && step.latencyMs != null && (
                    <span className="text-[10px] text-[#958ea0] font-mono">
                      {step.latencyMs < 1000 ? `${step.latencyMs}ms` : `${(step.latencyMs / 1000).toFixed(1)}s`}
                    </span>
                  )}
                  {isRunning && <Loader2 className="w-4 h-4 text-[#a078ff] animate-spin" />}
                  {isDone && <CheckCircle2 className="w-4 h-4 text-[#4edea3]" />}
                  {isError && <span className="text-[10px] text-[#ffb4ab] font-bold tracking-wider">ERROR</span>}
                  {isPending && <Clock className="w-3.5 h-3.5 text-[#494454]" />}
                </div>
              </div>

              {/* Inter-agent messages */}
              {isDone && messages.filter(m => m.from === step.agentId).map((msg, mi) => {
                const toPersona = getPersona(msg.to);
                return (
                  <div key={mi} className="ml-10 mt-1 mb-1 flex items-center gap-1.5 text-[10px] text-[#958ea0]">
                    <MessageSquare className="w-3 h-3 text-[#a078ff]/40" />
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
        <div className={cn('mt-4 pt-4 flex items-center justify-between', OL.containerLow, 'rounded-xl px-4 py-3')}>
          <div className="flex items-center gap-2">
            {steps.map((step, i) => (
              <AgentAvatar key={i} agentId={step.agentId} size={20} animate={false} />
            ))}
            <span className="text-[10px] text-[#958ea0] ml-1 tracking-wide uppercase">
              {steps.length} agentes · {steps.reduce((a, s) => a + (s.tokens ?? 0), 0)} tokens
            </span>
          </div>
          <span className="text-[10px] text-[#4edea3]/80 font-medium font-mono">
            {steps.reduce((a, s) => a + (s.latencyMs ?? 0), 0) < 1000
              ? `${steps.reduce((a, s) => a + (s.latencyMs ?? 0), 0)}ms total`
              : `${(steps.reduce((a, s) => a + (s.latencyMs ?? 0), 0) / 1000).toFixed(1)}s total`}
          </span>
        </div>
      )}
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
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-medium transition-all',
                isRunning && `bg-[#222a3d] text-[#d0bcff] shadow-[0_0_10px_rgba(160,120,255,0.15)]`,
                isDone && 'bg-[#005236]/20 text-[#4edea3]',
                step.status === 'pending' && 'bg-[#131b2e] text-[#494454]',
                step.status === 'error' && 'bg-[#93000a]/15 text-[#ffb4ab]',
              )}
            >
              <AgentAvatar agentId={step.agentId} size={16} animate={isRunning} />
              {persona.name}
              {isRunning && <Loader2 className="w-3 h-3 animate-spin" />}
              {isDone && <CheckCircle2 className="w-3 h-3" />}
            </div>
            {i < steps.length - 1 && (
              <ArrowRight className={cn('w-3 h-3', isDone ? 'text-[#4edea3]/40' : 'text-[#494454]/40')} />
            )}
          </div>
        );
      })}
    </div>
  );
}
