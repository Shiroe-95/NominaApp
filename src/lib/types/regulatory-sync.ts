/**
 * Shared TypeScript interfaces for the regulatory sync system.
 *
 * These types mirror the database tables created in
 * `scripts/004_regulatory_sync_tables.sql` and the service contracts
 * defined in the design document.
 */

// ── Database Row Types ──────────────────────────────────────────────

/** Row shape for the `sync_history` table. */
export interface SyncHistoryRow {
  id: string;
  country_code: string;
  rule_year: number;
  status: 'in_progress' | 'completed' | 'failed';
  trigger_type: 'automatic' | 'manual';
  started_at: string;
  completed_at: string | null;
  changes_detected: number;
  confidence: 'high' | 'medium' | 'low' | null;
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

/** Row shape for the `rule_audit_log` table. */
export interface RuleAuditLogRow {
  id: string;
  rule_id: string;
  action: 'created' | 'updated' | 'approved' | 'rejected';
  origin: 'automatic' | 'manual';
  previous_values: Record<string, unknown> | null;
  new_values: Record<string, unknown>;
  user_id: string | null;
  source_ids: string[];
  created_at: string;
}

/** Row shape for the `notifications` table. */
export interface NotificationRow {
  id: string;
  user_id: string | null;
  type: 'regulatory_change' | 'sync_completed' | 'rule_pending_review';
  severity: NotificationSeverity;
  title: string;
  body: string | null;
  metadata: Record<string, unknown>;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

/** Row shape for the `email_log` table. */
export interface EmailLogRow {
  id: string;
  resend_message_id: string | null;
  to_email: string;
  email_type: EmailType;
  status: 'pending' | 'sent' | 'failed' | 'bounced';
  error_message: string | null;
  retry_count: number;
  sent_at: string | null;
  created_at: string;
}

// ── Service Contract Types ──────────────────────────────────────────

/** Options accepted by `SyncService.runSync()`. */
export interface SyncOptions {
  /** If omitted, syncs all active countries. */
  countryCode?: string;
  /** Defaults to the current year. */
  year?: number;
  /** Ignore configured frequency and force a sync. */
  force?: boolean;
}

/** Result returned per country after a sync run. */
export interface SyncResult {
  countryCode: string;
  year: number;
  status: 'completed' | 'failed';
  changesDetected: number;
  confidence: 'high' | 'medium' | 'low';
  duration: number;
  error?: string;
}

/** Entry passed to `AuditService.logAudit()`. */
export interface AuditEntry {
  ruleId: string;
  action: AuditAction;
  origin: AuditOrigin;
  previousValues: Record<string, unknown> | null;
  newValues: Record<string, unknown>;
  userId?: string;
  sourceIds?: string[];
}

/** Options accepted by `EmailService.sendEmail()`. */
export interface SendEmailOptions {
  to: string | string[];
  type: EmailType;
  locale: 'en' | 'es' | 'pt';
  data: Record<string, unknown>;
}

/** Result returned by `EmailService.sendEmail()`. */
export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/** Options accepted by `NotificationService.createNotification()`. */
export interface CreateNotificationOptions {
  /** null = broadcast to all admins. */
  userId?: string;
  type: 'regulatory_change' | 'sync_completed' | 'rule_pending_review';
  severity: NotificationSeverity;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}

/** Constants extracted from rule `checks` strings by the dynamic rule engine. */
export interface ParsedRuleConstants {
  smmlv?: number;
  transportAllowance?: number;
  ibcMax?: number;
  healthEmployee?: number;
  healthEmployer?: number;
  pensionEmployee?: number;
  pensionEmployer?: number;
  [key: string]: number | undefined;
}

// ── Shared Enums / Unions ───────────────────────────────────────────

export type AuditAction = 'created' | 'updated' | 'approved' | 'rejected';
export type AuditOrigin = 'automatic' | 'manual';
export type EmailType = 'user_invitation' | 'regulatory_alert' | 'weekly_summary';
export type NotificationSeverity = 'info' | 'warning' | 'critical';
export type RuleStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';
