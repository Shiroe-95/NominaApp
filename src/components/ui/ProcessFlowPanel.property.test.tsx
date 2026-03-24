/**
 * Feature: dashboard-redesign, Property 4: Agentes visibles en cada paso del flujo de proceso
 *
 * *For any* set of process steps with assigned agents, the `ProcessFlowPanel`
 * must show for each step all assigned agents with their name, emoji and avatar,
 * including steps with multiple agents collaborating.
 *
 * **Validates: Requirements 2.2, 2.5, 2.6**
 */

// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import fc from 'fast-check';
import React from 'react';
import { render, cleanup, within } from '@testing-library/react';
import { ProcessFlowPanel } from './ProcessFlowPanel';
import type { ProcessStep } from '@/lib/types/pipeline';
import { AGENT_PERSONAS } from '@/lib/ai/agent-personas';

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock('next-intl', () => ({
  useTranslations: () => {
    return (key: string, params?: Record<string, unknown>) => {
      if (key === 'stepCounter' && params) {
        return `Step ${params.current} of ${params.total}`;
      }
      return key;
    };
  },
}));

vi.mock('@/i18n/routing', () => ({
  Link: ({ children, href, ...props }: { children: React.ReactNode; href: string; [k: string]: unknown }) =>
    React.createElement('a', { href, ...props }, children),
}));

vi.mock('@/components/ui/AgentAvatar', () => ({
  AgentAvatar: ({ agentId, size }: { agentId: string; size?: number }) =>
    React.createElement('div', {
      'data-testid': `agent-avatar-${agentId}`,
      'data-size': size,
    }),
}));

vi.mock('lucide-react', () => ({
  CheckCircle2: (props: Record<string, unknown>) =>
    React.createElement('span', { 'data-testid': 'check-icon', ...props }),
  ChevronRight: (props: Record<string, unknown>) =>
    React.createElement('span', { 'data-testid': 'chevron-icon', ...props }),
}));

// ── Generators ──────────────────────────────────────────────────────

const KNOWN_AGENT_IDS = Object.keys(AGENT_PERSONAS);
const STEP_STATUSES = ['pending', 'active', 'completed'] as const;

/** Generate a unique set of 1-4 agents (no duplicate IDs within a step). */
const arbAgentList = fc
  .shuffledSubarray(KNOWN_AGENT_IDS, { minLength: 1, maxLength: 4 })
  .map((ids) =>
    ids.map((id) => ({
      id,
      name: AGENT_PERSONAS[id].name,
      emoji: AGENT_PERSONAS[id].emoji,
      role: AGENT_PERSONAS[id].role,
    })),
  );

/** Generate a unique set of 2-4 agents for multi-agent steps. */
const arbMultiAgentList = fc
  .shuffledSubarray(KNOWN_AGENT_IDS, { minLength: 2, maxLength: 4 })
  .map((ids) =>
    ids.map((id) => ({
      id,
      name: AGENT_PERSONAS[id].name,
      emoji: AGENT_PERSONAS[id].emoji,
      role: AGENT_PERSONAS[id].role,
    })),
  );

const arbStep = (index: number): fc.Arbitrary<ProcessStep> =>
  fc.record({
    id: fc.constant(`step-${index}`),
    title: fc.string({ minLength: 1, maxLength: 30 }),
    description: fc.string({ minLength: 1, maxLength: 60 }),
    agents: arbAgentList,
    status: fc.constantFrom(...STEP_STATUSES),
    href: fc.constant(`/step-${index}`),
  });

const arbMultiAgentStep = (index: number): fc.Arbitrary<ProcessStep> =>
  fc.record({
    id: fc.constant(`step-${index}`),
    title: fc.string({ minLength: 1, maxLength: 30 }),
    description: fc.string({ minLength: 1, maxLength: 60 }),
    agents: arbMultiAgentList,
    status: fc.constantFrom(...STEP_STATUSES),
    href: fc.constant(`/step-${index}`),
  });

/** Generate 1-4 process steps, each with 1-4 unique agents. */
const arbSteps: fc.Arbitrary<ProcessStep[]> = fc
  .integer({ min: 1, max: 4 })
  .chain((count) => fc.tuple(...Array.from({ length: count }, (_, i) => arbStep(i))))
  .map((tuple) => [...tuple]);

/** Generate 1-4 process steps where every step has at least 2 agents. */
const arbMultiAgentSteps: fc.Arbitrary<ProcessStep[]> = fc
  .integer({ min: 1, max: 4 })
  .chain((count) => fc.tuple(...Array.from({ length: count }, (_, i) => arbMultiAgentStep(i))))
  .map((tuple) => [...tuple]);

// ── Property Tests ──────────────────────────────────────────────────

describe('Property 4: Agentes visibles en cada paso del flujo de proceso', () => {
  afterEach(() => {
    cleanup();
  });

  it('(a) for each step, all assigned agents have a rendered element with data-testid="step-agent-{agentId}"', () => {
    fc.assert(
      fc.property(arbSteps, (steps) => {
        const { container } = render(
          React.createElement(ProcessFlowPanel, {
            currentStep: 0,
            steps,
          }),
        );

        for (const step of steps) {
          const stepEl = within(container).getByTestId(`process-step-${step.id}`);
          for (const agent of step.agents) {
            const agentEl = within(stepEl).queryByTestId(`step-agent-${agent.id}`);
            expect(agentEl).not.toBeNull();
          }
        }

        cleanup();
      }),
      { numRuns: 100 },
    );
  });

  it('(b) for each step, agent names are visible in the rendered text', () => {
    fc.assert(
      fc.property(arbSteps, (steps) => {
        const { container } = render(
          React.createElement(ProcessFlowPanel, {
            currentStep: 0,
            steps,
          }),
        );

        for (const step of steps) {
          const stepEl = within(container).getByTestId(`process-step-${step.id}`);
          const text = stepEl.textContent ?? '';

          for (const agent of step.agents) {
            expect(text).toContain(agent.name);
          }
        }

        cleanup();
      }),
      { numRuns: 100 },
    );
  });

  it('(c) for each step, agent emojis are visible in the rendered text', () => {
    fc.assert(
      fc.property(arbSteps, (steps) => {
        const { container } = render(
          React.createElement(ProcessFlowPanel, {
            currentStep: 0,
            steps,
          }),
        );

        for (const step of steps) {
          const stepEl = within(container).getByTestId(`process-step-${step.id}`);
          const text = stepEl.textContent ?? '';

          for (const agent of step.agents) {
            expect(text).toContain(agent.emoji);
          }
        }

        cleanup();
      }),
      { numRuns: 100 },
    );
  });

  it('(d) steps with multiple agents show all agents (not just the first one)', () => {
    fc.assert(
      fc.property(arbMultiAgentSteps, (steps) => {
        const { container } = render(
          React.createElement(ProcessFlowPanel, {
            currentStep: 0,
            steps,
          }),
        );

        for (const step of steps) {
          expect(step.agents.length).toBeGreaterThanOrEqual(2);

          const stepEl = within(container).getByTestId(`process-step-${step.id}`);
          const text = stepEl.textContent ?? '';

          for (const agent of step.agents) {
            // All agents have their data-testid element
            expect(within(stepEl).queryByTestId(`step-agent-${agent.id}`)).not.toBeNull();
            // All agent names are present
            expect(text).toContain(agent.name);
            // All agent emojis are present
            expect(text).toContain(agent.emoji);
          }
        }

        cleanup();
      }),
      { numRuns: 100 },
    );
  });
});
