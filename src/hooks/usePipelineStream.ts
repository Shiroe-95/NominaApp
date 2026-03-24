'use client';

import { useState, useCallback, useRef } from 'react';
import { getPersona } from '@/lib/ai/agent-personas';
import type {
  LogEntry,
  SynthesisResult,
  PipelineStreamState,
  UsePipelineStreamReturn,
} from '@/lib/types/pipeline';
import type { StreamEventType } from '@/lib/ai/streaming';

// ── Constants ───────────────────────────────────────────────────────

const MAX_LOG_ENTRIES = 500;
const MAX_RECONNECT_ATTEMPTS = 3;

// ── SSE Event type ──────────────────────────────────────────────────

export interface SSEEvent {
  type: StreamEventType;
  data: Record<string, unknown>;
}

// ── Pure / Testable Functions ───────────────────────────────────────

/**
 * Calculates exponential backoff delay for reconnection attempts.
 * Formula: 2^attempt * 1000 ms → 1000, 2000, 4000
 */
export function calculateBackoffDelay(attempt: number): number {
  return Math.pow(2, attempt) * 1000;
}

/**
 * Maps an SSE event to a LogEntry.
 * Returns null for event types that don't produce log entries (e.g. pipeline-complete, plan-updated).
 */
export function mapSSEEventToLogEntry(event: SSEEvent): LogEntry | null {
  const timestamp = (event.data.timestamp as number) ?? Date.now();
  const baseId = `${event.type}-${timestamp}-${Math.random().toString(36).slice(2, 9)}`;

  switch (event.type) {
    case 'agent-start': {
      const agentId = (event.data.agentName as string) ?? (event.data.agentId as string) ?? 'unknown';
      const persona = getPersona(agentId);
      return {
        id: baseId,
        timestamp,
        type: 'agent-start',
        agentId,
        agentName: persona.name,
        message: `${persona.emoji} ${persona.name} iniciando ejecución`,
      };
    }

    case 'agent-complete': {
      const agentId = (event.data.agentName as string) ?? (event.data.agentId as string) ?? 'unknown';
      const persona = getPersona(agentId);
      const success = (event.data.success as boolean) ?? true;
      const tokensUsed = (event.data.tokensUsed as number) ?? 0;
      const latencyMs = (event.data.latencyMs as number) ?? 0;
      const statusIcon = success ? '✅' : '⚠️';
      return {
        id: baseId,
        timestamp,
        type: 'agent-complete',
        agentId,
        agentName: persona.name,
        message: `${statusIcon} ${persona.emoji} ${persona.name} — ${success ? 'completado' : 'error'}`,
        metadata: {
          tokensUsed,
          latencyMs,
          success,
        },
      };
    }

    case 'agent-communication': {
      const fromAgent = (event.data.fromAgent as string) ?? 'unknown';
      const toAgent = (event.data.toAgent as string) ?? 'unknown';
      const queryType = (event.data.queryType as string) ?? '';
      const fromPersona = getPersona(fromAgent);
      const toPersona = getPersona(toAgent);
      return {
        id: baseId,
        timestamp,
        type: 'agent-communication',
        agentId: fromAgent,
        agentName: fromPersona.name,
        message: `${fromPersona.emoji} ${fromPersona.name} → ${toPersona.emoji} ${toPersona.name}: ${queryType}`,
        metadata: {
          fromAgent,
          toAgent,
          queryType,
        },
      };
    }

    case 'error': {
      const errorMsg = (event.data.error as string) ?? (event.data.message as string) ?? 'Error desconocido';
      return {
        id: baseId,
        timestamp,
        type: 'error',
        message: `❌ Error: ${errorMsg}`,
      };
    }

    default:
      return null;
  }
}

/**
 * Maps a pipeline-complete SSE event to a SynthesisResult.
 * Returns null if the event data doesn't contain a valid response.
 */
