/**
 * Personalidades de los agentes de NominaSmart.
 *
 * Cada agente tiene un nombre, emoji, color, rol descriptivo y personalidad.
 * Dianis es la maestra orquestadora que guía todo el proceso.
 */

export interface AgentPersona {
  /** Nombre humano del agente */
  name: string;
  /** Identificador técnico */
  id: string;
  /** Rol corto */
  role: string;
  /** Descripción amigable de lo que hace */
  description: string;
  /** Emoji representativo */
  emoji: string;
  /** Tipo de avatar: 'woman' | 'man' | 'dog' | 'cat' | 'rabbit' */
  avatarType: 'woman' | 'man' | 'dog' | 'cat' | 'rabbit';
  /** Color principal (tailwind) */
  color: string;
  /** Color de fondo con opacidad */
  bgColor: string;
  /** Color de texto */
  textColor: string;
  /** Color de glow */
  glowColor: string;
  /** Color hex para SVG */
  hexColor: string;
  /** Frase de saludo */
  greeting: string;
  /** Color de cabello/pelaje para el avatar */
  hairColor: string;
}

export const AGENT_PERSONAS: Record<string, AgentPersona> = {
  master: {
    name: 'Dianis',
    id: 'master',
    role: 'Directora de Orquestación',
    description: 'Coordino a todo el equipo y te guío paso a paso',
    emoji: '👑',
    avatarType: 'woman',
    color: 'rose',
    bgColor: 'bg-rose-500/15',
    textColor: 'text-rose-300',
    glowColor: 'shadow-[0_0_12px_rgba(244,63,94,0.4)]',
    hexColor: '#f43f5e',
    greeting: '¡Hola! Soy Dianis, tu directora. Yo coordino al equipo para que todo salga perfecto 💅',
    hairColor: '#1a1a2e',
  },
  auditor: {
    name: 'Juli',
    id: 'auditor',
    role: 'Auditora de Nómina',
    description: 'Reviso cada número y detecto errores',
    emoji: '🔍',
    avatarType: 'woman',
    color: 'emerald',
    bgColor: 'bg-emerald-500/15',
    textColor: 'text-emerald-300',
    glowColor: 'shadow-[0_0_12px_rgba(16,185,129,0.4)]',
    hexColor: '#10b981',
    greeting: '¡Hola! Soy Juli, la auditora. Ningún error se me escapa 🧐',
    hairColor: '#8B4513',
  },
  writer: {
    name: 'Ana',
    id: 'writer',
    role: 'Redactora de Reportes',
    description: 'Escribo reportes claros y ejecutivos',
    emoji: '📝',
    avatarType: 'woman',
    color: 'violet',
    bgColor: 'bg-violet-500/15',
    textColor: 'text-violet-300',
    glowColor: 'shadow-[0_0_12px_rgba(139,92,246,0.4)]',
    hexColor: '#8b5cf6',
    greeting: '¡Hola! Soy Ana, la redactora. Transformo datos en historias claras ✍️',
    hairColor: '#D4A574',
  },
  corrector: {
    name: 'Wil',
    id: 'corrector',
    role: 'Ingeniero de Correcciones',
    description: 'Calculo las correcciones exactas con precisión de ingeniero',
    emoji: '⚙️',
    avatarType: 'man',
    color: 'amber',
    bgColor: 'bg-amber-500/15',
    textColor: 'text-amber-300',
    glowColor: 'shadow-[0_0_12px_rgba(245,158,11,0.4)]',
    hexColor: '#f59e0b',
    greeting: '¡Hola! Soy Wil, el ingeniero. Mis correcciones son exactas al centavo 🔧',
    hairColor: '#2d1b0e',
  },
  mapper: {
    name: 'Gyoru',
    id: 'mapper',
    role: 'Mapeadora de Campos',
    description: 'Conecto tus columnas con el sistema',
    emoji: '🐈‍⬛',
    avatarType: 'cat',
    color: 'cyan',
    bgColor: 'bg-cyan-500/15',
    textColor: 'text-cyan-300',
    glowColor: 'shadow-[0_0_12px_rgba(6,182,212,0.4)]',
    hexColor: '#06b6d4',
    greeting: '¡Miau! Soy Gyoru, mapeo tus datos con precisión felina 🐱',
    hairColor: '#1a1a2e',
  },
  'payroll-expert': {
    name: 'Luni',
    id: 'payroll-expert',
    role: 'Experta en Nómina Multi-País',
    description: 'Respondo tus dudas sobre normativa laboral de cualquier país',
    emoji: '🐰',
    avatarType: 'rabbit',
    color: 'violet',
    bgColor: 'bg-violet-500/15',
    textColor: 'text-violet-300',
    glowColor: 'shadow-[0_0_12px_rgba(139,92,246,0.4)]',
    hexColor: '#8b5cf6',
    greeting: '¡Hola! Soy Luni, tu experta en nómina. Pregúntame lo que necesites sobre normativa de cualquier país 🐰',
    hairColor: '#F5E6D3',
  },
  researcher: {
    name: 'Soul',
    id: 'researcher',
    role: 'Investigadora Regulatoria',
    description: 'Olfateo cambios en la normativa',
    emoji: '🐕',
    avatarType: 'dog',
    color: 'cyan',
    bgColor: 'bg-cyan-500/15',
    textColor: 'text-cyan-300',
    glowColor: 'shadow-[0_0_12px_rgba(6,182,212,0.4)]',
    hexColor: '#06b6d4',
    greeting: '¡Guau! Soy Soul, olfateo cambios regulatorios y traigo las novedades 🐾',
    hairColor: '#D4A574',
  },
  'anomaly-detector': {
    name: 'Nyx',
    id: 'anomaly-detector',
    role: 'Detectora de Anomalías',
    description: 'Detecto patrones atípicos y fraudes potenciales en datos de nómina',
    emoji: '🔮',
    avatarType: 'woman',
    color: 'fuchsia',
    bgColor: 'bg-fuchsia-500/15',
    textColor: 'text-fuchsia-300',
    glowColor: 'shadow-[0_0_12px_rgba(217,70,239,0.4)]',
    hexColor: '#d946ef',
    greeting: '¡Hola! Soy Nyx, detecto anomalías y patrones sospechosos en tus datos 🔮',
    hairColor: '#4a0e4e',
  },
};

