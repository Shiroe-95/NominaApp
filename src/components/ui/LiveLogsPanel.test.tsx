/**
 * Unit tests for LiveLogsPanel component.
 *
 * Tests rendering with empty logs, multiple log types,
 * clear button behavior, and visual differentiation.
 *
 * Validates: Requirements 3.1, 3.6
 */

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { LiveLogsPanel } from './LiveLogsPanel';
import type { LogEntry } from '@/lib/types/pipeline';

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock('next-intl', () => ({
  useTranslations: () => {
    return (key: string, params?: Record<string, unknown>) => {
      if (key === 'tokens' && params) return `${params.count} tokens`;
      if (key === 'latency' && params) return `${params.ms}ms`;
      return key;
    };
  },
}));

vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) =>
    React.createElement('a', { href, ...props }, children),
}));

vi.mock('lucide-react', () => ({
  Trash2: (props: Record<string, unknown>) => React.createElement('span', { 'data-testid': 'trash-icon', ...props }),
  Terminal: (props: Record<string, unknown>) => React.createElement('span', { 'data-testid': 'terminal-icon', ...props }),
  ArrowRight: (props: Record<string, unknown>) => React.createElement('span', { 'data-testid': 'arrow-icon', ...props }),
}));

vi.mock('@/components/ui/AgentAvatar', () => ({
  AgentAvatar: ({ agentId }: { agentId: string }) =>
    React.createElement('span', { 'data-testid': `agent-avatar-${agentId}` }, agentId),
}));

// ── Test Data ───────────────────────────────────────────────────────

function makeLog(overrides: Partial<LogEntry> & { id: string; type: LogEntry['type'] }): LogEntry {
  return {
    timestamp: Date.now(),
    message: `Log message for ${overrides.id}`,
    ...overrides,
  };
}

const sampleLogs: LogEntry[] = [
  makeLog({
    id: 'log-1',
    type: 'agent-start',
    agentId: 'auditor',
    agentName: 'Juli',
    message: 'Auditor agent started',
  }),
  makeLog({
    id: 'log-2',
    type: 'agent-complete',
    agentId: 'mapper',
    agentName: 'Gyoru',
    message: 'Mapper agent completed',
    metadata: { tokensUsed: 150, latencyMs: 320, success: true },
  }),
  makeLog({
    id: 'log-3',
    type: 'agent-communication',
    agentId: 'auditor',
    agentName: 'Juli',
    message: 'Inter-agent communication',
    metadata: { fromAgent: 'Juli', toAgent: 'Wil' },
  }),
  makeLog({
    id: 'log-4',
    type: 'error',
    message: 'Pipeline error occurred',
  }),
];

// ── Tests ───────────────────────────────────────────────────────────

describe('LiveLogsPanel', () => {
  afterEach(() => {
    cleanup();
  });

  describe('Empty state', () => {
    it('renders empty state when logs is an empty array', () => {
      const { getByTestId, queryByTestId } = render(
        <LiveLogsPanel logs={[]} onClear={vi.fn()} />,
      );

      expect(getByTestId('live-logs-panel')).toBeTruthy();
      expect(getByTestId('logs-empty-state')).toBeTruthy();
      expect(queryByTestId('logs-clear-button')).toBeNull();
    });
  });

  describe('Rendering N log entries', () => {
    it('renders each log entry with correct data-testid', () => {
      const { getByTestId } = render(
        <LiveLogsPanel logs={sampleLogs} onClear={vi.fn()} />,
      );

      for (const log of sampleLogs) {
        expect(getByTestId(`log-entry-${log.id}`)).toBeTruthy();
      }
    });

    it('renders agent avatars for entries with agentId', () => {
      const { getAllByTestId, getByTestId } = render(
        <LiveLogsPanel logs={sampleLogs} onClear={vi.fn()} />,
      );

      // 'auditor' appears in log-1 and log-3
      expect(getAllByTestId('agent-avatar-auditor').length).toBe(2);
      // 'mapper' appears in log-2
      expect(getByTestId('agent-avatar-mapper')).toBeTruthy();
    });

    it('renders message text for each entry', () => {
      const { getByTestId } = render(
        <LiveLogsPanel logs={sampleLogs} onClear={vi.fn()} />,
      );

      for (const log of sampleLogs) {
        const el = getByTestId(`log-entry-${log.id}`);
        expect(el.textContent).toContain(log.message);
      }
    });
  });

  describe('Visual treatment for different log types', () => {
    it('renders metadata (tokens, latency) for agent-complete entries', () => {
      const { getByTestId } = render(
        <LiveLogsPanel logs={sampleLogs} onClear={vi.fn()} />,
      );

      const completeEntry = getByTestId('log-entry-log-2');
      expect(completeEntry.textContent).toContain('150 tokens');
      expect(completeEntry.textContent).toContain('320ms');
    });

    it('renders from/to agents for agent-communication entries', () => {
      const { getByTestId } = render(
        <LiveLogsPanel logs={sampleLogs} onClear={vi.fn()} />,
      );

      const commEntry = getByTestId('log-entry-log-3');
      expect(commEntry.textContent).toContain('Juli');
      expect(commEntry.textContent).toContain('Wil');
    });

    it('does not render tokens/latency for non-complete entries', () => {
      const { getByTestId } = render(
        <LiveLogsPanel logs={sampleLogs} onClear={vi.fn()} />,
      );

      const startEntry = getByTestId('log-entry-log-1');
      expect(startEntry.textContent).not.toContain('tokens');
      expect(startEntry.textContent).not.toContain('ms');
    });
  });

  describe('Clear button', () => {
    it('calls onClear when clear button is clicked', () => {
      const onClear = vi.fn();
      const { getByTestId } = render(
        <LiveLogsPanel logs={sampleLogs} onClear={onClear} />,
      );

      fireEvent.click(getByTestId('logs-clear-button'));
      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('does not show clear button when logs is empty', () => {
      const { queryByTestId } = render(
        <LiveLogsPanel logs={[]} onClear={vi.fn()} />,
      );

      expect(queryByTestId('logs-clear-button')).toBeNull();
    });
  });
});
