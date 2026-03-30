import { createAdminClient } from '@/lib/supabase/admin';
import { WorkspaceSchema, type WorkspaceInput } from '@/lib/schemas/world-class-schemas';

/**
 * WorkspaceService — CRUD workspaces, member management, active workspace switching,
 * and workspace-scoped data filtering.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 *
 * @module lib/workspaces/workspace-service
 */

// ─── Constants ──────────────────────────────────────────────────────────────

/** Valid workspace member roles (Req 2.5) */
export const WORKSPACE_ROLES = ['owner', 'editor', 'viewer'] as const;

/** Valid invite statuses */
export const INVITE_STATUSES = ['pending', 'accepted', 'expired'] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];
export type InviteStatus = (typeof INVITE_STATUSES)[number];

export interface WorkspaceRow {
  id: string;
  name: string;
  description: string | null;
  default_country_code: string;
  data_region: string;
  organization_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceMemberRow {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  joined_at: string | null;
  invited_at: string;
  invite_status: InviteStatus;
}

// ─── Workspace CRUD (Req 2.1, 2.2) ─────────────────────────────────────────

/**
 * Create a new workspace and add the creator as owner.
 *
 * Req 2.1: support multiple workspaces within an organization.
 * Req 2.2: name, description, default country, members with roles.
 */
export async function createWorkspace(
  userId: string,
  input: WorkspaceInput,
): Promise<WorkspaceRow> {
  if (!userId) throw new Error('user_id is required');

  const parsed = WorkspaceSchema.parse(input);
  const supabase = createAdminClient();

  const { data: workspace, error } = await supabase
    .from('workspaces')
    .insert({
      name: parsed.name,
      description: parsed.description ?? null,
      default_country_code: parsed.default_country_code,
      data_region: parsed.data_region,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create workspace: ${error.message}`);
  }

  // Add creator as owner (Req 2.5)
  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: userId,
      role: 'owner',
      invite_status: 'accepted',
      joined_at: new Date().toISOString(),
    });

  if (memberError) {
    // Rollback workspace creation on member insert failure
    await supabase.from('workspaces').delete().eq('id', workspace.id);
    throw new Error(`Failed to add creator as owner: ${memberError.message}`);
  }

  return workspace as WorkspaceRow;
}


/**
 * Get a workspace by ID.
 */
export async function getWorkspace(workspaceId: string): Promise<WorkspaceRow> {
  if (!workspaceId) throw new Error('workspace_id is required');

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .single();

  if (error) {
    throw new Error(`Failed to get workspace: ${error.message}`);
  }

  return data as WorkspaceRow;
}

/**
 * Update a workspace. Only owners can update.
 *
 * Req 2.2: update name, description, country, data_region.
 */
export async function updateWorkspace(
  workspaceId: string,
  userId: string,
  input: Partial<WorkspaceInput>,
): Promise<WorkspaceRow> {
  if (!workspaceId) throw new Error('workspace_id is required');
  if (!userId) throw new Error('user_id is required');

  await requireRole(workspaceId, userId, 'owner');

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) updates.name = input.name;
  if (input.description !== undefined) updates.description = input.description;
  if (input.default_country_code !== undefined) updates.default_country_code = input.default_country_code;
  if (input.data_region !== undefined) updates.data_region = input.data_region;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('workspaces')
    .update(updates)
    .eq('id', workspaceId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update workspace: ${error.message}`);
  }

  return data as WorkspaceRow;
}

/**
 * Delete a workspace. Only owners can delete.
 * Cascade deletes members via FK constraint.
 */
export async function deleteWorkspace(
  workspaceId: string,
  userId: string,
): Promise<void> {
  if (!workspaceId) throw new Error('workspace_id is required');
  if (!userId) throw new Error('user_id is required');

  await requireRole(workspaceId, userId, 'owner');

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('workspaces')
    .delete()
    .eq('id', workspaceId);

  if (error) {
    throw new Error(`Failed to delete workspace: ${error.message}`);
  }
}

// ─── Member Management (Req 2.5, 2.6) ──────────────────────────────────────

/**
 * Invite a user to a workspace with a specific role.
 *
 * Req 2.5: owner, editor, viewer roles.
 * Req 2.6: send invitation (invite_status = 'pending').
 */
export async function inviteMember(
  workspaceId: string,
  inviterId: string,
  targetUserId: string,
  role: WorkspaceRole,
): Promise<WorkspaceMemberRow> {
  if (!workspaceId) throw new Error('workspace_id is required');
  if (!inviterId) throw new Error('inviter_id is required');
  if (!targetUserId) throw new Error('target_user_id is required');
  if (!WORKSPACE_ROLES.includes(role)) {
    throw new Error(`Invalid role: ${role}. Must be one of: ${WORKSPACE_ROLES.join(', ')}`);
  }

  // Only owners and editors can invite (owners can invite any role, editors can invite editors/viewers)
  const inviterMember = await getMember(workspaceId, inviterId);
  if (!inviterMember) {
    throw new Error('Inviter is not a member of this workspace');
  }
  if (inviterMember.role === 'viewer') {
    throw new Error('Viewers cannot invite members');
  }
  if (inviterMember.role === 'editor' && role === 'owner') {
    throw new Error('Editors cannot invite owners');
  }

  const supabase = createAdminClient();

  // Check if user is already a member
  const existing = await getMember(workspaceId, targetUserId);
  if (existing) {
    throw new Error('User is already a member of this workspace');
  }

  const { data, error } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspaceId,
      user_id: targetUserId,
      role,
      invite_status: 'pending',
      invited_at: new Date().toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to invite member: ${error.message}`);
  }

  return data as WorkspaceMemberRow;
}

/**
 * Accept a workspace invitation.
 * Updates invite_status to 'accepted' and sets joined_at.
 */
export async function acceptInvite(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceMemberRow> {
  if (!workspaceId) throw new Error('workspace_id is required');
  if (!userId) throw new Error('user_id is required');

  const supabase = createAdminClient();

  const member = await getMember(workspaceId, userId);
  if (!member) {
    throw new Error('No invitation found for this user in this workspace');
  }
  if (member.invite_status === 'accepted') {
    throw new Error('Invitation already accepted');
  }
  if (member.invite_status === 'expired') {
    throw new Error('Invitation has expired');
  }

  const { data, error } = await supabase
    .from('workspace_members')
    .update({
      invite_status: 'accepted',
      joined_at: new Date().toISOString(),
    })
    .eq('id', member.id)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to accept invite: ${error.message}`);
  }

  return data as WorkspaceMemberRow;
}

