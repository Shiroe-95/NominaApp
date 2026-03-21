'use client';

import { getPersona, type AgentPersona } from '@/lib/ai/agent-personas';

/**
 * Props para el componente {@link AgentAvatar}.
 */
interface AgentAvatarProps {
  /** Identificador del agente (ej: `'master'`, `'auditor'`, `'researcher'`). Se resuelve vía {@link getPersona}. */
  agentId: string;
  /** Tamaño en píxeles del avatar (ancho y alto). Por defecto `40`. */
  size?: number;
  /** Habilita animaciones SVG (parpadeo, flotación) y el anillo de glow. Por defecto `true`. */
  animate?: boolean;
  /** Clases CSS adicionales para el contenedor exterior. */
  className?: string;
}

/**
 * Avatar SVG animado para cada agente de NominaSmart.
 *
 * Renderiza un avatar vectorial basado en el `avatarType` de la persona del agente.
 * Soporta 4 variantes: `woman`, `man`, `dog` y `cat`. Cada variante incluye
 * animaciones SVG (parpadeo de ojos, movimiento de orejas/cola) y un anillo
 * de glow pulsante con el color característico del agente.
 *
 * @param props - {@link AgentAvatarProps}
 * @returns Elemento JSX con el avatar SVG del agente solicitado.
 *
 * @example
 * ```tsx
 * <AgentAvatar agentId="master" size={48} />
 * <AgentAvatar agentId="researcher" animate={false} />
 * ```
 */
export function AgentAvatar({ agentId, size = 40, animate = true, className = '' }: AgentAvatarProps) {
  const persona = getPersona(agentId);
  const s = size;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      style={{ width: s, height: s }}
    >
      <svg
        viewBox="0 0 100 100"
        width={s}
        height={s}
        className={animate ? 'animate-avatar-float' : ''}
        role="img"
        aria-label={`Avatar de ${persona.name}`}
      >
        {persona.avatarType === 'woman' && <WomanAvatar persona={persona} />}
        {persona.avatarType === 'man' && <ManAvatar persona={persona} />}
        {persona.avatarType === 'dog' && <DogAvatar persona={persona} />}
        {persona.avatarType === 'cat' && <CatAvatar persona={persona} />}
      </svg>
      {/* Glow ring */}
      {animate && (
        <div
          className="absolute inset-0 rounded-full animate-pulse opacity-30"
          style={{ boxShadow: `0 0 ${s / 3}px ${persona.hexColor}` }}
        />
      )}
    </div>
  );
}

/** Variante de avatar femenino con cabello largo, rubor y animación de parpadeo. */
function WomanAvatar({ persona }: { persona: AgentPersona }) {
  return (
    <g>
      {/* Hair */}
      <ellipse cx="50" cy="38" rx="28" ry="30" fill={persona.hairColor}>
        <animate attributeName="ry" values="30;31;30" dur="3s" repeatCount="indefinite" />
      </ellipse>
      {/* Face */}
      <circle cx="50" cy="42" r="22" fill="#FDBCB4" />
      {/* Eyes */}
      <ellipse cx="42" cy="40" rx="2.5" ry="3" fill={persona.hexColor}>
        <animate attributeName="ry" values="3;0.5;3" dur="4s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="58" cy="40" rx="2.5" ry="3" fill={persona.hexColor}>
        <animate attributeName="ry" values="3;0.5;3" dur="4s" repeatCount="indefinite" />
      </ellipse>
      {/* Smile */}
      <path d="M43 50 Q50 56 57 50" stroke={persona.hexColor} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Blush */}
      <circle cx="36" cy="48" r="4" fill="#FFB6C1" opacity="0.4" />
      <circle cx="64" cy="48" r="4" fill="#FFB6C1" opacity="0.4" />
      {/* Body */}
      <path d="M30 68 Q50 60 70 68 L75 95 H25 Z" fill={persona.hexColor} opacity="0.8" />
      {/* Hair strands */}
      <path d="M25 30 Q22 50 28 65" stroke={persona.hairColor} strokeWidth="4" fill="none" />
      <path d="M75 30 Q78 50 72 65" stroke={persona.hairColor} strokeWidth="4" fill="none" />
    </g>
  );
}

