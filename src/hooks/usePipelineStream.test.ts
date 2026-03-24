import { describe, it, expect } from 'vitest';
import {
  calculateBackoffDelay,
  mapSSEEventToLogEntry,
  mapPipelineCompleteToSynthesis,
  buildIncrementalSynthesis,
  parseSSEChunk,
  type SSEEvent,
} from './usePipelineStream';

// ── calculateBackoffDelay ───────────────────────────────────────────

describe('calculateBackoffDelay', () => {
  it('returns 1000ms for attempt 0', () => {
    expect(calculateBackoffDelay(0)).toBe(1000);
  });

  it('returns 2000ms for attempt 1', () => {
    expect(calculateBackoffDelay(1)).toBe(2000);
  });

  it('returns 4000ms for attempt 2', () => {
    expect(calculateBackoffDelay(2)).toBe(4000);
  });
});

// ── mapSSEEventToLogEntry ───────────────────────────────────────────

describe('mapSSEEventToLogEntry', () => {
  it('maps agent-start event to LogEntry', () => {
    const event: SSEEvent = {
      type: 'agent-start',
      data: { agentName: 'auditor', timestamp: 1000 },
    };
    const entry = mapSSEEventToLogEntry(event);
    expect(entry).not.toBeNull();
    expect(entry!.type).toBe('agent-start');
    expect(entry!.agentId).toBe('auditor');
    expect(entry!.agentName).toBe('Juli');
    expect(entry!.timestamp).toBe(1000);
    expect(entry!.message).toContain('Juli');
    expect(entry!.message.length).toBeGreaterThan(0);
  });

  it('maps agent-complete event with metadata', () => {
    const event: SSEEvent = {
      type: 'agent-complete',
      data: {
        agentName: 'corrector',
        success: true,
        tokensUsed: 150,
        latencyMs: 320,
        timestamp: 2000,
      },
    };
    const entry = mapSSEEventToLogEntry(event);
    expect(entry).not.toBeNull();
    expect(entry!.type).toBe('agent-complete');
    expect(entry!.agentId).toBe('corrector');
    expect(entry!.agentName).toBe('Wil');
    expect(entry!.metadata).toEqual({
      tokensUsed: 150,
      latencyMs: 320,
      success: true,
    });
    expect(entry!.message).toContain('completado');
  });

  it('maps agent-complete with failure', () => {
    const event: SSEEvent = {
      type: 'agent-complete',
      data: { agentName: 'mapper', success: false, tokensUsed: 0, latencyMs: 100, timestamp: 3000 },
    };
    const entry = mapSSEEventToLogEntry(event);
    expect(entry!.message).toContain('error');
    expect(entry!.metadata!.success).toBe(false);
  });

  it('maps agent-communication event with from/to metadata', () => {
    const event: SSEEvent = {
      type: 'agent-communication',
      data: {
        fromAgent: 'auditor',
        toAgent: 'corrector',
        queryType: 'correction-request',
        timestamp: 4000,
      },
    };
    const entry = mapSSEEventToLogEntry(event);
    expect(entry).not.toBeNull();
    expect(entry!.type).toBe('agent-communication');
    expect(entry!.metadata!.fromAgent).toBe('auditor');
    expect(entry!.metadata!.toAgent).toBe('corrector');
    expect(entry!.metadata!.queryType).toBe('correction-request');
    expect(entry!.message).toContain('Juli');
    expect(entry!.message).toContain('Wil');
  });

  it('maps error event', () => {
    const event: SSEEvent = {
      type: 'error',
      data: { error: 'Connection timeout', timestamp: 5000 },
    };
    const entry = mapSSEEventToLogEntry(event);
    expect(entry).not.toBeNull();
    expect(entry!.type).toBe('error');
    expect(entry!.message).toContain('Connection timeout');
  });

  it('returns null for pipeline-complete events', () => {
    const event: SSEEvent = {
      type: 'pipeline-complete',
      data: { response: { reply: 'done' } },
    };
    expect(mapSSEEventToLogEntry(event)).toBeNull();
  });

  it('returns null for plan-updated events', () => {
    const event: SSEEvent = {
      type: 'plan-updated',
      data: { totalSteps: 3, version: 1 },
    };
    expect(mapSSEEventToLogEntry(event)).toBeNull();
  });
});

// ── mapPipelineCompleteToSynthesis ──────────────────────────────────

