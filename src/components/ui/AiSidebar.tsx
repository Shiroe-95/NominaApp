'use client';

import { useRef, useEffect, useState } from 'react';
import { Bot, Send, X, Activity, BookOpen, Sparkles, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentChip } from '@/components/ui/AgentChip';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { getPersona, getAgentDisplayName, AGENT_PERSONAS } from '@/lib/ai/agent-personas';

// ── Types ───────────────────────────────────────────────────────────

/** Información resumida del resultado de un agente especializado. */
interface AgentResultInfo {
  agentName: string;
  success: boolean;
  tokensUsed: number;
  providerUsed: string;
  latencyMs: number;
}

/** Paso individual del plan de orquestación del Agente Maestro. */
interface PlanStep {
  agentName: string;
  description: string;
}

/** Mensaje inter-agente registrado por el AgentBus durante la orquestación. */
interface AgentBusMessage {
  fromAgent: string;
  toAgent: string;
  queryType: string;
  payload: unknown;
  timestamp: string;
}

/**
 * Mensaje del historial de chat.
 * Los mensajes del asistente pueden incluir resultados de agentes,
 * el plan de orquestación ejecutado y el historial de comunicaciones inter-agente.
 */
interface Message {
  role: 'user' | 'assistant';
  text: string;
  agentResults?: AgentResultInfo[];
  plan?: { steps: PlanStep[] };
  busHistory?: AgentBusMessage[];
}

// ── Constants ───────────────────────────────────────────────────────

/** Clave de localStorage para persistir el historial de conversación. */
const STORAGE_KEY = 'nominasmart_ai_history';

/** Sugerencias predefinidas mostradas en el mensaje de bienvenida. */
const SUGGESTIONS = [
  'Lista todas las reglas de Colombia',
  'Agrega el campo gross_pay a Colombia 2026',
  'Agrega verificación "Fondo solidaridad: 1% si IBC > 4 SMMLV" a Colombia 2026',
  'Explica cómo se calcula el IBC con la Ley 1393',
  'Crea una regla para Colombia 2027',
  'Quita el cálculo tope_40_no_salarial de Colombia 2025',
];

const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  text: '¡Hola! Soy Dianis 👑, tu directora de orquestación.\n\nYo coordino a todo el equipo de agentes para ayudarte:\n\n🔍 Juli — Auditora de nómina\n📝 Ana — Redactora de reportes\n⚙️ Wil — Ingeniero de correcciones\n🐕 Soul — Investigadora regulatoria\n🐈‍⬛ Gyoru — Mapeadora de campos\n\nDime qué necesitas y yo me encargo de asignar al equipo correcto. ¡Es súper fácil!',
};

// ── Component ───────────────────────────────────────────────────────

/**
 * Props del panel lateral de chat con IA.
 * @property context - Contexto adicional (datos de nómina, país, año) enviado al endpoint de orquestación.
 */
interface AiSidebarProps {
  context?: Record<string, unknown>;
}

/**
 * Panel lateral de chat con IA multi-agente.
 *
 * Conecta con `/api/ai/orchestrate` para enviar mensajes al Agente Maestro,
 * que orquesta agentes especializados (auditor, redactor, corrector, mapeador, nómina).
 *
 * Funcionalidades:
 * - Historial de conversación persistido en localStorage.
 * - Indicadores visuales de qué agentes están procesando (AgentChip).
 * - Chips de resultado por agente con tokens consumidos y latencia.
 * - Visualización del flujo de comunicación inter-agente (AgentBus).
 * - Sugerencias predefinidas en el mensaje de bienvenida.
 *
 * Cumple con Requisitos 14.1 (indicador de agente activo), 14.2 (progreso de sub-tareas),
 * 14.3 (chips de resultado), 14.4 (historial de conversaciones) y 25.5 (trazabilidad inter-agente).
 *
 * @param props - {@link AiSidebarProps}
 * @returns Panel lateral colapsable con chat de IA.
 */

