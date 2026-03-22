'use client';

import { getPersona } from '@/lib/ai/agent-personas';
import { AgentAvatar } from '@/components/ui/AgentAvatar';

/**
 * Props del componente AgentChip.
 *
 * @property agentName - Nombre interno del agente (ej. 'auditor', 'master', 'corrector').
 *   Se usa para obtener la persona visual (emoji, colores, nombre) desde `agent-personas`.
 * @property active - Indica si el agente está procesando activamente. Muestra animación
 *   de pulso y un indicador de actividad cuando es `true`. Por defecto `false`.
 * @property showAvatar - Muestra el avatar SVG del agente en lugar del emoji.
 *   Por defecto `false`.
 * @property className - Clases CSS adicionales para personalizar el chip.
 */
export interface AgentChipProps {
  agentName: string;
  active?: boolean;
  showAvatar?: boolean;
  className?: string;
}

/**
 * Chip visual que identifica a un agente de IA del sistema multi-agente.
 *
 * Muestra el nombre, emoji (o avatar) y colores de la persona del agente.
 * Cuando `active` es `true`, añade una animación de pulso y un indicador
 * luminoso para señalar que el agente está procesando una tarea.
 *
 * Se usa en {@link AiSidebar} para mostrar qué agentes participaron en
 * una respuesta, y en {@link AgentPipeline} para la vista compacta del pipeline.
 *
 * @param props - {@link AgentChipProps}
 * @returns Elemento `<span>` estilizado como chip con la identidad visual del agente.
 */
export function AgentChip({ agentName, active = false, showAvatar = false, className = '' }: AgentChipProps) {
  const persona = getPersona(agentName);

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        transition-all duration-200
        ${persona.bgColor} ${persona.textColor}
        ${active ? `shadow-[0_0_12px_${persona.hexColor}40] animate-pulse` : ''}
        ${className}
      `}
    >
      {showAvatar ? (
        <AgentAvatar agentId={persona.id} size={18} animate={active} />
      ) : (
        <span className="text-sm leading-none">{persona.emoji}</span>
      )}
      {active && (
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: persona.hexColor }} />
          <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: persona.hexColor }} />
        </span>
      )}
      {persona.name}
    </span>
  );
}
