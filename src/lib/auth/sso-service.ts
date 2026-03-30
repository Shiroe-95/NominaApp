import { createAdminClient } from '@/lib/supabase/admin';

/**
 * SSOService — Configure SAML 2.0 / OIDC identity providers per workspace,
 * JIT provisioning, attribute-to-role mapping, timeout handling, and session
 * revocation.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7
 *
 * @module lib/auth/sso-service
 */

// ─── Constants ──────────────────────────────────────────────────────────────

/** SSO authentication timeout in milliseconds (Req 1.4) */
export const SSO_TIMEOUT_MS = 10_000;

/** Supported SSO protocols (Req 1.1) */
export const SSO_PROTOCOLS = ['saml', 'oidc'] as const;

/** Valid NominaSmart roles for group mapping (Req 1.7) */
export const NOMINASMART_ROLES = ['admin', 'analyst', 'client'] as const;

// ─── Types ──────────────────────────────────────────────────────────────────

export type SSOProtocol = (typeof SSO_PROTOCOLS)[number];
export type NominaSmartRole = (typeof NOMINASMART_ROLES)[number];

/** Row shape from the sso_configurations table */
export interface SSOConfigRow {
  id: string;
  workspace_id: string;
  protocol: SSOProtocol;
  metadata_url: string;
  entity_id: string | null;
  certificate_x509: string | null;
  group_role_mapping: Record<string, NominaSmartRole>;
  default_role: NominaSmartRole;
  is_active: boolean;
  created_at: string;
}

/** Input for creating / updating an SSO configuration (Req 1.2) */
export interface SSOConfigInput {
  protocol: SSOProtocol;
  metadata_url: string;
  entity_id?: string;
  certificate_x509?: string;
  group_role_mapping?: Record<string, NominaSmartRole>;
  default_role?: NominaSmartRole;
  is_active?: boolean;
}

/** Attributes received from an Identity Provider during SSO login (Req 1.3) */
export interface IdPAttributes {
  email: string;
  name?: string;
  groups?: string[];
}

/** Result of JIT provisioning (Req 1.5) */
export interface JITProvisioningResult {
  user_id: string;
  email: string;
  role: NominaSmartRole;
  created: boolean; // true if newly created, false if existing
}

// ─── SSO Configuration CRUD (Req 1.2, 1.7) ─────────────────────────────────

/**
 * Configure an SSO identity provider for a workspace.
 *
 * Req 1.2: register IdP with metadata URL, entity ID, X.509 certificate.
 * Req 1.7: configure group-to-role mapping.
 *
 * Only one SSO config per workspace (UNIQUE constraint on workspace_id).
 */
export async function configureSSOProvider(
  workspaceId: string,
  input: SSOConfigInput,
): Promise<SSOConfigRow> {
  if (!workspaceId) throw new Error('workspace_id is required');
  if (!input.metadata_url) throw new Error('metadata_url is required');
  if (!SSO_PROTOCOLS.includes(input.protocol)) {
    throw new Error(`Invalid protocol: ${input.protocol}. Must be one of: ${SSO_PROTOCOLS.join(', ')}`);
  }
  if (input.default_role && !NOMINASMART_ROLES.includes(input.default_role)) {
    throw new Error(`Invalid default_role: ${input.default_role}. Must be one of: ${NOMINASMART_ROLES.join(', ')}`);
  }

  validateGroupRoleMapping(input.group_role_mapping);

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('sso_configurations')
    .insert({
      workspace_id: workspaceId,
      protocol: input.protocol,
      metadata_url: input.metadata_url,
      entity_id: input.entity_id ?? null,
      certificate_x509: input.certificate_x509 ?? null,
      group_role_mapping: input.group_role_mapping ?? {},
      default_role: input.default_role ?? 'client',
      is_active: input.is_active ?? false,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to configure SSO provider: ${error.message}`);
  }

  return data as SSOConfigRow;
}

/**
 * Get the SSO configuration for a workspace.
 * Returns null if no SSO is configured.
 */
export async function getSSOConfig(
  workspaceId: string,
): Promise<SSOConfigRow | null> {
  if (!workspaceId) throw new Error('workspace_id is required');

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('sso_configurations')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to get SSO config: ${error.message}`);
  }

  return data as SSOConfigRow | null;
}

/**
 * Update an existing SSO configuration.
 *
 * Req 1.2: update metadata URL, entity ID, certificate.
 * Req 1.7: update group-to-role mapping.
 */