export default function AiSidebar({ context }: AiSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeAgents, setActiveAgents] = useState<string[]>([]);
  const [messages, setMessages] = useState<Message[]>(() => {
    if (typeof window === 'undefined') return [WELCOME_MESSAGE];
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Message[];
        return parsed.length > 0 ? parsed : [WELCOME_MESSAGE];
      }
    } catch { /* ignore */ }
    return [WELCOME_MESSAGE];
  });
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  // Persist to localStorage
  useEffect(() => {
    if (messages.length > 1) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages)); } catch { /* ignore */ }
    }
  }, [messages]);

  const handleClearHistory = () => {
    setMessages([WELCOME_MESSAGE]);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSend = async (text: string = input) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const updated: Message[] = [...messages, { role: 'user', text: trimmed }];
    setMessages(updated);
    setInput('');
    setIsLoading(true);
    setActiveAgents([]);

    try {
      // Build messages array (skip welcome message at index 0)
      const apiMessages = updated.slice(1).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.text,
      }));

      const res = await fetch('/api/ai/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'chat',
          messages: apiMessages,
          context: context ?? {},
        }),
      });

      const data = await res.json() as {
        reply?: string;
        results?: AgentResultInfo[];
        plan?: { steps: PlanStep[] };
        busHistory?: AgentBusMessage[];
        interAgentMessages?: AgentBusMessage[];
        error?: string;
      };

      if (!res.ok) throw new Error(data.error ?? 'Error desconocido');

      // Show which agents participated
      const results = data.results ?? [];
      const busMessages = data.busHistory ?? data.interAgentMessages ?? [];
      setActiveAgents(results.map((r) => r.agentName));

      // Brief flash of active state, then clear
      setTimeout(() => setActiveAgents([]), 2000);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.reply ?? 'Acción completada.',
          agentResults: results.length > 0 ? results : undefined,
          plan: data.plan,
          busHistory: busMessages.length > 0 ? busMessages : undefined,
        },
      ]);
    } catch (error) {
      console.error('Orchestrate error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'No pude completar la solicitud. Intenta nuevamente.' },
      ]);
    } finally {
      setIsLoading(false);
      setActiveAgents([]);
    }
  };

  return (
    <>
      {/* FAB */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 bg-gradient-to-br from-violet to-violet-dark text-white rounded-2xl p-3.5 shadow-lg shadow-violet/30 transition-all hover:scale-105 hover:shadow-xl hover:shadow-violet/30 active:scale-95 flex items-center gap-2"
        >
          <Bot className="w-5 h-5" />
          <span className="text-sm font-semibold pr-0.5">IA</span>
        </button>
      )}

      {isOpen && (
        <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] bg-white shadow-2xl border-l border-slate-200 flex flex-col animate-in slide-in-from-right-full duration-300">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-navy-dark text-white shrink-0">
            <div className="flex items-center gap-3">
              <AgentAvatar agentId="master" size={36} animate />
              <div>
                <h3 className="font-semibold text-sm">👑 Dianis</h3>
                <div className="flex items-center gap-1.5 text-xs text-slate-300">
                  <Activity className="w-3 h-3 text-emerald-400" />
                  Directora · Equipo listo
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={handleClearHistory} title="Limpiar historial" className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <Trash2 className="w-4 h-4 text-slate-400 hover:text-rose-400" />
              </button>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn('flex flex-col max-w-[90%]', msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start')}
              >
                <div
                  className={cn(
                    'p-3 rounded-2xl text-sm whitespace-pre-line leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-violet text-white rounded-tr-sm'
                      : 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm shadow-sm',
                  )}
                >
                  {msg.text}
                </div>

                {/* Agent result chips */}
                {msg.agentResults && msg.agentResults.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 w-full">
                    {msg.agentResults.map((result, ri) => {
                      const persona = getPersona(result.agentName);
                      return (
                        <div key={ri} className="flex items-center gap-1.5">
                          <AgentAvatar agentId={result.agentName} size={20} animate={false} />
                          <AgentChip
                            agentName={result.agentName}
                            active={activeAgents.includes(result.agentName)}
                          />
                          <span className="text-[10px] text-slate-400">
                            {result.tokensUsed}t · {result.latencyMs}ms
                            {!result.success && ' · ⚠️'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Flujo de comunicación del equipo — muestra nombres amigables (emoji + nombre) vía getAgentDisplayName */}
                {msg.busHistory && msg.busHistory.length > 0 && (
                  <div className="mt-1.5 ml-3 pl-3 border-l-2 border-slate-200 space-y-1">
                    <span className="text-[9px] uppercase tracking-wider text-slate-300 font-semibold">
                      Comunicación del equipo
                    </span>
                    {msg.busHistory.map((bm, bi) => (
                      <div key={bi} className="text-[10px] text-slate-400 flex items-center gap-1">
                        <span className="font-medium text-slate-500">{getAgentDisplayName(bm.fromAgent)}</span>
                        <span>→</span>
                        <span className="font-medium text-slate-500">{getAgentDisplayName(bm.toAgent)}</span>
                        <span className="text-slate-300">·</span>
                        <span>{bm.queryType}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Suggestions on welcome message */}
                {msg.role === 'assistant' && i === 0 && (
                  <div className="mt-3 flex flex-col gap-1.5 w-full">
                    <p className="text-[10px] text-slate-400 flex items-center gap-1 mb-0.5">
                      <Sparkles className="w-3 h-3" /> Sugerencias
                    </p>
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        disabled={isLoading}
                        onClick={() => void handleSend(s)}
                        className="text-left text-xs bg-white border border-slate-200 text-slate-600 px-3 py-2 rounded-lg hover:bg-violet/5 hover:border-violet/30 hover:text-violet transition-colors flex items-center gap-2 group"
                      >
                        <BookOpen className="w-3 h-3 text-slate-400 group-hover:text-violet shrink-0" />
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Loading with active agent indicators */}
            {isLoading && (
              <div className="flex flex-col gap-2 mr-auto">
                <div className="bg-white border border-slate-200 rounded-2xl rounded-tl-sm shadow-sm px-4 py-3 flex items-center gap-2">
                  <AgentAvatar agentId="master" size={22} animate />
                  <div className="flex gap-1">
                    {[0, 150, 300].map((delay) => (
                      <span
                        key={delay}
                        className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"
                        style={{ animationDelay: `${delay}ms` }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-slate-400">Dianis coordinando...</span>
                </div>
                {activeAgents.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {activeAgents.map((name) => (
                      <AgentChip key={name} agentName={name} active showAvatar />
                    ))}
                  </div>
                )}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="p-4 bg-white border-t border-slate-100 shrink-0">
            <div className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleSend()}
                placeholder={isLoading ? 'Procesando...' : 'Escribe un mensaje o instrucción...'}
                disabled={isLoading}
                className="w-full pr-12 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-violet focus:border-transparent transition-all disabled:opacity-70 disabled:bg-slate-100"
              />
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-2 bg-violet hover:bg-violet-dark disabled:opacity-50 text-white rounded-full transition-colors flex items-center justify-center h-8 w-8 my-auto top-0 bottom-0"
              >
                {isLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-center text-slate-400 mt-2 flex items-center justify-center gap-1">
              <Bot className="w-3 h-3" /> Equipo: Juli · Ana · Wil · Soul · Gyoru
            </p>
          </div>
        </div>
      )}
    </>
  );
}
