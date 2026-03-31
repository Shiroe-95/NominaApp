/**
 * Property-Based Tests for Plan Serializer
 * Feature: platform-improvements, Property 12: Plan Serializer round-trip
 *
 * Validates: Requirements 4.3
 * For any valid DynamicPlan, deserializePlan(serializePlan(plan)) === plan.
 *
 * Uses fast-check with minimum 100 iterations.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  serializePlan,
  deserializePlan,
} from './plan-serializer';
import type { DynamicPlan, PlanStep, PlanAdaptation } from './plan-serializer';

const NUM_RUNS = 100;

// ── Generators ──────────────────────────────────────────────────────

const nonEmptyString = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

const planStepArb: fc.Arbitrary<PlanStep> = fc.record({
  agentName: nonEmptyString,
  description: fc.string({ maxLength: 100 }),
  inputFrom: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: undefined }),
});

const planAdaptationArb: fc.Arbitrary<PlanAdaptation> = fc.record({
  trigger: fc.string({ maxLength: 50 }),
  action: fc.constantFrom('add_step' as const, 'remove_step' as const, 'reorder' as const),
  reason: fc.string({ maxLength: 100 }),
  stepAdded: fc.option(planStepArb, { nil: undefined }),
});

const dynamicPlanArb: fc.Arbitrary<DynamicPlan> = fc.record({
  steps: fc.array(planStepArb, { minLength: 1, maxLength: 10 }),
  version: fc.integer({ min: 1, max: 1000 }),
  adaptations: fc.array(planAdaptationArb, { minLength: 0, maxLength: 5 }),
});

// ── Property 12: Plan Serializer Round-Trip ─────────────────────────

describe('Feature: platform-improvements, Property 12: Plan Serializer round-trip', () => {
  it('deserializePlan(serializePlan(plan)) produces an equivalent plan', () => {
    fc.assert(
      fc.property(dynamicPlanArb, (plan) => {
        const serialized = serializePlan(plan);
        const deserialized = deserializePlan(serialized);

        expect(deserialized.version).toBe(plan.version);
        expect(deserialized.steps).toHaveLength(plan.steps.length);
        expect(deserialized.adaptations).toHaveLength(plan.adaptations.length);

        // Verify each step
        for (let i = 0; i < plan.steps.length; i++) {
          expect(deserialized.steps[i].agentName).toBe(plan.steps[i].agentName);
          expect(deserialized.steps[i].description).toBe(plan.steps[i].description);
          expect(deserialized.steps[i].inputFrom).toBe(plan.steps[i].inputFrom);
        }

        // Verify each adaptation
        for (let i = 0; i < plan.adaptations.length; i++) {
          expect(deserialized.adaptations[i].trigger).toBe(plan.adaptations[i].trigger);
          expect(deserialized.adaptations[i].action).toBe(plan.adaptations[i].action);
          expect(deserialized.adaptations[i].reason).toBe(plan.adaptations[i].reason);

          if (plan.adaptations[i].stepAdded) {
            expect(deserialized.adaptations[i].stepAdded).toBeDefined();
            expect(deserialized.adaptations[i].stepAdded!.agentName).toBe(
              plan.adaptations[i].stepAdded!.agentName,
            );
            expect(deserialized.adaptations[i].stepAdded!.description).toBe(
              plan.adaptations[i].stepAdded!.description,
            );
            expect(deserialized.adaptations[i].stepAdded!.inputFrom).toBe(
              plan.adaptations[i].stepAdded!.inputFrom,
            );
          } else {
            expect(deserialized.adaptations[i].stepAdded).toBeUndefined();
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
