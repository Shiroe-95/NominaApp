import { createAdminClient } from '@/lib/supabase/admin';

/**
 * ActivityService — Log, query, and stream workspace activities.
 *
 * Tracks uploads, audits, corrections, comments, status changes,
 * and report generation. Supports filtering, grouping related
 * activities, cursor-based pagination, and real-time updates
 * via Supabase Realtime.
 *
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 *
 * @module lib/collab/activity-service
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export type ActivityType =
  | 'upload'
  | 'audit'
  | 'correction'
  | 'comment'
  | 'status_change'
  | 'report';

export interface ActivityRow {
  id: string;
  workspace_id: string;
  user_id: string;
  activity_type: ActivityType;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  group_key: string | null;
  created_at: string;
}

export interface ActivityFilters {
  workspace_id: string;
  activity_type?: ActivityType;
  user_id?: string;
  date_from?: string;
  date_to?: string;
  group_key?: string;
  /** Cursor for pagination — pass the `created_at` of the last item */
  cursor?: string;
}

export interface LogActivityInput {
  workspace_id: string;
  user_id: string;
  activity_type: ActivityType;
  resource_type?: string;
  resource_id?: string;
  metadata?: Record<string, unknown>;
  group_key?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────────

/** Default page size for listing activities */
export const DEFAULT_PAGE_SIZE = 50;

/** Number of recent activities for the dashboard widget (Req 13.5) */
export const RECENT_ACTIVITIES_LIMIT = 10;

/** Supabase Realtime channel prefix for activity feeds */
const CHANNEL_PREFIX = 'activity:';

/** Valid activity types for validation */
const VALID_ACTIVITY_TYPES: ReadonlySet<ActivityType> = new Set([
  'upload',
  'audit',
  'correction',
  'comment',
  'status_change',
  'report',
]);

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Log a new activity in the workspace feed.
 *
 * Req 13.1: Record uploads, audits, corrections, comments,
 *           status changes, and reports.
 * Req 13.4: Support grouping via `group_key` so related
 *           activities (e.g. corrections on the same payroll)
 *           can be collapsed.
 *
 * @returns The newly created activity row.
 */
export async function logActivity(
  input: LogActivityInput,
): Promise<ActivityRow> {
  if (!input.workspace_id) {
    throw new Error('workspace_id is required');
  }
  if (!input.user_id) {
    throw new Error('user_id is required');
  }
  if (!input.activity_type || !VALID_ACTIVITY_TYPES.has(input.activity_type)) {
    throw new Error(
      `activity_type must be one of: ${[...VALID_ACTIVITY_TYPES].join(', ')}`,
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('activity_log')
    .insert({
      workspace_id: input.workspace_id,
      user_id: input.user_id,
      activity_type: input.activity_type,
      resource_type: input.resource_type ?? null,
      resource_id: input.resource_id ?? null,
      metadata: input.metadata ?? null,
      group_key: input.group_key ?? null,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to log activity: ${error.message}`);
  }

  return data as ActivityRow;
}

/**
 * List activities for a workspace with optional filters and
 * cursor-based pagination.
 *
 * Req 13.1: Chronological activity feed.
 * Req 13.2: Filter by type, user, date range.
 * Req 13.4: Filter by group_key for grouped view.
 *
 * Activities are returned newest-first. Pass `cursor` (the
 * `created_at` value of the last row) to fetch the next page.
 */
export async function listActivities(
  filters: ActivityFilters,
  pageSize: number = DEFAULT_PAGE_SIZE,
): Promise<ActivityRow[]> {
  if (!filters.workspace_id) {
    throw new Error('workspace_id is required');
  }

  const supabase = createAdminClient();

  let query = supabase
    .from('activity_log')
    .select('*')
    .eq('workspace_id', filters.workspace_id)
    .order('created_at', { ascending: false })
    .limit(pageSize);

  if (filters.activity_type) {
    query = query.eq('activity_type', filters.activity_type);
  }
  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id);
  }
  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte('created_at', filters.date_to);
  }
  if (filters.group_key) {
    query = query.eq('group_key', filters.group_key);
  }
  if (filters.cursor) {
    query = query.lt('created_at', filters.cursor);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list activities: ${error.message}`);
  }

  return (data ?? []) as ActivityRow[];
}

/**
 * Get the most recent activities for the dashboard widget.
 *
 * Req 13.5: Widget showing the last 10 activities.
 */
export async function getRecentActivities(
  workspaceId: string,
): Promise<ActivityRow[]> {
  if (!workspaceId) {
    throw new Error('workspace_id is required');
  }

  return listActivities(
    { workspace_id: workspaceId },
    RECENT_ACTIVITIES_LIMIT,
  );
}

/**
 * Subscribe to real-time activity updates for a workspace.
 *
 * Req 13.3: Real-time updates without page reload.
 *
 * Returns an unsubscribe function to tear down the channel.
 */
export function subscribeToActivities(
  workspaceId: string,
  onActivity: (activity: ActivityRow) => void,
): () => void {
  if (!workspaceId) {
    throw new Error('workspace_id is required');
  }

  const supabase = createAdminClient();

  const channel = supabase
    .channel(`${CHANNEL_PREFIX}${workspaceId}`)
    .on(
      'postgres_changes' as never,
      {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_log',
        filter: `workspace_id=eq.${workspaceId}`,
      },
      (payload: { new: ActivityRow }) => {
        onActivity(payload.new);
      },
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