/** Variante de avatar masculino con cabello corto, gafas decorativas y corbata. */
function ManAvatar({ persona }: { persona: AgentPersona }) {
  return (
    <g>
      {/* Hair */}
      <path d="M25 38 Q25 15 50 12 Q75 15 75 38 L72 35 Q50 20 28 35 Z" fill={persona.hairColor}>
        <animate attributeName="d" values="M25 38 Q25 15 50 12 Q75 15 75 38 L72 35 Q50 20 28 35 Z;M25 37 Q25 14 50 11 Q75 14 75 37 L72 34 Q50 19 28 34 Z;M25 38 Q25 15 50 12 Q75 15 75 38 L72 35 Q50 20 28 35 Z" dur="4s" repeatCount="indefinite" />
      </path>
      {/* Face */}
      <circle cx="50" cy="42" r="22" fill="#F0C8A0" />
      {/* Eyes */}
      <rect x="39" y="38" width="6" height="4" rx="2" fill={persona.hexColor}>
        <animate attributeName="height" values="4;1;4" dur="5s" repeatCount="indefinite" />
      </rect>
      <rect x="55" y="38" width="6" height="4" rx="2" fill={persona.hexColor}>
        <animate attributeName="height" values="4;1;4" dur="5s" repeatCount="indefinite" />
      </rect>
      {/* Smile */}
      <path d="M44 50 Q50 55 56 50" stroke={persona.hexColor} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      {/* Glasses */}
      <circle cx="42" cy="40" r="8" stroke={persona.hexColor} strokeWidth="1" fill="none" opacity="0.4" />
      <circle cx="58" cy="40" r="8" stroke={persona.hexColor} strokeWidth="1" fill="none" opacity="0.4" />
      <line x1="50" y1="40" x2="50" y2="40" stroke={persona.hexColor} strokeWidth="1" opacity="0.4" />
      {/* Body */}
      <path d="M30 68 Q50 60 70 68 L75 95 H25 Z" fill={persona.hexColor} opacity="0.8" />
      {/* Tie/gear icon */}
      <circle cx="50" cy="78" r="5" fill="white" opacity="0.3" />
      <path d="M48 76 L50 73 L52 76 M48 80 L50 83 L52 80" stroke="white" strokeWidth="1" fill="none" opacity="0.5" />
    </g>
  );
}

/** Variante de avatar canino con orejas animadas, lengua y collar con placa. */
function DogAvatar({ persona }: { persona: AgentPersona }) {
  return (
    <g>
      {/* Ears */}
      <ellipse cx="30" cy="28" rx="12" ry="18" fill={persona.hairColor} transform="rotate(-15 30 28)">
        <animate attributeName="ry" values="18;20;18" dur="2s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="70" cy="28" rx="12" ry="18" fill={persona.hairColor} transform="rotate(15 70 28)">
        <animate attributeName="ry" values="18;20;18" dur="2s" repeatCount="indefinite" begin="0.3s" />
      </ellipse>
      {/* Head */}
      <circle cx="50" cy="45" r="25" fill={persona.hairColor} />
      {/* Face patch */}
      <ellipse cx="50" cy="52" rx="16" ry="14" fill="#F5E6D3" />
      {/* Eyes */}
      <circle cx="40" cy="42" r="4" fill="#1a1a2e">
        <animate attributeName="r" values="4;3.5;4" dur="3s" repeatCount="indefinite" />
      </circle>
      <circle cx="60" cy="42" r="4" fill="#1a1a2e">
        <animate attributeName="r" values="4;3.5;4" dur="3s" repeatCount="indefinite" />
      </circle>
      {/* Eye shine */}
      <circle cx="41.5" cy="41" r="1.5" fill="white" />
      <circle cx="61.5" cy="41" r="1.5" fill="white" />
      {/* Nose */}
      <ellipse cx="50" cy="50" rx="5" ry="3.5" fill="#1a1a2e" />
      {/* Tongue */}
      <ellipse cx="50" cy="58" rx="4" ry="5" fill="#FF8B8B">
        <animate attributeName="ry" values="5;6;5" dur="1.5s" repeatCount="indefinite" />
      </ellipse>
      {/* Collar */}
      <path d="M30 68 Q50 72 70 68" stroke={persona.hexColor} strokeWidth="4" fill="none" strokeLinecap="round" />
      {/* Tag */}
      <circle cx="50" cy="73" r="4" fill={persona.hexColor} />
      {/* Body */}
      <ellipse cx="50" cy="88" rx="22" ry="14" fill={persona.hairColor} />
    </g>
  );
}

