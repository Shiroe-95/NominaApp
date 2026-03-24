import { describe, it, expect, vi } from 'vitest';
import type { AgentResult } from '../types';
import type { DynamicPlan, PlanAdaptation } from '../plan-serializer';
import {
  buildDynamicPlan,
  evaluateAndAdapt,
  type PlanContext,
} from './dynamic-planner';
import type { UserIntent } from './intent-classifier';

// ── Helpers ─────────────────────────────────────────────────────────

const baseContext: PlanContext = {
  hasPayrollData: true,
  countryCode: 'CO',
};

function makeSuccessResult(agentName: string, data: unknown = {}): AgentResult {
  return {
    agentName,
    success: true,
    data,
    tokensUsed: 100,
    providerUsed: 'test',
    latencyMs: 50,
  };
}

function makeFailureResult(agentName: string, error = 'Agent failed'): AgentResult {
  return {
    agentName,
    success: false,
    data: { error },
    tokensUsed: 0,
    providerUsed: 'test',
    latencyMs: 10,
  };
}

// ── buildDynamicPlan ────────────────────────────────────────────────

describe('buildDynamicPlan', () => {
  it('returns a plan with version 1 and empty adaptations', () => {
    const plan = buildDynamicPlan('audit', baseContext);

    expect(plan.version).toBe(1);
    expect(plan.adaptations).toEqual([]);
  });

  it('builds audit plan with auditor step', () => {
    const plan = buildDynamicPlan('audit', baseContext);

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].agentName).toBe('auditor');
  });

  it('builds mapping plan with mapper step', () => {
    const plan = buildDynamicPlan('mapping', baseContext);

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].agentName).toBe('mapper');
  });

  it('builds consultation plan with payroll-expert step', () => {
    const plan = buildDynamicPlan('consultation', baseContext);

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].agentName).toBe('payroll-expert');
  });

  it('builds correction plan with auditor → corrector', () => {
    const plan = buildDynamicPlan('correction', baseContext);

    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].agentName).toBe('auditor');
    expect(plan.steps[1].agentName).toBe('corrector');
    expect(plan.steps[1].inputFrom).toBe('auditor');
  });

  it('builds report plan with auditor → writer', () => {
    const plan = buildDynamicPlan('report', baseContext);

    expect(plan.steps).toHaveLength(2);
    expect(plan.steps[0].agentName).toBe('auditor');
    expect(plan.steps[1].agentName).toBe('writer');
    expect(plan.steps[1].inputFrom).toBe('auditor');
  });

  it('builds full-analysis plan with auditor → writer → corrector', () => {
    const plan = buildDynamicPlan('full-analysis', baseContext);

    expect(plan.steps).toHaveLength(3);
    expect(plan.steps.map((s) => s.agentName)).toEqual(['auditor', 'writer', 'corrector']);
  });

  it('defaults to payroll-expert for unknown intent', () => {
    const plan = buildDynamicPlan('unknown-intent' as UserIntent, baseContext);

    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].agentName).toBe('payroll-expert');
  });

  it('all steps have a description', () => {
    const intents: UserIntent[] = ['audit', 'mapping', 'consultation', 'correction', 'report', 'full-analysis'];
    for (const intent of intents) {
      const plan = buildDynamicPlan(intent, baseContext);
      for (const step of plan.steps) {
        expect(step.description).toBeTruthy();
      }
    }
  });
});

// ── evaluateAndAdapt ────────────────────────────────────────────────

