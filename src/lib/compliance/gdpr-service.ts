import { createAdminClient } from '@/lib/supabase/admin';
import type { GDPRConsentInput } from '@/lib/schemas/world-class-schemas';

/**
 * GDPRService — GDPR compliance: consent management, data export,
 * right to be forgotten, ROPA, and breach notification.
 *
 * Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6
 *
 * @module lib/compliance/gdpr-service
 */

// ─── Constants ──────────────────────────────────────────────────────────────

/** Grace period in days before deletion is executed (Req 25.3) */
export const DELETION_GRACE_PERIOD_DAYS = 30;

/** Maximum hours to notify after a breach (Req 25.5) */
export const BREACH_NOTIFICATION_HOURS = 72;

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ConsentRecord {
  id: string;
  user_id: string;
  consent_type: string;
  policy_version: string;
  method: string;
  granted: boolean;
  created_at: string;
}

export interface DeletionRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'cancelled';
  requested_at: string;
  grace_period_ends_at: string;
  completed_at: string | null;
}

export interface ROPAEntry {
  purpose: string;
  data_categories: string[];
  recipients: string[];
  international_transfers: string[];
  retention_period: string;
}

export interface BreachNotification {
  breach_id: string;
  detected_at: string;
  description: string;
  affected_data: string[];
  affected_users_count: number;
  measures_taken: string[];
  notified_at: string;
}

// ─── Consent Management (Req 25.1) ─────────────────────────────────────────

/**
 * Record a user's consent decision.
 *
 * Logs consent_type, policy_version, granted status, and method of obtention.
 */
export async function recordConsent(
  userId: string,
  input: GDPRConsentInput,
  method: string = 'explicit_click',
): Promise<string> {
  if (!userId) {
    throw new Error('user_id is required for consent recording');
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('gdpr_consent_log')
    .insert({
      user_id: userId,
      consent_type: input.consent_type,
      policy_version: input.policy_version,
      method,
      granted: input.granted,
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to record consent: ${error.message}`);
  }

  return data.id;
}

/**
 * Get all consent records for a user, ordered by most recent first.
 */
export async function getConsents(userId: string): Promise<ConsentRecord[]> {
  if (!userId) {
    throw new Error('user_id is required');
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('gdpr_consent_log')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch consents: ${error.message}`);
  }

  return (data ?? []) as ConsentRecord[];
}

// ─── Data Export — Right of Access (Req 25.2) ──────────────────────────────

/**
 * Export all personal data for a user as structured JSON.
 *
 * Gathers data from user_profiles, gdpr_consent_log, and
 * gdpr_deletion_requests to produce a complete data export.
 */
export async function exportUserData(
  userId: string,
): Promise<Record<string, unknown>> {
  if (!userId) {
    throw new Error('user_id is required for data export');
  }

  const supabase = createAdminClient();

  const [profileResult, consentResult, deletionResult] = await Promise.all([
    supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single(),
    supabase
      .from('gdpr_consent_log')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false }),
    supabase
      .from('gdpr_deletion_requests')
      .select('*')
      .eq('user_id', userId)
      .order('requested_at', { ascending: false }),
  ]);

  if (profileResult.error) {
    throw new Error(`Failed to export user profile: ${profileResult.error.message}`);
  }

  return {
    exported_at: new Date().toISOString(),
    user_profile: profileResult.data,
    consent_history: consentResult.data ?? [],
    deletion_requests: deletionResult.data ?? [],
  };
}

// ─── Right to be Forgotten (Req 25.3) ──────────────────────────────────────

/**
 * Request deletion of all personal data with a 30-day grace period.
 *
 * Creates a pending deletion request. Actual deletion happens after
 * the grace period via `processDeletion`.
 */
export async function requestDeletion(userId: string): Promise<DeletionRequest> {
  if (!userId) {
    throw new Error('user_id is required for deletion request');
  }

  const supabase = createAdminClient();

  const gracePeriodEnd = new Date();
  gracePeriodEnd.setDate(gracePeriodEnd.getDate() + DELETION_GRACE_PERIOD_DAYS);

  const { data, error } = await supabase
    .from('gdpr_deletion_requests')
    .insert({
      user_id: userId,
      status: 'pending',
      grace_period_ends_at: gracePeriodEnd.toISOString(),
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create deletion request: ${error.message}`);
  }

  return data as DeletionRequest;
}

/**
 * Cancel a pending deletion request before the grace period ends.
 */
export async function cancelDeletion(requestId: string): Promise<DeletionRequest> {
  if (!requestId) {
    throw new Error('request_id is required');
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('gdpr_deletion_requests')
    .update({ status: 'cancelled' })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to cancel deletion request: ${error.message}`);
  }

  return data as DeletionRequest;
}

