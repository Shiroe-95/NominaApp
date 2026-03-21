'use client';

import { getPersona } from '@/lib/ai/agent-personas';
import { AgentAvatar } from '@/components/ui/AgentAvatar';

export interface AgentChipProps {
  agentName: string;
  active?: boolean;
  showAvatar?: boolean;
  className?: string;
}

export function AgentChip({ agentName, active = false, showAvatar = false, className = '' }: AgentChipProps) {
  const persona = getPersona(agentName);

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        border border-white/10 transition-all duration-200
        ${persona.bgColor} ${persona.textColor}
        ${active ? `${persona.glowColor} animate-pulse` : ''}
        ${className}
      `}
    >
      {showAvatar ? (
        <AgentAvatar agentId={persona.id} size={18} animate={active} />
      ) : (
        <span className="text-sm leading-none">{persona.emoji}</span>
      )}
      {active && (
        <span className={`w-1.5 h-1.5 rounded-full ${persona.textColor} bg-current`} />
      )}
      {persona.name}
    </span>
  );
}
