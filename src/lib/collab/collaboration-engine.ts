import { createAdminClient } from '@/lib/supabase/admin';

/**
 * CollaborationEngine — Real-time collaboration for payroll editing.
 *
 * Provides presence tracking, change propagation, and conflict resolution
 * using Supabase Realtime channels (one channel per payroll).
 *
 * Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6
 *
 * @module lib/collab/collaboration-engine
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface PresenceState {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  cursorPosition: { row: number; col: number } | null;
  lastActiveAt: string;
}

export interface CollaborationEvent {
  type: 'correction_applied' | 'presence_update' | 'conflict_resolved';
  payrollId: string;
  userId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface ConflictResolution {
  cellKey: string;
  winnerUserId: string;
  loserUserId: string;
  winnerValue: unknown;
  loserValue: unknown;
  timestamp: string;
  reverted: boolean;
}

export interface CorrectionPayload {
  payrollId: string;
  userId: string;
  cellKey: string;
  row: number;
  col: number;
  oldValue: unknown;
  newValue: unknown;
  timestamp: string;
}

export interface PendingChange {
  correction: CorrectionPayload;
  addedAt: string;
}

export type CollaborationEventHandler = (event: CollaborationEvent) => void;
export type ConflictHandler = (conflict: ConflictResolution) => void;

// ─── Constants ──────────────────────────────────────────────────────────────

/** Channel prefix for payroll collaboration rooms */
const CHANNEL_PREFIX = 'payroll:';

/** Event names for Supabase Realtime broadcast */
const EVENTS = {
  CORRECTION: 'correction_applied',
  PRESENCE: 'presence_update',
  CONFLICT: 'conflict_resolved',
} as const;

/** Maximum time (ms) before a presence entry is considered stale */
export const PRESENCE_STALE_MS = 30_000;

/** Target propagation latency for corrections (Req 11.2: <500ms) */
export const TARGET_LATENCY_MS = 500;

// ─── Internal State ─────────────────────────────────────────────────────────

/** Active channel subscriptions keyed by payrollId */
const activeChannels = new Map<string, ReturnType<typeof createChannel>>();

/** Presence state per payroll, keyed by payrollId → userId */
const presenceMap = new Map<string, Map<string, PresenceState>>();

/** Pending changes that haven't been synced (for reconnection — Req 11.5) */
const pendingChanges = new Map<string, PendingChange[]>();

/** Last-write timestamps per cell for conflict resolution (Req 11.3) */
const cellTimestamps = new Map<string, { userId: string; timestamp: string }>();

/** Registered event handlers */
const eventHandlers = new Set<CollaborationEventHandler>();

/** Registered conflict handlers */
const conflictHandlers = new Set<ConflictHandler>();

// ─── Helper Functions ───────────────────────────────────────────────────────

/** Build a unique cell key from payrollId + row + col */
export function buildCellKey(payrollId: string, row: number, col: number): string {
  return `${payrollId}:${row}:${col}`;
}

/** Get current ISO timestamp */
function now(): string {
  return new Date().toISOString();
}

/** Emit a collaboration event to all registered handlers */
function emitEvent(event: CollaborationEvent): void {
  for (const handler of eventHandlers) {
    try {
      handler(event);
    } catch {
      // Don't let a handler error break the event loop
    }
  }
}

/** Emit a conflict to all registered conflict handlers */
function emitConflict(conflict: ConflictResolution): void {
  for (const handler of conflictHandlers) {
    try {
      handler(conflict);
    } catch {
      // Don't let a handler error break the event loop
    }
  }
}

/**
 * Create a Supabase Realtime channel for a payroll.
 * Returns the channel object (not yet subscribed).
 */
