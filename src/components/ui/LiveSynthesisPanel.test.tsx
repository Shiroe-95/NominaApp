/**
 * Unit tests for LiveSynthesisPanel component.
 *
 * Tests empty state, loading indicator, full rendering with synthesis data,
 * and loading overlay when updating.
 *
 * Validates: Requirements 4.1, 4.3
 */

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { LiveSynthesisPanel } from './LiveSynthesisPanel';
import type { SynthesisResult } from '@/lib/types/pipeline';

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock('next-intl', () => ({
  useTranslations: () => {
    return (key: string) => key;
  },
}));

vi.mock('lucide-react', () => ({
  Brain: (props: Record<string, unknown>) => React.createElement('span', { 'data-testid': 'brain-icon', ...props }),
  AlertTriangle: (props: Record<string, unknown>) => React.createElement('span', { 'data-testid': 'alert-icon', ...props }),
  Lightbulb: (props: Record<string, unknown>) => React.createElement('span', { 'data-testid': 'lightbulb-icon', ...props }),
  Loader2: (props: Record<string, unknown>) => React.createElement('span', { 'data-testid': 'loader-icon', ...props }),
}));

vi.mock('@/components/ui/AgentAvatar', () => ({
  AgentAvatar: ({ agentId }: { agentId: string }) =>
    React.createElement('span', { 'data-testid': `agent-avatar-${agentId}` }, agentId),
}));

// ── Test Data ───────────────────────────────────────────────────────

const sampleSynthesis: SynthesisResult = {
  summary: 'Analysis complete with 3 issues found across payroll data.',
  riskLevel: 'medium',
  findings: [
    { description: 'Duplicate entries detected in Q4 payroll', severity: 'high' },
    { description: 'Missing tax withholding for 2 employees', severity: 'medium' },
  ],
  recommendations: [
    'Review and merge duplicate entries before final submission',
    'Update tax configuration for affected employees',
  ],
  contributingAgents: [
    { id: 'auditor', name: 'Juli', emoji: '🔍' },
    { id: 'mapper', name: 'Gyoru', emoji: '🗺️' },
  ],
  completedAt: Date.now(),
};

// ── Tests ───────────────────────────────────────────────────────────

describe('LiveSynthesisPanel', () => {
  afterEach(() => {
    cleanup();
  });

  describe('Empty state', () => {
    it('renders empty state when synthesis is null and isRunning is false', () => {
      const { getByTestId, queryByTestId } = render(
        <LiveSynthesisPanel synthesis={null} isRunning={false} />,
      );

      expect(getByTestId('live-synthesis-panel')).toBeTruthy();
      expect(getByTestId('synthesis-empty-state')).toBeTruthy();
      expect(queryByTestId('synthesis-loading')).toBeNull();
      expect(queryByTestId('synthesis-summary')).toBeNull();
    });
  });

  describe('Loading state', () => {
    it('renders loading indicator when isRunning is true and synthesis is null', () => {
      const { getByTestId, queryByTestId } = render(
        <LiveSynthesisPanel synthesis={null} isRunning={true} />,
      );

      expect(getByTestId('live-synthesis-panel')).toBeTruthy();
      expect(getByTestId('synthesis-loading')).toBeTruthy();
      expect(queryByTestId('synthesis-empty-state')).toBeNull();
      expect(queryByTestId('synthesis-summary')).toBeNull();
    });
  });

  describe('Full rendering with synthesis data', () => {
    it('renders summary, risk level, findings, recommendations, and agents', () => {
      const { getByTestId } = render(
        <LiveSynthesisPanel synthesis={sampleSynthesis} isRunning={false} />,
      );

      // Summary
      const summary = getByTestId('synthesis-summary');
      expect(summary.textContent).toContain(sampleSynthesis.summary);

      // Risk level
      const riskLevel = getByTestId('synthesis-risk-level');
      expect(riskLevel).toBeTruthy();

      // Findings
      const findings = getByTestId('synthesis-findings');
      for (const finding of sampleSynthesis.findings) {
        expect(findings.textContent).toContain(finding.description);
        expect(findings.textContent).toContain(finding.severity);
      }

      // Recommendations
      const recommendations = getByTestId('synthesis-recommendations');
      for (const rec of sampleSynthesis.recommendations) {
        expect(recommendations.textContent).toContain(rec);
      }

      // Contributing agents
      const agents = getByTestId('synthesis-agents');
      for (const agent of sampleSynthesis.contributingAgents) {
        expect(agents.textContent).toContain(agent.name);
        expect(agents.textContent).toContain(agent.emoji);
      }
    });

    it('renders agent avatars for each contributing agent', () => {
      const { getByTestId } = render(
        <LiveSynthesisPanel synthesis={sampleSynthesis} isRunning={false} />,
      );

      for (const agent of sampleSynthesis.contributingAgents) {
        expect(getByTestId(`agent-avatar-${agent.id}`)).toBeTruthy();
      }
    });
  });

  describe('Loading overlay with existing synthesis', () => {
    it('shows loading indicator alongside synthesis when isRunning is true', () => {
      const { getByTestId } = render(
        <LiveSynthesisPanel synthesis={sampleSynthesis} isRunning={true} />,
      );

      // Both loading and synthesis content should be present
      expect(getByTestId('synthesis-loading')).toBeTruthy();
      expect(getByTestId('synthesis-summary')).toBeTruthy();
      expect(getByTestId('synthesis-risk-level')).toBeTruthy();
      expect(getByTestId('synthesis-findings')).toBeTruthy();
      expect(getByTestId('synthesis-recommendations')).toBeTruthy();
      expect(getByTestId('synthesis-agents')).toBeTruthy();
    });
  });
});
