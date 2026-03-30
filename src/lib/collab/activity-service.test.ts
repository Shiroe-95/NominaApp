import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Chainable mock builder ──────────────────────────────────────────

function createChainMock(resolvedValue?: { data: unknown; error: unknown }) {
  const terminal = resolvedValue
    ? vi.fn().mockResolvedValue(resolvedValue)
    : vi.fn();

  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;

  chain.select = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.lte = vi.fn(self);
  chain.lt = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.single = terminal;

  return { chain, terminal };
}

// ── Mock Supabase ───────────────────────────────────────────────────

let activityMock: ReturnType<typeof createChainMock>;

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
};
const mockRemoveChannel = vi.fn();

const mockFrom = vi.fn((table: string) => {
  if (table === 'activity_log') return activityMock.chain;
  return {};
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: mockFrom,
    channel: vi.fn(() => mockChannel),
    removeChannel: mockRemoveChannel,
  }),
}));

import {
  logActivity,
  listActivities,
  getRecentActivities,
  subscribeToActivities,
  DEFAULT_PAGE_SIZE,
  RECENT_ACTIVITIES_LIMIT,
  type ActivityRow,
  type LogActivityInput,
} from './activity-service';

// ── Helpers ─────────────────────────────────────────────────────────

function makeLogInput(overrides: Partial<LogActivityInput> = {}): LogActivityInput {
  return {
    workspace_id: 'ws-001',
    user_id: 'user-001',
    activity_type: 'upload',
    ...overrides,
  };
}

