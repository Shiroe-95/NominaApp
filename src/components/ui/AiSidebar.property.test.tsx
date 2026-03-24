/**
 * Feature: dashboard-redesign, Property 8: Sidebar no renderiza detalles técnicos
 *
 * *For any* assistant response message in the simplified `AiSidebar`, the message
 * block must not contain token consumption chips, latency indicators in
 * milliseconds, or inter-agent communication sections (busHistory).
 *
 * **Validates: Requirements 6.3**
 */

// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fc from 'fast-check';
import React from 'react';
import { render, cleanup, fireEvent } from '@testing-library/react';

// ── Mocks ───────────────────────────────────────────────────────────

vi.mock('lucide-react', () => ({
  Bot: (props: Record<string, unknown>) => React.createElement('span', props),
  Send: (props: Record<string, unknown>) => React.createElement('span', props),
  X: (props: Record<string, unknown>) => React.createElement('span', props),
  Activity: (props: Record<string, unknown>) => React.createElement('span', props),
  BookOpen: (props: Record<string, unknown>) => React.createElement('span', props),
  Sparkles: (props: Record<string, unknown>) => React.createElement('span', props),
  Trash2: (props: Record<string, unknown>) => React.createElement('span', props),
  ExternalLink: (props: Record<string, unknown>) => React.createElement('span', props),
}));

vi.mock('@/components/ui/AgentAvatar', () => ({
  AgentAvatar: ({ agentId }: { agentId: string }) =>
    React.createElement('span', { 'data-testid': `agent-avatar-${agentId}` }, agentId),
}));

vi.mock('@/lib/ai/agent-personas', () => ({
  getPersona: (agentId: string) => ({
    name: agentId,
    id: agentId,
    emoji: '🤖',
    role: 'Agent',
    description: '',
    avatarType: 'man',
    color: 'slate',
    bgColor: 'bg-white/10',
    textColor: 'text-slate-300',
    glowColor: '',
    hexColor: '#94a3b8',
    greeting: 'Hello',
    hairColor: '#1a1a2e',
  }),
}));

import AiSidebar from './AiSidebar';

// ── Types ───────────────────────────────────────────────────────────

interface AgentResultInfo {
  agentName: string;
  success: boolean;
  tokensUsed: number;
  providerUsed: string;
  latencyMs: number;
}

interface AgentBusMessage {
  fromAgent: string;
  toAgent: string;
  queryType: string;
  payload: unknown;
  timestamp: string;
}

interface Message {
  role: 'user' | 'assistant';
  text: string;
  agentResults?: AgentResultInfo[];
  plan?: { steps: { agentName: string; description: string }[] };
  busHistory?: AgentBusMessage[];
}

// ── Constants ───────────────────────────────────────────────────────

const STORAGE_KEY = 'nominasmart_ai_history';

const AGENT_IDS = ['master', 'auditor', 'writer', 'corrector', 'mapper', 'payroll-expert', 'researcher'] as const;

// ── Generators ──────────────────────────────────────────────────────

const arbTokenCount = fc.integer({ min: 1, max: 50000 });
const arbLatencyMs = fc.integer({ min: 1, max: 30000 });

const arbAgentResult: fc.Arbitrary<AgentResultInfo> = fc.record({
  agentName: fc.constantFrom(...AGENT_IDS),
  success: fc.boolean(),
  tokensUsed: arbTokenCount,
  providerUsed: fc.constantFrom('openai', 'anthropic', 'groq', 'google'),
  latencyMs: arbLatencyMs,
});

const arbBusMessage: fc.Arbitrary<AgentBusMessage> = fc.record({
  fromAgent: fc.constantFrom(...AGENT_IDS),
  toAgent: fc.constantFrom(...AGENT_IDS),
  queryType: fc.constantFrom('consult', 'delegate', 'report', 'validate'),
  payload: fc.constant(null),
  timestamp: fc.constant(new Date().toISOString()),
});

/**
 * Generate an assistant message with random technical details.
 * Uses a safe text generator that avoids producing strings that
 * accidentally match token/latency/bus patterns.
 */
const arbSafeText = fc.stringOf(fc.constantFrom(...'abcdefghijklñopqruvwxyz .!¿?éáíóú'.split('')), {
  minLength: 5,
  maxLength: 100,
});

