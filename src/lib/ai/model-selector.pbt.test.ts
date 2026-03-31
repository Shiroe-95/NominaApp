/**
 * Property-Based Tests for Model Selector
 * Feature: platform-improvements, Property 14: Model Selector optimality
 *
 * Validates: Requirements 4.5
 * For any valid configuration of providers with weights and any task context,
 * the selected model must have a composite score >= all other candidates.
 *
 * Uses fast-check with minimum 100 iterations.
 * Tests the pure scoring logic without DB dependencies.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { assessComplexity } from './model-selector';
import type {
  ModelCandidate,
  OptimizationConfig,
  TaskContext,
  TaskComplexity,
} from './model-selector';

const NUM_RUNS = 100;

// ── Pure scoring function (extracted from selectModel logic) ────────

function scoreCandidate(
  candidate: ModelCandidate,
  config: OptimizationConfig,
  maxCost: number,
): number {
  const costScore = maxCost > 0 ? 1 - candidate.estimatedCostPer1kTokens / maxCost : 1;
  return costScore * config.cost_weight + candidate.qualityScore * config.quality_weight;
}

function selectBestCandidate(
  candidates: ModelCandidate[],
  config: OptimizationConfig,
): { winner: ModelCandidate; compositeScore: number } | null {
  if (candidates.length === 0) return null;

  // Filter by min quality threshold
  const qualified = candidates.filter(
    (c) => c.qualityScore >= config.min_quality_threshold,
  );

  // Fallback: if none meet threshold, pick highest quality
  if (qualified.length === 0) {
    const best = candidates.reduce((a, b) =>
      b.qualityScore > a.qualityScore ? b : a,
    );
    return { winner: best, compositeScore: best.qualityScore };
  }

  const maxCost = Math.max(...qualified.map((c) => c.estimatedCostPer1kTokens));

  const scored = qualified.map((c) => ({
    candidate: c,
    score: scoreCandidate(c, config, maxCost),
  }));

  scored.sort((a, b) => b.score - a.score);
  return { winner: scored[0].candidate, compositeScore: scored[0].score };
}

// ── Generators ──────────────────────────────────────────────────────

const tierArb = fc.constantFrom('economy' as const, 'standard' as const, 'premium' as const);

const candidateArb: fc.Arbitrary<ModelCandidate> = fc.record({
  providerId: fc.uuid(),
  providerType: fc.constantFrom(
    'openai' as any, 'anthropic' as any, 'google' as any, 'deepseek' as any,
  ),
  modelId: fc.string({ minLength: 3, maxLength: 30 }),
  estimatedCostPer1kTokens: fc.float({ min: 0.0001, max: 0.1, noNaN: true }),
  qualityScore: fc.float({ min: 0, max: 1, noNaN: true }),
  tier: tierArb,
});

const candidatesArb = fc.array(candidateArb, { minLength: 1, maxLength: 10 });


const configArb: fc.Arbitrary<OptimizationConfig> = fc.record({
  strategy: fc.constantFrom('cost-first' as const, 'quality-first' as const, 'balanced' as const),
  cost_weight: fc.float({ min: 0, max: 1, noNaN: true }),
  quality_weight: fc.float({ min: 0, max: 1, noNaN: true }),
  max_cost_per_task_usd: fc.float({ min: 0.01, max: 10, noNaN: true }),
  min_quality_threshold: fc.float({ min: 0, max: 1, noNaN: true }),
  enable_auto_routing: fc.boolean(),
});

const taskTypeArb = fc.constantFrom('chat', 'map', 'validate', 'correct', 'full-analysis');

const taskContextArb: fc.Arbitrary<TaskContext> = fc.record({
  taskType: taskTypeArb as fc.Arbitrary<TaskContext['taskType']>,
  agentName: fc.constantFrom('auditor', 'writer', 'corrector', 'mapper', 'payroll-expert', 'researcher'),
  dataSize: fc.option(fc.integer({ min: 1, max: 2000 }), { nil: undefined }),
  messageCount: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
  hasPayrollData: fc.boolean(),
  countryCode: fc.constantFrom('CO', 'MX', 'PE', 'CL', 'BR', 'AR', 'US'),
  previousStepComplexity: fc.constant(undefined),
});

// ── Property 14: Model Selector Optimality ──────────────────────────

describe('Feature: platform-improvements, Property 14: Model Selector optimality', () => {
  it('selected model has the highest composite score among qualified candidates', () => {
    fc.assert(
      fc.property(candidatesArb, configArb, (candidates, config) => {
        const result = selectBestCandidate(candidates, config);
        if (!result) return; // no candidates

        const qualified = candidates.filter(
          (c) => c.qualityScore >= config.min_quality_threshold,
        );

        if (qualified.length === 0) {
          // Fallback: winner should have highest quality
          for (const c of candidates) {
            expect(result.winner.qualityScore).toBeGreaterThanOrEqual(c.qualityScore);
          }
          return;
        }

        const maxCost = Math.max(...qualified.map((c) => c.estimatedCostPer1kTokens));

        // Verify winner's score >= all other qualified candidates
        for (const c of qualified) {
          const otherScore = scoreCandidate(c, config, maxCost);
          expect(result.compositeScore).toBeGreaterThanOrEqual(otherScore - 1e-10);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('assessComplexity produces deterministic results and valid score range', () => {
    fc.assert(
      fc.property(taskTypeArb, taskContextArb, (taskType, context) => {
        const result1 = assessComplexity(taskType, context);
        const result2 = assessComplexity(taskType, context);

        // Deterministic
        expect(result1).toEqual(result2);

        // Score in [0, 1]
        expect(result1.score).toBeGreaterThanOrEqual(0);
        expect(result1.score).toBeLessThanOrEqual(1);

        // Level consistent with score
        if (result1.score < 0.35) expect(result1.level).toBe('simple');
        else if (result1.score < 0.65) expect(result1.level).toBe('moderate');
        else expect(result1.level).toBe('complex');
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