export async function updateSSOConfig(
  workspaceId: string,
  input: Partial<SSOConfigInput>,
): Promise<SSOConfigRow> {
  if (!workspaceId) throw new Error('workspace_id is required');

  if (input.protocol && !SSO_PROTOCOLS.includes(input.protocol)) {
    throw new Error(`Invalid protocol: ${input.protocol}. Must be one of: ${SSO_PROTOCOLS.join(', ')}`);
  }
  if (input.default_role && !NOMINASMART_ROLES.includes(input.default_role)) {
    throw new Error(`Invalid default_role: ${input.default_role}. Must be one of: ${NOMINASMART_ROLES.join(', ')}`);
  }

  validateGroupRoleMapping(input.group_role_mapping);

  const updates: Record<string, unknown> = {};
  if (input.protocol !== undefined) updates.protocol = input.protocol;
  if (input.metadata_url !== undefined) updates.metadata_url = input.metadata_url;
  if (input.entity_id !== undefined) updates.entity_id = input.entity_id;
  if (input.certificate_x509 !== undefined) updates.certificate_x509 = input.certificate_x509;
  if (input.group_role_mapping !== undefined) updates.group_role_mapping = input.group_role_mapping;
  if (input.default_role !== undefined) updates.default_role = input.default_role;
  if (input.is_active !== undefined) updates.is_active = input.is_active;

  if (Object.keys(updates).length === 0) {
    throw new Error('No fields to update');
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('sso_configurations')
    .update(updates)
    .eq('workspace_id', workspaceId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update SSO config: ${error.message}`);
  }

  return data as SSOConfigRow;
}

/**
 * Delete the SSO configuration for a workspace.
 */
export async function deleteSSOConfig(workspaceId: string): Promise<void> {
  if (!workspaceId) throw new Error('workspace_id is required');

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('sso_configurations')
    .delete()
    .eq('workspace_id', workspaceId);

  if (error) {
    throw new Error(`Failed to delete SSO config: ${error.message}`);
  }
}

// ─── Attribute Mapping (Req 1.3) ────────────────────────────────────────────

/**
 * Map Identity Provider attributes to a NominaSmart user profile shape.
 *
 * Req 1.3: map email, name, group from IdP to NominaSmart profile and role.
 *
 * Returns the mapped email, display name, and resolved role.
 */
export function mapAttributes(
  attributes: IdPAttributes,
  groupRoleMapping: Record<string, NominaSmartRole>,
  defaultRole: NominaSmartRole,
): { email: string; name: string; role: NominaSmartRole } {
  if (!attributes.email) {
    throw new Error('IdP attributes must include an email');
  }

  const role = resolveRoleFromGroups(attributes.groups ?? [], groupRoleMapping, defaultRole);

  return {
    email: attributes.email,
    name: attributes.name ?? attributes.email.split('@')[0],
    role,
  };
}

// ─── Group-to-Role Resolution (Req 1.7) ─────────────────────────────────────

/**
 * Resolve a NominaSmart role from IdP group memberships.
 *
 * Req 1.7: map IdP groups to NominaSmart roles (admin, analyst, client).
 *
 * Strategy: highest-privilege match wins. If a user belongs to multiple groups
 * that map to different roles, the most privileged role is assigned.
 * Priority: admin > analyst > client.
 *
 * Falls back to defaultRole when no groups match.
 */
export function resolveRoleFromGroups(
  groups: string[],
  groupRoleMapping: Record<string, NominaSmartRole>,
  defaultRole: NominaSmartRole,
): NominaSmartRole {
  if (!groups.length || !Object.keys(groupRoleMapping).length) {
    return defaultRole;
  }

  const ROLE_PRIORITY: Record<NominaSmartRole, number> = {
    admin: 3,
    analyst: 2,
    client: 1,
  };

  let highestRole: NominaSmartRole | null = null;

  for (const group of groups) {
    const mappedRole = groupRoleMapping[group];
    if (mappedRole && NOMINASMART_ROLES.includes(mappedRole)) {
      if (!highestRole || ROLE_PRIORITY[mappedRole] > ROLE_PRIORITY[highestRole]) {
        highestRole = mappedRole;
      }
    }
  }

  return highestRole ?? defaultRole;
}

// ─── JIT Provisioning (Req 1.5) ─────────────────────────────────────────────

/**
 * Handle Just-In-Time provisioning on first SSO login.
 *
 * Req 1.5: auto-create user profile on first SSO login with default role.
 * Req 1.3: use mapped attributes for the new profile.
 *
 * If the user already exists (by email), returns the existing profile without
 * creating a duplicate. Otherwise, creates a new user_profile and adds them
 * as a member of the workspace with the resolved role.
 */
export async function handleJITProvisioning(
  workspaceId: string,
  attributes: IdPAttributes,
  ssoConfig: SSOConfigRow,
): Promise<JITProvisioningResult> {
  if (!workspaceId) throw new Error('workspace_id is required');
  if (!attributes.email) throw new Error('email attribute is required');

  const mapped = mapAttributes(
    attributes,
    ssoConfig.group_role_mapping,
    ssoConfig.default_role,
  );

  const supabase = createAdminClient();

  // Check if user already exists by email
  const { data: existingUser, error: lookupError } = await supabase
    .from('user_profiles')
    .select('id, email')
    .eq('email', mapped.email)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Failed to look up user: ${lookupError.message}`);
  }

  if (existingUser) {
    // Ensure user is a member of this workspace
    await ensureWorkspaceMembership(supabase, workspaceId, existingUser.id, mapped.role);

    return {
      user_id: existingUser.id,
      email: mapped.email,
      role: mapped.role,
      created: false,
    };
  }

  // Create new user profile (Req 1.5)
  const { data: newUser, error: createError } = await supabase
    .from('user_profiles')
    .insert({
      email: mapped.email,
      full_name: mapped.name,
      role: mapped.role,
      active_workspace_id: workspaceId,
    })
    .select('id, email')
    .single();

  if (createError) {
    throw new Error(`Failed to create user profile: ${createError.message}`);
  }

  // Add user as workspace member
  await ensureWorkspaceMembership(supabase, workspaceId, newUser.id, mapped.role);

  return {
    user_id: newUser.id,
    email: mapped.email,
    role: mapped.role,
    created: true,
  };
}

