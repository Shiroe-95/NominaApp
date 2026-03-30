/**
 * Collaboration feature wiring helpers.
 * Wire PresenceIndicator, AnnotationBadge, and ActivityFeed
 * into existing PayrollEditor and dashboard.
 *
 * Requirements: 11.1, 11.6, 12.6, 13.5
 * @module lib/integration/wire-collaboration
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface PresenceUser {
  userId: string;
  userName: string;
  avatarUrl: string | null;
  cursorRow?: number;
  cursorCol?: number;
}

/**
 * Subscribe to presence updates for a payroll editing session.
 * Returns an unsubscribe function.
 */
export function subscribeToPresence(
  supabase: SupabaseClient,
  payrollId: string,
  currentUser: { id: string; name: string; avatarUrl: string | null },
  onPresenceChange: (users: PresenceUser[]) => void,
): () => void {
  const channel = supabase.channel(`payroll:${payrollId}`);

  channel
    .on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<PresenceUser>();
      const users = Object.values(state).flat();
      onPresenceChange(users);
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await channel.track({
          userId: currentUser.id,
          userName: currentUser.name,
          avatarUrl: currentUser.avatarUrl,
        });
      }
    });

  return () => {
    channel.unsubscribe();
  };
}

/**
 * Get annotation count for a specific target (cell, finding, etc.).
 */
export async function getAnnotationCount(
  supabase: SupabaseClient,
  targetType: string,
  targetId: string,
): Promise<number> {
  const { count } = await supabase
    .from('annotations')
    .select('id', { count: 'exact', head: true })
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .eq('is_resolved', false);

  return count ?? 0;
}

/**
 * Subscribe to real-time activity feed updates for a workspace.
 */
export function subscribeToActivityFeed(
  supabase: SupabaseClient,
  workspaceId: string,
  onNewActivity: (activity: Record<string, unknown>) => void,
): () => void {
  const channel = supabase
    .channel(`activity:${workspaceId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'activity_log', filter: `workspace_id=eq.${workspaceId}` },
      (payload) => onNewActivity(payload.new as Record<string, unknown>),
    )
    .subscribe();

  return () => {
    channel.unsubscribe();
  };
}