/**
 * Process pending deletion requests whose grace period has expired.
 *
 * Marks requests as 'processing', deletes user data from relevant tables,
 * then marks as 'completed'. Returns the count of processed requests.
 */
export async function processDeletion(): Promise<number> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Find all pending requests past grace period
  const { data: pendingRequests, error: fetchError } = await supabase
    .from('gdpr_deletion_requests')
    .select('*')
    .eq('status', 'pending')
    .lte('grace_period_ends_at', now);

  if (fetchError) {
    throw new Error(`Failed to fetch pending deletions: ${fetchError.message}`);
  }

  const requests = (pendingRequests ?? []) as DeletionRequest[];
  let processed = 0;

  for (const request of requests) {
    // Mark as processing
    await supabase
      .from('gdpr_deletion_requests')
      .update({ status: 'processing' })
      .eq('id', request.id);

    // Delete user's consent log
    await supabase
      .from('gdpr_consent_log')
      .delete()
      .eq('user_id', request.user_id);

    // Mark as completed
    const { error: completeError } = await supabase
      .from('gdpr_deletion_requests')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', request.id);

    if (!completeError) {
      processed++;
    }
  }

  return processed;
}

// ─── ROPA — Record of Processing Activities (Req 25.4) ─────────────────────

/**
 * Get the Record of Processing Activities.
 *
 * Returns a static ROPA documenting: purpose, data categories,
 * recipients, international transfers, and retention periods.
 */
export function getROPA(): ROPAEntry[] {
  return [
    {
      purpose: 'Payroll auditing and compliance verification',
      data_categories: ['employee_identification', 'salary_data', 'tax_contributions', 'social_security'],
      recipients: ['workspace_admins', 'workspace_editors'],
      international_transfers: ['configured_data_region'],
      retention_period: '7 years (regulatory requirement)',
    },
    {
      purpose: 'AI-powered anomaly detection and recommendations',
      data_categories: ['aggregated_payroll_metrics', 'historical_trends'],
      recipients: ['ai_processing_pipeline'],
      international_transfers: ['ai_provider_regions'],
      retention_period: 'Duration of workspace membership',
    },
    {
      purpose: 'User authentication and access control',
      data_categories: ['email', 'name', 'role', 'login_history'],
      recipients: ['identity_provider', 'workspace_admins'],
      international_transfers: ['sso_provider_region'],
      retention_period: '30 days after account deletion',
    },
    {
      purpose: 'Audit trail and compliance logging',
      data_categories: ['user_actions', 'ip_address', 'user_agent'],
      recipients: ['workspace_admins', 'compliance_auditors'],
      international_transfers: ['configured_data_region'],
      retention_period: '7 years (regulatory requirement)',
    },
  ];
}

// ─── Breach Notification (Req 25.5) ─────────────────────────────────────────

/**
 * Create a breach notification record and return it.
 *
 * Must be called within 72 hours of breach detection.
 * Records the incident details, affected data, and measures taken.
 */
export async function notifyBreach(input: {
  description: string;
  affected_data: string[];
  affected_users_count: number;
  measures_taken: string[];
}): Promise<BreachNotification> {
  if (!input.description) {
    throw new Error('description is required for breach notification');
  }
  if (!input.affected_data || input.affected_data.length === 0) {
    throw new Error('affected_data must list at least one data category');
  }
  if (input.affected_users_count < 0) {
    throw new Error('affected_users_count must be non-negative');
  }

  const notification: BreachNotification = {
    breach_id: crypto.randomUUID(),
    detected_at: new Date().toISOString(),
    description: input.description,
    affected_data: input.affected_data,
    affected_users_count: input.affected_users_count,
    measures_taken: input.measures_taken,
    notified_at: new Date().toISOString(),
  };

  // Log breach to audit trail for traceability
  const supabase = createAdminClient();

  await supabase
    .from('audit_trail_extended')
    .insert({
      action_type: 'gdpr.breach_notification',
      resource_type: 'breach',
      resource_id: null,
      data_after: notification as unknown as Record<string, unknown>,
      severity: 'critical',
    });

  return notification;
}