/** Variante de avatar felino con orejas puntiagudas, bigotes, cola animada y collar. */
function CatAvatar({ persona }: { persona: AgentPersona }) {
  return (
    <g>
      {/* Ears */}
      <polygon points="25,35 18,8 40,28" fill="#1a1a2e">
        <animate attributeName="points" values="25,35 18,8 40,28;25,34 16,6 40,27;25,35 18,8 40,28" dur="3s" repeatCount="indefinite" />
      </polygon>
      <polygon points="75,35 82,8 60,28" fill="#1a1a2e">
        <animate attributeName="points" values="75,35 82,8 60,28;75,34 84,6 60,27;75,35 82,8 60,28" dur="3s" repeatCount="indefinite" begin="0.5s" />
      </polygon>
      {/* Inner ears */}
      <polygon points="27,33 22,14 38,28" fill="#2d2d4e" />
      <polygon points="73,33 78,14 62,28" fill="#2d2d4e" />
      {/* Head */}
      <circle cx="50" cy="45" r="25" fill="#1a1a2e" />
      {/* Eyes */}
      <ellipse cx="38" cy="42" rx="5" ry="6" fill={persona.hexColor}>
        <animate attributeName="ry" values="6;1;6" dur="5s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="62" cy="42" rx="5" ry="6" fill={persona.hexColor}>
        <animate attributeName="ry" values="6;1;6" dur="5s" repeatCount="indefinite" />
      </ellipse>
      {/* Pupils */}
      <ellipse cx="38" cy="42" rx="2" ry="5" fill="#0a0a1a">
        <animate attributeName="ry" values="5;0.5;5" dur="5s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="62" cy="42" rx="2" ry="5" fill="#0a0a1a">
        <animate attributeName="ry" values="5;0.5;5" dur="5s" repeatCount="indefinite" />
      </ellipse>
      {/* Nose */}
      <polygon points="50,50 47,53 53,53" fill="#FF8B8B" />
      {/* Whiskers */}
      <line x1="20" y1="50" x2="38" y2="52" stroke="#555" strokeWidth="0.8" opacity="0.5" />
      <line x1="20" y1="55" x2="38" y2="54" stroke="#555" strokeWidth="0.8" opacity="0.5" />
      <line x1="80" y1="50" x2="62" y2="52" stroke="#555" strokeWidth="0.8" opacity="0.5" />
      <line x1="80" y1="55" x2="62" y2="54" stroke="#555" strokeWidth="0.8" opacity="0.5" />
      {/* Mouth */}
      <path d="M47 55 Q50 58 53 55" stroke="#555" strokeWidth="0.8" fill="none" />
      {/* Body */}
      <ellipse cx="50" cy="85" rx="20" ry="16" fill="#1a1a2e" />
      {/* Tail */}
      <path d="M70 82 Q85 70 80 55" stroke="#1a1a2e" strokeWidth="5" fill="none" strokeLinecap="round">
        <animate attributeName="d" values="M70 82 Q85 70 80 55;M70 82 Q88 65 82 50;M70 82 Q85 70 80 55" dur="2s" repeatCount="indefinite" />
      </path>
      {/* Collar */}
      <path d="M32 68 Q50 72 68 68" stroke={persona.hexColor} strokeWidth="3" fill="none" strokeLinecap="round" />
    </g>
  );
}