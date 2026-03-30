import { createAdminClient } from '@/lib/supabase/admin';
import type { AuditEntry, RuleAuditLogRow } from '@/lib/types/regulatory-sync';

/**
 * AuditService — Records and retrieves audit trail entries for rule changes
 * AND extended audit trail for all write operations on protected API routes.
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 6.1, 6.2, 6.3, 6.4, 24.1
 *
 * @module lib/audit/audit-service
 */

// ─── Constants ──────────────────────────────────────────────────────────────

/** 7-year retention policy in days (Req 3.5) */
export const RETENTION_DAYS = 7 * 365;

/** Default page size for cursor-based pagination */
export const DEFAULT_PAGE_SIZE = 50;

/** Maximum page size allowed */
export const MAX_PAGE_SIZE = 200;

// ─── Types ──────────────────────────────────────────────────────────────────

export type AuditSeverity = 'info' | 'warning' | 'critical';

export interface AuditLogActionInput {
  workspace_id: string;
  user_id: string;
  action_type: string;
  resource_type: string;
  resource_id?: string;
  data_before?: Record<string, unknown> | null;
  data_after?: Record<string, unknown> | null;
  ip_address?: string;
  user_agent?: string;
  severity?: AuditSeverity;
}

export interface AuditTrailRow {
  id: string;
  workspace_id: string | null;
  user_id: string | null;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  data_before: Record<string, unknown> | null;
  data_after: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  severity: AuditSeverity;
  created_at: string;
}

export interface AuditQueryFilters {
  workspace_id: string;
  action_type?: string;
  resource_type?: string;
  user_id?: string;
  severity?: AuditSeverity;
  date_from?: string;
  date_to?: string;
}

export interface AuditQueryOptions {
  cursor?: string;
  page_size?: number;
}

export interface AuditQueryResult {
  data: AuditTrailRow[];
  next_cursor: string | null;
  has_more: boolean;
}

// ─── Legacy rule audit functions ────────────────────────────────────────────

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


// ─── Extended Audit Trail Service (Req 3.1–3.7, 24.1) ──────────────────────

/**
 * Log a write operation to the extended audit trail.
 *
 * Automatically records workspace_id, user_id, action_type, resource_type,
 * resource_id, data_before, data_after, ip_address, user_agent, severity.
 *
 * Requirement 3.6: automatic logging of all write operations on protected routes.
 * Requirement 24.1: centralized logging of all accesses to sensitive data.
 */
