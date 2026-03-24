import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { mapSSEEventToLogEntry, type SSEEvent } from './usePipelineStream';

/**
 * Feature: dashboard-redesign, Property 5: Eventos SSE producen entradas de log correctas
 *
 * *For any* SSE event of type `agent-start`, `agent-complete` or `agent-communication`,
 * the function `mapSSEEventToLogEntry` must produce a `LogEntry` with:
 * (a) correct type corresponding to the event,
 * (b) non-null timestamp,
 * (c) non-empty descriptive message, and
 * (d) appropriate metadata according to event type.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 7.1, 7.2, 7.4**
 */

// ── Generators ──────────────────────────────────────────────────────

const KNOWN_AGENT_IDS = [
  'master',
  'auditor',
  'writer',
  'corrector',
  'mapper',
  'payroll-expert',
  'researcher',
] as const;

const arbAgentId = fc.constantFrom(...KNOWN_AGENT_IDS);

const arbPositiveTimestamp = fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER });

const arbAgentStartEvent: fc.Arbitrary<SSEEvent> = fc.record({
  type: fc.constant('agent-start' as const),
  data: fc.record({
    agentName: arbAgentId,
    timestamp: arbPositiveTimestamp,
  }).map((r) => r as Record<string, unknown>),
});

const arbAgentCompleteEvent: fc.Arbitrary<SSEEvent> = fc.record({
  type: fc.constant('agent-complete' as const),
  data: fc
    .record({
      agentName: arbAgentId,
      timestamp: arbPositiveTimestamp,
      success: fc.boolean(),
      tokensUsed: fc.integer({ min: 0, max: 100_000 }),
      latencyMs: fc.integer({ min: 0, max: 60_000 }),
    })
    .map((r) => r as Record<string, unknown>),
});

const arbAgentCommunicationEvent: fc.Arbitrary<SSEEvent> = fc
  .record({
    type: fc.constant('agent-communication' as const),
    data: fc
      .record({
        fromAgent: arbAgentId,
        toAgent: arbAgentId,
        queryType: fc.stringOf(fc.char(), { minLength: 1, maxLength: 50 }),
        timestamp: arbPositiveTimestamp,
      })
      .map((r) => r as Record<string, unknown>),
  });

const arbLoggableSSEEvent: fc.Arbitrary<SSEEvent> = fc.oneof(
  arbAgentStartEvent,
  arbAgentCompleteEvent,
  arbAgentCommunicationEvent,
);

// ── Property Tests ──────────────────────────────────────────────────