/**
 * Remove a member from a workspace.
 * Owners can remove anyone except themselves if they're the last owner.
 */
export async function removeMember(
  workspaceId: string,
  removerId: string,
  targetUserId: string,
): Promise<void> {
  if (!workspaceId) throw new Error('workspace_id is required');
  if (!removerId) throw new Error('remover_id is required');
  if (!targetUserId) throw new Error('target_user_id is required');

  await requireRole(workspaceId, removerId, 'owner');

  // Prevent removing the last owner
  if (removerId === targetUserId) {
    const owners = await getOwnerCount(workspaceId);
    if (owners <= 1) {
      throw new Error('Cannot remove the last owner of a workspace');
    }
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', targetUserId);

  if (error) {
    throw new Error(`Failed to remove member: ${error.message}`);
  }
}

/**
 * Change a member's role within a workspace.
 *
 * Req 2.5: owner, editor, viewer roles.
 * Only owners can change roles. Cannot demote the last owner.
 */
export async function changeRole(
  workspaceId: string,
  changerId: string,
  targetUserId: string,
  newRole: WorkspaceRole,
): Promise<WorkspaceMemberRow> {
  if (!workspaceId) throw new Error('workspace_id is required');
  if (!changerId) throw new Error('changer_id is required');
  if (!targetUserId) throw new Error('target_user_id is required');
  if (!WORKSPACE_ROLES.includes(newRole)) {
    throw new Error(`Invalid role: ${newRole}. Must be one of: ${WORKSPACE_ROLES.join(', ')}`);
  }

  await requireRole(workspaceId, changerId, 'owner');

  const targetMember = await getMember(workspaceId, targetUserId);
  if (!targetMember) {
    throw new Error('Target user is not a member of this workspace');
  }

  // Prevent demoting the last owner
  if (targetMember.role === 'owner' && newRole !== 'owner') {
    const owners = await getOwnerCount(workspaceId);
    if (owners <= 1) {
      throw new Error('Cannot demote the last owner of a workspace');
    }
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('workspace_members')
    .update({ role: newRole })
    .eq('id', targetMember.id)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to change role: ${error.message}`);
  }

  return data as WorkspaceMemberRow;
}


// ─── Active Workspace (Req 2.4) ────────────────────────────────────────────

/**
 * Switch the user's active workspace.
 * Updates user_profiles.active_workspace_id.
 *
 * Req 2.4: selector in header to switch workspaces without logging out.
 */
export async function switchWorkspace(
  userId: string,
  workspaceId: string,
): Promise<void> {
  if (!userId) throw new Error('user_id is required');
  if (!workspaceId) throw new Error('workspace_id is required');

  // Verify user is a member of the target workspace
  const member = await getMember(workspaceId, userId);
  if (!member) {
    throw new Error('User is not a member of this workspace');
  }
  if (member.invite_status !== 'accepted') {
    throw new Error('User has not accepted the invitation to this workspace');
  }

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('user_profiles')
    .update({ active_workspace_id: workspaceId })
    .eq('id', userId);

  if (error) {
    throw new Error(`Failed to switch workspace: ${error.message}`);
  }
}

/**
 * List all members of a workspace.
 */
export async function listWorkspaceMembers(
  workspaceId: string,
): Promise<WorkspaceMemberRow[]> {
  if (!workspaceId) throw new Error('workspace_id is required');

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('invited_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to list workspace members: ${error.message}`);
  }

  return (data ?? []) as WorkspaceMemberRow[];
}

