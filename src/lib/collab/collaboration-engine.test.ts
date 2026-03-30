import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Supabase Realtime channel ──────────────────────────────────────────

let trackFn: ReturnType<typeof vi.fn>;
let untrackFn: ReturnType<typeof vi.fn>;
let subscribeFn: ReturnType<typeof vi.fn>;
let unsubscribeFn: ReturnType<typeof vi.fn>;
let sendFn: ReturnType<typeof vi.fn>;
let presenceStateFn: ReturnType<typeof vi.fn>;
let onHandlers: Map<string, Map<string, (payload: unknown) => void>>;

function createMockChannel() {
  trackFn = vi.fn().mockResolvedValue('ok');
  untrackFn = vi.fn().mockResolvedValue('ok');
  sendFn = vi.fn().mockResolvedValue('ok');
  unsubscribeFn = vi.fn().mockResolvedValue('ok');
  presenceStateFn = vi.fn().mockReturnValue({});
  onHandlers = new Map();

  subscribeFn = vi.fn(async (callback?: (status: string) => void) => {
    if (callback) callback('SUBSCRIBED');
    return mockChannel;
  });

  const mockChannel = {
    on: vi.fn((type: string, opts: { event: string }, handler: (payload: unknown) => void) => {
      const key = `${type}:${opts.event}`;
      if (!onHandlers.has(type)) onHandlers.set(type, new Map());
      onHandlers.get(type)!.set(opts.event, handler);
      return mockChannel;
    }),
    subscribe: subscribeFn,
    unsubscribe: unsubscribeFn,
    track: trackFn,
    untrack: untrackFn,
    send: sendFn,
    presenceState: presenceStateFn,
  };

  return mockChannel;
}

let mockChannel: ReturnType<typeof createMockChannel>;

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    channel: () => mockChannel,
  }),
}));

import {
  joinPayroll,
  leavePayroll,
  broadcastCorrection,
  handleConflict,
  revertConflict,
  getPresence,
  reconnect,
  getPendingChangeCount,
  isConnected,
  getActivePayrolls,
  buildCellKey,
  onCollaborationEvent,
  onConflict,
  _resetForTesting,
  _internals,
  PRESENCE_STALE_MS,
  type CorrectionPayload,
  type CollaborationEvent,
  type ConflictResolution,
} from './collaboration-engine';

// ─── Setup ──────────────────────────────────────────────────────────────────

const testUser = {
  userId: 'user-1',
  userName: 'Alice',
  avatarUrl: 'https://example.com/alice.png',
};

const testUser2 = {
  userId: 'user-2',
  userName: 'Bob',
  avatarUrl: null,
};

