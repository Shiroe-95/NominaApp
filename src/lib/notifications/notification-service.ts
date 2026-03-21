import { createAdminClient } from '@/lib/supabase/admin';
import type {
  CreateNotificationOptions,
  NotificationRow,
  NotificationSeverity,
} from '@/lib/types/regulatory-sync';

/**
 * NotificationService — Manages in-app notifications and broadcasts to admins.
 *
 * Requirements: 5.1, 5.2, 5.3, 5.5
 */

/**
 * Maps a confidence level to a notification severity.
 *
 * - `high`   → `info`    (Req 5.2)
 * - `medium` → `warning` (Req 5.3)
 * - `low`    → `warning` (Req 5.3)
 */
export function mapConfidenceToSeverity(
  confidence: 'high' | 'medium' | 'low',
): NotificationSeverity {
  if (confidence === 'high') return 'info';
  return 'warning';
}

/**
 * Creates a notification. When `userId` is omitted or null, the notification
 * is broadcast to every user with `role = 'admin'` in `user_profiles`.
 *
 * @returns The ID of the newly created notification (or the first one when
 *          broadcasting).
 */
export async function createNotification(
  options: CreateNotificationOptions,
): Promise<string> {
  const supabase = createAdminClient();

  // If userId is provided, insert a single notification
  if (options.userId) {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: options.userId,
        type: options.type,
        severity: options.severity,
        title: options.title,
        body: options.body,
        metadata: options.metadata ?? {},
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }

    return data.id;
  }

  // Broadcast: query all admin users
  const { data: admins, error: adminsError } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('role', 'admin');

  if (adminsError) {
    throw new Error(`Failed to fetch admin users: ${adminsError.message}`);
  }

  if (!admins || admins.length === 0) {
    throw new Error('No admin users found for broadcast');
  }

  const rows = admins.map((admin) => ({
    user_id: admin.user_id,
    type: options.type,
    severity: options.severity,
    title: options.title,
    body: options.body,
    metadata: options.metadata ?? {},
  }));

  const { data, error } = await supabase
    .from('notifications')
    .insert(rows)
    .select('id');

  if (error) {
    throw new Error(`Failed to broadcast notifications: ${error.message}`);
  }

  return data[0].id;
}

/**
 * Marks a notification as read for a given user.
 * Sets `is_read = true` and `read_at` to the current timestamp.
 *
 * Requirement: 5.5
 */
export async function markAsRead(
  notificationId: string,
  userId: string,
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('notifications')
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Failed to mark notification as read: ${error.message}`);
  }
}

/**
 * Returns the count of unread notifications for a given user.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = createAdminClient();

  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('is_read', false);

  if (error) {
    throw new Error(
      `Failed to get unread notification count: ${error.message}`,
    );
  }

  return count ?? 0;
}
