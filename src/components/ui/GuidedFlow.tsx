'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronRight, Upload, GitBranch, ShieldCheck, FileDown } from 'lucide-react';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { getPersona } from '@/lib/ai/agent-personas';
import { cn } from '@/lib/utils';

interface FlowStep {
  id: string;
  title: string;
  description: string;
  agentId: string;
  icon: React.ReactNode;
  tip: string;
}

const STEPS: FlowStep[] = [
  {
    id: 'upload',
    title: 'Sube tu archivo',
    description: 'Arrastra tu Excel de nómina. Detecto hojas y columnas automáticamente.',
    agentId: 'master',
    icon: <Upload className="w-5 h-5" />,
    tip: '👑 Dianis coordina todo el equipo desde aquí',
  },
  {
    id: 'mapping',
    title: 'Mapeo inteligente',
    description: 'Gyoru conecta tus columnas con el sistema usando IA multi-idioma (ES/PT/EN).',
    agentId: 'mapper',
    icon: <GitBranch className="w-5 h-5" />,
    tip: '🐈‍⬛ Gyoru reconoce columnas en español, portugués e inglés',
  },
  {
    id: 'validation',
    title: 'Auditoría + Corrección',
    description: 'Juli audita contra normativa del país. Wil calcula correcciones exactas. Se comunican entre sí.',
    agentId: 'auditor',
    icon: <ShieldCheck className="w-5 h-5" />,
    tip: '🔍 Juli detecta → ⚙️ Wil corrige → 💼 Dianis consulta normas',
  },
  {
    id: 'results',
    title: 'Reporte ejecutivo',
    description: 'Ana genera tu reporte narrativo con hallazgos priorizados y recomendaciones.',
    agentId: 'writer',
    icon: <FileDown className="w-5 h-5" />,
    tip: '📝 Ana transforma datos en historias claras para la gerencia',
  },
];

interface GuidedFlowProps {
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
}

export function GuidedFlow({ currentStep, onStepClick }: GuidedFlowProps) {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const dianis = getPersona('master');

  return (
    <div className="rounded-2xl glass-panel p-5">
      {/* Dianis header */}
      <div className="flex items-center gap-3 mb-5">
        <AgentAvatar agentId="master" size={38} animate />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[#dae2fd] flex items-center gap-1.5">
            {dianis.emoji} {dianis.name}
            <span className="text-[10px] font-normal text-[#958ea0]">te guía</span>
          </p>
          <p className="text-xs text-[#cbc3d7] truncate">
            {currentStep < STEPS.length
              ? STEPS[currentStep].description
              : '¡Todo listo! Tu nómina está reconciliada 🎉'}
          </p>
        </div>
        {currentStep < STEPS.length && (
          <span className="shrink-0 text-[10px] font-bold tracking-wider uppercase text-[#d0bcff] bg-[#a078ff]/15 px-2.5 py-1 rounded-full">
            Paso {currentStep + 1}/{STEPS.length}
          </span>
        )}
      </div>

      {/* Steps — tonal layering */}
      <div className="flex items-start gap-1">
        {STEPS.map((step, i) => {
          const isCompleted = i < currentStep;
          const isActive = i === currentStep;
          const isFuture = i > currentStep;
          const isHovered = hoveredStep === i;
          const persona = getPersona(step.agentId);

          return (
            <div key={step.id} className="flex items-start flex-1 min-w-0">
              <button
                type="button"
                disabled={isFuture}
                onClick={() => isCompleted && onStepClick?.(i)}
                onMouseEnter={() => setHoveredStep(i)}
                onMouseLeave={() => setHoveredStep(null)}
                className={cn(
                  'flex flex-col items-center text-center w-full p-2.5 rounded-xl transition-all duration-300 relative group',
                  isCompleted && 'cursor-pointer hover:bg-[#005236]/10',
                  isActive && 'bg-[#222a3d] shadow-[0_0_20px_rgba(160,120,255,0.12)]',
                  isFuture && 'opacity-40 cursor-default',
                )}
              >
                {/* Icon circle */}
                <div
                  className={cn(
                    'w-11 h-11 rounded-full flex items-center justify-center mb-2 transition-all duration-300',
                    isCompleted && 'bg-[#005236]/25 text-[#4edea3]',
                    isActive && 'bg-[#2d3449] text-[#d0bcff] shadow-[0_0_15px_rgba(160,120,255,0.2)]',
                    isFuture && 'bg-[#131b2e] text-[#494454]',
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : isActive ? (
                    <AgentAvatar agentId={step.agentId} size={30} animate />
                  ) : (
                    step.icon
                  )}
                </div>

                {/* Title */}
                <span
                  className={cn(
                    'text-[11px] font-semibold leading-tight',
                    isCompleted && 'text-[#4edea3]',
                    isActive && 'text-[#dae2fd]',
                    isFuture && 'text-[#494454]',
                  )}
                >
                  {step.title}
                </span>

                {/* Tooltip */}
                {(isHovered && (isActive || isCompleted)) && (
                  <div className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[#2d3449] text-[10px] text-[#cbc3d7] px-3 py-1.5 rounded-lg shadow-[0_24px_48px_-12px_rgba(6,14,32,0.5)] z-10 animate-in fade-in zoom-in-95 duration-200">
                    {step.tip}
                  </div>
                )}
              </button>

              {/* Connector */}
              {i < STEPS.length - 1 && (
                <div className="flex items-center pt-6 px-0.5 shrink-0">
                  <ChevronRight
                    className={cn(
                      'w-3.5 h-3.5 transition-colors',
                      i < currentStep ? 'text-[#4edea3]' : 'text-[#494454]/40',
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
