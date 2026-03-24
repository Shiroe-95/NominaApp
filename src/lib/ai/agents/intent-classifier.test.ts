import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ChatMessage } from '../types';
import {
  classifyIntentContextual,
  LOW_CONFIDENCE_THRESHOLD,
  type PayrollContext,
  type IntentClassificationResult,
  type UserIntent,
} from './intent-classifier';

// ── Mock for 'ai' SDK ───────────────────────────────────────────────

// We mock generateObject since actual classification depends on an LLM.
// The mock lets us control the AI response and test the surrounding logic.
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

import { generateObject } from 'ai';
const mockGenerateObject = vi.mocked(generateObject);

// ── Helpers ─────────────────────────────────────────────────────────

function makeMessages(count: number, role: ChatMessage['role'] = 'user'): ChatMessage[] {
  return Array.from({ length: count }, (_, i) => ({
    role,
    content: `Message ${i + 1}`,
  }));
}

function mockAIResponse(intent: UserIntent, confidence: number, reasoning = 'Test reasoning') {
  mockGenerateObject.mockResolvedValueOnce({
    object: { intent, confidence, reasoning },
    usage: { totalTokens: 50 },
  } as never);
}

const noPayroll: PayrollContext = { hasData: false, countryCode: 'CO' };
const withPayroll: PayrollContext = { hasData: true, countryCode: 'CO' };
const fakeModel = {} as never; // model is passed through to generateObject

// ── classifyIntentContextual ────────────────────────────────────────