// ─── Session Revocation (Req 1.6) ───────────────────────────────────────────

/**
 * Revoke a user's active session when deactivated in the IdP.
 *
 * Req 1.6: revoke NominaSmart session on next token verification when user
 * is deactivated in the Identity Provider.
 *
 * This removes the user from all workspace memberships and clears their
 * active workspace, effectively locking them out until re-provisioned.
 */
export async function revokeSession(
  userId: string,
  workspaceId?: string,
): Promise<void> {
  if (!userId) throw new Error('user_id is required');

  const supabase = createAdminClient();

  if (workspaceId) {
    // Revoke membership for a specific workspace
    const { error: memberError } = await supabase
      .from('workspace_members')
      .delete()
      .eq('user_id', userId)
      .eq('workspace_id', workspaceId);

    if (memberError) {
      throw new Error(`Failed to revoke workspace membership: ${memberError.message}`);
    }
  } else {
    // Revoke all workspace memberships
    const { error: memberError } = await supabase
      .from('workspace_members')
      .delete()
      .eq('user_id', userId);

    if (memberError) {
      throw new Error(`Failed to revoke workspace memberships: ${memberError.message}`);
    }
  }

  // Clear active workspace
  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({ active_workspace_id: null })
    .eq('id', userId);

  if (profileError) {
    throw new Error(`Failed to clear active workspace: ${profileError.message}`);
  }
}

// ─── Internal Helpers ───────────────────────────────────────────────────────

/**
 * Validate that all values in a group-role mapping are valid NominaSmart roles.
 */
function validateGroupRoleMapping(
  mapping: Record<string, NominaSmartRole> | undefined,
): void {
  if (!mapping) return;

  for (const [group, role] of Object.entries(mapping)) {
    if (!NOMINASMART_ROLES.includes(role as NominaSmartRole)) {
      throw new Error(
        `Invalid role "${role}" for group "${group}". Must be one of: ${NOMINASMART_ROLES.join(', ')}`,
      );
    }
  }
}

/**
 * Ensure a user is a member of a workspace. If not, add them.
 * Maps NominaSmart roles to workspace roles:
 *   admin → owner, analyst → editor, client → viewer
 */
async function ensureWorkspaceMembership(
  supabase: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  userId: string,
  role: NominaSmartRole,
): Promise<void> {
  const ROLE_TO_WORKSPACE_ROLE: Record<NominaSmartRole, string> = {
    admin: 'owner',
    analyst: 'editor',
    client: 'viewer',
  };

  const { data: existing } = await supabase
    .from('workspace_members')
    .select('id')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (existing) return;

  const { error } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      role: ROLE_TO_WORKSPACE_ROLE[role],
      invite_status: 'accepted',
      joined_at: new Date().toISOString(),
    });

  if (error) {
    throw new Error(`Failed to add user to workspace: ${error.message}`);
  }
}