describe('Property 5: Eventos SSE producen entradas de log correctas', () => {
  it('(a) returned LogEntry type matches the SSE event type', () => {
    fc.assert(
      fc.property(arbLoggableSSEEvent, (event) => {
        const entry = mapSSEEventToLogEntry(event);
        expect(entry).not.toBeNull();
        expect(entry!.type).toBe(event.type);
      }),
      { numRuns: 100 },
    );
  });

  it('(b) timestamp is non-null and positive', () => {
    fc.assert(
      fc.property(arbLoggableSSEEvent, (event) => {
        const entry = mapSSEEventToLogEntry(event);
        expect(entry).not.toBeNull();
        expect(entry!.timestamp).not.toBeNull();
        expect(entry!.timestamp).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it('(c) message is non-empty', () => {
    fc.assert(
      fc.property(arbLoggableSSEEvent, (event) => {
        const entry = mapSSEEventToLogEntry(event);
        expect(entry).not.toBeNull();
        expect(entry!.message).toBeTruthy();
        expect(entry!.message.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it('(d) agent-complete metadata contains tokensUsed, latencyMs, success', () => {
    fc.assert(
      fc.property(arbAgentCompleteEvent, (event) => {
        const entry = mapSSEEventToLogEntry(event);
        expect(entry).not.toBeNull();
        expect(entry!.metadata).toBeDefined();
        expect(entry!.metadata).toHaveProperty('tokensUsed');
        expect(entry!.metadata).toHaveProperty('latencyMs');
        expect(entry!.metadata).toHaveProperty('success');
        expect(typeof entry!.metadata!.tokensUsed).toBe('number');
        expect(typeof entry!.metadata!.latencyMs).toBe('number');
        expect(typeof entry!.metadata!.success).toBe('boolean');
      }),
      { numRuns: 100 },
    );
  });

  it('(e) agent-communication metadata contains fromAgent, toAgent, queryType', () => {
    fc.assert(
      fc.property(arbAgentCommunicationEvent, (event) => {
        const entry = mapSSEEventToLogEntry(event);
        expect(entry).not.toBeNull();
        expect(entry!.metadata).toBeDefined();
        expect(entry!.metadata).toHaveProperty('fromAgent');
        expect(entry!.metadata).toHaveProperty('toAgent');
        expect(entry!.metadata).toHaveProperty('queryType');
        expect(typeof entry!.metadata!.fromAgent).toBe('string');
        expect(typeof entry!.metadata!.toAgent).toBe('string');
        expect(typeof entry!.metadata!.queryType).toBe('string');
      }),
      { numRuns: 100 },
    );
  });
});

import { calculateBackoffDelay } from './usePipelineStream';

/**
 * Feature: dashboard-redesign, Property 12: Reconexión SSE usa backoff exponencial
 *
 * *For any* reconnection attempt number `n` (where 0 ≤ n < 3), the delay before
 * retry must be `2^n * 1000` milliseconds (1s, 2s, 4s), and after 3 failed
 * attempts the connection must stop.
 *
 * **Validates: Requirements 7.5**
 */

// ── Generators ──────────────────────────────────────────────────────

const arbValidAttempt = fc.integer({ min: 0, max: 2 });

// ── Property Tests ──────────────────────────────────────────────────

describe('Property 12: Reconexión SSE usa backoff exponencial', () => {
  it('delay equals 2^n * 1000 for valid attempt numbers (0 ≤ n < 3)', () => {
    fc.assert(
      fc.property(arbValidAttempt, (attempt) => {
        const delay = calculateBackoffDelay(attempt);
        const expected = Math.pow(2, attempt) * 1000;
        expect(delay).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  it('delay values are strictly 1000, 2000, 4000 for attempts 0, 1, 2 respectively', () => {
    fc.assert(
      fc.property(arbValidAttempt, (attempt) => {
        const delay = calculateBackoffDelay(attempt);
        const expectedDelays = [1000, 2000, 4000];
        expect(delay).toBe(expectedDelays[attempt]);
      }),
      { numRuns: 100 },
    );
  });

  it('each successive attempt delay is exactly double the previous', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1 }), (attempt) => {
        const currentDelay = calculateBackoffDelay(attempt);
        const nextDelay = calculateBackoffDelay(attempt + 1);
        expect(nextDelay).toBe(currentDelay * 2);
      }),
      { numRuns: 100 },
    );
  });
});

import { mapPipelineCompleteToSynthesis } from './usePipelineStream';

/**
 * Feature: dashboard-redesign, Property 6: Pipeline completado produce síntesis completa
 *
 * *For any* `pipeline-complete` event with response data, the `SynthesisResult`
 * produced must contain: non-empty summary, valid risk level (`low`|`medium`|`high`),
 * list of findings, list of recommendations, and list of contributing agents with
 * id, name and emoji.
 *
 * **Validates: Requirements 4.1, 4.4, 7.3**
 */

// ── Generators ──────────────────────────────────────────────────────

const KNOWN_AGENT_IDS_P6 = [
  'master',
  'auditor',
  'writer',
  'corrector',
  'mapper',
  'payroll-expert',
  'researcher',
] as const;

const arbAgentIdP6 = fc.constantFrom(...KNOWN_AGENT_IDS_P6);

const arbRiskLevel = fc.constantFrom('low' as const, 'medium' as const, 'high' as const);

const arbFinding = fc.record({
  description: fc.string({ minLength: 1, maxLength: 200 }),
  severity: fc.constantFrom('low', 'medium', 'high', 'critical'),
});

const arbRecommendation = fc.string({ minLength: 1, maxLength: 200 });

const arbAgentResult = fc.record({
  agentName: arbAgentIdP6,
  success: fc.boolean(),
});

const arbPipelineCompleteEvent: fc.Arbitrary<SSEEvent> = fc
  .record({
    reply: fc.string({ minLength: 1, maxLength: 500 }),
    results: fc.array(arbAgentResult, { minLength: 1, maxLength: 7 }),
    riskLevel: arbRiskLevel,
    findings: fc.array(arbFinding, { minLength: 0, maxLength: 10 }),
    recommendations: fc.array(arbRecommendation, { minLength: 0, maxLength: 10 }),
  })
  .map((response) => ({
    type: 'pipeline-complete' as const,
    data: {
      response: response as unknown as Record<string, unknown>,
    },
  }));

// ── Property Tests ──────────────────────────────────────────────────

describe('Property 6: Pipeline completado produce síntesis completa', () => {
  it('(a) summary is a non-empty string', () => {
    fc.assert(
      fc.property(arbPipelineCompleteEvent, (event) => {
        const result = mapPipelineCompleteToSynthesis(event);
        expect(result).not.toBeNull();
        expect(typeof result!.summary).toBe('string');
        expect(result!.summary.length).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it('(b) riskLevel is one of low, medium, high', () => {
    fc.assert(
      fc.property(arbPipelineCompleteEvent, (event) => {
        const result = mapPipelineCompleteToSynthesis(event);
        expect(result).not.toBeNull();
        expect(['low', 'medium', 'high']).toContain(result!.riskLevel);
      }),
      { numRuns: 100 },
    );
  });

  it('(c) findings is an array', () => {
    fc.assert(
      fc.property(arbPipelineCompleteEvent, (event) => {
        const result = mapPipelineCompleteToSynthesis(event);
        expect(result).not.toBeNull();
        expect(Array.isArray(result!.findings)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('(d) recommendations is an array', () => {
    fc.assert(
      fc.property(arbPipelineCompleteEvent, (event) => {
        const result = mapPipelineCompleteToSynthesis(event);
        expect(result).not.toBeNull();
        expect(Array.isArray(result!.recommendations)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it('(e) contributingAgents contains only successful agents with id, name, and emoji', () => {
    fc.assert(
      fc.property(arbPipelineCompleteEvent, (event) => {
        const result = mapPipelineCompleteToSynthesis(event);
        expect(result).not.toBeNull();

        const response = event.data.response as Record<string, unknown>;
        const results = response.results as Array<{ agentName: string; success: boolean }>;
        const successfulAgentIds = results
          .filter((r) => r.success !== false)
          .map((r) => r.agentName);

        // Every contributing agent must have id, name, and emoji
        for (const agent of result!.contributingAgents) {
          expect(typeof agent.id).toBe('string');
          expect(agent.id.length).toBeGreaterThan(0);
          expect(typeof agent.name).toBe('string');
          expect(agent.name.length).toBeGreaterThan(0);
          expect(typeof agent.emoji).toBe('string');
          expect(agent.emoji.length).toBeGreaterThan(0);
        }

        // Contributing agents should only come from successful results
        const contributingIds = result!.contributingAgents.map((a) => a.id);
        for (const id of contributingIds) {
          expect(successfulAgentIds).toContain(id);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('(f) completedAt is a positive number', () => {
    fc.assert(
      fc.property(arbPipelineCompleteEvent, (event) => {
        const result = mapPipelineCompleteToSynthesis(event);
        expect(result).not.toBeNull();
        expect(typeof result!.completedAt).toBe('number');
        expect(result!.completedAt).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});

import { buildIncrementalSynthesis } from './usePipelineStream';

/**
 * Feature: dashboard-redesign, Property 7: Resultados parciales actualizan síntesis incrementalmente
 *
 * *For any* sequence of `agent-complete` events received before `pipeline-complete`,
 * the synthesis state of the hook must reflect the accumulated partial results,
 * and the number of contributing agents must equal the number of successful unique
 * `agent-complete` events received.
 *
 * **Validates: Requirements 4.2**
 */

// ── Generators ──────────────────────────────────────────────────────

const KNOWN_AGENT_IDS_P7 = [
  'master',
  'auditor',
  'writer',
  'corrector',
  'mapper',
  'payroll-expert',
  'researcher',
] as const;

const arbAgentIdP7 = fc.constantFrom(...KNOWN_AGENT_IDS_P7);

const arbAgentCompleteEventP7 = (agentId: string, success: boolean): SSEEvent => ({
  type: 'agent-complete' as const,
  data: {
    agentName: agentId,
    timestamp: Date.now(),
    success,
    tokensUsed: 100,
    latencyMs: 500,
  } as Record<string, unknown>,
});

/** Generate a sequence of agent-complete events with mixed success/failure */
const arbAgentCompleteSequence: fc.Arbitrary<Array<{ agentId: string; success: boolean }>> = fc
  .array(
    fc.record({
      agentId: arbAgentIdP7,
      success: fc.boolean(),
    }),
    { minLength: 1, maxLength: 7 },
  );

// ── Property Tests ──────────────────────────────────────────────────

describe('Property 7: Resultados parciales actualizan síntesis incrementalmente', () => {
  it('(a) after processing N unique successful agent-complete events, contributingAgents.length equals the number of unique successful agents', () => {
    fc.assert(
      fc.property(arbAgentCompleteSequence, (sequence) => {
        let synthesis = null as ReturnType<typeof buildIncrementalSynthesis> | null;

        for (const { agentId, success } of sequence) {
          const event = arbAgentCompleteEventP7(agentId, success);
          synthesis = buildIncrementalSynthesis(event, synthesis);
        }

        expect(synthesis).not.toBeNull();

        const uniqueSuccessfulAgents = new Set(
          sequence.filter((e) => e.success).map((e) => e.agentId),
        );

        expect(synthesis!.contributingAgents.length).toBe(uniqueSuccessfulAgents.size);
      }),
      { numRuns: 100 },
    );
  });

  it('(b) failed agents are not included in contributingAgents', () => {
    fc.assert(
      fc.property(arbAgentCompleteSequence, (sequence) => {
        let synthesis = null as ReturnType<typeof buildIncrementalSynthesis> | null;

        for (const { agentId, success } of sequence) {
          const event = arbAgentCompleteEventP7(agentId, success);
          synthesis = buildIncrementalSynthesis(event, synthesis);
        }

        expect(synthesis).not.toBeNull();

        // Agents that ONLY appear with success=false should not be in contributingAgents
        const agentsWithSuccess = new Set(
          sequence.filter((e) => e.success).map((e) => e.agentId),
        );
        const contributingIds = new Set(synthesis!.contributingAgents.map((a) => a.id));

        for (const id of contributingIds) {
          expect(agentsWithSuccess.has(id)).toBe(true);
        }
      }),
      { numRuns: 100 },
    );
  });

  it('(c) duplicate agent events do not increase the count', () => {
    fc.assert(
      fc.property(
        arbAgentIdP7,
        fc.integer({ min: 2, max: 5 }),
        (agentId, repeatCount) => {
          let synthesis = null as ReturnType<typeof buildIncrementalSynthesis> | null;

          for (let i = 0; i < repeatCount; i++) {
            const event = arbAgentCompleteEventP7(agentId, true);
            synthesis = buildIncrementalSynthesis(event, synthesis);
          }

          expect(synthesis).not.toBeNull();
          expect(synthesis!.contributingAgents.length).toBe(1);
          expect(synthesis!.contributingAgents[0].id).toBe(agentId);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('(d) each contributing agent has id, name, and emoji', () => {
    fc.assert(
      fc.property(arbAgentCompleteSequence, (sequence) => {
        let synthesis = null as ReturnType<typeof buildIncrementalSynthesis> | null;

        for (const { agentId, success } of sequence) {
          const event = arbAgentCompleteEventP7(agentId, success);
          synthesis = buildIncrementalSynthesis(event, synthesis);
        }

        expect(synthesis).not.toBeNull();

        for (const agent of synthesis!.contributingAgents) {
          expect(typeof agent.id).toBe('string');
          expect(agent.id.length).toBeGreaterThan(0);
          expect(typeof agent.name).toBe('string');
          expect(agent.name.length).toBeGreaterThan(0);
          expect(typeof agent.emoji).toBe('string');
          expect(agent.emoji.length).toBeGreaterThan(0);
        }
      }),
      { numRuns: 100 },
    );
  });
});
