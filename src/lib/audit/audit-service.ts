import { createAdminClient } from '@/lib/supabase/admin';
import type { AuditEntry, RuleAuditLogRow } from '@/lib/types/regulatory-sync';

/**
 * AuditService — Records and retrieves audit trail entries for rule changes.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4
 */

/**
 * Inserts an audit entry into `rule_audit_log`.
 *
 * Validation:
 *  - If `origin === 'automatic'`, `sourceIds` must be a non-empty array.
 *  - If `origin === 'manual'`, `userId` must be provided.
 *
 * @returns The ID of the newly created audit log row.
 */
export async function logAudit(entry: AuditEntry): Promise<string> {
  // Conditional validation per origin
  if (entry.origin === 'automatic') {
    if (!entry.sourceIds || entry.sourceIds.length === 0) {
      throw new Error(
        'Automatic audit entries require at least one sourceId',
      );
    }
  }

  if (entry.origin === 'manual') {
    if (!entry.userId) {
      throw new Error('Manual audit entries require a userId');
    }
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('rule_audit_log')
    .insert({
      rule_id: entry.ruleId,
      action: entry.action,
      origin: entry.origin,
      previous_values: entry.previousValues,
      new_values: entry.newValues,
      user_id: entry.userId ?? null,
      source_ids: entry.sourceIds ?? [],
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to insert audit log: ${error.message}`);
  }

  return data.id;
}

/**
 * Retrieves the full audit history for a given rule, ordered by
 * `created_at` ascending (oldest first).
 *
 * Requirement: 6.4
 */
export async function getAuditHistory(
  ruleId: string,
): Promise<RuleAuditLogRow[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('rule_audit_log')
    .select('*')
    .eq('rule_id', ruleId)
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch audit history: ${error.message}`);
  }

  return (data ?? []) as RuleAuditLogRow[];
}