describe('mapPipelineCompleteToSynthesis', () => {
  it('maps pipeline-complete with full response', () => {
    const event: SSEEvent = {
      type: 'pipeline-complete',
      data: {
        response: {
          reply: 'Analysis complete with 3 findings',
          results: [
            { agentName: 'auditor', success: true },
            { agentName: 'corrector', success: true },
          ],
          riskLevel: 'medium',
          findings: [{ description: 'Missing field', severity: 'high' }],
          recommendations: ['Fix the missing field'],
        },
      },
    };
    const synthesis = mapPipelineCompleteToSynthesis(event);
    expect(synthesis).not.toBeNull();
    expect(synthesis!.summary).toBe('Analysis complete with 3 findings');
    expect(synthesis!.riskLevel).toBe('medium');
    expect(synthesis!.findings).toHaveLength(1);
    expect(synthesis!.recommendations).toHaveLength(1);
    expect(synthesis!.contributingAgents).toHaveLength(2);
    expect(synthesis!.contributingAgents[0].name).toBe('Juli');
    expect(synthesis!.completedAt).toBeGreaterThan(0);
  });

  it('returns null when no response in event data', () => {
    const event: SSEEvent = {
      type: 'pipeline-complete',
      data: {},
    };
    expect(mapPipelineCompleteToSynthesis(event)).toBeNull();
  });

  it('filters out failed agents from contributing list', () => {
    const event: SSEEvent = {
      type: 'pipeline-complete',
      data: {
        response: {
          reply: 'Done',
          results: [
            { agentName: 'auditor', success: true },
            { agentName: 'mapper', success: false },
          ],
        },
      },
    };
    const synthesis = mapPipelineCompleteToSynthesis(event);
    expect(synthesis!.contributingAgents).toHaveLength(1);
    expect(synthesis!.contributingAgents[0].id).toBe('auditor');
  });

  it('defaults riskLevel to low when not provided', () => {
    const event: SSEEvent = {
      type: 'pipeline-complete',
      data: { response: { reply: 'OK', results: [] } },
    };
    const synthesis = mapPipelineCompleteToSynthesis(event);
    expect(synthesis!.riskLevel).toBe('low');
  });
});

// ── buildIncrementalSynthesis ───────────────────────────────────────

describe('buildIncrementalSynthesis', () => {
  it('creates new synthesis from first agent-complete', () => {
    const event: SSEEvent = {
      type: 'agent-complete',
      data: { agentName: 'auditor', success: true },
    };
    const result = buildIncrementalSynthesis(event, null);
    expect(result.contributingAgents).toHaveLength(1);
    expect(result.contributingAgents[0].id).toBe('auditor');
    expect(result.contributingAgents[0].name).toBe('Juli');
  });

  it('accumulates agents from multiple events', () => {
    const event1: SSEEvent = {
      type: 'agent-complete',
      data: { agentName: 'auditor', success: true },
    };
    const event2: SSEEvent = {
      type: 'agent-complete',
      data: { agentName: 'corrector', success: true },
    };
    const after1 = buildIncrementalSynthesis(event1, null);
    const after2 = buildIncrementalSynthesis(event2, after1);
    expect(after2.contributingAgents).toHaveLength(2);
  });

  it('does not duplicate agents', () => {
    const event: SSEEvent = {
      type: 'agent-complete',
      data: { agentName: 'auditor', success: true },
    };
    const after1 = buildIncrementalSynthesis(event, null);
    const after2 = buildIncrementalSynthesis(event, after1);
    expect(after2.contributingAgents).toHaveLength(1);
  });

  it('does not add failed agents', () => {
    const event: SSEEvent = {
      type: 'agent-complete',
      data: { agentName: 'mapper', success: false },
    };
    const result = buildIncrementalSynthesis(event, null);
    expect(result.contributingAgents).toHaveLength(0);
  });
});

// ── parseSSEChunk ───────────────────────────────────────────────────

describe('parseSSEChunk', () => {
  it('parses a complete SSE event', () => {
    const chunk = 'event: agent-start\ndata: {"agentName":"auditor"}\n\n';
    const { events, remaining } = parseSSEChunk(chunk, '');
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('agent-start');
    expect(events[0].data.agentName).toBe('auditor');
    expect(remaining).toBe('');
  });

  it('handles multiple events in one chunk', () => {
    const chunk =
      'event: agent-start\ndata: {"agentName":"auditor"}\n\n' +
      'event: agent-complete\ndata: {"agentName":"auditor","success":true}\n\n';
    const { events } = parseSSEChunk(chunk, '');
    expect(events).toHaveLength(2);
    expect(events[0].type).toBe('agent-start');
    expect(events[1].type).toBe('agent-complete');
  });

  it('returns remaining buffer for incomplete events', () => {
    const chunk = 'event: agent-start\ndata: {"agent';
    const { events, remaining } = parseSSEChunk(chunk, '');
    expect(events).toHaveLength(0);
    expect(remaining).toBe('event: agent-start\ndata: {"agent');
  });

  it('combines buffer with new chunk', () => {
    const buffer = 'event: agent-start\ndata: {"agent';
    const chunk = 'Name":"auditor"}\n\n';
    const { events, remaining } = parseSSEChunk(chunk, buffer);
    expect(events).toHaveLength(1);
    expect(events[0].data.agentName).toBe('auditor');
    expect(remaining).toBe('');
  });

  it('skips malformed JSON data', () => {
    const chunk = 'event: agent-start\ndata: {invalid json}\n\n';
    const { events } = parseSSEChunk(chunk, '');
    expect(events).toHaveLength(0);
  });

  it('skips events without data line', () => {
    const chunk = 'event: agent-start\n\n';
    const { events } = parseSSEChunk(chunk, '');
    expect(events).toHaveLength(0);
  });
});