export function mapPipelineCompleteToSynthesis(event: SSEEvent): SynthesisResult | null {
  const response = event.data.response as Record<string, unknown> | undefined;
  if (!response) return null;

  const reply = (response.reply as string) ?? '';
  const results = (response.results as Array<Record<string, unknown>>) ?? [];

  // Extract contributing agents from results
  const contributingAgents = results
    .filter((r) => r.agentName && r.success !== false)
    .map((r) => {
      const agentId = r.agentName as string;
      const persona = getPersona(agentId);
      return { id: agentId, name: persona.name, emoji: persona.emoji };
    });

  // Extract findings and recommendations from the response
  const findings = (response.findings as Array<{ description: string; severity: string }>) ?? [];
  const recommendations = (response.recommendations as string[]) ?? [];
  const riskLevel = (response.riskLevel as 'low' | 'medium' | 'high') ?? 'low';

  return {
    summary: reply || 'Análisis completado',
    riskLevel,
    findings,
    recommendations,
    contributingAgents,
    completedAt: Date.now(),
  };
}

/**
 * Builds an incremental SynthesisResult from an agent-complete event,
 * merging with the existing partial synthesis.
 */
export function buildIncrementalSynthesis(
  event: SSEEvent,
  existing: SynthesisResult | null,
): SynthesisResult {
  const agentId = (event.data.agentName as string) ?? (event.data.agentId as string) ?? 'unknown';
  const persona = getPersona(agentId);
  const success = (event.data.success as boolean) ?? true;

  const base: SynthesisResult = existing ?? {
    summary: '',
    riskLevel: 'low',
    findings: [],
    recommendations: [],
    contributingAgents: [],
    completedAt: 0,
  };

  // Only add successful agents to contributing list
  const alreadyContributing = base.contributingAgents.some((a) => a.id === agentId);
  const contributingAgents =
    success && !alreadyContributing
      ? [...base.contributingAgents, { id: agentId, name: persona.name, emoji: persona.emoji }]
      : base.contributingAgents;

  return {
    ...base,
    contributingAgents,
    completedAt: Date.now(),
  };
}

// ── SSE Chunk Parser (extracted from AiSidebar) ─────────────────────

/**
 * Parses an SSE text chunk into individual events.
 * Handles partial chunks by tracking leftover buffer.
 */
export function parseSSEChunk(
  chunk: string,
  buffer: string,
): { events: SSEEvent[]; remaining: string } {
  const text = buffer + chunk;
  const events: SSEEvent[] = [];
  const parts = text.split('\n\n');
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
        // Skip malformed events silently
      }
    }
  }

  return { events, remaining };
}

// ── Append with FIFO limit ──────────────────────────────────────────

function appendLog(logs: LogEntry[], entry: LogEntry): LogEntry[] {
  const updated = [...logs, entry];
  if (updated.length > MAX_LOG_ENTRIES) {
    return updated.slice(updated.length - MAX_LOG_ENTRIES);
  }
  return updated;
}

// ── Hook ────────────────────────────────────────────────────────────

/**
 * Hook that encapsulates SSE pipeline streaming logic.
 *
 * Connects to `/api/ai/orchestrate` via SSE, maps events to LogEntry
 * and SynthesisResult, manages reconnection with exponential backoff,
 * and limits logs to 500 entries (FIFO).
 *
 * @see Requirements 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 7.1, 7.2, 7.3, 7.4, 7.5
 */