const arbAssistantMessage: fc.Arbitrary<Message> = fc.record({
  role: fc.constant('assistant' as const),
  text: arbSafeText,
  agentResults: fc.option(fc.array(arbAgentResult, { minLength: 1, maxLength: 5 }), { nil: undefined }),
  plan: fc.option(
    fc.record({
      steps: fc.array(
        fc.record({
          agentName: fc.constantFrom(...AGENT_IDS),
          description: arbSafeText,
        }),
        { minLength: 1, maxLength: 4 },
      ),
    }),
    { nil: undefined },
  ),
  busHistory: fc.option(fc.array(arbBusMessage, { minLength: 1, maxLength: 5 }), { nil: undefined }),
});

// ── Helpers ─────────────────────────────────────────────────────────

const WELCOME_MESSAGE: Message = {
  role: 'assistant',
  text: '¡Hola! Soy Dianis 👑, tu directora de orquestación.',
};

/**
 * Seed localStorage with a conversation containing the generated
 * assistant message that has technical details (agentResults, busHistory).
 */
function seedLocalStorage(assistantMsg: Message): void {
  const messages: Message[] = [
    WELCOME_MESSAGE,
    { role: 'user', text: 'Analiza mi nómina' },
    assistantMsg,
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
}

/**
 * Render the AiSidebar and open it by clicking the FAB button.
 * Returns the messages area text content.
 */
function renderAndGetMessagesText(): string {
  const { container } = render(React.createElement(AiSidebar));

  // The sidebar starts closed — click the FAB to open
  const fab = container.querySelector('button');
  if (fab) fireEvent.click(fab);

  // After opening, the messages area has class overflow-y-auto
  const messagesArea = container.querySelector('.overflow-y-auto');
  return messagesArea?.textContent ?? '';
}

// ── Property Tests ──────────────────────────────────────────────────

describe('Property 8: Sidebar no renderiza detalles técnicos', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('(a) rendered sidebar does NOT contain token count patterns from agentResults', () => {
    fc.assert(
      fc.property(arbAssistantMessage, (assistantMsg) => {
        localStorage.clear();
        seedLocalStorage(assistantMsg);

        const textContent = renderAndGetMessagesText();

        // The sidebar must not render token consumption chips
        if (assistantMsg.agentResults) {
          for (const result of assistantMsg.agentResults) {
            // Must not contain "{N}t" token chip format
            expect(textContent).not.toContain(`${result.tokensUsed}t`);
            // Must not contain "tokens" label associated with agent results
            expect(textContent).not.toMatch(
              new RegExp(`${result.tokensUsed}\\s*tokens?`, 'i'),
            );
          }
        }

        // Must not contain raw field name leaks
        expect(textContent).not.toMatch(/tokensUsed/);

        cleanup();
      }),
      { numRuns: 100 },
    );
  });

  it('(b) rendered sidebar does NOT contain latency patterns from agentResults', () => {
    fc.assert(
      fc.property(arbAssistantMessage, (assistantMsg) => {
        localStorage.clear();
        seedLocalStorage(assistantMsg);

        const textContent = renderAndGetMessagesText();

        // The sidebar must not render latency indicators
        if (assistantMsg.agentResults) {
          for (const result of assistantMsg.agentResults) {
            // Must not contain "{N}ms" latency format
            expect(textContent).not.toContain(`${result.latencyMs}ms`);
            expect(textContent).not.toMatch(
              new RegExp(`${result.latencyMs}\\s*ms`, 'i'),
            );
          }
        }

        // Must not contain raw field name leaks
        expect(textContent).not.toMatch(/latencyMs/);

        cleanup();
      }),
      { numRuns: 100 },
    );
  });

  it('(c) rendered sidebar does NOT contain busHistory/inter-agent communication sections', () => {
    fc.assert(
      fc.property(arbAssistantMessage, (assistantMsg) => {
        localStorage.clear();
        seedLocalStorage(assistantMsg);

        const textContent = renderAndGetMessagesText();

        // Must not contain busHistory structural markers
        expect(textContent).not.toMatch(/busHistory/i);
        expect(textContent).not.toMatch(/fromAgent/i);
        expect(textContent).not.toMatch(/toAgent/i);
        expect(textContent).not.toMatch(/queryType/i);

        // Must not render inter-agent communication arrow patterns
        if (assistantMsg.busHistory) {
          for (const busMsg of assistantMsg.busHistory) {
            expect(textContent).not.toContain(`${busMsg.fromAgent} → ${busMsg.toAgent}`);
            expect(textContent).not.toContain(`${busMsg.fromAgent} -> ${busMsg.toAgent}`);
          }
        }

        cleanup();
      }),
      { numRuns: 100 },
    );
  });
});
