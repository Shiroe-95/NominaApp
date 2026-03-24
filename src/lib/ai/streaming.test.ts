import { describe, it, expect, vi } from 'vitest';
import {
  PipelineStreamEmitter,
  formatSSE,
  type StreamEvent,
  type StreamEventType,
} from './streaming';

// ── Helpers ─────────────────────────────────────────────────────────

/** Collects bytes written to a mock WritableStreamDefaultWriter. */
function createMockWriter() {
  const chunks: Uint8Array[] = [];
  let closed = false;

  const writer: WritableStreamDefaultWriter<Uint8Array> = {
    write: vi.fn(async (chunk: Uint8Array) => {
      if (closed) throw new Error('Writer is closed');
      chunks.push(chunk);
    }),
    close: vi.fn(async () => {
      closed = true;
    }),
    abort: vi.fn(),
    releaseLock: vi.fn(),
    ready: Promise.resolve(undefined),
    desiredSize: 1,
    closed: Promise.resolve(undefined),
  } as unknown as WritableStreamDefaultWriter<Uint8Array>;

  const decoder = new TextDecoder();
  const getOutput = () => decoder.decode(concatUint8Arrays(chunks));
  const getChunks = () => chunks;

  return { writer, getOutput, getChunks };
}

function concatUint8Arrays(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, a) => sum + a.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

function makeEvent(
  type: StreamEventType,
  data: Record<string, unknown> = {},
  timestamp = 1000,
): StreamEvent {
  return { type, data, timestamp };
}

// ── formatSSE ───────────────────────────────────────────────────────

describe('formatSSE', () => {
  it('formats an event in SSE format with event and data lines', () => {
    const event = makeEvent('agent-start', { agentName: 'auditor' }, 1234);
    const result = formatSSE(event);

    expect(result).toBe(
      'event: agent-start\ndata: {"agentName":"auditor","timestamp":1234}\n\n',
    );
  });

  it('includes timestamp in the data JSON', () => {
    const event = makeEvent('pipeline-complete', {}, 9999);
    const result = formatSSE(event);
    const dataLine = result.split('\n')[1];
    const parsed = JSON.parse(dataLine.replace('data: ', ''));
    expect(parsed.timestamp).toBe(9999);
  });

  it('handles empty data', () => {
    const event = makeEvent('error', {}, 0);
    const result = formatSSE(event);
    expect(result).toContain('event: error\n');
    expect(result).toContain('data: {"timestamp":0}\n');
    expect(result.endsWith('\n\n')).toBe(true);
  });

  it('handles complex nested data', () => {
    const event = makeEvent(
      'agent-complete',
      { result: { findings: 3 }, tokens: 150, latency: 420 },
      5000,
    );
    const result = formatSSE(event);
    const dataLine = result.split('\n')[1];
    const parsed = JSON.parse(dataLine.replace('data: ', ''));
    expect(parsed.result).toEqual({ findings: 3 });
    expect(parsed.tokens).toBe(150);
    expect(parsed.latency).toBe(420);
    expect(parsed.timestamp).toBe(5000);
  });
});

// ── PipelineStreamEmitter ───────────────────────────────────────────