/**
 * Obtiene la persona de un agente por su ID, con fallback a un agente genérico.
 *
 * Normaliza el ID eliminando prefijos como "agente" y caracteres `_` / `-`
 * antes de buscar en el registro de personas.
 *
 * @param agentId - Identificador del agente (ej: `'master'`, `'auditor'`, `'corrector'`)
 * @returns La persona correspondiente, o un fallback genérico si no se encuentra
 */
export function getPersona(agentId: string): AgentPersona {
  const key = agentId.toLowerCase().replace(/^agente?\s*/i, '').replace(/[_-]/g, '');
  return AGENT_PERSONAS[key] ?? AGENT_PERSONAS[agentId] ?? {
    name: agentId,
    id: agentId,
    role: 'Agente',
    description: '',
    emoji: '🤖',
    avatarType: 'man' as const as AgentPersona['avatarType'],
    color: 'slate',
    bgColor: 'bg-white/10',
    textColor: 'text-slate-300',
    glowColor: '',
    hexColor: '#94a3b8',
    greeting: 'Hola, estoy aquí para ayudarte.',
    hairColor: '#1a1a2e',
  };
}

/**
 * Obtiene el nombre amigable del agente con su emoji.
 *
 * @param agentId - Identificador del agente
 * @returns Cadena con formato `"emoji nombre"` (ej: `"👑 Dianis"`)
 */
export function getAgentDisplayName(agentId: string): string {
  const persona = getPersona(agentId);
  return `${persona.emoji} ${persona.name}`;
}

/**
 * Obtiene el label completo del agente con emoji, nombre y rol.
 *
 * @param agentId - Identificador del agente
 * @returns Cadena con formato `"emoji nombre — rol"` (ej: `"👑 Dianis — Directora de Orquestación"`)
 */
export function getAgentLabel(agentId: string): string {
  const persona = getPersona(agentId);
  return `${persona.emoji} ${persona.name} — ${persona.role}`;
}
