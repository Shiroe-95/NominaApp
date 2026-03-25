'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Bot, Send, X, Activity, BookOpen, Sparkles, Trash2, ExternalLink, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AgentAvatar } from '@/components/ui/AgentAvatar';
import { getPersona } from '@/lib/ai/agent-personas';
import { colors } from '@/lib/design-tokens';
import type { StreamEventType } from '@/lib/ai/streaming';

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

/**
 * Número máximo de intentos de reconexión SSE con backoff exponencial.
 * Tras agotar los intentos, el sidebar vuelve al modo fetch simple.
 * @see Requirements 3.4
 */
const MAX_RECONNECT_ATTEMPTS = 3;

/** Sugerencias predefinidas mostradas en el mensaje de bienvenida. */
const SUGGESTIONS = [
  'Lista todas las reglas normativas configuradas',
  'Muestra las reglas de México 2025',
  'Crea una regla para Perú 2026',
];

/** Acciones rápidas de agentes que se pueden invocar directamente. */
const AGENT_ACTIONS = [
  {
    agentId: 'researcher',
    label: '🔄 Actualizar reglas normativas',
    description: 'Soul investiga cambios regulatorios y actualiza las reglas de todos los países.',
    action: 'sync',
  },
  {
    agentId: 'auditor',
    label: '🔍 Auditar última nómina',
    description: 'Juli ejecuta las 14 verificaciones sobre la última planilla cargada.',
    action: 'chat',
    prompt: 'Ejecuta una auditoría completa sobre la última nómina cargada. Analiza todos los hallazgos y dame un resumen ejecutivo.',
  },
  {
    agentId: 'payroll-expert',
    label: '📋 Consultar normativa vigente',
    description: 'Luni responde preguntas sobre leyes laborales de cualquier país.',
    action: 'chat',
    prompt: 'Dame un resumen de la normativa laboral vigente para Colombia 2026, incluyendo SMMLV, auxilio de transporte, y porcentajes de aportes.',
  },
  {
    agentId: 'writer',
    label: '📝 Generar reporte ejecutivo',
    description: 'Ana redacta un reporte con hallazgos priorizados de la última auditoría.',
    action: 'chat',
    prompt: 'Genera un reporte ejecutivo de la última nómina procesada con hallazgos priorizados por severidad y recomendaciones.',
  },
] as const;

const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  text: '¡Hola! Soy Dianis 👑, tu directora de orquestación.\n\nYo coordino a todo el equipo de agentes para ayudarte con nómina de cualquier país:\n\n🔍 Juli — Auditora de nómina\n📝 Ana — Redactora de reportes\n⚙️ Wil — Ingeniero de correcciones\n🐕 Soul — Investigadora regulatoria\n🐈‍⬛ Gyoru — Mapeadora de campos\n🐰 Luni — Experta en nómina multi-país\n\n🌎 Países: CO · MX · PE · CL · BR · AR · US\n\nDime qué necesitas y yo me encargo de asignar al equipo correcto.',
};

// ── SSE Stream Parser ───────────────────────────────────────────────

interface SSEEvent {
  type: StreamEventType;
  data: Record<string, unknown>;
}

/**
 * Parses an SSE text chunk into individual events.
 * Handles partial chunks by tracking leftover buffer.
 */
function parseSSEChunk(chunk: string, buffer: string): { events: SSEEvent[]; remaining: string } {
  const text = buffer + chunk;
  const events: SSEEvent[] = [];
  // Split on double newline (SSE event boundary)
  const parts = text.split('\n\n');
  // Last part may be incomplete
  const remaining = parts.pop() ?? '';

  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;

    let eventType: string | undefined;
    let dataStr: string | undefined;

    for (const line of trimmed.split('\n')) {
      if (line.startsWith('event: ')) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith('data: ')) {
        dataStr = line.slice(6);
      }
    }

    if (eventType && dataStr) {
      try {
        const data = JSON.parse(dataStr) as Record<string, unknown>;
        events.push({ type: eventType as StreamEventType, data });
      } catch {
        // Skip malformed events
      }
    }
  }

  return { events, remaining };
}

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
 * Conecta con `/api/ai/orchestrate` usando SSE streaming para enviar mensajes
 * al Agente Maestro, que orquesta agentes especializados.
 *
 * Funcionalidades:
 * - Streaming SSE con renderizado incremental de contenido.
 * - Indicador de escritura con agente activo (nombre + avatar).
 * - Reconexión automática con backoff exponencial (hasta 3 intentos).
 * - Historial de conversación persistido en localStorage.
 * - Chips de resultado por agente con tokens consumidos y latencia.
 * - Visualización del flujo de comunicación inter-agente (AgentBus).
 * - Sugerencias predefinidas en el mensaje de bienvenida.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5
 */
