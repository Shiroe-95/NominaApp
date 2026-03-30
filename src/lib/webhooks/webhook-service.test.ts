import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Chainable mock builder (same pattern as audit-service tests) ────

function createChainMock(resolvedValue?: { data: unknown; error: unknown }) {
  const terminal = resolvedValue
    ? vi.fn().mockResolvedValue(resolvedValue)
    : vi.fn();

  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;

  chain.select = vi.fn((...args: unknown[]) => {
    // When called with count options (head: true), return terminal directly
    if (args.length > 1 && typeof args[1] === 'object') {
      return terminal;
    }
    return chain;
  });
  chain.insert = vi.fn(self);
  chain.update = vi.fn(self);
  chain.delete = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.lt = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.lte = vi.fn(self);
  chain.contains = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = terminal;
  chain.single = terminal;

  return { chain, terminal };
}

// ── Mock Supabase ───────────────────────────────────────────────────

let webhooksMock: ReturnType<typeof createChainMock>;
let deliveriesMock: ReturnType<typeof createChainMock>;

const mockFrom = vi.fn((table: string) => {
  if (table === 'webhooks') return webhooksMock.chain;
  if (table === 'webhook_deliveries') return deliveriesMock.chain;
  return {};
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

// ── Mock fetch ──────────────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import {
  signPayload,
  verifySignature,
  generateWebhookSecret,
  calculateRetryDelay,
  createWebhook,
  listWebhooks,
  getWebhook,
  updateWebhook,
  deleteWebhook,
  queryDeliveryLog,
  sendTestEvent,
  retryDelivery,
  MAX_WEBHOOKS_PER_WORKSPACE,
  MAX_RETRY_ATTEMPTS,
  BASE_RETRY_DELAY_MS,
  DEFAULT_DELIVERY_PAGE_SIZE,
  MAX_DELIVERY_PAGE_SIZE,
  type WebhookRow,
  type WebhookDeliveryRow,
} from './webhook-service';


// ── Helpers ─────────────────────────────────────────────────────────

function makeWebhookRow(overrides: Partial<WebhookRow> = {}): WebhookRow {
  return {
    id: 'wh-001',
    workspace_id: 'ws-001',
    url: 'https://example.com/webhook',
    secret_encrypted: 'abc123secret',
    events: ['payroll.uploaded', 'audit.completed'],
    is_active: true,
    created_by: 'user-001',
    created_at: '2025-01-15T10:00:00Z',
    ...overrides,
  };
}

function makeDeliveryRow(overrides: Partial<WebhookDeliveryRow> = {}): WebhookDeliveryRow {
  return {
    id: 'del-001',
    webhook_id: 'wh-001',
    event_type: 'payroll.uploaded',
    status: 'success',
    http_status: 200,
    response_time_ms: 150,
    attempts: 1,
    last_attempt_at: '2025-01-15T10:00:00Z',
    next_retry_at: null,
    payload_summary: { event: 'payroll.uploaded' },
    created_at: '2025-01-15T10:00:00Z',
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('WebhookService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    webhooksMock = createChainMock();
    deliveriesMock = createChainMock();
  });

  // ── Constants ─────────────────────────────────────────────────────

  describe('constants', () => {
    it('MAX_WEBHOOKS_PER_WORKSPACE is 10', () => {
      expect(MAX_WEBHOOKS_PER_WORKSPACE).toBe(10);
    });

    it('MAX_RETRY_ATTEMPTS is 5', () => {
      expect(MAX_RETRY_ATTEMPTS).toBe(5);
    });

    it('BASE_RETRY_DELAY_MS is 30000', () => {
      expect(BASE_RETRY_DELAY_MS).toBe(30_000);
    });

    it('DEFAULT_DELIVERY_PAGE_SIZE is 50', () => {
      expect(DEFAULT_DELIVERY_PAGE_SIZE).toBe(50);
    });

    it('MAX_DELIVERY_PAGE_SIZE is 200', () => {
      expect(MAX_DELIVERY_PAGE_SIZE).toBe(200);
    });
  });

  // ── HMAC-SHA256 Signing ───────────────────────────────────────────

  describe('signPayload', () => {
    it('produces a hex-encoded HMAC-SHA256 signature', () => {
      const sig = signPayload('hello', 'secret');
      expect(sig).toMatch(/^[0-9a-f]{64}$/);
    });

    it('produces consistent signatures for same input', () => {
      const sig1 = signPayload('data', 'key');
      const sig2 = signPayload('data', 'key');
      expect(sig1).toBe(sig2);
    });

    it('produces different signatures for different payloads', () => {
      const sig1 = signPayload('data1', 'key');
      const sig2 = signPayload('data2', 'key');
      expect(sig1).not.toBe(sig2);
    });

    it('produces different signatures for different secrets', () => {
      const sig1 = signPayload('data', 'key1');
      const sig2 = signPayload('data', 'key2');
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('verifySignature', () => {
    it('returns true for valid signature', () => {
      const sig = signPayload('hello', 'secret');
      expect(verifySignature('hello', sig, 'secret')).toBe(true);
    });

    it('returns false for invalid signature', () => {
      expect(verifySignature('hello', 'invalidsig'.padEnd(64, '0'), 'secret')).toBe(false);
    });

    it('returns false for wrong secret', () => {
      const sig = signPayload('hello', 'secret1');
      expect(verifySignature('hello', sig, 'secret2')).toBe(false);
    });

    it('returns false for tampered payload', () => {
      const sig = signPayload('hello', 'secret');
      expect(verifySignature('tampered', sig, 'secret')).toBe(false);
    });
  });

  describe('generateWebhookSecret', () => {
    it('generates a 64-character hex string', () => {
      const secret = generateWebhookSecret();
      expect(secret).toMatch(/^[0-9a-f]{64}$/);
    });

    it('generates unique secrets', () => {
      const s1 = generateWebhookSecret();
      const s2 = generateWebhookSecret();
      expect(s1).not.toBe(s2);
    });
  });

  // ── Retry Backoff ─────────────────────────────────────────────────

  describe('calculateRetryDelay', () => {
    it('returns 30s for attempt 0', () => {
      expect(calculateRetryDelay(0)).toBe(30_000);
    });

    it('returns 60s for attempt 1', () => {
      expect(calculateRetryDelay(1)).toBe(60_000);
    });

    it('returns 120s for attempt 2', () => {
      expect(calculateRetryDelay(2)).toBe(120_000);
    });

    it('follows exponential pattern', () => {
      for (let i = 0; i < 5; i++) {
        expect(calculateRetryDelay(i)).toBe(BASE_RETRY_DELAY_MS * Math.pow(2, i));
      }
    });
  });

  // ── CRUD: createWebhook ───────────────────────────────────────────

  describe('createWebhook', () => {
    it('creates a webhook and returns it with secret', async () => {
      // Count check
      webhooksMock.terminal.mockResolvedValueOnce({ count: 0, error: null });
      // Insert
      const row = makeWebhookRow();
      webhooksMock.terminal.mockResolvedValueOnce({ data: row, error: null });

      const result = await createWebhook('ws-001', 'user-001', {
        url: 'https://example.com/webhook',
        events: ['payroll.uploaded'],
        is_active: true,
      });

      expect(result.webhook).toEqual(row);
      expect(result.secret).toMatch(/^[0-9a-f]{64}$/);
      expect(mockFrom).toHaveBeenCalledWith('webhooks');
    });

    it('throws when workspace limit is reached', async () => {
      webhooksMock.terminal.mockResolvedValueOnce({ count: 10, error: null });

      await expect(
        createWebhook('ws-001', 'user-001', {
          url: 'https://example.com/webhook',
          events: ['payroll.uploaded'],
          is_active: true,
        }),
      ).rejects.toThrow('Maximum of 10 webhooks per workspace reached');
    });

    it('throws when workspace_id is missing', async () => {
      await expect(
        createWebhook('', 'user-001', {
          url: 'https://example.com/webhook',
          events: ['payroll.uploaded'],
        }),
      ).rejects.toThrow('workspace_id is required');
    });

    it('throws when user_id is missing', async () => {
      await expect(
        createWebhook('ws-001', '', {
          url: 'https://example.com/webhook',
          events: ['payroll.uploaded'],
        }),
      ).rejects.toThrow('user_id is required');
    });

    it('throws on Supabase insert error', async () => {
      webhooksMock.terminal.mockResolvedValueOnce({ count: 0, error: null });
      webhooksMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { message: 'RLS violation' },
      });

      await expect(
        createWebhook('ws-001', 'user-001', {
          url: 'https://example.com/webhook',
          events: ['payroll.uploaded'],
        }),
      ).rejects.toThrow('Failed to create webhook: RLS violation');
    });
  });

  // ── CRUD: listWebhooks ───────────────────────────────────────────

  describe('listWebhooks', () => {
    it('returns webhooks ordered by created_at desc', async () => {
      const rows = [makeWebhookRow({ id: 'wh-1' }), makeWebhookRow({ id: 'wh-2' })];
      webhooksMock.chain.order.mockResolvedValueOnce({ data: rows, error: null });

      const result = await listWebhooks('ws-001');

      expect(result).toEqual(rows);
      expect(webhooksMock.chain.eq).toHaveBeenCalledWith('workspace_id', 'ws-001');
    });

    it('returns empty array when no webhooks exist', async () => {
      webhooksMock.chain.order.mockResolvedValueOnce({ data: [], error: null });

      const result = await listWebhooks('ws-001');
      expect(result).toEqual([]);
    });

    it('throws when workspace_id is missing', async () => {
      await expect(listWebhooks('')).rejects.toThrow('workspace_id is required');
    });

    it('throws on Supabase error', async () => {
      webhooksMock.chain.order.mockResolvedValueOnce({
        data: null,
        error: { message: 'connection refused' },
      });

      await expect(listWebhooks('ws-001')).rejects.toThrow(
        'Failed to list webhooks: connection refused',
      );
    });
  });

  // ── CRUD: getWebhook ─────────────────────────────────────────────

  describe('getWebhook', () => {
    it('returns a single webhook by id', async () => {
      const row = makeWebhookRow();
      webhooksMock.terminal.mockResolvedValueOnce({ data: row, error: null });

      const result = await getWebhook('wh-001');

      expect(result).toEqual(row);
      expect(webhooksMock.chain.eq).toHaveBeenCalledWith('id', 'wh-001');
    });

    it('throws when webhook_id is missing', async () => {
      await expect(getWebhook('')).rejects.toThrow('webhook_id is required');
    });

    it('throws on Supabase error', async () => {
      webhooksMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      });

      await expect(getWebhook('wh-001')).rejects.toThrow('Failed to get webhook: not found');
    });
  });

  // ── CRUD: updateWebhook ───────────────────────────────────────────

  describe('updateWebhook', () => {
    it('updates webhook fields', async () => {
      const updated = makeWebhookRow({ url: 'https://new.example.com/hook' });
      webhooksMock.terminal.mockResolvedValueOnce({ data: updated, error: null });

      const result = await updateWebhook('wh-001', { url: 'https://new.example.com/hook' });

      expect(result.url).toBe('https://new.example.com/hook');
      expect(webhooksMock.chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://new.example.com/hook' }),
      );
    });

    it('throws when webhook_id is missing', async () => {
      await expect(updateWebhook('', { url: 'https://x.com' })).rejects.toThrow(
        'webhook_id is required',
      );
    });

    it('throws when no fields to update', async () => {
      await expect(updateWebhook('wh-001', {})).rejects.toThrow('No fields to update');
    });

    it('throws on Supabase error', async () => {
      webhooksMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { message: 'update failed' },
      });

      await expect(
        updateWebhook('wh-001', { is_active: false }),
      ).rejects.toThrow('Failed to update webhook: update failed');
    });
  });

  // ── CRUD: deleteWebhook ───────────────────────────────────────────

  describe('deleteWebhook', () => {
    it('deletes a webhook', async () => {
      webhooksMock.chain.eq.mockResolvedValueOnce({ error: null });

      await expect(deleteWebhook('wh-001')).resolves.toBeUndefined();
      expect(webhooksMock.chain.delete).toHaveBeenCalled();
    });

    it('throws when webhook_id is missing', async () => {
      await expect(deleteWebhook('')).rejects.toThrow('webhook_id is required');
    });

    it('throws on Supabase error', async () => {
      webhooksMock.chain.eq.mockResolvedValueOnce({
        error: { message: 'FK constraint' },
      });

      await expect(deleteWebhook('wh-001')).rejects.toThrow(
        'Failed to delete webhook: FK constraint',
      );
    });
  });

  // ── Delivery Log ──────────────────────────────────────────────────

  describe('queryDeliveryLog', () => {
    it('returns paginated delivery log', async () => {
      const rows = [makeDeliveryRow({ id: 'd1' }), makeDeliveryRow({ id: 'd2' })];
      deliveriesMock.terminal.mockResolvedValueOnce({ data: rows, error: null });

      const result = await queryDeliveryLog('wh-001');

      expect(result.data).toEqual(rows);
      expect(result.has_more).toBe(false);
      expect(result.next_cursor).toBeNull();
    });

    it('detects has_more when extra row returned', async () => {
      const rows = Array.from({ length: 4 }, (_, i) =>
        makeDeliveryRow({
          id: `d${i}`,
          created_at: `2025-01-${String(15 - i).padStart(2, '0')}T10:00:00Z`,
        }),
      );
      deliveriesMock.terminal.mockResolvedValueOnce({ data: rows, error: null });

      const result = await queryDeliveryLog('wh-001', { page_size: 3 });

      expect(result.data).toHaveLength(3);
      expect(result.has_more).toBe(true);
      expect(result.next_cursor).toBe(result.data[2].created_at);
    });

    it('clamps page_size to MAX_DELIVERY_PAGE_SIZE', async () => {
      deliveriesMock.terminal.mockResolvedValueOnce({ data: [], error: null });

      await queryDeliveryLog('wh-001', { page_size: 999 });

      expect(deliveriesMock.chain.limit).toHaveBeenCalledWith(MAX_DELIVERY_PAGE_SIZE + 1);
    });

    it('applies cursor filter', async () => {
      deliveriesMock.terminal.mockResolvedValueOnce({ data: [], error: null });

      await queryDeliveryLog('wh-001', { cursor: '2025-01-10T00:00:00Z' });

      expect(deliveriesMock.chain.lt).toHaveBeenCalledWith('created_at', '2025-01-10T00:00:00Z');
    });

    it('throws when webhook_id is missing', async () => {
      await expect(queryDeliveryLog('')).rejects.toThrow('webhook_id is required');
    });

    it('throws on Supabase error', async () => {
      deliveriesMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { message: 'timeout' },
      });

      await expect(queryDeliveryLog('wh-001')).rejects.toThrow(
        'Failed to query delivery log: timeout',
      );
    });
  });

  // ── retryDelivery ─────────────────────────────────────────────────

  describe('retryDelivery', () => {
    it('throws when delivery_id is missing', async () => {
      await expect(retryDelivery('')).rejects.toThrow('delivery_id is required');
    });

    it('throws when max attempts reached', async () => {
      const delivery = {
        ...makeDeliveryRow({ attempts: 5, status: 'failed' as const }),
        webhooks: makeWebhookRow(),
      };
      deliveriesMock.terminal.mockResolvedValueOnce({ data: delivery, error: null });

      await expect(retryDelivery('del-001')).rejects.toThrow(
        'Maximum retry attempts (5) reached',
      );
    });

    it('throws when trying to retry a successful delivery', async () => {
      const delivery = {
        ...makeDeliveryRow({ attempts: 1, status: 'success' as const }),
        webhooks: makeWebhookRow(),
      };
      deliveriesMock.terminal.mockResolvedValueOnce({ data: delivery, error: null });

      await expect(retryDelivery('del-001')).rejects.toThrow(
        'Cannot retry a successful delivery',
      );
    });

    it('retries a failed delivery and updates record on success', async () => {
      const delivery = {
        ...makeDeliveryRow({ attempts: 1, status: 'failed' as const }),
        webhooks: makeWebhookRow(),
      };
      deliveriesMock.terminal.mockResolvedValueOnce({ data: delivery, error: null });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      // Update call
      deliveriesMock.chain.eq.mockResolvedValueOnce({ error: null });

      const result = await retryDelivery('del-001');

      expect(result.status).toBe('success');
      expect(result.http_status).toBe(200);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('retries a failed delivery and schedules next retry on failure', async () => {
      const delivery = {
        ...makeDeliveryRow({ attempts: 1, status: 'failed' as const }),
        webhooks: makeWebhookRow(),
      };
      deliveriesMock.terminal.mockResolvedValueOnce({ data: delivery, error: null });

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      // Update call
      deliveriesMock.chain.eq.mockResolvedValueOnce({ error: null });

      const result = await retryDelivery('del-001');

      expect(result.status).toBe('failed');
      expect(result.http_status).toBe(500);
    });
  });

  // ── sendTestEvent ─────────────────────────────────────────────────

  describe('sendTestEvent', () => {
    it('throws when webhook_id is missing', async () => {
      await expect(sendTestEvent('')).rejects.toThrow('webhook_id is required');
    });

    it('sends a test event to the webhook endpoint', async () => {
      const row = makeWebhookRow();
      // getWebhook call
      webhooksMock.terminal.mockResolvedValueOnce({ data: row, error: null });
      // deliverToWebhook: create delivery record
      deliveriesMock.terminal.mockResolvedValueOnce({
        data: makeDeliveryRow({ status: 'pending' }),
        error: null,
      });
      // fetch call
      mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
      // update delivery record
      deliveriesMock.chain.eq.mockResolvedValueOnce({ error: null });

      const result = await sendTestEvent('wh-001');

      expect(result.delivery_id).toBe('del-001');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/webhook',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Webhook-Signature': expect.any(String),
          }),
        }),
      );
    });
  });
});
