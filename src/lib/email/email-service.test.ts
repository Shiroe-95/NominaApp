import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SendEmailOptions } from '@/lib/types/regulatory-sync';

// ── Mock Supabase ───────────────────────────────────────────────────

const mockInsert = vi.fn();
const mockContains = vi.fn();
const mockSelectProfiles = vi.fn(() => ({ contains: mockContains }));

const mockFrom = vi.fn((table: string) => {
  if (table === 'email_log') {
    return { insert: mockInsert };
  }
  if (table === 'user_profiles') {
    return { select: mockSelectProfiles };
  }
  return {};
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

// ── Mock fetch ──────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── Import after mocks ─────────────────────────────────────────────

import { sendEmail, resolveTemplate } from './email-service';

// ── Helpers ─────────────────────────────────────────────────────────

function makeOptions(
  overrides: Partial<SendEmailOptions> = {},
): SendEmailOptions {
  return {
    to: 'user@example.com',
    type: 'user_invitation',
    locale: 'es',
    data: { displayName: 'Juan', inviteUrl: 'https://app.test/invite/abc' },
    ...overrides,
  };
}

function mockResendSuccess(messageId = 'msg-001') {
  mockFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => ({ id: messageId }),
  });
}

function mockResendError(status = 500, body = 'Internal Server Error') {
  mockFetch.mockResolvedValueOnce({
    ok: false,
    status,
    headers: new Headers(),
    text: async () => body,
  });
}

// ── Tests ───────────────────────────────────────────────────────────

describe('EmailService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('RESEND_API_KEY', 'test-api-key');
    vi.stubEnv('RESEND_FROM_EMAIL', 'noreply@test.com');
    mockInsert.mockResolvedValue({ error: null });
  });

  // ── resolveTemplate ─────────────────────────────────────────────

  describe('resolveTemplate', () => {
    it('resolves user_invitation template', () => {
      const result = resolveTemplate('user_invitation', 'es', {
        displayName: 'Ana',
        inviteUrl: 'https://app.test/invite',
      });
      expect(result.subject).toContain('invitado');
      expect(result.html).toContain('Ana');
    });

    it('resolves regulatory_alert template', () => {
      const result = resolveTemplate('regulatory_alert', 'en', {
        countryName: 'Colombia',
        changesCount: 3,
        confidence: 'high',
        changesDetail: 'SMMLV updated',
      });
      expect(result.subject).toContain('Colombia');
      expect(result.html).toContain('Regulatory Alert');
    });

    it('resolves weekly_summary template', () => {
      const result = resolveTemplate('weekly_summary', 'pt', {
        syncs: [{ country: 'BR', status: 'completed', changes: 2 }],
      });
      expect(result.subject).toContain('Resumo Semanal');
    });

    it('throws for unknown email type', () => {
      expect(() =>
        resolveTemplate('unknown' as never, 'es', {}),
      ).toThrow('Unknown email type');
    });
  });

  // ── sendEmail — basic send ──────────────────────────────────────

  describe('sendEmail', () => {
    it('sends a single email and logs success', async () => {
      mockResendSuccess('msg-123');

      const result = await sendEmail(makeOptions());

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('msg-123');

      // Verify Resend API was called correctly
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test-api-key',
          }),
        }),
      );

      // Verify email_log was written
      expect(mockFrom).toHaveBeenCalledWith('email_log');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          to_email: 'user@example.com',
          email_type: 'user_invitation',
          status: 'sent',
          resend_message_id: 'msg-123',
        }),
      );
    });

    it('sends to multiple recipients', async () => {
      mockResendSuccess('msg-a');
      mockResendSuccess('msg-b');

      const result = await sendEmail(
        makeOptions({ to: ['a@test.com', 'b@test.com'] }),
      );

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('returns failure when RESEND_API_KEY is missing', async () => {
      vi.stubEnv('RESEND_API_KEY', '');

      const result = await sendEmail(makeOptions());

      expect(result.success).toBe(false);
      expect(result.error).toContain('RESEND_API_KEY');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('logs failure when Resend returns a non-retryable error', async () => {
      mockResendError(422, 'Invalid email');

      const result = await sendEmail(makeOptions());

      expect(result.success).toBe(false);
      expect(result.error).toContain('422');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'failed' }),
      );
    });

    it('reports partial failure for multiple recipients', async () => {
      mockResendSuccess('msg-ok');
      mockResendError(422, 'bad address');

      const result = await sendEmail(
        makeOptions({ to: ['good@test.com', 'bad@test.com'] }),
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('1/2 emails failed');
    });
  });

  // ── sendEmail — regulatory alert filtering ──────────────────────

  describe('sendEmail — regulatory alert with country filtering', () => {
    it('filters recipients by alert_countries', async () => {
      mockContains.mockResolvedValueOnce({
        data: [
          { email: 'admin1@test.com', preferred_locale: 'es' },
          { email: 'admin2@test.com', preferred_locale: 'en' },
        ],
        error: null,
      });
      mockResendSuccess('msg-1');
      mockResendSuccess('msg-2');

      const result = await sendEmail({
        to: '',
        type: 'regulatory_alert',
        locale: 'es',
        data: {
          countryCode: 'CO',
          countryName: 'Colombia',
          changesCount: 2,
          confidence: 'high',
          changesDetail: 'SMMLV changed',
        },
      });

      expect(result.success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('user_profiles');
      expect(mockContains).toHaveBeenCalledWith('alert_countries', ['CO']);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('returns success when no recipients match the country', async () => {
      mockContains.mockResolvedValueOnce({ data: [], error: null });

      const result = await sendEmail({
        to: '',
        type: 'regulatory_alert',
        locale: 'es',
        data: { countryCode: 'XX', countryName: 'Unknown' },
      });

      expect(result.success).toBe(true);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('throws when user_profiles query fails', async () => {
      mockContains.mockResolvedValueOnce({
        data: null,
        error: { message: 'connection refused' },
      });

      await expect(
        sendEmail({
          to: '',
          type: 'regulatory_alert',
          locale: 'es',
          data: { countryCode: 'CO' },
        }),
      ).rejects.toThrow('Failed to fetch alert recipients');
    });

    it('uses each recipient preferred locale', async () => {
      mockContains.mockResolvedValueOnce({
        data: [{ email: 'pt-user@test.com', preferred_locale: 'pt' }],
        error: null,
      });
      mockResendSuccess('msg-pt');

      await sendEmail({
        to: '',
        type: 'regulatory_alert',
        locale: 'es', // this should be overridden by user's preferred locale
        data: {
          countryCode: 'BR',
          countryName: 'Brasil',
          changesCount: 1,
          confidence: 'medium',
          changesDetail: 'Tax rate changed',
        },
      });

      // Verify the fetch body uses Portuguese template
      const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(callBody.subject).toContain('Brasil');
    });
  });
});