export default function AiSidebar({ context }: AiSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [streamingText, setStreamingText] = useState('');
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
  const [syncLoading, setSyncLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Persist to localStorage (Req 3.5)
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
  }, [messages, isLoading, streamingText]);

  // ── SSE Streaming fetch with reconnection ───────────────────────

  /**
   * Ejecuta una solicitud al endpoint de orquestación usando SSE streaming.
   *
   * Conecta con `/api/ai/orchestrate` y procesa eventos SSE en tiempo real,
   * actualizando el estado del componente conforme los agentes progresan.
   * Si el servidor no soporta SSE, hace fallback a respuesta JSON estándar.
   *
   * Implementa reconexión automática con backoff exponencial (1s, 2s, 4s)
   * hasta {@link MAX_RECONNECT_ATTEMPTS} intentos ante desconexiones inesperadas.
   *
   * @param apiMessages - Historial de mensajes a enviar al orquestador.
   * @param attempt - Número de intento actual para reconexión (uso interno).
   * @returns Resultado consolidado con respuesta, resultados de agentes, plan y mensajes del bus.
   *
   * @see Requirements 3.1 (indicador de agente activo)
   * @see Requirements 3.2 (renderizado incremental)
   * @see Requirements 3.4 (reconexión automática)
   */
  const executeSSEStream = useCallback(async (
    apiMessages: { role: 'user' | 'assistant'; content: string }[],
    attempt: number = 0,
  ): Promise<{
    reply: string;
    results: AgentResultInfo[];
    plan?: { steps: PlanStep[] };
    busHistory?: AgentBusMessage[];
  }> => {
    const controller = new AbortController();
    abortRef.current = controller;

    const res = await fetch('/api/ai/orchestrate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        type: 'chat',
        messages: apiMessages,
        context: context ?? {},
      }),
      signal: controller.signal,
    });

    // If server doesn't return SSE, fall back to JSON parsing
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/event-stream')) {
      const data = await res.json() as {
        reply?: string;
        results?: AgentResultInfo[];
        plan?: { steps: PlanStep[] };
        busHistory?: AgentBusMessage[];
        interAgentMessages?: AgentBusMessage[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? 'Error desconocido');
      return {
        reply: data.reply ?? 'Acción completada.',
        results: data.results ?? [],
        plan: data.plan,
        busHistory: data.busHistory ?? data.interAgentMessages,
      };
    }

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(errorText || `HTTP ${res.status}`);
    }

    if (!res.body) throw new Error('No response body');

    // ── Parse SSE stream using ReadableStream reader ────────────
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let sseBuffer = '';
    const collectedResults: AgentResultInfo[] = [];
    const collectedBusMessages: AgentBusMessage[] = [];
    let collectedPlan: { steps: PlanStep[] } | undefined;
    let finalReply = '';
    let partialText = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const { events, remaining } = parseSSEChunk(chunk, sseBuffer);
        sseBuffer = remaining;

        for (const event of events) {
          switch (event.type) {
            case 'agent-start': {
              // Req 3.1: Show typing indicator with active agent name + avatar
              const agentName = event.data.agentName as string;
              setActiveAgent(agentName);
              break;
            }

            case 'agent-complete': {
              // Req 3.2: Render content incrementally as agents complete
              const agentName = event.data.agentName as string;
              const success = event.data.success as boolean;
              const tokensUsed = (event.data.tokensUsed as number) ?? 0;
              const latencyMs = (event.data.latencyMs as number) ?? 0;

              collectedResults.push({
                agentName,
                success,
                tokensUsed,
                providerUsed: 'stream',
                latencyMs,
              });

              // Build incremental status text
              const persona = getPersona(agentName);
              const statusIcon = success ? '✅' : '⚠️';
              partialText += `${statusIcon} ${persona.emoji} ${persona.name} — ${success ? 'completado' : 'error'} (${tokensUsed}t · ${latencyMs}ms)\n`;
              setStreamingText(partialText);
              break;
            }

            case 'agent-communication': {
              collectedBusMessages.push({
                fromAgent: event.data.fromAgent as string,
                toAgent: event.data.toAgent as string,
                queryType: event.data.queryType as string,
                payload: null,
                timestamp: new Date().toISOString(),
              });
              break;
            }

            case 'plan-updated': {
              const totalSteps = event.data.totalSteps as number;
              const version = event.data.version as number;
              const adaptation = event.data.adaptation as Record<string, unknown> | undefined;
              collectedPlan = {
                steps: Array.from({ length: totalSteps }, (_, i) => ({
                  agentName: `step-${i}`,
                  description: `Plan v${version}`,
                })),
              };
              if (adaptation?.reason) {
                partialText += `🔄 Plan adaptado: ${adaptation.reason as string}\n`;
                setStreamingText(partialText);
              }
              break;
            }

            case 'pipeline-complete': {
              // Final consolidated result
              const response = event.data.response as {
                reply?: string;
                results?: AgentResultInfo[];
                plan?: { steps: PlanStep[] };
                busHistory?: AgentBusMessage[];
              } | undefined;

              if (response) {
                finalReply = response.reply ?? '';
                if (response.results) {
                  collectedResults.length = 0;
                  collectedResults.push(...response.results);
                }
                if (response.plan) collectedPlan = response.plan;
              }
              break;
            }

            case 'clarification-needed': {
              finalReply = event.data.message as string ?? 'No entendí tu solicitud. ¿Podrías ser más específico?';
              break;
            }

            case 'error': {
              const errorMsg = event.data.error as string ?? 'Error desconocido';
              const fatal = event.data.fatal as boolean;
              if (fatal) {
                throw new Error(errorMsg);
              }
              partialText += `❌ Error: ${errorMsg}\n`;
              setStreamingText(partialText);
              break;
            }
          }
        }
      }
    } catch (err) {
      // If stream disconnected unexpectedly, attempt reconnection
      if (
        err instanceof TypeError &&
        attempt < MAX_RECONNECT_ATTEMPTS &&
        !controller.signal.aborted
      ) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        await new Promise((resolve) => setTimeout(resolve, delay));
        return executeSSEStream(apiMessages, attempt + 1);
      }
      throw err;
    }

    return {
      reply: finalReply || partialText.trim() || 'Acción completada.',
      results: collectedResults,
      plan: collectedPlan,
      busHistory: collectedBusMessages.length > 0 ? collectedBusMessages : undefined,
    };
  }, [context]);

  // ── Agent action handler ────────────────────────────────────────

  /**
   * Ejecuta una acción rápida de agente desde los botones del panel de bienvenida.
   *
   * Soporta dos tipos de acción:
   * - `sync`: Invoca `/api/sync/bootstrap` para sincronización regulatoria de todos los países.
   * - `chat`: Envía el prompt predefinido de la acción al orquestador vía {@link handleSend}.
   *
   * @param action - Definición de la acción rápida desde {@link AGENT_ACTIONS}.
   */
  const handleAgentAction = async (action: typeof AGENT_ACTIONS[number]) => {
    if (isLoading || syncLoading) return;

    if (action.action === 'sync') {
      // Execute regulatory sync via bootstrap API
      setSyncLoading(true);
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: '🔄 Actualizar reglas normativas de todos los países' },
      ]);

      try {
        const res = await fetch('/api/sync/bootstrap', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ force: true }),
        });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error ?? 'Error al sincronizar');
        }

        const results = data.results ?? [];
        const successCount = results.filter((r: { status: string }) => r.status === 'success').length;
        const errorCount = results.filter((r: { status: string }) => r.status === 'error').length;

        let replyText = `🐕 Soul completó la sincronización regulatoria.\n\n`;
        replyText += `✅ Exitosos: ${successCount}\n`;
        if (errorCount > 0) replyText += `⚠️ Con errores: ${errorCount}\n`;
        replyText += `\nTotal procesados: ${results.length}`;

        if (results.length > 0) {
          replyText += '\n\nDetalle:';
          for (const r of results.slice(0, 10)) {
            const icon = r.status === 'success' ? '✅' : '❌';
            replyText += `\n${icon} ${r.countryCode} ${r.year} — ${r.status === 'success' ? `${r.changesDetected ?? 0} cambios` : r.error ?? 'error'}`;
          }
        }

        setMessages((prev) => [...prev, { role: 'assistant', text: replyText }]);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Error desconocido';
        setMessages((prev) => [...prev, { role: 'assistant', text: `❌ Error al sincronizar: ${msg}` }]);
      } finally {
        setSyncLoading(false);
      }
    } else if (action.action === 'chat' && 'prompt' in action) {
      // Send as a chat message to the orchestrator
      void handleSend(action.prompt);
    }
  };

  // ── Send handler ──────────────────────────────────────────────────

  const handleSend = async (text: string = input) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const updated: Message[] = [...messages, { role: 'user', text: trimmed }];
    setMessages(updated);
    // Req 3.3: Clear input and disable until response starts arriving
    setInput('');
    setIsLoading(true);
    setActiveAgent(null);
    setStreamingText('');

    try {
      // Build messages array (skip welcome message at index 0)
      const apiMessages = updated.slice(1).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.text,
      }));

      const result = await executeSSEStream(apiMessages);

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: result.reply,
          agentResults: result.results.length > 0 ? result.results : undefined,
          plan: result.plan,
          busHistory: result.busHistory,
        },
      ]);
    } catch (error) {
      if ((error as Error).name === 'AbortError') return;
      console.error('Orchestrate error:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'No pude completar la solicitud. Intenta nuevamente.' },
      ]);
    } finally {
      setIsLoading(false);
      setActiveAgent(null);
      setStreamingText('');
      abortRef.current = null;
    }
  };

  return (
    <>
      {/* FAB */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-40 rounded-2xl p-3.5 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
          style={{
            background: `linear-gradient(135deg, ${colors.secondary}, ${colors.primary})`,
            color: '#23005c',
            boxShadow: `0 0 25px ${colors.primary}4d`,
          }}
        >
          <Bot className="w-5 h-5" />
          <span className="text-sm font-semibold pr-0.5">IA</span>
        </button>
      )}

      {isOpen && (
        <div
          className="fixed inset-y-0 right-0 z-50 w-full sm:w-[420px] flex flex-col animate-in slide-in-from-right-full duration-300"
          style={{
            backgroundColor: colors.surface,
            boxShadow: '0 0 60px rgba(6,14,32,0.8)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-5 py-4 border-b shrink-0"
            style={{
              backgroundColor: colors.surfaceContainer.low,
              borderColor: 'rgba(73,68,84,0.15)',
            }}
          >
            <div className="flex items-center gap-3">
              <AgentAvatar agentId="master" size={38} animate />
              <div>
                <h3 className="font-semibold text-sm" style={{ color: colors.onSurface }}>
                  👑 Dianis
                </h3>
                <div className="flex items-center gap-1.5 text-xs" style={{ color: '#958ea0' }}>
                  <Activity className="w-3 h-3" style={{ color: colors.success }} />
                  Directora · Equipo listo
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={handleClearHistory}
                title="Limpiar historial"
                className="p-2 rounded-full transition-colors"
                style={{ color: '#958ea0' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceContainer.high; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-full transition-colors"
                style={{ color: '#958ea0' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = colors.surfaceContainer.high; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ backgroundColor: colors.surface }}>
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn('flex flex-col max-w-[90%]', msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start')}
              >
                <div
                  className={cn(
                    'p-3.5 rounded-2xl text-sm whitespace-pre-line leading-relaxed',
                    msg.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm',
                  )}
                  style={
                    msg.role === 'user'
                      ? {
                          background: `linear-gradient(135deg, ${colors.secondary}33, ${colors.primary}33)`,
                          color: colors.onSurface,
                        }
                      : {
                          backgroundColor: colors.surfaceContainer.default,
                          color: '#cbc3d7',
                        }
                  }
                >
                  {msg.text}
                </div>

                {/* Req 6.6: Link to view details in logs panel */}
                {msg.role === 'assistant' && i > 0 && (
                  <a
                    href="#live-logs-panel"
                    data-testid="sidebar-log-link"
                    className="mt-2 inline-flex items-center gap-1 text-xs transition-opacity hover:opacity-80"
                    style={{ color: colors.primary }}
                  >
                    <ExternalLink className="w-3 h-3" />
                    Ver detalles en logs
                  </a>
                )}

                {/* Suggestions on welcome message */}
                {msg.role === 'assistant' && i === 0 && (
                  <div className="mt-3 flex flex-col gap-1.5 w-full">
                    <p className="text-[10px] flex items-center gap-1 mb-0.5" style={{ color: '#958ea0' }}>
                      <Sparkles className="w-3 h-3" /> Sugerencias
                    </p>
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s}
                        disabled={isLoading}
                        onClick={() => void handleSend(s)}
                        className="text-left text-xs px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2 group"
                        style={{ backgroundColor: colors.surfaceContainer.default, color: '#cbc3d7' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = colors.surfaceContainer.high;
                          e.currentTarget.style.color = colors.secondary;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = colors.surfaceContainer.default;
                          e.currentTarget.style.color = '#cbc3d7';
                        }}
                      >
                        <BookOpen className="w-3 h-3 shrink-0" style={{ color: '#494454' }} />
                        {s}
                      </button>
                    ))}

                    <p className="text-[10px] flex items-center gap-1 mt-3 mb-0.5" style={{ color: '#958ea0' }}>
                      <Zap className="w-3 h-3" /> Acciones rápidas
                    </p>
                    {AGENT_ACTIONS.map((action) => (
                      <button
                        key={action.label}
                        disabled={isLoading || syncLoading}
                        onClick={() => void handleAgentAction(action)}
                        className="text-left text-xs px-3 py-2.5 rounded-lg transition-colors flex items-start gap-2 group"
                        style={{ backgroundColor: colors.surfaceContainer.default, color: '#cbc3d7' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = colors.surfaceContainer.high;
                          e.currentTarget.style.color = colors.secondary;
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = colors.surfaceContainer.default;
                          e.currentTarget.style.color = '#cbc3d7';
                        }}
                      >
                        <AgentAvatar agentId={action.agentId} size={18} animate={false} />
                        <div className="min-w-0">
                          <span className="block font-medium leading-tight">{action.label}</span>
                          <span className="block text-[10px] mt-0.5 leading-tight" style={{ color: '#958ea0' }}>{action.description}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {/* Req 6.5: Simplified typing indicator — avatar + agent name only */}
            {isLoading && (
              <div className="flex items-center gap-2 mr-auto">
                <div
                  className="rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-2"
                  style={{ backgroundColor: colors.surfaceContainer.default }}
                >
                  <AgentAvatar agentId={activeAgent ?? 'master'} size={22} animate />
                  <span className="text-xs" style={{ color: '#958ea0' }}>
                    {activeAgent
                      ? `${getPersona(activeAgent).emoji} ${getPersona(activeAgent).name} procesando...`
                      : 'Dianis coordinando...'}
                  </span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            className="p-4 border-t shrink-0"
            style={{
              backgroundColor: colors.surfaceContainer.low,
              borderColor: 'rgba(73,68,84,0.15)',
            }}
          >
            <div className="relative flex items-center">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void handleSend()}
                placeholder={isLoading ? 'Procesando...' : 'Escribe un mensaje o instrucción...'}
                disabled={isLoading}
                className="w-full pr-12 pl-4 py-3 rounded-full text-sm transition-all disabled:opacity-70"
                style={{
                  backgroundColor: '#060e20',
                  color: colors.onSurface,
                  outline: 'none',
                }}
                onFocus={(e) => {
                  e.currentTarget.style.boxShadow = `0 0 0 2px ${colors.primary}4d, 0 0 15px ${colors.primary}1a`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.boxShadow = 'none';
                }}
              />
              <button
                onClick={() => void handleSend()}
                disabled={!input.trim() || isLoading}
                className="absolute right-2 p-2 rounded-full transition-all flex items-center justify-center h-8 w-8 my-auto top-0 bottom-0 disabled:opacity-30 hover:opacity-90"
                style={{
                  background: `linear-gradient(135deg, ${colors.secondary}, ${colors.primary})`,
                  color: '#23005c',
                }}
              >
                {isLoading ? (
                  <div className="w-3.5 h-3.5 border-2 border-[#23005c] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <p className="text-[10px] text-center mt-2 flex items-center justify-center gap-1" style={{ color: '#494454' }}>
              <Bot className="w-3 h-3" /> Equipo: Juli · Ana · Wil · Soul · Gyoru
            </p>
          </div>
        </div>
      )}
    </>
  );
}