function makeCorrection(overrides: Partial<CorrectionPayload> = {}): CorrectionPayload {
  return {
    payrollId: 'payroll-1',
    userId: 'user-1',
    cellKey: 'payroll-1:5:3',
    row: 5,
    col: 3,
    oldValue: 1000,
    newValue: 1500,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  _resetForTesting();
  mockChannel = createMockChannel();
});

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('CollaborationEngine', () => {
  describe('buildCellKey', () => {
    it('builds a unique key from payrollId, row, and col', () => {
      expect(buildCellKey('p1', 5, 3)).toBe('p1:5:3');
      expect(buildCellKey('p2', 0, 0)).toBe('p2:0:0');
    });
  });

  describe('joinPayroll', () => {
    it('subscribes to a Supabase Realtime channel for the payroll', async () => {
      await joinPayroll('payroll-1', testUser);

      expect(subscribeFn).toHaveBeenCalled();
      expect(trackFn).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-1',
          userName: 'Alice',
          avatarUrl: 'https://example.com/alice.png',
          cursorPosition: null,
        })
      );
      expect(isConnected('payroll-1')).toBe(true);
    });

    it('does not create a duplicate channel if already joined', async () => {
      await joinPayroll('payroll-1', testUser);
      const firstCallCount = subscribeFn.mock.calls.length;

      await joinPayroll('payroll-1', testUser);
      // subscribe should not be called again
      expect(subscribeFn.mock.calls.length).toBe(firstCallCount);
    });

    it('registers broadcast and presence handlers on the channel', async () => {
      await joinPayroll('payroll-1', testUser);

      // Should have registered handlers for broadcast and presence events
      expect(mockChannel.on).toHaveBeenCalled();
      const onCalls = (mockChannel.on as ReturnType<typeof vi.fn>).mock.calls;
      const eventTypes = onCalls.map((c: unknown[]) => `${c[0]}:${(c[1] as { event: string }).event}`);

      expect(eventTypes).toContain('broadcast:correction_applied');
      expect(eventTypes).toContain('broadcast:conflict_resolved');
      expect(eventTypes).toContain('presence:sync');
      expect(eventTypes).toContain('presence:join');
      expect(eventTypes).toContain('presence:leave');
    });
  });

  describe('leavePayroll', () => {
    it('unsubscribes and cleans up state', async () => {
      await joinPayroll('payroll-1', testUser);
      expect(isConnected('payroll-1')).toBe(true);

      await leavePayroll('payroll-1');
      expect(untrackFn).toHaveBeenCalled();
      expect(unsubscribeFn).toHaveBeenCalled();
      expect(isConnected('payroll-1')).toBe(false);
    });

    it('is a no-op if not connected', async () => {
      await leavePayroll('nonexistent');
      expect(unsubscribeFn).not.toHaveBeenCalled();
    });
  });

  describe('broadcastCorrection', () => {
    it('sends a correction broadcast to the channel', async () => {
      await joinPayroll('payroll-1', testUser);
      const correction = makeCorrection();

      await broadcastCorrection(correction);

      expect(sendFn).toHaveBeenCalledWith({
        type: 'broadcast',
        event: 'correction_applied',
        payload: correction,
      });
    });

    it('emits a collaboration event to registered handlers', async () => {
      await joinPayroll('payroll-1', testUser);
      const events: CollaborationEvent[] = [];
      onCollaborationEvent((e) => events.push(e));

      await broadcastCorrection(makeCorrection());

      expect(events.length).toBe(1);
      expect(events[0].type).toBe('correction_applied');
      expect(events[0].payrollId).toBe('payroll-1');
    });

    it('queues as pending change when channel is not available', async () => {
      // Don't join — no channel available
      const correction = makeCorrection();
      await broadcastCorrection(correction);

      expect(getPendingChangeCount('payroll-1')).toBe(1);
      expect(sendFn).not.toHaveBeenCalled();
    });

    it('returns null when there is no conflict', async () => {
      await joinPayroll('payroll-1', testUser);
      const result = await broadcastCorrection(makeCorrection());
      expect(result).toBeNull();
    });
  });

  describe('handleConflict (last-write-wins)', () => {
    it('returns null when no previous write exists for the cell', () => {
      const correction = makeCorrection();
      const result = handleConflict('payroll-1:5:3', correction);
      expect(result).toBeNull();
    });

    it('returns null when the same user edits the same cell again', () => {
      // Simulate a previous write by the same user
      _internals.cellTimestamps.set('payroll-1:5:3', {
        userId: 'user-1',
        timestamp: new Date(Date.now() - 1000).toISOString(),
      });

      const correction = makeCorrection({ userId: 'user-1' });
      const result = handleConflict('payroll-1:5:3', correction);
      expect(result).toBeNull();
    });

    it('detects a conflict when a different user edits the same cell', () => {
      const earlierTime = new Date(Date.now() - 5000).toISOString();
      _internals.cellTimestamps.set('payroll-1:5:3', {
        userId: 'user-1',
        timestamp: earlierTime,
      });

      const correction = makeCorrection({
        userId: 'user-2',
        timestamp: new Date().toISOString(),
      });
      const result = handleConflict('payroll-1:5:3', correction);

      expect(result).not.toBeNull();
      expect(result!.winnerUserId).toBe('user-2'); // Later timestamp wins
      expect(result!.loserUserId).toBe('user-1');
      expect(result!.reverted).toBe(false);
    });

    it('emits conflict to registered conflict handlers', () => {
      const conflicts: ConflictResolution[] = [];
      onConflict((c) => conflicts.push(c));

      _internals.cellTimestamps.set('payroll-1:5:3', {
        userId: 'user-1',
        timestamp: new Date(Date.now() - 5000).toISOString(),
      });

      handleConflict('payroll-1:5:3', makeCorrection({ userId: 'user-2' }));
      expect(conflicts.length).toBe(1);
    });
  });

  describe('broadcastCorrection with conflict', () => {
    it('detects and broadcasts conflict when two users edit the same cell', async () => {
      await joinPayroll('payroll-1', testUser);

      // First user writes
      await broadcastCorrection(makeCorrection({
        userId: 'user-1',
        timestamp: new Date(Date.now() - 2000).toISOString(),
      }));

      // Second user writes to the same cell
      const conflict = await broadcastCorrection(makeCorrection({
        userId: 'user-2',
        timestamp: new Date().toISOString(),
      }));

      expect(conflict).not.toBeNull();
      expect(conflict!.winnerUserId).toBe('user-2');

      // Should have sent both correction and conflict broadcasts
      expect(sendFn).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'conflict_resolved' })
      );
    });
  });

  describe('revertConflict', () => {
    it('swaps winner and loser and marks as reverted', async () => {
      await joinPayroll('payroll-1', testUser);

      const original: ConflictResolution = {
        cellKey: 'payroll-1:5:3',
        winnerUserId: 'user-2',
        loserUserId: 'user-1',
        winnerValue: 1600,
        loserValue: 1500,
        timestamp: new Date().toISOString(),
        reverted: false,
      };

      const reverted = await revertConflict('payroll-1', original);

      expect(reverted.reverted).toBe(true);
      expect(reverted.winnerUserId).toBe('user-1');
      expect(reverted.loserUserId).toBe('user-2');
      expect(reverted.winnerValue).toBe(1500);
      expect(reverted.loserValue).toBe(1600);
    });

    it('broadcasts the reverted conflict', async () => {
      await joinPayroll('payroll-1', testUser);

      const original: ConflictResolution = {
        cellKey: 'payroll-1:5:3',
        winnerUserId: 'user-2',
        loserUserId: 'user-1',
        winnerValue: 1600,
        loserValue: 1500,
        timestamp: new Date().toISOString(),
        reverted: false,
      };

      await revertConflict('payroll-1', original);

      expect(sendFn).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'conflict_resolved',
          payload: expect.objectContaining({ reverted: true }),
        })
      );
    });
  });

  describe('getPresence', () => {
    it('returns empty array when no one is connected', () => {
      expect(getPresence('payroll-1')).toEqual([]);
    });

    it('returns active users from the presence map', () => {
      const map = new Map<string, import('./collaboration-engine').PresenceState>();
      map.set('user-1', {
        userId: 'user-1',
        userName: 'Alice',
        avatarUrl: null,
        cursorPosition: { row: 1, col: 2 },
        lastActiveAt: new Date().toISOString(),
      });
      _internals.presenceMap.set('payroll-1', map);

      const result = getPresence('payroll-1');
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-1');
    });

    it('filters out stale presence entries', () => {
      const map = new Map<string, import('./collaboration-engine').PresenceState>();
      map.set('user-stale', {
        userId: 'user-stale',
        userName: 'Stale',
        avatarUrl: null,
        cursorPosition: null,
        lastActiveAt: new Date(Date.now() - PRESENCE_STALE_MS - 1000).toISOString(),
      });
      map.set('user-active', {
        userId: 'user-active',
        userName: 'Active',
        avatarUrl: null,
        cursorPosition: null,
        lastActiveAt: new Date().toISOString(),
      });
      _internals.presenceMap.set('payroll-1', map);

      const result = getPresence('payroll-1');
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user-active');
    });
  });

  describe('reconnect', () => {
    it('leaves the old channel and rejoins', async () => {
      await joinPayroll('payroll-1', testUser);
      const pending = await reconnect('payroll-1', testUser);

      expect(pending).toEqual([]);
      expect(isConnected('payroll-1')).toBe(true);
    });

    it('returns pending changes that were queued during disconnection', async () => {
      // Queue a pending change without a channel
      const correction = makeCorrection();
      _internals.pendingChanges.set('payroll-1', [
        { correction, addedAt: new Date().toISOString() },
      ]);

      const pending = await reconnect('payroll-1', testUser);
      expect(pending).toHaveLength(1);
      expect(pending[0].correction.payrollId).toBe('payroll-1');
    });
  });

  describe('event handlers', () => {
    it('allows registering and unregistering event handlers', async () => {
      const events: CollaborationEvent[] = [];
      const unsub = onCollaborationEvent((e) => events.push(e));

      await joinPayroll('payroll-1', testUser);
      await broadcastCorrection(makeCorrection());
      expect(events.length).toBe(1);

      unsub();
      await broadcastCorrection(makeCorrection({ timestamp: new Date().toISOString() }));
      expect(events.length).toBe(1); // No new events after unsubscribe
    });

    it('allows registering and unregistering conflict handlers', () => {
      const conflicts: ConflictResolution[] = [];
      const unsub = onConflict((c) => conflicts.push(c));

      _internals.cellTimestamps.set('payroll-1:5:3', {
        userId: 'user-1',
        timestamp: new Date(Date.now() - 5000).toISOString(),
      });

      handleConflict('payroll-1:5:3', makeCorrection({ userId: 'user-2' }));
      expect(conflicts.length).toBe(1);

      unsub();
      handleConflict('payroll-1:5:3', makeCorrection({
        userId: 'user-3',
        timestamp: new Date().toISOString(),
      }));
      expect(conflicts.length).toBe(1); // No new conflicts after unsubscribe
    });
  });

  describe('getActivePayrolls', () => {
    it('returns list of active payroll IDs', async () => {
      expect(getActivePayrolls()).toEqual([]);

      await joinPayroll('payroll-1', testUser);
      await joinPayroll('payroll-2', testUser2);

      expect(getActivePayrolls()).toContain('payroll-1');
      expect(getActivePayrolls()).toContain('payroll-2');
    });
  });
});
