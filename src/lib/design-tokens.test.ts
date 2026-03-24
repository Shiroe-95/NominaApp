import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import {
  spacing,
  spacingToPx,
  calculateTrend,
  aggregateFindingsBySeverity,
  type SpacingKey,
} from './design-tokens';

/**
 * Feature: platform-premium-upgrade
 * Property 1: Los valores de espaciado son múltiplos de 4
 * Validates: Requirements 1.3
 */
describe('Property 1: Los valores de espaciado son múltiplos de 4', () => {
  const spacingKeys = Object.keys(spacing) as SpacingKey[];

  it('para cualquier valor en la escala de espaciado, el valor en píxeles es un múltiplo exacto de 4', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...spacingKeys),
        (key) => {
          const px = spacingToPx(spacing[key]);
          expect(px).toBeGreaterThan(0);
          expect(px % 4).toBe(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Unit tests: calculateTrend ──────────────────────────

describe('calculateTrend', () => {
  it('returns "up" when current > previous', () => {
    const result = calculateTrend(150, 100);
    expect(result.direction).toBe('up');
    expect(result.percentage).toBeCloseTo(50);
  });

  it('returns "down" when current < previous', () => {
    const result = calculateTrend(80, 100);
    expect(result.direction).toBe('down');
    expect(result.percentage).toBeCloseTo(-20);
  });

  it('returns "stable" when current === previous', () => {
    const result = calculateTrend(100, 100);
    expect(result.direction).toBe('stable');
    expect(result.percentage).toBe(0);
  });

  it('returns "stable" when both are 0', () => {
    const result = calculateTrend(0, 0);
    expect(result.direction).toBe('stable');
    expect(result.percentage).toBe(0);
  });

  it('returns "up" 100% when previous is 0 and current > 0', () => {
    const result = calculateTrend(50, 0);
    expect(result.direction).toBe('up');
    expect(result.percentage).toBe(100);
  });

  it('returns "down" 100% when previous is 0 and current < 0', () => {
    const result = calculateTrend(-10, 0);
    expect(result.direction).toBe('down');
    expect(result.percentage).toBe(100);
  });

  it('handles negative previous values correctly', () => {
    // From -100 to -50: improvement (going up), change = (-50 - (-100)) / |-100| * 100 = 50%
    const result = calculateTrend(-50, -100);
    expect(result.direction).toBe('up');
    expect(result.percentage).toBeCloseTo(50);
  });
});

// ── Unit tests: aggregateFindingsBySeverity ─────────────

describe('aggregateFindingsBySeverity', () => {
  it('counts findings by severity correctly', () => {
    const findings = [
      { severity: 'alta' as const },
      { severity: 'alta' as const },
      { severity: 'media' as const },
      { severity: 'baja' as const },
      { severity: 'baja' as const },
      { severity: 'baja' as const },
    ];
    const result = aggregateFindingsBySeverity(findings);
    expect(result).toEqual({ alta: 2, media: 1, baja: 3 });
  });

  it('returns all zeros for empty array', () => {
    const result = aggregateFindingsBySeverity([]);
    expect(result).toEqual({ alta: 0, media: 0, baja: 0 });
  });

  it('handles single severity', () => {
    const findings = [
      { severity: 'media' as const },
      { severity: 'media' as const },
    ];
    const result = aggregateFindingsBySeverity(findings);
    expect(result).toEqual({ alta: 0, media: 2, baja: 0 });
  });

  it('sum of severities equals total findings count', () => {
    const findings = [
      { severity: 'alta' as const },
      { severity: 'media' as const },
      { severity: 'baja' as const },
      { severity: 'alta' as const },
    ];
    const result = aggregateFindingsBySeverity(findings);
    expect(result.alta + result.media + result.baja).toBe(findings.length);
  });
});