function createChannel(payrollId: string) {
  const supabase = createAdminClient();
  return supabase.channel(`${CHANNEL_PREFIX}${payrollId}`);
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Register a handler for collaboration events.
 */
export function onCollaborationEvent(handler: CollaborationEventHandler): () => void {
  eventHandlers.add(handler);
  return () => { eventHandlers.delete(handler); };
}

/**
 * Register a handler for conflict notifications (Req 11.3).
 */
export function onConflict(handler: ConflictHandler): () => void {
  conflictHandlers.add(handler);
  return () => { conflictHandlers.delete(handler); };
}

/**
 * Join a payroll collaboration session.
 *
 * Subscribes to the Supabase Realtime channel for the given payroll,
 * tracks presence, and listens for correction broadcasts.
 *
 * Req 11.1: Presence indicators for connected users.
 * Req 11.4: Uses Supabase Realtime (WebSocket).
 */
export async function joinPayroll(
  payrollId: string,
  user: { userId: string; userName: string; avatarUrl: string | null }
): Promise<void> {
  // If already joined, update presence and return
  if (activeChannels.has(payrollId)) {
    await updatePresence(payrollId, user.userId, user.userName, user.avatarUrl, null);
    return;
  }

  const channel = createChannel(payrollId);

  // Initialize presence map for this payroll
  if (!presenceMap.has(payrollId)) {
    presenceMap.set(payrollId, new Map());
  }

  // Listen for correction broadcasts (Req 11.2)
  channel.on('broadcast', { event: EVENTS.CORRECTION }, (payload) => {
    const correction = payload.payload as CorrectionPayload;
    handleIncomingCorrection(correction);
  });

  // Listen for conflict resolution broadcasts (Req 11.3)
  channel.on('broadcast', { event: EVENTS.CONFLICT }, (payload) => {
    const conflict = payload.payload as ConflictResolution;
    emitConflict(conflict);
    emitEvent({
      type: 'conflict_resolved',
      payrollId,
      userId: conflict.winnerUserId,
      data: conflict as unknown as Record<string, unknown>,
      timestamp: conflict.timestamp,
    });
  });

  // Track presence via Supabase Realtime presence (Req 11.1)
  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState();
      syncPresenceState(payrollId, state);
    })
    .on('presence', { event: 'join' }, ({ newPresences }) => {
      for (const p of newPresences) {
        const ps = p as unknown as PresenceState;
        const map = presenceMap.get(payrollId);
        if (map) map.set(ps.userId, ps);
      }
    })
    .on('presence', { event: 'leave' }, ({ leftPresences }) => {
      for (const p of leftPresences) {
        const ps = p as unknown as PresenceState;
        const map = presenceMap.get(payrollId);
        if (map) map.delete(ps.userId);
      }
    });

  await channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      // Track our own presence
      await channel.track({
        userId: user.userId,
        userName: user.userName,
        avatarUrl: user.avatarUrl,
        cursorPosition: null,
        lastActiveAt: now(),
      } satisfies PresenceState);

      // Sync any pending changes from a previous disconnection (Req 11.5)
      await syncPendingChanges(payrollId);
    }
  });

  activeChannels.set(payrollId, channel);
}

/**
 * Leave a payroll collaboration session.
 *
 * Unsubscribes from the Realtime channel and cleans up presence.
 */
export async function leavePayroll(payrollId: string): Promise<void> {
  const channel = activeChannels.get(payrollId);
  if (!channel) return;

  await channel.untrack();
  await channel.unsubscribe();
  activeChannels.delete(payrollId);
  presenceMap.delete(payrollId);
}

/**
 * Broadcast a correction to all connected users on the same payroll.
 *
 * Implements last-write-wins conflict resolution (Req 11.3):
 * - Compares timestamp of incoming change against last known write.
 * - If a conflict is detected, the later timestamp wins.
 * - The losing user receives a conflict notification with revert option.
 *
 * Req 11.2: Propagation target <500ms via Supabase Realtime broadcast.
 */
