/**
 * Webhook Client — Client-side utilities for webhook management.
 *
 * Provides HMAC generation, retry delay calculation, and limit enforcement
 * as pure functions testable without network calls.
 *
 * Requirements: 16.1-16.5
 */

import { createHmac, randomBytes } from 'crypto';

// ─── Constants ──────────────────────────────────────────────────────────────

export const MAX_WEBHOOKS_PER_WORKSPACE = 10;
export const MAX_RETRY_ATTEMPTS = 5;
export const BASE_RETRY_DELAY_MS = 30_000; // 30 seconds

export type WebhookEvent =
  | 'payroll.uploaded'
  | 'audit.completed'
  | 'correction.applied'
  | 'report.generated'
  | 'rule.updated'
  | 'user.invited'
  | 'action.status_changed';

export type DeliveryStatus = 'success' | 'failed' | 'pending';

export interface DeliveryLogEntry {
  id: string;
  webhookId: string;
  event: WebhookEvent;
  status: DeliveryStatus;
  httpStatus: number | null;
  responseTimeMs: number | null;
  attempts: number;
  lastAttemptAt: string;
}

// ─── HMAC-SHA256 Signing ────────────────────────────────────────────────────

/**
 * Sign a payload string with HMAC-SHA256.
 */
export function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify an HMAC-SHA256 signature against a payload and secret.
 * Uses constant-time comparison to prevent timing attacks.
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = signPayload(payload, secret);
  if (expected.length !== signature.length) return false;
  // Constant-time comparison
  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Generate a unique HMAC secret for a new webhook.
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

// ─── Retry Logic ────────────────────────────────────────────────────────────

/**
 * Calculate retry delay with exponential backoff.
 * attempt 0 → 30s, attempt 1 → 60s, attempt 2 → 120s, etc.
 */
export function calculateRetryDelay(attempt: number): number {
  return BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
}

/**
 * Get all retry delays for the full retry sequence.
 */
export function getRetrySchedule(): number[] {
  return Array.from({ length: MAX_RETRY_ATTEMPTS }, (_, i) => calculateRetryDelay(i));
}

// ─── Limit Enforcement ──────────────────────────────────────────────────────

/**
 * Check if a workspace can create a new webhook.
 */
export function canCreateWebhook(currentCount: number): boolean {
  return currentCount < MAX_WEBHOOKS_PER_WORKSPACE;
}

// ─── Delivery Log ───────────────────────────────────────────────────────────

/**
 * Build a delivery log entry from raw delivery data.
 */
export function buildDeliveryLogEntry(
  id: string,
  webhookId: string,
  event: WebhookEvent,
  status: DeliveryStatus,
  httpStatus: number | null,
  responseTimeMs: number | null,
  attempts: number,
): DeliveryLogEntry {
  return {
    id,
    webhookId,
    event,
    status,
    httpStatus,
    responseTimeMs,
    attempts,
    lastAttemptAt: new Date().toISOString(),
  };
}