function makeActivityRow(overrides: Partial<ActivityRow> = {}): ActivityRow {
  return {
    id: 'act-001',
    workspace_id: 'ws-001',
    user_id: 'user-001',
    activity_type: 'upload',
    resource_type: null,
    resource_id: null,
    metadata: null,
    group_key: null,
    created_at: '2025-01-15T10:00:00Z',
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('ActivityService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    activityMock = createChainMock();
  });

  // ── logActivity ─────────────────────────────────────────────────

  describe('logActivity', () => {
    it('inserts an activity and returns the row', async () => {
      const row = makeActivityRow();
      activityMock.terminal.mockResolvedValueOnce({ data: row, error: null });

      const result = await logActivity(makeLogInput());

      expect(result).toEqual(row);
      expect(mockFrom).toHaveBeenCalledWith('activity_log');
      expect(activityMock.chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: 'ws-001',
          user_id: 'user-001',
          activity_type: 'upload',
        }),
      );
    });

    it('stores optional fields: resource_type, resource_id, metadata, group_key', async () => {
      const row = makeActivityRow({
        resource_type: 'payroll',
        resource_id: 'pay-001',
        metadata: { fileName: 'jan.xlsx' },
        group_key: 'payroll:pay-001',
      });
      activityMock.terminal.mockResolvedValueOnce({ data: row, error: null });

      await logActivity(makeLogInput({
        resource_type: 'payroll',
        resource_id: 'pay-001',
        metadata: { fileName: 'jan.xlsx' },
        group_key: 'payroll:pay-001',
      }));

      expect(activityMock.chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          resource_type: 'payroll',
          resource_id: 'pay-001',
          metadata: { fileName: 'jan.xlsx' },
          group_key: 'payroll:pay-001',
        }),
      );
    });

    it('supports all valid activity types', async () => {
      const types = ['upload', 'audit', 'correction', 'comment', 'status_change', 'report'] as const;
      for (const activityType of types) {
        activityMock.terminal.mockResolvedValueOnce({
          data: makeActivityRow({ activity_type: activityType }),
          error: null,
        });

        const result = await logActivity(makeLogInput({ activity_type: activityType }));
        expect(result.activity_type).toBe(activityType);
      }
    });

    it('throws when workspace_id is missing', async () => {
      await expect(
        logActivity(makeLogInput({ workspace_id: '' })),
      ).rejects.toThrow('workspace_id is required');
    });

    it('throws when user_id is missing', async () => {
      await expect(
        logActivity(makeLogInput({ user_id: '' })),
      ).rejects.toThrow('user_id is required');
    });

    it('throws when activity_type is invalid', async () => {
      await expect(
        logActivity(makeLogInput({ activity_type: 'invalid' as never })),
      ).rejects.toThrow('activity_type must be one of');
    });

    it('throws on Supabase insert error', async () => {
      activityMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { message: 'RLS violation' },
      });

      await expect(
        logActivity(makeLogInput()),
      ).rejects.toThrow('Failed to log activity: RLS violation');
    });
  });

  // ── listActivities ──────────────────────────────────────────────

  describe('listActivities', () => {
    it('returns activities for a workspace', async () => {
      const rows = [makeActivityRow()];
      activityMock.chain.limit.mockResolvedValueOnce({ data: rows, error: null });

      const result = await listActivities({ workspace_id: 'ws-001' });

      expect(result).toEqual(rows);
      expect(activityMock.chain.eq).toHaveBeenCalledWith('workspace_id', 'ws-001');
      expect(activityMock.chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(activityMock.chain.limit).toHaveBeenCalledWith(DEFAULT_PAGE_SIZE);
    });

    it('applies activity_type filter', async () => {
      activityMock.chain.limit.mockResolvedValueOnce({ data: [], error: null });

      await listActivities({ workspace_id: 'ws-001', activity_type: 'correction' });

      expect(activityMock.chain.eq).toHaveBeenCalledWith('activity_type', 'correction');
    });

    it('applies user_id filter', async () => {
      activityMock.chain.limit.mockResolvedValueOnce({ data: [], error: null });

      await listActivities({ workspace_id: 'ws-001', user_id: 'user-002' });

      expect(activityMock.chain.eq).toHaveBeenCalledWith('user_id', 'user-002');
    });

    it('applies date range filters', async () => {
      activityMock.chain.limit.mockResolvedValueOnce({ data: [], error: null });

      await listActivities({
        workspace_id: 'ws-001',
        date_from: '2025-01-01T00:00:00Z',
        date_to: '2025-01-31T23:59:59Z',
      });

      expect(activityMock.chain.gte).toHaveBeenCalledWith('created_at', '2025-01-01T00:00:00Z');
      expect(activityMock.chain.lte).toHaveBeenCalledWith('created_at', '2025-01-31T23:59:59Z');
    });

    it('applies group_key filter', async () => {
      activityMock.chain.limit.mockResolvedValueOnce({ data: [], error: null });

      await listActivities({ workspace_id: 'ws-001', group_key: 'payroll:pay-001' });

      expect(activityMock.chain.eq).toHaveBeenCalledWith('group_key', 'payroll:pay-001');
    });

    it('applies cursor for pagination', async () => {
      activityMock.chain.limit.mockResolvedValueOnce({ data: [], error: null });

      await listActivities({
        workspace_id: 'ws-001',
        cursor: '2025-01-15T10:00:00Z',
      });

      expect(activityMock.chain.lt).toHaveBeenCalledWith('created_at', '2025-01-15T10:00:00Z');
    });

    it('respects custom page size', async () => {
      activityMock.chain.limit.mockResolvedValueOnce({ data: [], error: null });

      await listActivities({ workspace_id: 'ws-001' }, 25);

      expect(activityMock.chain.limit).toHaveBeenCalledWith(25);
    });

    it('throws when workspace_id is missing', async () => {
      await expect(
        listActivities({ workspace_id: '' }),
      ).rejects.toThrow('workspace_id is required');
    });

    it('throws on Supabase query error', async () => {
      activityMock.chain.limit.mockResolvedValueOnce({
        data: null,
        error: { message: 'timeout' },
      });

      await expect(
        listActivities({ workspace_id: 'ws-001' }),
      ).rejects.toThrow('Failed to list activities: timeout');
    });
  });

  // ── getRecentActivities ─────────────────────────────────────────

  describe('getRecentActivities', () => {
    it('returns the last 10 activities for the dashboard widget', async () => {
      const rows = Array.from({ length: 10 }, (_, i) =>
        makeActivityRow({ id: `act-${i}` }),
      );
      activityMock.chain.limit.mockResolvedValueOnce({ data: rows, error: null });

      const result = await getRecentActivities('ws-001');

      expect(result).toHaveLength(10);
      expect(activityMock.chain.limit).toHaveBeenCalledWith(RECENT_ACTIVITIES_LIMIT);
    });

    it('throws when workspaceId is empty', async () => {
      await expect(getRecentActivities('')).rejects.toThrow('workspace_id is required');
    });
  });

  // ── subscribeToActivities ───────────────────────────────────────

  describe('subscribeToActivities', () => {
    it('creates a Realtime channel and returns an unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = subscribeToActivities('ws-001', handler);

      expect(mockChannel.on).toHaveBeenCalled();
      expect(mockChannel.subscribe).toHaveBeenCalled();
      expect(typeof unsubscribe).toBe('function');
    });

    it('calls removeChannel on unsubscribe', () => {
      const handler = vi.fn();
      const unsubscribe = subscribeToActivities('ws-001', handler);

      unsubscribe();

      expect(mockRemoveChannel).toHaveBeenCalledWith(mockChannel);
    });

    it('throws when workspaceId is empty', () => {
      expect(() => subscribeToActivities('', vi.fn())).toThrow('workspace_id is required');
    });
  });

  // ── Constants ───────────────────────────────────────────────────

  describe('constants', () => {
    it('DEFAULT_PAGE_SIZE is 50', () => {
      expect(DEFAULT_PAGE_SIZE).toBe(50);
    });

    it('RECENT_ACTIVITIES_LIMIT is 10', () => {
      expect(RECENT_ACTIVITIES_LIMIT).toBe(10);
    });
  });
});
