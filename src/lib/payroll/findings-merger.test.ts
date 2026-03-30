import { describe, it, expect } from 'vitest';
import {
  mergeFindings,
  calculateAiRiskScore,
  type EngineEmployee,
  type AiEmployeeFinding,
} from './findings-merger';

describe('findings-merger', () => {
  describe('calculateAiRiskScore', () => {
    it('returns 0 for empty issues', () => {
      expect(calculateAiRiskScore([])).toBe(0);
    });

    it('calculates weighted sum: high=40, medium=20, low=10', () => {
      const issues = [
        { severity: 'high' as const },
        { severity: 'medium' as const },
        { severity: 'low' as const },
      ];
      expect(calculateAiRiskScore(issues)).toBe(70);
    });
  });

  describe('mergeFindings', () => {
    it('returns empty array when both sources are empty', () => {
      expect(mergeFindings([], [])).toEqual([]);
    });

    it('returns engine employees when AI is empty', () => {
      const engine: EngineEmployee[] = [
        { document: '123', name: 'Alice', score: 40, findings: ['Issue A'] },
      ];
      const result = mergeFindings(engine, []);
      expect(result).toHaveLength(1);
      expect(result[0].document).toBe('123');
      expect(result[0].source).toBe('engine');
    });

    it('returns AI employees when engine is empty', () => {
      const ai: AiEmployeeFinding[] = [
        { document: '456', name: 'Bob', issues: [{ description: 'AI Issue', severity: 'high', rule: 'R1' }] },
      ];
      const result = mergeFindings([], ai);
      expect(result).toHaveLength(1);
      expect(result[0].document).toBe('456');
      expect(result[0].score).toBe(40);
      expect(result[0].source).toBe('ai');
    });

    it('deduplicates by document, merging findings from both sources', () => {
      const engine: EngineEmployee[] = [
        { document: '123', name: 'Alice', score: 20, findings: ['Engine finding'] },
      ];
      const ai: AiEmployeeFinding[] = [
        { document: '123', name: 'Alice', issues: [{ description: 'AI finding', severity: 'high', rule: 'R1' }] },
      ];
      const result = mergeFindings(engine, ai);
      expect(result).toHaveLength(1);
      expect(result[0].document).toBe('123');
      expect(result[0].findings).toContain('Engine finding');
      expect(result[0].findings).toContain('AI finding');
      expect(result[0].score).toBe(40); // max(20, 40)
      expect(result[0].source).toBe('merged');
    });

    it('does not duplicate identical findings during merge', () => {
      const engine: EngineEmployee[] = [
        { document: '123', name: 'Alice', score: 20, findings: ['Same finding'] },
      ];
      const ai: AiEmployeeFinding[] = [
        { document: '123', name: 'Alice', issues: [{ description: 'Same finding', severity: 'medium', rule: 'R1' }] },
      ];
      const result = mergeFindings(engine, ai);
      expect(result[0].findings.filter(f => f === 'Same finding')).toHaveLength(1);
    });

    it('sorts by risk score descending', () => {
      const engine: EngineEmployee[] = [
        { document: '1', name: 'Low', score: 10, findings: ['A'] },
        { document: '2', name: 'High', score: 80, findings: ['B'] },
        { document: '3', name: 'Mid', score: 40, findings: ['C'] },
      ];
      const result = mergeFindings(engine, []);
      expect(result.map(r => r.document)).toEqual(['2', '3', '1']);
    });

    it('skips employees with empty document', () => {
      const engine: EngineEmployee[] = [
        { document: '', name: 'NoDoc', score: 50, findings: ['X'] },
        { document: '123', name: 'Valid', score: 30, findings: ['Y'] },
      ];
      const result = mergeFindings(engine, []);
      expect(result).toHaveLength(1);
      expect(result[0].document).toBe('123');
    });
  });
});
