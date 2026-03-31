/**
 * SSO Attribute Mapper — Maps IdP attributes to NominaSmart profile fields
 * and handles JIT provisioning logic.
 *
 * This module provides pure functions for attribute mapping that can be
 * tested independently of Supabase.
 *
 * Requirements: 14.3, 14.4, 14.6
 */

import type { NominaSmartRole, IdPAttributes } from './sso-service';
import { NOMINASMART_ROLES } from './sso-service';

export interface AttributeMappingConfig {
  groupRoleMapping: Record<string, NominaSmartRole>;
  defaultRole: NominaSmartRole;
}

export interface MappedProfile {
  email: string;
  name: string;
  role: NominaSmartRole;
}

export interface JITProvisioningInput {
  attributes: IdPAttributes;
  config: AttributeMappingConfig;
  existingUserIds: string[]; // IDs of users that already exist
}

export interface JITProvisioningOutput {
  email: string;
  name: string;
  role: NominaSmartRole;
  shouldCreate: boolean;
}

const ROLE_PRIORITY: Record<NominaSmartRole, number> = {
  admin: 3,
  analyst: 2,
  client: 1,
};

/**
 * Map IdP attributes to a NominaSmart profile.
 * - email is required
 * - name falls back to email prefix
 * - role is resolved from group mapping with highest-priority match
 */
export function mapIdPAttributes(
  attributes: IdPAttributes,
  config: AttributeMappingConfig,
): MappedProfile {
  if (!attributes.email) {
    throw new Error('IdP attributes must include an email');
  }

  const role = resolveRole(attributes.groups ?? [], config.groupRoleMapping, config.defaultRole);

  return {
    email: attributes.email,
    name: attributes.name ?? attributes.email.split('@')[0],
    role,
  };
}

/**
 * Resolve the highest-priority role from IdP groups.
 * If no groups match, returns the default role.
 */
export function resolveRole(
  groups: string[],
  groupRoleMapping: Record<string, NominaSmartRole>,
  defaultRole: NominaSmartRole,
): NominaSmartRole {
  if (!groups.length || !Object.keys(groupRoleMapping).length) {
    return defaultRole;
  }

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

/**
 * Determine JIT provisioning action for an SSO user.
 * Returns whether the user should be created and their mapped profile.
 */
export function determineJITProvisioning(input: JITProvisioningInput): JITProvisioningOutput {
  const mapped = mapIdPAttributes(input.attributes, input.config);

  return {
    ...mapped,
    shouldCreate: !input.existingUserIds.length,
  };
}