describe('PipelineStreamEmitter', () => {
  it('writes SSE-formatted bytes to the writer on emit', async () => {
    const { writer, getOutput } = createMockWriter();
    const emitter = new PipelineStreamEmitter(writer);

    emitter.emit(makeEvent('agent-start', { agentName: 'auditor' }, 1000));

    // Allow the async write to settle
    await vi.waitFor(() => {
      expect(getOutput()).toContain('event: agent-start');
    });

    expect(getOutput()).toContain('"agentName":"auditor"');
    expect(getOutput()).toContain('"timestamp":1000');
  });

  it('emits multiple events sequentially', async () => {
    const { writer, getOutput, getChunks } = createMockWriter();
    const emitter = new PipelineStreamEmitter(writer);

    emitter.emit(makeEvent('agent-start', { agentName: 'auditor' }));
    emitter.emit(makeEvent('agent-complete', { tokens: 100 }));

    await vi.waitFor(() => {
      expect(getChunks()).toHaveLength(2);
    });

    const output = getOutput();
    expect(output).toContain('event: agent-start');
    expect(output).toContain('event: agent-complete');
  });

  it('emits all supported event types', async () => {
    const { writer, getOutput } = createMockWriter();
    const emitter = new PipelineStreamEmitter(writer);

    const types: StreamEventType[] = [
      'agent-start',
      'agent-complete',
      'agent-communication',
      'plan-updated',
      'pipeline-complete',
      'clarification-needed',
      'error',
    ];

    for (const type of types) {
      emitter.emit(makeEvent(type));
    }

    await vi.waitFor(() => {
      const output = getOutput();
      for (const type of types) {
        expect(output).toContain(`event: ${type}`);
      }
    });
  });

  it('closes the writer on close()', async () => {
    const { writer } = createMockWriter();
    const emitter = new PipelineStreamEmitter(writer);

    emitter.close();

    expect(writer.close).toHaveBeenCalledOnce();
    expect(emitter.isClosed()).toBe(true);
  });

  it('ignores emit calls after close', async () => {
    const { writer } = createMockWriter();
    const emitter = new PipelineStreamEmitter(writer);

    emitter.close();
    emitter.emit(makeEvent('agent-start', { agentName: 'auditor' }));

    // write should only have been called 0 times (no writes after close)
    expect(writer.write).not.toHaveBeenCalled();
  });

  it('is safe to call close() multiple times', () => {
    const { writer } = createMockWriter();
    const emitter = new PipelineStreamEmitter(writer);

    emitter.close();
    emitter.close();
    emitter.close();

    // close should only be called once
    expect(writer.close).toHaveBeenCalledOnce();
  });

  it('isClosed() returns false initially', () => {
    const { writer } = createMockWriter();
    const emitter = new PipelineStreamEmitter(writer);
    expect(emitter.isClosed()).toBe(false);
  });

  it('marks itself closed when writer.write rejects (client disconnect)', async () => {
    const writer: WritableStreamDefaultWriter<Uint8Array> = {
      write: vi.fn(async () => {
        throw new Error('Client disconnected');
      }),
      close: vi.fn(),
      abort: vi.fn(),
      releaseLock: vi.fn(),
      ready: Promise.resolve(undefined),
      desiredSize: 1,
      closed: Promise.resolve(undefined),
    } as unknown as WritableStreamDefaultWriter<Uint8Array>;

    const emitter = new PipelineStreamEmitter(writer);
    emitter.emit(makeEvent('agent-start', { agentName: 'auditor' }));

    // Wait for the async catch to mark it closed
    await vi.waitFor(() => {
      expect(emitter.isClosed()).toBe(true);
    });
  });

  it('emits agent-start with agentName and description (Req 11.2)', async () => {
    const { writer, getOutput } = createMockWriter();
    const emitter = new PipelineStreamEmitter(writer);

    emitter.emit(
      makeEvent('agent-start', {
        agentName: 'auditor',
        description: 'Ejecutar validaciones matemáticas',
      }),
    );

    await vi.waitFor(() => {
      const output = getOutput();
      expect(output).toContain('event: agent-start');
      const dataLine = output.split('\n').find((l) => l.startsWith('data: '))!;
      const parsed = JSON.parse(dataLine.replace('data: ', ''));
      expect(parsed.agentName).toBe('auditor');
      expect(parsed.description).toBe('Ejecutar validaciones matemáticas');
    });
  });

  it('emits agent-complete with result, tokens, and latency (Req 11.3)', async () => {
    const { writer, getOutput } = createMockWriter();
    const emitter = new PipelineStreamEmitter(writer);

    emitter.emit(
      makeEvent('agent-complete', {
        agentName: 'auditor',
        result: 'Found 3 issues',
        tokensUsed: 250,
        latencyMs: 1200,
      }),
    );

    await vi.waitFor(() => {
      const output = getOutput();
      expect(output).toContain('event: agent-complete');
      const dataLine = output.split('\n').find((l) => l.startsWith('data: '))!;
      const parsed = JSON.parse(dataLine.replace('data: ', ''));
      expect(parsed.result).toBe('Found 3 issues');
      expect(parsed.tokensUsed).toBe(250);
      expect(parsed.latencyMs).toBe(1200);
    });
  });

  it('emits agent-communication with agents and message type (Req 11.4)', async () => {
    const { writer, getOutput } = createMockWriter();
    const emitter = new PipelineStreamEmitter(writer);

    emitter.emit(
      makeEvent('agent-communication', {
        fromAgent: 'auditor',
        toAgent: 'corrector',
        queryType: 'cross-validation:numeric-check',
      }),
    );

    await vi.waitFor(() => {
      const output = getOutput();
      expect(output).toContain('event: agent-communication');
      const dataLine = output.split('\n').find((l) => l.startsWith('data: '))!;
      const parsed = JSON.parse(dataLine.replace('data: ', ''));
      expect(parsed.fromAgent).toBe('auditor');
      expect(parsed.toAgent).toBe('corrector');
      expect(parsed.queryType).toBe('cross-validation:numeric-check');
    });
  });
});
