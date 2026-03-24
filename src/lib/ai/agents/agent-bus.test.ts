import { describe, it, expect, vi } from 'vitest';
import type { AgentResult } from '@/lib/ai/types';
import {
  AgentBus,
  AgentBusV2,
  type AgentBusConfig,
  type AgentBusV2Config,
  type AgentMessage,
  type CrossValidationRequest,
} from './agent-bus';

// ── Helpers ─────────────────────────────────────────────────────────

function makeConfig(overrides?: Partial<AgentBusConfig>): AgentBusConfig {
  return { maxDepth: 5, timeout: 30_000, sessionId: 'test-session', ...overrides };
}

function makeV2Config(overrides?: Partial<AgentBusV2Config>): AgentBusV2Config {
  return { maxDepth: 5, timeout: 30_000, sessionId: 'test-session', ...overrides };
}

function successResult(agentName: string, data: unknown = {}): AgentResult {
  return { agentName, success: true, data, tokensUsed: 10, providerUsed: 'test', latencyMs: 5 };
}

// ── AgentBus (base) ─────────────────────────────────────────────────

describe('AgentBus', () => {
  it('routes a message to a registered agent', async () => {
    const bus = new AgentBus(makeConfig());
    bus.register('agentA', async () => successResult('agentA', { answer: 42 }));

    const result = await bus.send({ fromAgent: 'caller', toAgent: 'agentA', queryType: 'query', payload: {} });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ answer: 42 });
  });

  it('returns error for unregistered agent', async () => {
    const bus = new AgentBus(makeConfig());

    const result = await bus.send({ fromAgent: 'caller', toAgent: 'unknown', queryType: 'query', payload: {} });

    expect(result.success).toBe(false);
    expect(result.data).toEqual({ error: 'Agent unknown not found' });
  });

  it('records messages in history with timestamp', async () => {
    const bus = new AgentBus(makeConfig());
    bus.register('agentA', async () => successResult('agentA'));

    await bus.send({ fromAgent: 'caller', toAgent: 'agentA', queryType: 'query', payload: { x: 1 } });

    const history = bus.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].fromAgent).toBe('caller');
    expect(history[0].toAgent).toBe('agentA');
    expect(history[0].queryType).toBe('query');
    expect(history[0].payload).toEqual({ x: 1 });
    expect(history[0].timestamp).toBeInstanceOf(Date);
  });

  it('prevents cycles when depth exceeds maxDepth', async () => {
    const bus = new AgentBus(makeConfig({ maxDepth: 2 }));

    // agentA calls agentB, agentB calls agentC — that's depth 2, so agentC should be blocked
    bus.register('agentA', async () => {
      return bus.send({ fromAgent: 'agentA', toAgent: 'agentB', queryType: 'chain', payload: {} });
    });
    bus.register('agentB', async () => {
      return bus.send({ fromAgent: 'agentB', toAgent: 'agentC', queryType: 'chain', payload: {} });
    });
    bus.register('agentC', async () => successResult('agentC'));

    const result = await bus.send({ fromAgent: 'caller', toAgent: 'agentA', queryType: 'start', payload: {} });

    expect(result.success).toBe(false);
    expect(result.data).toEqual({ error: 'Max depth exceeded - possible cycle detected' });
  });

  it('returns error on timeout without blocking', async () => {
    const bus = new AgentBus(makeConfig({ timeout: 50 }));
    bus.register('slow', async () => {
      await new Promise((r) => setTimeout(r, 200));
      return successResult('slow');
    });

    const start = Date.now();
    const result = await bus.send({ fromAgent: 'caller', toAgent: 'slow', queryType: 'query', payload: {} });
    const elapsed = Date.now() - start;

    expect(result.success).toBe(false);
    expect((result.data as Record<string, unknown>).error).toContain('timed out');
    // Should resolve close to the timeout, not the handler's 200ms
    expect(elapsed).toBeLessThan(150);
  });

  it('depth resets after a call completes', async () => {
    const bus = new AgentBus(makeConfig({ maxDepth: 5 }));
    bus.register('agentA', async () => successResult('agentA'));

    await bus.send({ fromAgent: 'caller', toAgent: 'agentA', queryType: 'q', payload: {} });
    expect(bus.getDepth()).toBe(0);
  });
});

// ── AgentBusV2 ──────────────────────────────────────────────────────

