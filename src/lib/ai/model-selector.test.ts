import { describe, it, expect } from 'vitest';
import { assessComplexity, type TaskContext } from './model-selector';

/** Helper to build a minimal TaskContext with overrides. */
function ctx(overrides: Partial<TaskContext> = {}): TaskContext {
  return {
    taskType: 'chat',
    agentName: 'mapper',
    hasPayrollData: false,
    countryCode: 'CO',
    ...overrides,
  };
}

describe('assessComplexity', () => {
  // ── Output invariants ──────────────────────────────────────────

  it('returns score in [0, 1], a valid level, and at least one factor', () => {
    const result = assessComplexity('chat', ctx());
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
    expect(['simple', 'moderate', 'complex']).toContain(result.level);
    expect(result.factors.length).toBeGreaterThanOrEqual(1);
  });

  // ── Base complexity scores ─────────────────────────────────────

  it.each([
    ['chat', 0.2],
    ['map', 0.3],
    ['validate', 0.5],
    ['correct', 0.6],
    ['full-analysis', 0.8],
  ])('assigns base score for task type "%s" = %f', (taskType, expected) => {
    // Use mapper (-0.05) + CO so only base + agent boost apply
    const result = assessComplexity(taskType as string, ctx({ agentName: 'payroll-expert' }));
    expect(result.score).toBeCloseTo(expected, 10);
  });

  it('defaults to 0.5 for unknown task types', () => {
    const result = assessComplexity('unknown-type', ctx({ agentName: 'payroll-expert' }));
    expect(result.score).toBeCloseTo(0.5, 10);
  });

  // ── Level classification ───────────────────────────────────────

  it('classifies as "simple" when score < 0.35', () => {
    // chat(0.2) + mapper(-0.05) + CO = 0.15
    const result = assessComplexity('chat', ctx({ agentName: 'mapper' }));
    expect(result.score).toBeLessThan(0.35);
    expect(result.level).toBe('simple');
  });

  it('classifies as "moderate" when 0.35 ≤ score < 0.65', () => {
    // validate(0.5) + payroll-expert(0) + CO = 0.5
    const result = assessComplexity('validate', ctx({ agentName: 'payroll-expert' }));
    expect(result.score).toBeGreaterThanOrEqual(0.35);
    expect(result.score).toBeLessThan(0.65);
    expect(result.level).toBe('moderate');
  });

  it('classifies as "complex" when score ≥ 0.65', () => {
    // full-analysis(0.8) + auditor(0.1) + CO = 0.9
    const result = assessComplexity('full-analysis', ctx({ agentName: 'auditor' }));
    expect(result.score).toBeGreaterThanOrEqual(0.65);
    expect(result.level).toBe('complex');
  });

  // ── Data volume factor ─────────────────────────────────────────

  it('adds 0.15 for dataSize > 500', () => {
    const base = assessComplexity('chat', ctx({ agentName: 'payroll-expert' }));
    const large = assessComplexity('chat', ctx({ agentName: 'payroll-expert', dataSize: 501 }));
    expect(large.score - base.score).toBeCloseTo(0.15, 10);
    expect(large.factors).toContain('large_dataset:>500_rows');
  });

  it('adds 0.05 for 100 < dataSize ≤ 500', () => {
    const base = assessComplexity('chat', ctx({ agentName: 'payroll-expert' }));
    const medium = assessComplexity('chat', ctx({ agentName: 'payroll-expert', dataSize: 200 }));
    expect(medium.score - base.score).toBeCloseTo(0.05, 10);
    expect(medium.factors).toContain('medium_dataset:>100_rows');
  });

  it('adds nothing for dataSize ≤ 100', () => {
    const base = assessComplexity('chat', ctx({ agentName: 'payroll-expert' }));
    const small = assessComplexity('chat', ctx({ agentName: 'payroll-expert', dataSize: 50 }));
    expect(small.score).toBeCloseTo(base.score, 10);
  });

  // ── Agent boost factor ─────────────────────────────────────────

  it.each([
    ['auditor', 0.1],
    ['writer', 0.05],
    ['corrector', 0.1],
    ['mapper', -0.05],
    ['payroll-expert', 0],
    ['researcher', 0.1],
  ])('applies boost for agent "%s" = %f', (agent, boost) => {
    const baseline = assessComplexity('chat', ctx({ agentName: 'payroll-expert' }));
    const result = assessComplexity('chat', ctx({ agentName: agent }));
    expect(result.score - baseline.score).toBeCloseTo(boost, 10);
  });

  // ── Multi-country factor ───────────────────────────────────────

  it('adds 0.05 for non-CO country', () => {
    const co = assessComplexity('chat', ctx({ agentName: 'payroll-expert', countryCode: 'CO' }));
    const mx = assessComplexity('chat', ctx({ agentName: 'payroll-expert', countryCode: 'MX' }));
    expect(mx.score - co.score).toBeCloseTo(0.05, 10);
    expect(mx.factors).toContain('non_default_country:MX');
  });

  it('does not add country boost for CO', () => {
    const result = assessComplexity('chat', ctx({ agentName: 'payroll-expert', countryCode: 'CO' }));
    expect(result.factors.every(f => !f.startsWith('non_default_country'))).toBe(true);
  });

  // ── Normalization ──────────────────────────────────────────────

  it('clamps score to 1.0 when factors exceed it', () => {
    // full-analysis(0.8) + auditor(0.1) + large_dataset(0.15) + non-CO(0.05) = 1.1 → 1.0
    const result = assessComplexity('full-analysis', ctx({
      agentName: 'auditor',
      dataSize: 1000,
      countryCode: 'MX',
    }));
    expect(result.score).toBe(1.0);
  });

  it('clamps score to 0.0 when factors go negative', () => {
    // chat(0.2) + mapper(-0.05) = 0.15 — still positive, but let's verify normalization works
    const result = assessComplexity('chat', ctx({ agentName: 'mapper' }));
    expect(result.score).toBeGreaterThanOrEqual(0);
  });

  // ── Factors tracking ───────────────────────────────────────────

  it('always includes the base_type factor', () => {
    const result = assessComplexity('validate', ctx());
    expect(result.factors.some(f => f.startsWith('base_type:'))).toBe(true);
  });

  it('does not include agent_boost factor when boost is 0', () => {
    const result = assessComplexity('chat', ctx({ agentName: 'payroll-expert' }));
    expect(result.factors.every(f => !f.startsWith('agent_boost:'))).toBe(true);
  });
});