describe('evaluateAndAdapt', () => {
  // ── Req 7.2: High severity → add corrector ────────────────────

  describe('Req 7.2: high severity findings add corrector', () => {
    it('adds corrector when auditor finds high-severity findings (summary shape)', () => {
      const plan = buildDynamicPlan('audit', baseContext);
      const auditorResult = makeSuccessResult('auditor', {
        summary: { totalFindings: 3, bySeverity: { alta: 2, media: 1, baja: 0 } },
      });

      const adapted = evaluateAndAdapt(plan, auditorResult, 0, baseContext);

      expect(adapted.version).toBe(2);
      expect(adapted.steps.some((s) => s.agentName === 'corrector')).toBe(true);
      expect(adapted.adaptations).toHaveLength(1);
      expect(adapted.adaptations[0].action).toBe('add_step');
      expect(adapted.adaptations[0].trigger).toBe('auditor-high-severity-findings');
    });

    it('adds corrector when auditor finds high-severity findings (findings array shape)', () => {
      const plan = buildDynamicPlan('audit', baseContext);
      const auditorResult = makeSuccessResult('auditor', {
        findings: [
          { severity: 'alta', message: 'Error grave' },
          { severity: 'baja', message: 'Menor' },
        ],
      });

      const adapted = evaluateAndAdapt(plan, auditorResult, 0, baseContext);

      expect(adapted.steps.some((s) => s.agentName === 'corrector')).toBe(true);
    });

    it('does NOT add corrector if already in plan', () => {
      const plan = buildDynamicPlan('correction', baseContext); // already has corrector
      const auditorResult = makeSuccessResult('auditor', {
        summary: { bySeverity: { alta: 5 } },
      });

      const adapted = evaluateAndAdapt(plan, auditorResult, 0, baseContext);

      // Plan should be unchanged
      expect(adapted.version).toBe(plan.version);
      expect(adapted.adaptations).toHaveLength(0);
    });

    it('does NOT add corrector when no high-severity findings', () => {
      const plan = buildDynamicPlan('audit', baseContext);
      const auditorResult = makeSuccessResult('auditor', {
        summary: { bySeverity: { alta: 0, media: 3, baja: 1 } },
      });

      const adapted = evaluateAndAdapt(plan, auditorResult, 0, baseContext);

      expect(adapted.version).toBe(plan.version);
      expect(adapted.steps.some((s) => s.agentName === 'corrector')).toBe(false);
    });

    it('corrector step has inputFrom auditor', () => {
      const plan = buildDynamicPlan('audit', baseContext);
      const auditorResult = makeSuccessResult('auditor', {
        summary: { bySeverity: { alta: 1 } },
      });

      const adapted = evaluateAndAdapt(plan, auditorResult, 0, baseContext);
      const correctorStep = adapted.steps.find((s) => s.agentName === 'corrector');

      expect(correctorStep?.inputFrom).toBe('auditor');
    });
  });

  // ── Req 7.3: Non-deterministic findings → add payroll-expert ──

  describe('Req 7.3: non-deterministic findings add payroll-expert', () => {
    it('adds payroll-expert when corrector has skipped > 0', () => {
      const plan = buildDynamicPlan('correction', baseContext);
      const correctorResult = makeSuccessResult('corrector', {
        corrections: [{ field: 'salario', corrected: 1000 }],
        skipped: 2,
      });

      const adapted = evaluateAndAdapt(plan, correctorResult, 1, baseContext);

      expect(adapted.steps.some((s) => s.agentName === 'payroll-expert')).toBe(true);
      expect(adapted.adaptations).toHaveLength(1);
      expect(adapted.adaptations[0].trigger).toBe('corrector-non-deterministic-findings');
    });

    it('does NOT add payroll-expert when skipped is 0', () => {
      const plan = buildDynamicPlan('correction', baseContext);
      const correctorResult = makeSuccessResult('corrector', {
        corrections: [{ field: 'salario', corrected: 1000 }],
        skipped: 0,
      });

      const adapted = evaluateAndAdapt(plan, correctorResult, 1, baseContext);

      expect(adapted.steps.some((s) => s.agentName === 'payroll-expert')).toBe(false);
    });

    it('does NOT add payroll-expert if already in plan', () => {
      // Build a plan that already has payroll-expert
      const plan: DynamicPlan = {
        steps: [
          { agentName: 'auditor', description: 'Audit' },
          { agentName: 'corrector', inputFrom: 'auditor', description: 'Correct' },
          { agentName: 'payroll-expert', description: 'Expert' },
        ],
        version: 1,
        adaptations: [],
      };
      const correctorResult = makeSuccessResult('corrector', { skipped: 3 });

      const adapted = evaluateAndAdapt(plan, correctorResult, 1, baseContext);

      expect(adapted.version).toBe(plan.version);
    });

    it('payroll-expert step has inputFrom corrector', () => {
      const plan = buildDynamicPlan('correction', baseContext);
      const correctorResult = makeSuccessResult('corrector', { skipped: 1 });

      const adapted = evaluateAndAdapt(plan, correctorResult, 1, baseContext);
      const expertStep = adapted.steps.find((s) => s.agentName === 'payroll-expert');

      expect(expertStep?.inputFrom).toBe('corrector');
    });
  });

  // ── Req 7.4: Agent failure → plan unchanged ───────────────────

  describe('Req 7.4: agent failure does not modify plan', () => {
    it('returns plan unchanged when agent fails', () => {
      const plan = buildDynamicPlan('audit', baseContext);
      const failedResult = makeFailureResult('auditor');

      const adapted = evaluateAndAdapt(plan, failedResult, 0, baseContext);

      expect(adapted).toBe(plan); // same reference — no modification
      expect(adapted.version).toBe(1);
      expect(adapted.adaptations).toHaveLength(0);
    });

    it('does not add corrector even if auditor fails with high-severity data', () => {
      const plan = buildDynamicPlan('audit', baseContext);
      const failedResult: AgentResult = {
        agentName: 'auditor',
        success: false,
        data: { summary: { bySeverity: { alta: 5 } }, error: 'Timeout' },
        tokensUsed: 0,
        providerUsed: 'test',
        latencyMs: 0,
      };

      const adapted = evaluateAndAdapt(plan, failedResult, 0, baseContext);

      expect(adapted.steps.some((s) => s.agentName === 'corrector')).toBe(false);
    });
  });

  // ── Req 7.5: Plan modification notifies via callback ──────────

  describe('Req 7.5: plan modification notifies via callback', () => {
    it('calls onPlanUpdated when plan is adapted', () => {
      const onPlanUpdated = vi.fn();
      const ctx: PlanContext = { ...baseContext, onPlanUpdated };
      const plan = buildDynamicPlan('audit', ctx);
      const auditorResult = makeSuccessResult('auditor', {
        summary: { bySeverity: { alta: 1 } },
      });

      evaluateAndAdapt(plan, auditorResult, 0, ctx);

      expect(onPlanUpdated).toHaveBeenCalledTimes(1);
      const [updatedPlan, adaptation] = onPlanUpdated.mock.calls[0] as [DynamicPlan, PlanAdaptation];
      expect(updatedPlan.version).toBe(2);
      expect(adaptation.action).toBe('add_step');
    });

    it('does NOT call onPlanUpdated when plan is not adapted', () => {
      const onPlanUpdated = vi.fn();
      const ctx: PlanContext = { ...baseContext, onPlanUpdated };
      const plan = buildDynamicPlan('audit', ctx);
      const auditorResult = makeSuccessResult('auditor', {
        summary: { bySeverity: { alta: 0 } },
      });

      evaluateAndAdapt(plan, auditorResult, 0, ctx);

      expect(onPlanUpdated).not.toHaveBeenCalled();
    });

    it('works without onPlanUpdated callback (optional)', () => {
      const plan = buildDynamicPlan('audit', baseContext);
      const auditorResult = makeSuccessResult('auditor', {
        summary: { bySeverity: { alta: 1 } },
      });

      // Should not throw
      const adapted = evaluateAndAdapt(plan, auditorResult, 0, baseContext);
      expect(adapted.version).toBe(2);
    });

    it('works without context parameter', () => {
      const plan = buildDynamicPlan('audit', baseContext);
      const auditorResult = makeSuccessResult('auditor', {
        summary: { bySeverity: { alta: 1 } },
      });

      // No context passed — should not throw
      const adapted = evaluateAndAdapt(plan, auditorResult, 0);
      expect(adapted.version).toBe(2);
    });
  });

  // ── Immutability ──────────────────────────────────────────────

  describe('immutability', () => {
    it('does not mutate the original plan when adapting', () => {
      const plan = buildDynamicPlan('audit', baseContext);
      const originalStepsLength = plan.steps.length;
      const auditorResult = makeSuccessResult('auditor', {
        summary: { bySeverity: { alta: 1 } },
      });

      const adapted = evaluateAndAdapt(plan, auditorResult, 0, baseContext);

      expect(plan.steps.length).toBe(originalStepsLength);
      expect(adapted.steps.length).toBe(originalStepsLength + 1);
      expect(plan.version).toBe(1);
      expect(adapted.version).toBe(2);
    });
  });

  // ── Version tracking ──────────────────────────────────────────

  describe('version tracking', () => {
    it('increments version on each adaptation', () => {
      let plan = buildDynamicPlan('audit', baseContext);
      expect(plan.version).toBe(1);

      // First adaptation: auditor high severity → add corrector
      const auditorResult = makeSuccessResult('auditor', {
        summary: { bySeverity: { alta: 1 } },
      });
      plan = evaluateAndAdapt(plan, auditorResult, 0, baseContext);
      expect(plan.version).toBe(2);

      // Second adaptation: corrector skipped → add payroll-expert
      const correctorResult = makeSuccessResult('corrector', { skipped: 2 });
      plan = evaluateAndAdapt(plan, correctorResult, 1, baseContext);
      expect(plan.version).toBe(3);
    });

    it('accumulates adaptations across multiple evaluations', () => {
      let plan = buildDynamicPlan('audit', baseContext);

      const auditorResult = makeSuccessResult('auditor', {
        summary: { bySeverity: { alta: 1 } },
      });
      plan = evaluateAndAdapt(plan, auditorResult, 0, baseContext);

      const correctorResult = makeSuccessResult('corrector', { skipped: 1 });
      plan = evaluateAndAdapt(plan, correctorResult, 1, baseContext);

      expect(plan.adaptations).toHaveLength(2);
      expect(plan.adaptations[0].trigger).toBe('auditor-high-severity-findings');
      expect(plan.adaptations[1].trigger).toBe('corrector-non-deterministic-findings');
    });
  });

  // ── Non-triggering agents ─────────────────────────────────────

  describe('non-triggering agents', () => {
    it('does not adapt for writer results', () => {
      const plan = buildDynamicPlan('report', baseContext);
      const writerResult = makeSuccessResult('writer', {
        executiveSummary: 'Report generated',
      });

      const adapted = evaluateAndAdapt(plan, writerResult, 1, baseContext);

      expect(adapted).toBe(plan);
    });

    it('does not adapt for mapper results', () => {
      const plan = buildDynamicPlan('mapping', baseContext);
      const mapperResult = makeSuccessResult('mapper', {
        totalColumns: 10,
        synonymMatches: 8,
      });

      const adapted = evaluateAndAdapt(plan, mapperResult, 0, baseContext);

      expect(adapted).toBe(plan);
    });

    it('does not adapt for payroll-expert results', () => {
      const plan = buildDynamicPlan('consultation', baseContext);
      const expertResult = makeSuccessResult('payroll-expert', {
        reply: 'Here is the answer',
      });

      const adapted = evaluateAndAdapt(plan, expertResult, 0, baseContext);

      expect(adapted).toBe(plan);
    });
  });
});