describe('AgentBusV2', () => {
  it('extends AgentBus — register and send still work', async () => {
    const bus = new AgentBusV2(makeV2Config());
    bus.register('agentA', async () => successResult('agentA', { ok: true }));

    const result = await bus.send({ fromAgent: 'caller', toAgent: 'agentA', queryType: 'q', payload: {} });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({ ok: true });
  });

  describe('sendWithEvent', () => {
    it('calls onMessage callback with the full message before routing', async () => {
      const captured: AgentMessage[] = [];
      const bus = new AgentBusV2(makeV2Config({ onMessage: (msg) => captured.push(msg) }));
      bus.register('agentA', async () => successResult('agentA'));

      await bus.sendWithEvent({ fromAgent: 'caller', toAgent: 'agentA', queryType: 'q', payload: { x: 1 } });

      expect(captured).toHaveLength(1);
      expect(captured[0].fromAgent).toBe('caller');
      expect(captured[0].toAgent).toBe('agentA');
      expect(captured[0].timestamp).toBeInstanceOf(Date);
    });

    it('routes the message and returns the agent result', async () => {
      const bus = new AgentBusV2(makeV2Config());
      bus.register('agentA', async () => successResult('agentA', { val: 99 }));

      const result = await bus.sendWithEvent({ fromAgent: 'caller', toAgent: 'agentA', queryType: 'q', payload: {} });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ val: 99 });
    });

    it('records the message in history', async () => {
      const bus = new AgentBusV2(makeV2Config());
      bus.register('agentA', async () => successResult('agentA'));

      await bus.sendWithEvent({ fromAgent: 'caller', toAgent: 'agentA', queryType: 'q', payload: {} });

      const history = bus.getHistory();
      // sendWithEvent delegates to send, which records in history
      expect(history.length).toBeGreaterThanOrEqual(1);
      expect(history.some((m) => m.fromAgent === 'caller' && m.toAgent === 'agentA')).toBe(true);
    });

    it('works without onMessage callback (optional)', async () => {
      const bus = new AgentBusV2(makeV2Config()); // no onMessage
      bus.register('agentA', async () => successResult('agentA'));

      const result = await bus.sendWithEvent({ fromAgent: 'caller', toAgent: 'agentA', queryType: 'q', payload: {} });
      expect(result.success).toBe(true);
    });

    it('respects depth limit and timeout like base send', async () => {
      const bus = new AgentBusV2(makeV2Config({ maxDepth: 1, timeout: 50 }));

      // Depth: register agent that calls another via sendWithEvent
      bus.register('agentA', async () => {
        return bus.sendWithEvent({ fromAgent: 'agentA', toAgent: 'agentB', queryType: 'chain', payload: {} });
      });
      bus.register('agentB', async () => successResult('agentB'));

      const result = await bus.sendWithEvent({ fromAgent: 'caller', toAgent: 'agentA', queryType: 'start', payload: {} });
      // agentA's nested call to agentB should be blocked at depth 1
      expect(result.success).toBe(false);
      expect((result.data as Record<string, unknown>).error).toContain('Max depth exceeded');
    });
  });

  describe('requestCrossValidation', () => {
    it('sends a cross-validation message and returns structured result', async () => {
      const bus = new AgentBusV2(makeV2Config());
      bus.register('auditor', async () =>
        successResult('auditor', { isConsistent: true }),
      );

      const request: CrossValidationRequest = {
        fromAgent: 'corrector',
        toAgent: 'auditor',
        dataToValidate: { salary: 5000 },
        validationType: 'numeric-check',
      };

      const result = await bus.requestCrossValidation(request);
      expect(result.isConsistent).toBe(true);
      expect(result.discrepancies).toBeUndefined();
    });

    it('returns discrepancies when validation finds inconsistencies', async () => {
      const bus = new AgentBusV2(makeV2Config());
      bus.register('auditor', async () =>
        successResult('auditor', {
          isConsistent: false,
          discrepancies: ['Salary mismatch: expected 5000, got 4500'],
        }),
      );

      const request: CrossValidationRequest = {
        fromAgent: 'corrector',
        toAgent: 'auditor',
        dataToValidate: { salary: 4500 },
        validationType: 'numeric-check',
      };

      const result = await bus.requestCrossValidation(request);
      expect(result.isConsistent).toBe(false);
      expect(result.discrepancies).toEqual(['Salary mismatch: expected 5000, got 4500']);
    });

    it('returns failure when target agent is not registered', async () => {
      const bus = new AgentBusV2(makeV2Config());

      const request: CrossValidationRequest = {
        fromAgent: 'corrector',
        toAgent: 'nonexistent',
        dataToValidate: {},
        validationType: 'correction-verify',
      };

      const result = await bus.requestCrossValidation(request);
      expect(result.isConsistent).toBe(false);
      expect(result.discrepancies).toBeDefined();
      expect(result.discrepancies![0]).toContain('not found');
    });

    it('uses correct queryType format for validation type', async () => {
      const captured: AgentMessage[] = [];
      const bus = new AgentBusV2(makeV2Config({ onMessage: (msg) => captured.push(msg) }));
      bus.register('auditor', async () => successResult('auditor', { isConsistent: true }));

      await bus.requestCrossValidation({
        fromAgent: 'writer',
        toAgent: 'auditor',
        dataToValidate: {},
        validationType: 'report-data-check',
      });

      expect(captured[0].queryType).toBe('cross-validation:report-data-check');
    });

    it('returns isConsistent true when agent returns unstructured success data', async () => {
      const bus = new AgentBusV2(makeV2Config());
      bus.register('agentA', async () => successResult('agentA', 'some string result'));

      const result = await bus.requestCrossValidation({
        fromAgent: 'caller',
        toAgent: 'agentA',
        dataToValidate: {},
        validationType: 'correction-verify',
      });

      // Fallback: unstructured data treated as consistent
      expect(result.isConsistent).toBe(true);
    });

    it('returns failure with error message when agent times out', async () => {
      const bus = new AgentBusV2(makeV2Config({ timeout: 50 }));
      bus.register('slow', async () => {
        await new Promise((r) => setTimeout(r, 200));
        return successResult('slow', { isConsistent: true });
      });

      const result = await bus.requestCrossValidation({
        fromAgent: 'caller',
        toAgent: 'slow',
        dataToValidate: {},
        validationType: 'numeric-check',
      });

      expect(result.isConsistent).toBe(false);
      expect(result.discrepancies![0]).toContain('timed out');
    });
  });
});