export async function broadcastCorrection(
  correction: CorrectionPayload
): Promise<ConflictResolution | null> {
  const channel = activeChannels.get(correction.payrollId);
  const cellKey = buildCellKey(correction.payrollId, correction.row, correction.col);

  // Check for conflict (Req 11.3: last-write-wins with timestamp)
  const conflict = handleConflict(cellKey, correction);

  // Update the cell timestamp record
  cellTimestamps.set(cellKey, {
    userId: correction.userId,
    timestamp: correction.timestamp,
  });

  if (channel) {
    // Broadcast the correction to all subscribers (Req 11.2)
    await channel.send({
      type: 'broadcast',
      event: EVENTS.CORRECTION,
      payload: correction,
    });

    // If there was a conflict, broadcast the resolution
    if (conflict) {
      await channel.send({
        type: 'broadcast',
        event: EVENTS.CONFLICT,
        payload: conflict,
      });
    }
  } else {
    // Channel not available — queue as pending change (Req 11.5)
    addPendingChange(correction.payrollId, correction);
  }

  // Emit local event
  emitEvent({
    type: 'correction_applied',
    payrollId: correction.payrollId,
    userId: correction.userId,
    data: correction as unknown as Record<string, unknown>,
    timestamp: correction.timestamp,
  });

  return conflict;
}

/**
 * Handle conflict detection using last-write-wins strategy (Req 11.3).
 *
 * Compares the incoming correction timestamp against the last known write
 * for the same cell. If a different user wrote more recently, the incoming
 * change still wins (last-write-wins), and the previous writer is notified.
 *
 * Returns a ConflictResolution if a conflict was detected, null otherwise.
 */
export function handleConflict(
  cellKey: string,
  incoming: CorrectionPayload
): ConflictResolution | null {
  const existing = cellTimestamps.get(cellKey);

  if (!existing || existing.userId === incoming.userId) {
    return null; // No conflict: first write or same user editing again
  }

  // Different user edited the same cell — conflict detected
  const incomingTime = new Date(incoming.timestamp).getTime();
  const existingTime = new Date(existing.timestamp).getTime();

  // Last-write-wins: the later timestamp always wins
  const incomingWins = incomingTime >= existingTime;

  const resolution: ConflictResolution = {
    cellKey,
    winnerUserId: incomingWins ? incoming.userId : existing.userId,
    loserUserId: incomingWins ? existing.userId : incoming.userId,
    winnerValue: incomingWins ? incoming.newValue : incoming.oldValue,
    loserValue: incomingWins ? incoming.oldValue : incoming.newValue,
    timestamp: incoming.timestamp,
    reverted: false,
  };

  emitConflict(resolution);
  return resolution;
}

/**
 * Revert a conflict resolution — applies the loser's value instead.
 *
 * Req 11.3: "the user whose change was overwritten receives a notification
 * with the option to revert."
 */
export async function revertConflict(
  payrollId: string,
  conflict: ConflictResolution
): Promise<ConflictResolution> {
  const reverted: ConflictResolution = {
    ...conflict,
    reverted: true,
    winnerUserId: conflict.loserUserId,
    loserUserId: conflict.winnerUserId,
    winnerValue: conflict.loserValue,
    loserValue: conflict.winnerValue,
    timestamp: now(),
  };

  const channel = activeChannels.get(payrollId);
  if (channel) {
    await channel.send({
      type: 'broadcast',
      event: EVENTS.CONFLICT,
      payload: reverted,
    });
  }

  emitConflict(reverted);
  return reverted;
}

/**
 * Get the current presence state for a payroll (Req 11.1, 11.6).
 *
 * Returns all connected users with their cursor positions.
 * Filters out stale entries (>30s without activity).
 */
export function getPresence(payrollId: string): PresenceState[] {
  const map = presenceMap.get(payrollId);
  if (!map) return [];

  const cutoff = Date.now() - PRESENCE_STALE_MS;
  const active: PresenceState[] = [];

  for (const [userId, state] of map) {
    if (new Date(state.lastActiveAt).getTime() >= cutoff) {
      active.push(state);
    } else {
      map.delete(userId);
    }
  }

  return active;
}

/**
 * Update cursor position for a user in a payroll session.
 */