export function usePipelineStream(): UsePipelineStreamReturn {
  const [state, setState] = useState<PipelineStreamState>({
    isConnected: false,
    isRunning: false,
    logs: [],
    synthesis: null,
    activeStep: 0,
    activeAgentId: null,
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const synthesisRef = useRef<SynthesisResult | null>(null);

  const clearLogs = useCallback(() => {
    setState((prev) => ({ ...prev, logs: [], synthesis: null, error: null }));
    synthesisRef.current = null;
  }, []);

  const processSSEStream = useCallback(
    async (
      messages: Array<{ role: string; content: string }>,
      context: Record<string, unknown>,
      attempt: number,
      controller: AbortController,
    ): Promise<void> => {
      const res = await fetch('/api/ai/orchestrate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({ type: 'chat', messages, context }),
        signal: controller.signal,
      });

      const contentType = res.headers.get('content-type') ?? '';
      if (!contentType.includes('text/event-stream')) {
        // Fallback: non-SSE response
        if (!res.ok) {
          const data = (await res.json()) as { error?: string };
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        return;
      }

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(errorText || `HTTP ${res.status}`);
      }

      if (!res.body) throw new Error('No response body');

      setState((prev) => ({ ...prev, isConnected: true }));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const { events, remaining } = parseSSEChunk(chunk, sseBuffer);
          sseBuffer = remaining;

          for (const event of events) {
            // Map to log entry for loggable events
            const logEntry = mapSSEEventToLogEntry(event);
            if (logEntry) {
              setState((prev) => ({
                ...prev,
                logs: appendLog(prev.logs, logEntry),
                activeAgentId: logEntry.agentId ?? prev.activeAgentId,
              }));
            }

            // Handle specific event types for state updates
            switch (event.type) {
              case 'agent-start': {
                const agentId =
                  (event.data.agentName as string) ??
                  (event.data.agentId as string) ??
                  null;
                setState((prev) => ({
                  ...prev,
                  activeAgentId: agentId,
                }));
                break;
              }

              case 'agent-complete': {
                // Incremental synthesis update
                synthesisRef.current = buildIncrementalSynthesis(
                  event,
                  synthesisRef.current,
                );
                setState((prev) => ({
                  ...prev,
                  synthesis: synthesisRef.current,
                }));
                break;
              }

              case 'pipeline-complete': {
                const synthesis = mapPipelineCompleteToSynthesis(event);
                if (synthesis) {
                  // Merge contributing agents from incremental with final
                  const incrementalAgents =
                    synthesisRef.current?.contributingAgents ?? [];
                  const finalAgents = synthesis.contributingAgents;
                  // Use final agents if available, otherwise keep incremental
                  synthesis.contributingAgents =
                    finalAgents.length > 0 ? finalAgents : incrementalAgents;
                  synthesisRef.current = synthesis;
                  setState((prev) => ({
                    ...prev,
                    synthesis,
                    isRunning: false,
                    isConnected: false,
                    activeAgentId: null,
                  }));
                } else {
                  setState((prev) => ({
                    ...prev,
                    isRunning: false,
                    isConnected: false,
                    activeAgentId: null,
                  }));
                }
                break;
              }

              case 'error': {
                const fatal = event.data.fatal as boolean;
                if (fatal) {
                  const errorMsg =
                    (event.data.error as string) ?? 'Error fatal';
                  setState((prev) => ({
                    ...prev,
                    error: errorMsg,
                    isRunning: false,
                    isConnected: false,
                  }));
                }
                break;
              }
            }
          }
        }
      } catch (err) {
        // Reconnect on unexpected stream disconnection
        if (
          err instanceof TypeError &&
          attempt < MAX_RECONNECT_ATTEMPTS &&
          !controller.signal.aborted
        ) {
          setState((prev) => ({ ...prev, isConnected: false }));
          const delay = calculateBackoffDelay(attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return processSSEStream(messages, context, attempt + 1, controller);
        }
        throw err;
      }
    },
    [],
  );

  const startPipeline = useCallback(
    (
      messages: Array<{ role: string; content: string }>,
      context?: Record<string, unknown>,
    ) => {
      // Abort any existing connection
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const controller = new AbortController();
      abortRef.current = controller;

      // Reset state for new pipeline run
      synthesisRef.current = null;
      setState({
        isConnected: false,
        isRunning: true,
        logs: [],
        synthesis: null,
        activeStep: 0,
        activeAgentId: null,
        error: null,
      });

      processSSEStream(messages, context ?? {}, 0, controller).catch(
        (err: unknown) => {
          if ((err as Error).name === 'AbortError') return;
          console.error('Pipeline stream error:', err);
          setState((prev) => ({
            ...prev,
            isRunning: false,
            isConnected: false,
            error:
              (err as Error).message ?? 'Error de conexión con el pipeline',
          }));
        },
      );
    },
    [processSSEStream],
  );

  return {
    ...state,
    clearLogs,
    startPipeline,
  };
}