// ─── Workspace-Scoped Filtering (Req 2.3, 2.7) ────────────────────────────

/**
 * Get all workspaces a user belongs to (accepted invitations only).
 * Used for the workspace selector dropdown (Req 2.4).
 */
export async function listUserWorkspaces(
  userId: string,
): Promise<WorkspaceRow[]> {
  if (!userId) throw new Error('user_id is required');

  const supabase = createAdminClient();

  const { data: memberships, error: memberError } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .eq('invite_status', 'accepted');

  if (memberError) {
    throw new Error(`Failed to list user memberships: ${memberError.message}`);
  }

  if (!memberships || memberships.length === 0) {
    return [];
  }

  const workspaceIds = memberships.map((m: { workspace_id: string }) => m.workspace_id);

  const { data: workspaces, error: wsError } = await supabase
    .from('workspaces')
    .select('*')
    .in('id', workspaceIds)
    .order('name', { ascending: true });

  if (wsError) {
    throw new Error(`Failed to list workspaces: ${wsError.message}`);
  }

  return (workspaces ?? []) as WorkspaceRow[];
}

/**
 * Get the user's active workspace ID from their profile.
 * Returns null if no active workspace is set.
 */
export async function getActiveWorkspaceId(
  userId: string,
): Promise<string | null> {
  if (!userId) throw new Error('user_id is required');

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('user_profiles')
    .select('active_workspace_id')
    .eq('id', userId)
    .single();

  if (error) {
    throw new Error(`Failed to get active workspace: ${error.message}`);
  }

  return data?.active_workspace_id ?? null;
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

/**
 * Get a specific member record for a user in a workspace.
 * Returns null if the user is not a member.
 */
async function getMember(
  workspaceId: string,
  userId: string,
): Promise<WorkspaceMemberRow | null> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('workspace_members')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get member: ${error.message}`);
  }

  return data as WorkspaceMemberRow | null;
}

/**
 * Count the number of owners in a workspace.
 */
async function getOwnerCount(workspaceId: string): Promise<number> {
  const supabase = createAdminClient();

  const { count, error } = await supabase
    .from('workspace_members')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId)
    .eq('role', 'owner');

  if (error) {
    throw new Error(`Failed to count owners: ${error.message}`);
  }

  return count ?? 0;
}

/**
 * Verify that a user has the required role (or higher) in a workspace.
 * Role hierarchy: owner > editor > viewer.
 */
async function requireRole(
  workspaceId: string,
  userId: string,
  requiredRole: WorkspaceRole,
): Promise<WorkspaceMemberRow> {
  const member = await getMember(workspaceId, userId);
  if (!member) {
    throw new Error('User is not a member of this workspace');
  }

  const hierarchy: Record<WorkspaceRole, number> = {
    owner: 3,
    editor: 2,
    viewer: 1,
  };

  if (hierarchy[member.role] < hierarchy[requiredRole]) {
    throw new Error(
      `Insufficient permissions: requires ${requiredRole}, user has ${member.role}`,
    );
  }

  return member;
}
