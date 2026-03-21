'use client';

const AGENT_COLORS: Record<string, { bg: string; text: string; glow: string }> = {
  auditor:   { bg: 'bg-emerald/15', text: 'text-emerald-light', glow: 'shadow-[0_0_8px_rgba(16,185,129,0.3)]' },
  writer:    { bg: 'bg-violet/15',  text: 'text-violet-light',  glow: 'shadow-[0_0_8px_rgba(124,58,237,0.3)]' },
  corrector: { bg: 'bg-amber/15',   text: 'text-amber-light',   glow: 'shadow-[0_0_8px_rgba(245,158,11,0.3)]' },
  mapper:    { bg: 'bg-cyan/15',    text: 'text-cyan-light',    glow: 'shadow-[0_0_8px_rgba(6,182,212,0.3)]' },
  master:    { bg: 'bg-rose/15',    text: 'text-rose-light',    glow: 'shadow-[0_0_8px_rgba(225,29,72,0.3)]' },
  payroll:   { bg: 'bg-violet/15',  text: 'text-violet-light',  glow: 'shadow-[0_0_8px_rgba(124,58,237,0.3)]' },
  researcher:{ bg: 'bg-cyan/15',    text: 'text-cyan-light',    glow: 'shadow-[0_0_8px_rgba(6,182,212,0.3)]' },
};

const DEFAULT_COLOR = { bg: 'bg-white/10', text: 'text-slate-300', glow: '' };

export interface AgentChipProps {
  agentName: string;
  active?: boolean;
  className?: string;
}

export function AgentChip({ agentName, active = false, className = '' }: AgentChipProps) {
  const key = agentName.toLowerCase().replace(/^agente?\s*/i, '').replace(/[_-]/g, '');
  const colors = AGENT_COLORS[key] ?? DEFAULT_COLOR;

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium
        border border-white/10 transition-all duration-200
        ${colors.bg} ${colors.text}
        ${active ? `${colors.glow} animate-pulse` : ''}
        ${className}
      `}
    >
      {active && (
        <span className={`w-1.5 h-1.5 rounded-full ${colors.text} bg-current`} />
      )}
      {agentName}
    </span>
  );
}
