import { describe, it, expect } from 'vitest';
import {
  serializePlan,
  deserializePlan,
  type DynamicPlan,
  type PlanAdaptation,
} from './plan-serializer';

// ── Helpers ─────────────────────────────────────────────────────────

function minimalPlan(overrides: Partial<DynamicPlan> = {}): DynamicPlan {
  return {
    steps: [{ agentName: 'auditor', description: 'Run audit' }],
    version: 1,
    adaptations: [],
    ...overrides,
  };
}

// ── serializePlan ───────────────────────────────────────────────────

describe('serializePlan', () => {
  it('produces valid JSON', () => {
    const json = serializePlan(minimalPlan());
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('includes all steps with agentName and description', () => {
    const plan = minimalPlan({
      steps: [
        { agentName: 'auditor', description: 'Audit payroll' },
        { agentName: 'corrector', inputFrom: 'auditor', description: 'Fix issues' },
      ],
    });
    const parsed = JSON.parse(serializePlan(plan));
    expect(parsed.steps).toHaveLength(2);
    expect(parsed.steps[0].agentName).toBe('auditor');
    expect(parsed.steps[1].inputFrom).toBe('auditor');
  });

  it('includes version and adaptations', () => {
    const adaptation: PlanAdaptation = {
      trigger: 'high-severity findings',
      action: 'add_step',
      stepAdded: { agentName: 'corrector', description: 'Auto-correct' },
      reason: 'Critical findings detected',
    };
    const plan = minimalPlan({ version: 3, adaptations: [adaptation] });
    const parsed = JSON.parse(serializePlan(plan));
    expect(parsed.version).toBe(3);
    expect(parsed.adaptations).toHaveLength(1);
    expect(parsed.adaptations[0].action).toBe('add_step');
    expect(parsed.adaptations[0].stepAdded.agentName).toBe('corrector');
  });

  it('omits inputFrom when undefined', () => {
    const plan = minimalPlan({
      steps: [{ agentName: 'auditor', description: 'Audit' }],
    });
    const parsed = JSON.parse(serializePlan(plan));
    expect(parsed.steps[0]).not.toHaveProperty('inputFrom');
  });

  it('omits stepAdded when undefined in adaptation', () => {
    const plan = minimalPlan({
      adaptations: [
        { trigger: 'rebalance', action: 'reorder', reason: 'Priority change' },
      ],
    });
    const parsed = JSON.parse(serializePlan(plan));
    expect(parsed.adaptations[0]).not.toHaveProperty('stepAdded');
  });
});

// ── deserializePlan ─────────────────────────────────────────────────

describe('deserializePlan', () => {
  it('reconstructs a plan from valid JSON', () => {
    const original = minimalPlan({
      steps: [
        { agentName: 'auditor', description: 'Audit' },
        { agentName: 'writer', inputFrom: 'auditor', description: 'Write report' },
      ],
      version: 2,
      adaptations: [
        {
          trigger: 'high severity',
          action: 'add_step',
          stepAdded: { agentName: 'corrector', description: 'Fix' },
          reason: 'Auto-fix needed',
        },
      ],
    });
    const result = deserializePlan(serializePlan(original));
    expect(result).toEqual(original);
  });

  it('throws on invalid JSON', () => {
    expect(() => deserializePlan('not json')).toThrow('Invalid JSON');
  });

  it('throws on missing steps', () => {
    const json = JSON.stringify({ version: 1, adaptations: [] });
    expect(() => deserializePlan(json)).toThrow('Invalid plan structure');
  });

  it('throws on missing version', () => {
    const json = JSON.stringify({ steps: [], adaptations: [] });
    expect(() => deserializePlan(json)).toThrow('Invalid plan structure');
  });

  it('throws on invalid step (missing agentName)', () => {
    const json = JSON.stringify({
      steps: [{ description: 'no agent' }],
      version: 1,
      adaptations: [],
    });
    expect(() => deserializePlan(json)).toThrow('Invalid plan structure');
  });

  it('throws on invalid adaptation action', () => {
    const json = JSON.stringify({
      steps: [],
      version: 1,
      adaptations: [{ trigger: 'x', action: 'invalid', reason: 'y' }],
    });
    expect(() => deserializePlan(json)).toThrow('Invalid plan structure');
  });

  it('handles empty steps and adaptations', () => {
    const plan = minimalPlan({ steps: [], adaptations: [] });
    const result = deserializePlan(serializePlan(plan));
    expect(result.steps).toEqual([]);
    expect(result.adaptations).toEqual([]);
  });

  it('preserves inputFrom in stepAdded within adaptations', () => {
    const plan = minimalPlan({
      adaptations: [
        {
          trigger: 'test',
          action: 'add_step',
          stepAdded: {
            agentName: 'corrector',
            inputFrom: 'auditor',
            description: 'Fix after audit',
          },
          reason: 'Needed',
        },
      ],
    });
    const result = deserializePlan(serializePlan(plan));
    expect(result.adaptations[0].stepAdded?.inputFrom).toBe('auditor');
  });
});

// ── Round-trip (Req 13.3) ───────────────────────────────────────────

describe('round-trip: serialize → deserialize', () => {
  it('produces an equivalent plan for a complex example', () => {
    const plan: DynamicPlan = {
      steps: [
        { agentName: 'mapper', description: 'Map columns' },
        { agentName: 'auditor', inputFrom: 'mapper', description: 'Audit data' },
        { agentName: 'corrector', inputFrom: 'auditor', description: 'Correct issues' },
        { agentName: 'writer', inputFrom: 'corrector', description: 'Generate report' },
      ],
      version: 5,
      adaptations: [
        {
          trigger: 'high-severity findings from auditor',
          action: 'add_step',
          stepAdded: { agentName: 'payroll-expert', inputFrom: 'auditor', description: 'Consult expert' },
          reason: 'Critical findings require expert review',
        },
        {
          trigger: 'rebalance after expert',
          action: 'reorder',
          reason: 'Expert step inserted before corrector',
        },
        {
          trigger: 'redundant step',
          action: 'remove_step',
          reason: 'Duplicate agent removed',
        },
      ],
    };

    const result = deserializePlan(serializePlan(plan));
    expect(result).toEqual(plan);
  });
});
