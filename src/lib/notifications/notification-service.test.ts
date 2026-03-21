import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CreateNotificationOptions } from '@/lib/types/regulatory-sync';

// ── Mock Supabase ───────────────────────────────────────────────────

const mockSingle = vi.fn();
const mockSelectId = vi.fn(() => ({ single: mockSingle }));
const mockSelectIds = vi.fn();
const mockInsert = vi.fn((rows: unknown) => {
  // If inserting a single object, return chain with .single()
  if (!Array.isArray(rows)) {
    return { select: mockSelectId };
  }
  // If inserting an array (broadcast), return chain without .single()
  return { select: mockSelectIds };
});

// For update chain: .update().eq().eq()
const mockUpdateEq2 = vi.fn();
const mockUpdateEq1 = vi.fn(() => ({ eq: mockUpdateEq2 }));
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq1 }));

// For select count chain: .select().eq().eq()
const mockCountEq2 = vi.fn();
const mockCountEq1 = vi.fn(() => ({ eq: mockCountEq2 }));
const mockCountSelect = vi.fn(() => ({ eq: mockCountEq1 }));

// For admin query chain: .select().eq()
const mockAdminEq = vi.fn();
const mockAdminSelect = vi.fn(() => ({ eq: mockAdminEq }));

const mockFrom = vi.fn((table: string) => {
  if (table === 'notifications') {
    return {
      insert: mockInsert,
      update: mockUpdate,
      select: mockCountSelect,
    };
  }
  if (table === 'user_profiles') {
    return { select: mockAdminSelect };
  }
  return {};
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import {
  createNotification,
  markAsRead,
  getUnreadCount,
  mapConfidenceToSeverity,
} from './notification-service';

// ── Helpers ─────────────────────────────────────────────────────────

function makeOptions(
  overrides: Partial<CreateNotificationOptions> = {},
): CreateNotificationOptions {
  return {
    userId: 'user-001',
    type: 'regulatory_change',
    severity: 'info',
    title: 'New regulation detected',
    body: 'Colombia 2026 SMMLV changed',
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('NotificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── mapConfidenceToSeverity ─────────────────────────────────────

  describe('mapConfidenceToSeverity', () => {
    it('maps high confidence to info', () => {
      expect(mapConfidenceToSeverity('high')).toBe('info');
    });

    it('maps medium confidence to warning', () => {
      expect(mapConfidenceToSeverity('medium')).toBe('warning');
    });

    it('maps low confidence to warning', () => {
      expect(mapConfidenceToSeverity('low')).toBe('warning');
    });
  });

  // ── createNotification ──────────────────────────────────────────

  describe('createNotification', () => {
    it('inserts a single notification when userId is provided', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'notif-123' },
        error: null,
      });

      const id = await createNotification(makeOptions());

      expect(id).toBe('notif-123');
      expect(mockFrom).toHaveBeenCalledWith('notifications');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-001',
          type: 'regulatory_change',
          severity: 'info',
          title: 'New regulation detected',
          body: 'Colombia 2026 SMMLV changed',
          metadata: {},
        }),
      );
    });

    it('passes metadata when provided', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'notif-456' },
        error: null,
      });

      const id = await createNotification(
        makeOptions({ metadata: { country: 'CO' } }),
      );

      expect(id).toBe('notif-456');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { country: 'CO' } }),
      );
    });

    it('broadcasts to all admins when userId is omitted', async () => {
      mockAdminEq.mockResolvedValueOnce({
        data: [{ user_id: 'admin-1' }, { user_id: 'admin-2' }],
        error: null,
      });
      mockSelectIds.mockResolvedValueOnce({
        data: [{ id: 'notif-a' }, { id: 'notif-b' }],
        error: null,
      });

      const id = await createNotification(
        makeOptions({ userId: undefined }),
      );

      expect(id).toBe('notif-a');
      expect(mockFrom).toHaveBeenCalledWith('user_profiles');
      expect(mockAdminSelect).toHaveBeenCalledWith('user_id');
      expect(mockAdminEq).toHaveBeenCalledWith('role', 'admin');
      expect(mockInsert).toHaveBeenCalledWith([
        expect.objectContaining({ user_id: 'admin-1' }),
        expect.objectContaining({ user_id: 'admin-2' }),
      ]);
    });

    it('throws when no admin users found for broadcast', async () => {
      mockAdminEq.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      await expect(
        createNotification(makeOptions({ userId: undefined })),
      ).rejects.toThrow('No admin users found for broadcast');
    });

    it('throws on admin query error', async () => {
      mockAdminEq.mockResolvedValueOnce({
        data: null,
        error: { message: 'connection refused' },
      });

      await expect(
        createNotification(makeOptions({ userId: undefined })),
      ).rejects.toThrow('Failed to fetch admin users: connection refused');
    });

    it('throws on insert error', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'FK violation' },
      });

      await expect(createNotification(makeOptions())).rejects.toThrow(
        'Failed to create notification: FK violation',
      );
    });

    it('throws on broadcast insert error', async () => {
      mockAdminEq.mockResolvedValueOnce({
        data: [{ user_id: 'admin-1' }],
        error: null,
      });
      mockSelectIds.mockResolvedValueOnce({
        data: null,
        error: { message: 'insert failed' },
      });

      await expect(
        createNotification(makeOptions({ userId: undefined })),
      ).rejects.toThrow('Failed to broadcast notifications: insert failed');
    });
  });

  // ── markAsRead ──────────────────────────────────────────────────

  describe('markAsRead', () => {
    it('updates is_read and read_at for the notification', async () => {
      mockUpdateEq2.mockResolvedValueOnce({ error: null });

      await markAsRead('notif-123', 'user-001');

      expect(mockFrom).toHaveBeenCalledWith('notifications');
      expect(mockUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          is_read: true,
          read_at: expect.any(String),
        }),
      );
      expect(mockUpdateEq1).toHaveBeenCalledWith('id', 'notif-123');
      expect(mockUpdateEq2).toHaveBeenCalledWith('user_id', 'user-001');
    });

    it('throws on update error', async () => {
      mockUpdateEq2.mockResolvedValueOnce({
        error: { message: 'not found' },
      });

      await expect(markAsRead('notif-bad', 'user-001')).rejects.toThrow(
        'Failed to mark notification as read: not found',
      );
    });
  });

  // ── getUnreadCount ──────────────────────────────────────────────

  describe('getUnreadCount', () => {
    it('returns the count of unread notifications', async () => {
      mockCountEq2.mockResolvedValueOnce({
        count: 5,
        error: null,
      });

      const count = await getUnreadCount('user-001');

      expect(count).toBe(5);
      expect(mockFrom).toHaveBeenCalledWith('notifications');
      expect(mockCountSelect).toHaveBeenCalledWith('*', {
        count: 'exact',
        head: true,
      });
    });

    it('returns 0 when count is null', async () => {
      mockCountEq2.mockResolvedValueOnce({
        count: null,
        error: null,
      });

      const count = await getUnreadCount('user-001');

      expect(count).toBe(0);
    });

    it('throws on query error', async () => {
      mockCountEq2.mockResolvedValueOnce({
        count: null,
        error: { message: 'timeout' },
      });

      await expect(getUnreadCount('user-001')).rejects.toThrow(
        'Failed to get unread notification count: timeout',
      );
    });
  });
});