export async function updatePresence(
  payrollId: string,
  userId: string,
  userName: string,
  avatarUrl: string | null,
  cursorPosition: { row: number; col: number } | null
): Promise<void> {
  const channel = activeChannels.get(payrollId);
  const state: PresenceState = {
    userId,
    userName,
    avatarUrl,
    cursorPosition,
    lastActiveAt: now(),
  };

  // Update local presence map
  const map = presenceMap.get(payrollId);
  if (map) map.set(userId, state);

  // Track via Supabase Realtime presence
  if (channel) {
    await channel.track(state);
  }
}

/**
 * Reconnect to a payroll session after a disconnection (Req 11.5).
 *
 * Re-joins the channel and syncs any pending changes that were
 * queued while disconnected.
 */
export async function reconnect(
  payrollId: string,
  user: { userId: string; userName: string; avatarUrl: string | null }
): Promise<PendingChange[]> {
  // Leave existing stale channel if any
  await leavePayroll(payrollId);

  // Get pending changes before rejoining
  const pending = pendingChanges.get(payrollId) ?? [];

  // Rejoin the channel — this will trigger syncPendingChanges on SUBSCRIBED
  await joinPayroll(payrollId, user);

  return pending;
}

/**
 * Get the count of pending (unsynced) changes for a payroll.
 */
export function getPendingChangeCount(payrollId: string): number {
  return pendingChanges.get(payrollId)?.length ?? 0;
}

/**
 * Check if currently connected to a payroll channel.
 */
export function isConnected(payrollId: string): boolean {
  return activeChannels.has(payrollId);
}

/**
 * Get all active payroll sessions.
 */
export function getActivePayrolls(): string[] {
  return Array.from(activeChannels.keys());
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

/** Sync Supabase Realtime presence state into our local map */
function syncPresenceState(
  payrollId: string,
  state: Record<string, unknown[]>
): void {
  const map = presenceMap.get(payrollId) ?? new Map();

  map.clear();
  for (const presences of Object.values(state)) {
    for (const p of presences) {
      const ps = p as unknown as PresenceState;
      if (ps.userId) {
        map.set(ps.userId, ps);
      }
    }
  }

  presenceMap.set(payrollId, map);

  emitEvent({
    type: 'presence_update',
    payrollId,
    userId: '',
    data: { users: Array.from(map.values()) },
    timestamp: now(),
  });
}

/** Handle an incoming correction from another user */
function handleIncomingCorrection(correction: CorrectionPayload): void {
  const cellKey = buildCellKey(correction.payrollId, correction.row, correction.col);

  // Update cell timestamp
  cellTimestamps.set(cellKey, {
    userId: correction.userId,
    timestamp: correction.timestamp,
  });

  emitEvent({
    type: 'correction_applied',
    payrollId: correction.payrollId,
    userId: correction.userId,
    data: correction as unknown as Record<string, unknown>,
    timestamp: correction.timestamp,
  });
}

/** Queue a change for later sync when reconnected (Req 11.5) */
function addPendingChange(payrollId: string, correction: CorrectionPayload): void {
  const list = pendingChanges.get(payrollId) ?? [];
  list.push({ correction, addedAt: now() });
  pendingChanges.set(payrollId, list);
}

/** Sync all pending changes after reconnection (Req 11.5) */
async function syncPendingChanges(payrollId: string): Promise<void> {
  const pending = pendingChanges.get(payrollId);
  if (!pending || pending.length === 0) return;

  const channel = activeChannels.get(payrollId);
  if (!channel) return;

  for (const { correction } of pending) {
    await channel.send({
      type: 'broadcast',
      event: EVENTS.CORRECTION,
      payload: correction,
    });
  }

  // Clear pending changes after successful sync
  pendingChanges.delete(payrollId);
}

// ─── Test Helpers (for unit tests) ──────────────────────────────────────────

/** Reset all internal state — only for testing */
export function _resetForTesting(): void {
  activeChannels.clear();
  presenceMap.clear();
  pendingChanges.clear();
  cellTimestamps.clear();
  eventHandlers.clear();
  conflictHandlers.clear();
}

/** Expose internal maps for testing */
export const _internals = {
  activeChannels,
  presenceMap,
  pendingChanges,
  cellTimestamps,
  eventHandlers,
  conflictHandlers,
};
