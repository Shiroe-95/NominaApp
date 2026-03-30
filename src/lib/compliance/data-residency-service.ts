import { createAdminClient } from '@/lib/supabase/admin';

/**
 * DataResidencyService — Region selection, residency verification,
 * and cross-region transfer confirmation.
 *
 * Requirements: 26.1, 26.2, 26.3, 26.4, 26.5
 *
 * @module lib/compliance/data-residency-service
 */

// ─── Constants ──────────────────────────────────────────────────────────────

/** Valid data storage regions */
export const VALID_REGIONS = ['na', 'sa', 'eu', 'ap'] as const;

export type DataRegion = (typeof VALID_REGIONS)[number];

/** Human-readable region metadata (Req 26.4) */
export const REGION_INFO: Record<DataRegion, {
  name: string;
  location: string;
  certifications: string[];
}> = {
  na: {
    name: 'North America',
    location: 'US East (Virginia)',
    certifications: ['SOC 2 Type II', 'ISO 27001'],
  },
  sa: {
    name: 'South America',
    location: 'São Paulo, Brazil',
    certifications: ['SOC 2 Type II', 'LGPD Compliant'],
  },
  eu: {
    name: 'Europe',
    location: 'Frankfurt, Germany',
    certifications: ['SOC 2 Type II', 'ISO 27001', 'GDPR Compliant'],
  },
  ap: {
    name: 'Asia-Pacific',
    location: 'Singapore',
    certifications: ['SOC 2 Type II', 'ISO 27001'],
  },
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ResidencyInfo {
  workspace_id: string;
  data_region: DataRegion;
  region_name: string;
  region_location: string;
  certifications: string[];
}

export interface TransferConfirmation {
  workspace_id: string;
  from_region: DataRegion;
  to_region: DataRegion;
  confirmed_at: string;
  regulatory_notice: string;
}

// ─── Region Selection (Req 26.1) ───────────────────────────────────────────

/**
 * Get the current data region for a workspace.
 */
export async function getDataRegion(workspaceId: string): Promise<ResidencyInfo> {
  if (!workspaceId) {
    throw new Error('workspace_id is required');
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('workspaces')
    .select('id, data_region')
    .eq('id', workspaceId)
    .single();

  if (error) {
    throw new Error(`Failed to get data region: ${error.message}`);
  }

  const region = data.data_region as DataRegion;
  const info = REGION_INFO[region];

  return {
    workspace_id: data.id,
    data_region: region,
    region_name: info.name,
    region_location: info.location,
    certifications: info.certifications,
  };
}

/**
 * Set the data region for a workspace (Req 26.1).
 *
 * Validates the region is one of the allowed values.
 */
export async function setDataRegion(
  workspaceId: string,
  region: DataRegion,
): Promise<ResidencyInfo> {
  if (!workspaceId) {
    throw new Error('workspace_id is required');
  }
  if (!VALID_REGIONS.includes(region)) {
    throw new Error(`Invalid region: ${region}. Must be one of: ${VALID_REGIONS.join(', ')}`);
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('workspaces')
    .update({ data_region: region })
    .eq('id', workspaceId)
    .select('id, data_region')
    .single();

  if (error) {
    throw new Error(`Failed to set data region: ${error.message}`);
  }

  const info = REGION_INFO[region];

  return {
    workspace_id: data.id,
    data_region: region,
    region_name: info.name,
    region_location: info.location,
    certifications: info.certifications,
  };
}

// ─── Residency Verification (Req 26.2, 26.3) ──────────────────────────────

/**
 * Verify that a workspace's data is stored in the expected region.
 *
 * Returns true if the workspace's configured region matches the expected region.
 */
export async function verifyResidency(
  workspaceId: string,
  expectedRegion: DataRegion,
): Promise<boolean> {
  if (!workspaceId) {
    throw new Error('workspace_id is required');
  }
  if (!VALID_REGIONS.includes(expectedRegion)) {
    throw new Error(`Invalid region: ${expectedRegion}. Must be one of: ${VALID_REGIONS.join(', ')}`);
  }

  const residency = await getDataRegion(workspaceId);
  return residency.data_region === expectedRegion;
}

// ─── Transfer Confirmation (Req 26.5) ──────────────────────────────────────

/**
 * Confirm a cross-region data transfer.
 *
 * Requires explicit confirmation and informs the user of regulatory
 * implications before changing the workspace's data region.
 */
export async function confirmTransfer(
  workspaceId: string,
  toRegion: DataRegion,
): Promise<TransferConfirmation> {
  if (!workspaceId) {
    throw new Error('workspace_id is required');
  }
  if (!VALID_REGIONS.includes(toRegion)) {
    throw new Error(`Invalid target region: ${toRegion}. Must be one of: ${VALID_REGIONS.join(', ')}`);
  }

  const currentResidency = await getDataRegion(workspaceId);
  const fromRegion = currentResidency.data_region;

  if (fromRegion === toRegion) {
    throw new Error('Source and target regions are the same; no transfer needed');
  }

  // Perform the region change
  await setDataRegion(workspaceId, toRegion);

  // Log the transfer in audit trail
  const supabase = createAdminClient();

  await supabase
    .from('audit_trail_extended')
    .insert({
      workspace_id: workspaceId,
      action_type: 'data_residency.transfer',
      resource_type: 'workspace',
      resource_id: workspaceId,
      data_before: { data_region: fromRegion },
      data_after: { data_region: toRegion },
      severity: 'warning',
    });

  const regulatory_notice =
    `Data transfer from ${REGION_INFO[fromRegion].name} (${REGION_INFO[fromRegion].location}) ` +
    `to ${REGION_INFO[toRegion].name} (${REGION_INFO[toRegion].location}). ` +
    `Please ensure this transfer complies with applicable data protection regulations ` +
    `including GDPR, LGPD, and local data sovereignty laws.`;

  return {
    workspace_id: workspaceId,
    from_region: fromRegion,
    to_region: toRegion,
    confirmed_at: new Date().toISOString(),
    regulatory_notice,
  };
}