describe('classifyIntentContextual', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Req 6.1: Uses last 5 messages ──────────────────────────────

  describe('context window (Req 6.1)', () => {
    it('uses all messages when history has fewer than 5', async () => {
      const messages = makeMessages(3);
      mockAIResponse('consultation', 0.8);

      const result = await classifyIntentContextual(messages, noPayroll, fakeModel);

      expect(result.contextUsed).toBe(3);
    });

    it('uses exactly 5 messages when history has more than 5', async () => {
      const messages = makeMessages(10);
      mockAIResponse('audit', 0.9);

      const result = await classifyIntentContextual(messages, noPayroll, fakeModel);

      expect(result.contextUsed).toBe(5);
    });

    it('uses exactly 5 messages when history has exactly 5', async () => {
      const messages = makeMessages(5);
      mockAIResponse('mapping', 0.7);

      const result = await classifyIntentContextual(messages, noPayroll, fakeModel);

      expect(result.contextUsed).toBe(5);
    });

    it('takes the LAST 5 messages (most recent)', async () => {
      const messages: ChatMessage[] = [
        { role: 'user', content: 'Old message 1' },
        { role: 'assistant', content: 'Old response' },
        { role: 'user', content: 'Old message 2' },
        { role: 'assistant', content: 'Old response 2' },
        { role: 'user', content: 'Old message 3' },
        { role: 'assistant', content: 'Recent response' },
        { role: 'user', content: 'Recent message' },
      ];
      mockAIResponse('consultation', 0.8);

      await classifyIntentContextual(messages, noPayroll, fakeModel);

      // Verify the prompt sent to AI contains only the last 5 messages
      const callArgs = mockGenerateObject.mock.calls[0][0] as { prompt: string };
      expect(callArgs.prompt).toContain('Old message 3');
      expect(callArgs.prompt).toContain('Recent message');
      expect(callArgs.prompt).not.toContain('Old message 1');
    });
  });

  // ── Req 6.2: Confidence field ──────────────────────────────────

  describe('confidence field (Req 6.2)', () => {
    it('returns confidence from AI response', async () => {
      mockAIResponse('audit', 0.85);

      const result = await classifyIntentContextual(makeMessages(1), noPayroll, fakeModel);

      expect(result.confidence).toBe(0.85);
    });

    it('clamps confidence to 1.0 if AI returns > 1', async () => {
      mockAIResponse('audit', 1.5);

      const result = await classifyIntentContextual(makeMessages(1), noPayroll, fakeModel);

      expect(result.confidence).toBe(1.0);
    });

    it('clamps confidence to 0.0 if AI returns negative', async () => {
      mockAIResponse('audit', -0.3);

      const result = await classifyIntentContextual(makeMessages(1), noPayroll, fakeModel);

      expect(result.confidence).toBe(0.0);
    });
  });

  // ── Req 6.3: Low confidence threshold ──────────────────────────

  describe('low confidence threshold (Req 6.3)', () => {
    it('exports LOW_CONFIDENCE_THRESHOLD as 0.6', () => {
      expect(LOW_CONFIDENCE_THRESHOLD).toBe(0.6);
    });

    it('returns low confidence when AI is uncertain', async () => {
      mockAIResponse('consultation', 0.4, 'Ambiguous request');

      const result = await classifyIntentContextual(makeMessages(1), noPayroll, fakeModel);

      expect(result.confidence).toBeLessThan(LOW_CONFIDENCE_THRESHOLD);
    });
  });

  // ── Req 6.4: Payroll priority boost ────────────────────────────

  describe('payroll priority boost (Req 6.4)', () => {
    it('boosts consultation to audit when payroll data is present and confidence is moderate', async () => {
      mockAIResponse('consultation', 0.65);

      const result = await classifyIntentContextual(makeMessages(1), withPayroll, fakeModel);

      expect(result.intent).toBe('audit');
      expect(result.reasoning).toContain('datos de nómina');
    });

    it('does NOT boost when confidence is high (>= 0.75)', async () => {
      mockAIResponse('consultation', 0.8);

      const result = await classifyIntentContextual(makeMessages(1), withPayroll, fakeModel);

      expect(result.intent).toBe('consultation');
    });

    it('does NOT boost when no payroll data', async () => {
      mockAIResponse('consultation', 0.65);

      const result = await classifyIntentContextual(makeMessages(1), noPayroll, fakeModel);

      expect(result.intent).toBe('consultation');
    });

    it('does NOT boost when intent is already a payroll-priority intent', async () => {
      mockAIResponse('audit', 0.65);

      const result = await classifyIntentContextual(makeMessages(1), withPayroll, fakeModel);

      expect(result.intent).toBe('audit');
      // Confidence should remain unchanged (no boost applied)
      expect(result.confidence).toBe(0.65);
    });

    it('does NOT boost non-consultation intents like mapping', async () => {
      mockAIResponse('mapping', 0.65);

      const result = await classifyIntentContextual(makeMessages(1), withPayroll, fakeModel);

      expect(result.intent).toBe('mapping');
    });
  });

  // ── Empty messages fallback ────────────────────────────────────

  describe('empty messages fallback', () => {
    it('returns consultation with low confidence when no messages', async () => {
      const result = await classifyIntentContextual([], noPayroll, fakeModel);

      expect(result.intent).toBe('consultation');
      expect(result.confidence).toBe(0.3);
      expect(result.contextUsed).toBe(0);
      // Should NOT call AI
      expect(mockGenerateObject).not.toHaveBeenCalled();
    });
  });

  // ── Result structure ───────────────────────────────────────────

  describe('result structure', () => {
    it('returns all required fields', async () => {
      mockAIResponse('report', 0.9, 'User wants a report');

      const result = await classifyIntentContextual(makeMessages(2), noPayroll, fakeModel);

      expect(result).toHaveProperty('intent');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reasoning');
      expect(result).toHaveProperty('contextUsed');
      expect(typeof result.intent).toBe('string');
      expect(typeof result.confidence).toBe('number');
      expect(typeof result.reasoning).toBe('string');
      expect(typeof result.contextUsed).toBe('number');
    });

    it('includes reasoning from AI', async () => {
      mockAIResponse('correction', 0.75, 'User mentioned fixing errors');

      const result = await classifyIntentContextual(makeMessages(1), noPayroll, fakeModel);

      expect(result.reasoning).toBe('User mentioned fixing errors');
    });
  });

  // ── Payroll context in prompt ──────────────────────────────────

  describe('payroll context in prompt', () => {
    it('includes payroll context hint when data is present', async () => {
      mockAIResponse('audit', 0.9);

      await classifyIntentContextual(makeMessages(1), withPayroll, fakeModel);

      const callArgs = mockGenerateObject.mock.calls[0][0] as { prompt: string };
      expect(callArgs.prompt).toContain('datos de nómina cargados');
      expect(callArgs.prompt).toContain('CO');
    });

    it('does NOT include payroll context hint when no data', async () => {
      mockAIResponse('consultation', 0.8);

      await classifyIntentContextual(makeMessages(1), noPayroll, fakeModel);

      const callArgs = mockGenerateObject.mock.calls[0][0] as { prompt: string };
      expect(callArgs.prompt).not.toContain('datos de nómina cargados');
    });
  });
});