export async function logAction(input: AuditLogActionInput): Promise<string> {
  if (!input.workspace_id) {
    throw new Error('workspace_id is required for audit logging');
  }
  if (!input.user_id) {
    throw new Error('user_id is required for audit logging');
  }
  if (!input.action_type) {
    throw new Error('action_type is required for audit logging');
  }
  if (!input.resource_type) {
    throw new Error('resource_type is required for audit logging');
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('audit_trail_extended')
    .insert({
      workspace_id: input.workspace_id,
      user_id: input.user_id,
      action_type: input.action_type,
      resource_type: input.resource_type,
      resource_id: input.resource_id ?? null,
      data_before: input.data_before ?? null,
      data_after: input.data_after ?? null,
      ip_address: input.ip_address ?? null,
      user_agent: input.user_agent ?? null,
      severity: input.severity ?? 'info',
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to insert audit trail entry: ${error.message}`);
  }

  return data.id;
}

/**
 * Query the extended audit trail with cursor-based pagination.
 *
 * Requirement 3.7: cursor-based pagination for queries exceeding 10,000 entries.
 * Requirement 3.2: filter by action type, user, date range, workspace, severity.
 *
 * The cursor is the `created_at` timestamp of the last item in the previous page.
 * Results are ordered by created_at DESC (newest first).
 */
export async function queryAuditTrail(
  filters: AuditQueryFilters,
  options: AuditQueryOptions = {},
): Promise<AuditQueryResult> {
  if (!filters.workspace_id) {
    throw new Error('workspace_id is required for audit trail queries');
  }

  const pageSize = Math.min(
    Math.max(options.page_size ?? DEFAULT_PAGE_SIZE, 1),
    MAX_PAGE_SIZE,
  );

  const supabase = createAdminClient();

  // Fetch one extra row to determine if there are more results
  let query = supabase
    .from('audit_trail_extended')
    .select('*')
    .eq('workspace_id', filters.workspace_id)
    .order('created_at', { ascending: false })
    .limit(pageSize + 1);

  // Cursor: fetch rows older than the cursor timestamp
  if (options.cursor) {
    query = query.lt('created_at', options.cursor);
  }

  // Apply optional filters
  if (filters.action_type) {
    query = query.eq('action_type', filters.action_type);
  }
  if (filters.resource_type) {
    query = query.eq('resource_type', filters.resource_type);
  }
  if (filters.user_id) {
    query = query.eq('user_id', filters.user_id);
  }
  if (filters.severity) {
    query = query.eq('severity', filters.severity);
  }
  if (filters.date_from) {
    query = query.gte('created_at', filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte('created_at', filters.date_to);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to query audit trail: ${error.message}`);
  }

  const rows = (data ?? []) as AuditTrailRow[];
  const hasMore = rows.length > pageSize;
  const pageRows = hasMore ? rows.slice(0, pageSize) : rows;
  const nextCursor = hasMore && pageRows.length > 0
    ? pageRows[pageRows.length - 1].created_at
    : null;

  return {
    data: pageRows,
    next_cursor: nextCursor,
    has_more: hasMore,
  };
}

/**
 * Export audit trail entries to CSV format.
 *
 * Requirement 3.4: export filtered log to CSV for external audits.
 *
 * Returns a UTF-8 CSV string with BOM for Excel compatibility.
 */
export async function exportAuditCSV(
  filters: AuditQueryFilters,
): Promise<string> {
  const allRows = await fetchAllFilteredRows(filters);

  const headers = [
    'id',
    'workspace_id',
    'user_id',
    'action_type',
    'resource_type',
    'resource_id',
    'data_before',
    'data_after',
    'ip_address',
    'user_agent',
    'severity',
    'created_at',
  ];

  const csvRows = allRows.map((row) =>
    headers.map((h) => {
      const value = row[h as keyof AuditTrailRow];
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      const str = String(value);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(','),
  );

  // BOM + header + rows
  return '\uFEFF' + headers.join(',') + '\n' + csvRows.join('\n');
}

/**
 * Export audit trail entries to a PDF-ready data structure.
 *
 * Requirement 3.4: export filtered log to PDF for external audits.
 *
 * Returns structured data that can be consumed by a PDF renderer.
 * Actual PDF generation is delegated to PDFExporter service.
 */
export async function exportAuditPDF(
  filters: AuditQueryFilters,
): Promise<AuditPDFData> {
  const allRows = await fetchAllFilteredRows(filters);

  return {
    title: 'Audit Trail Report',
    generated_at: new Date().toISOString(),
    filters: {
      workspace_id: filters.workspace_id,
      action_type: filters.action_type ?? null,
      resource_type: filters.resource_type ?? null,
      user_id: filters.user_id ?? null,
      severity: filters.severity ?? null,
      date_from: filters.date_from ?? null,
      date_to: filters.date_to ?? null,
    },
    total_entries: allRows.length,
    entries: allRows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      action_type: row.action_type,
      resource_type: row.resource_type,
      resource_id: row.resource_id,
      severity: row.severity,
      ip_address: row.ip_address,
      created_at: row.created_at,
      has_data_changes: row.data_before !== null || row.data_after !== null,
    })),
  };
}

export interface AuditPDFEntry {
  id: string;
  user_id: string | null;
  action_type: string;
  resource_type: string;
  resource_id: string | null;
  severity: AuditSeverity;
  ip_address: string | null;
  created_at: string;
  has_data_changes: boolean;
}

export interface AuditPDFData {
  title: string;
  generated_at: string;
  filters: {
    workspace_id: string;
    action_type: string | null;
    resource_type: string | null;
    user_id: string | null;
    severity: AuditSeverity | null;
    date_from: string | null;
    date_to: string | null;
  };
  total_entries: number;
  entries: AuditPDFEntry[];
}

/**
 * Calculate the retention cutoff date (7 years ago).
 *
 * Requirement 3.5: retain records for a minimum of 7 years.
 */
export function getRetentionCutoffDate(): Date {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - RETENTION_DAYS);
  return cutoff;
}

/**
 * Purge audit trail entries older than the retention period.
 *
 * Requirement 3.5: 7-year retention policy.
 * Only entries older than 7 years are deleted.
 *
 * @returns The number of rows deleted.
 */
export async function purgeExpiredEntries(): Promise<number> {
  const cutoff = getRetentionCutoffDate();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('audit_trail_extended')
    .delete()
    .lt('created_at', cutoff.toISOString())
    .select('id');

  if (error) {
    throw new Error(`Failed to purge expired audit entries: ${error.message}`);
  }

  return data?.length ?? 0;
}

// ─── Internal helpers ───────────────────────────────────────────────────────

/**
 * Fetch all rows matching filters (no pagination limit).
 * Used internally for CSV/PDF export.
 * Streams in batches of 1000 to avoid memory issues.
 */
async function fetchAllFilteredRows(
  filters: AuditQueryFilters,
): Promise<AuditTrailRow[]> {
  if (!filters.workspace_id) {
    throw new Error('workspace_id is required for audit trail export');
  }

  const batchSize = 1000;
  const allRows: AuditTrailRow[] = [];
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const result = await queryAuditTrail(filters, {
      cursor,
      page_size: batchSize > MAX_PAGE_SIZE ? MAX_PAGE_SIZE : batchSize,
    });
    allRows.push(...result.data);
    hasMore = result.has_more;
    cursor = result.next_cursor ?? undefined;
  }

  return allRows;
}
