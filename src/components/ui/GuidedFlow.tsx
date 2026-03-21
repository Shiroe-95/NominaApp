'use client';

import { useState } from 'react';
import { CheckCircle2, ChevronRight, Upload, GitBranch, ShieldCheck, FileDown } from 'lucide-react';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { getPersona } from '@/lib/ai/agent-personas';
import { cn } from '@/lib/utils';

/** Step definition for the guided flow */
interface FlowStep {
  id: string;
  title: string;
  description: string;
  agentId: string;
  icon: React.ReactNode;
  tip: string;
}

/**
 * Pasos del flujo de reconciliación de nómina.
 * Cada paso está asociado a un agente IA específico que ejecuta esa fase.
 *
 * 1. upload   → Agente Master (Dianis) — detección de hojas y columnas
 * 2. mapping  → Agente Mapper (Gyoru) — mapeo inteligente de columnas
 * 3. validation → Agente Auditor (Juli) + Corrector (Wil) — auditoría normativa
 * 4. results  → Agente Writer (Ana) — generación de reportes ejecutivos
 */
const STEPS: FlowStep[] = [
  {
    id: 'upload',
    title: 'Sube tu archivo',
    description: 'Arrastra tu Excel de nómina aquí. Yo detecto las hojas y columnas automáticamente.',
    agentId: 'master',
    icon: <Upload className="w-5 h-5" />,
    tip: '💡 Acepto archivos .xlsx, .csv y .xml hasta 1GB',
  },
  {
    id: 'mapping',
    title: 'Mapeo inteligente',
    description: 'Gyoru conecta tus columnas con el sistema. Si algo no cuadra, te pregunto.',
    agentId: 'mapper',
    icon: <GitBranch className="w-5 h-5" />,
    tip: '🐈‍⬛ Gyoru mapea con precisión felina',
  },
  {
    id: 'validation',
    title: 'Auditoría y validación',
    description: 'Juli revisa cada número contra la normativa. Wil calcula las correcciones exactas.',
    agentId: 'auditor',
    icon: <ShieldCheck className="w-5 h-5" />,
    tip: '🔍 Juli + ⚙️ Wil trabajan en equipo',
  },
  {
    id: 'results',
    title: 'Resultados y descarga',
    description: 'Ana genera tu reporte ejecutivo. Descarga la nómina corregida en un clic.',
    agentId: 'writer',
    icon: <FileDown className="w-5 h-5" />,
    tip: '📝 Ana transforma datos en historias claras',
  },
];

interface GuidedFlowProps {
  /** Current active step index (0-based). Controlled externally. */
  currentStep: number;
  /** Callback when user clicks a completed step to navigate back */
  onStepClick?: (stepIndex: number) => void;
}

/**
 * Stepper visual guiado por Dianis que muestra el progreso del proceso
 * de reconciliación de nómina. Cada paso muestra qué agente IA está trabajando
 * y da tips contextuales al hacer hover.
 *
 * Los pasos completados son clickeables para navegar hacia atrás.
 * Los pasos futuros aparecen deshabilitados con opacidad reducida.
 *
 * @param props - {@link GuidedFlowProps}
 * @param props.currentStep - Índice del paso activo (0-based). Los pasos con índice menor se marcan como completados.
 * @param props.onStepClick - Callback opcional invocado al hacer clic en un paso completado. Recibe el índice del paso.
 * @returns Componente stepper con header de Dianis, indicador de progreso y tarjetas de paso con tooltips.
 */
export function GuidedFlow({ currentStep, onStepClick }: GuidedFlowProps) {
  const [hoveredStep, setHoveredStep] = useState<number | null>(null);
  const dianis = getPersona('master');

  return (
    <div className="rounded-2xl border border-white/10 glass-panel p-4 shadow-xl shadow-black/20">
      {/* Dianis header */}
      <div className="flex items-center gap-3 mb-4">
        <AgentAvatar agentId="master" size={36} animate />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white flex items-center gap-1.5">
            {dianis.emoji} {dianis.name}
            <span className="text-[10px] font-normal text-slate-400">te guía</span>
          </p>
          <p className="text-xs text-slate-400 truncate">
            {currentStep < STEPS.length
              ? STEPS[currentStep].description
              : '¡Todo listo! Tu nómina está reconciliada 🎉'}
          </p>
        </div>
        {currentStep < STEPS.length && (
          <span className="shrink-0 text-[10px] font-bold text-violet-light bg-violet/20 border border-violet/30 px-2 py-0.5 rounded-full">
            Paso {currentStep + 1}/{STEPS.length}
          </span>
        )}
      </div>

      {/* Steps */}
      <div className="flex items-start gap-1">
        {STEPS.map((step, i) => {
          const isCompleted = i < currentStep;
          const isActive = i === currentStep;
          const isFuture = i > currentStep;
          const isHovered = hoveredStep === i;
          const persona = getPersona(step.agentId);

          return (
            <div key={step.id} className="flex items-start flex-1 min-w-0">
              {/* Step card */}
              <button
                type="button"
                disabled={isFuture}
                onClick={() => isCompleted && onStepClick?.(i)}
                onMouseEnter={() => setHoveredStep(i)}
                onMouseLeave={() => setHoveredStep(null)}
                className={cn(
                  'flex flex-col items-center text-center w-full p-2 rounded-xl transition-all duration-300 relative group',
                  isCompleted && 'cursor-pointer hover:bg-emerald-950/30',
                  isActive && 'bg-violet/10 border border-violet/30 shadow-[0_0_15px_rgba(139,92,246,0.2)]',
                  isFuture && 'opacity-40 cursor-default',
                )}
              >
                {/* Icon circle */}
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center mb-1.5 transition-all duration-300',
                    isCompleted && 'bg-emerald-500/20 text-emerald-light border border-emerald-500/30',
                    isActive && `${persona.bgColor} ${persona.textColor} border border-current/30 animate-pulse`,
                    isFuture && 'bg-white/5 text-slate-500 border border-white/10',
                  )}
                >
                  {isCompleted ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : isActive ? (
                    <AgentAvatar agentId={step.agentId} size={28} animate />
                  ) : (
                    step.icon
                  )}
                </div>

                {/* Title */}
                <span
                  className={cn(
                    'text-[11px] font-semibold leading-tight',
                    isCompleted && 'text-emerald-light',
                    isActive && 'text-white',
                    isFuture && 'text-slate-500',
                  )}
                >
                  {step.title}
                </span>

                {/* Tip tooltip on hover */}
                {(isHovered && (isActive || isCompleted)) && (
                  <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-black/90 text-[10px] text-slate-300 px-2.5 py-1 rounded-lg border border-white/10 shadow-lg z-10 animate-in fade-in zoom-in-95 duration-200">
                    {step.tip}
                  </div>
                )}
              </button>

              {/* Connector */}
              {i < STEPS.length - 1 && (
                <div className="flex items-center pt-5 px-0.5 shrink-0">
                  <ChevronRight
                    className={cn(
                      'w-3.5 h-3.5 transition-colors',
                      i < currentStep ? 'text-emerald-light' : 'text-white/15',
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
