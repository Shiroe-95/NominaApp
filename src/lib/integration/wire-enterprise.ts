/**
 * Enterprise feature wiring helpers.
 * Wire WorkspaceSelector, ThemeToggle, SSO, API key auth, and audit logging
 * into the existing app layout and middleware.
 *
 * Requirements: 1.1, 2.4, 3.6, 17.1, 38.3
 * @module lib/integration/wire-enterprise
 */

import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Get the active workspace ID for the current user.
 * Used by Header to render WorkspaceSelector.
 */
export async function getActiveWorkspace(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ workspaceId: string | null; workspaceName: string | null }> {
  const { data } = await supabase
    .from('user_profiles')
    .select('active_workspace_id')
    .eq('id', userId)
    .single();

  if (!data?.active_workspace_id) return { workspaceId: null, workspaceName: null };

  const { data: ws } = await supabase
    .from('workspaces')
    .select('name')
    .eq('id', data.active_workspace_id)
    .single();

  return { workspaceId: data.active_workspace_id, workspaceName: ws?.name ?? null };
}

/**
 * Validate an API key from the Authorization header.
 * Returns workspace and permissions if valid.
 */
export async function validateAPIKeyFromHeader(
  supabase: SupabaseClient,
  authHeader: string | null,
): Promise<{ valid: boolean; workspaceId?: string; permissions?: string[] }> {
  if (!authHeader?.startsWith('Bearer ns_')) {
    return { valid: false };
  }

  const key = authHeader.slice(7);
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(key));
  const keyHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const { data } = await supabase
    .from('api_keys')
    .select('workspace_id, permissions, expires_at, is_revoked')
    .eq('key_hash', keyHash)
    .single();

  if (!data || data.is_revoked) return { valid: false };
  if (data.expires_at && new Date(data.expires_at) < new Date()) return { valid: false };

  return { valid: true, workspaceId: data.workspace_id, permissions: data.permissions };
}

/**
 * Add workspace_id filter to any Supabase query builder.
 * Ensures all data queries are workspace-scoped.
 */
export function withWorkspaceScope<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  workspaceId: string,
): T {
  return query.eq('workspace_id', workspaceId);
}

/**
 * Log an audit trail entry for a write operation.
 */
export async function logAuditEntry(
  supabase: SupabaseClient,
  params: {
    workspaceId: string;
    userId: string;
    actionType: string;
    resourceType: string;
    resourceId?: string;
    dataBefore?: unknown;
    dataAfter?: unknown;
    ipAddress?: string;
    userAgent?: string;
    severity?: 'info' | 'warning' | 'critical';
  },
): Promise<void> {
  await supabase.from('audit_trail_extended').insert({
    workspace_id: params.workspaceId,
    user_id: params.userId,
    action_type: params.actionType,
    resource_type: params.resourceType,
    resource_id: params.resourceId,
    data_before: params.dataBefore,
    data_after: params.dataAfter,
    ip_address: params.ipAddress,
    user_agent: params.userAgent,
    severity: params.severity ?? 'info',
  });
}
