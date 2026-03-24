/**
 * Pipeline Stream Emitter — emits Server-Sent Events (SSE) during pipeline execution.
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4
 */

// ── Types ───────────────────────────────────────────────────────────

export type StreamEventType =
  | 'agent-start'
  | 'agent-complete'
  | 'agent-communication'
  | 'plan-updated'
  | 'pipeline-complete'
  | 'clarification-needed'
  | 'error';

export interface StreamEvent {
  type: StreamEventType;
  data: Record<string, unknown>;
  timestamp: number;
}

// ── Encoder ─────────────────────────────────────────────────────────

const encoder = new TextEncoder();

/**
 * Formats a StreamEvent as an SSE-compliant string.
 *
 * SSE format:
 *   event: {type}\n
 *   data: {json}\n
 *   \n
 */
export function formatSSE(event: StreamEvent): string {
  const json = JSON.stringify({ ...event.data, timestamp: event.timestamp });
  return `event: ${event.type}\ndata: ${json}\n\n`;
}

// ── PipelineStreamEmitter ───────────────────────────────────────────

/**
 * Emits SSE events to a WritableStreamDefaultWriter during pipeline execution.
 *
 * Usage:
 *   const { readable, writable } = new TransformStream();
 *   const writer = writable.getWriter();
 *   const emitter = new PipelineStreamEmitter(writer);
 *   emitter.emit({ type: 'agent-start', data: { agentName: 'auditor' }, timestamp: Date.now() });
 *   emitter.close();
 */
export class PipelineStreamEmitter {
  private writer: WritableStreamDefaultWriter<Uint8Array>;
  private closed = false;

  constructor(writer: WritableStreamDefaultWriter<Uint8Array>) {
    this.writer = writer;
  }

  /**
   * Emit a single SSE event. Silently ignores writes after close.
   */
  emit(event: StreamEvent): void {
    if (this.closed) return;

    const sseString = formatSSE(event);
    const bytes = encoder.encode(sseString);

    // Fire-and-forget write — errors are caught so the pipeline isn't interrupted
    // if the client disconnects (Req 11 error handling: pipeline continues).
    this.writer.write(bytes).catch(() => {
      // Client likely disconnected; mark as closed to avoid further writes.
      this.closed = true;
    });
  }

  /**
   * Close the underlying writer. Safe to call multiple times.
   */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.writer.close().catch(() => {
      // Already closed or errored — nothing to do.
    });
  }

  /**
   * Whether the emitter has been closed.
   */
  isClosed(): boolean {
    return this.closed;
  }
}
