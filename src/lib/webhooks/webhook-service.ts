import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import { WebhookSchema, type WebhookInput } from '@/lib/schemas/world-class-schemas';

/**
 * WebhookService — CRUD for webhook registrations, HMAC-SHA256 payload signing,
 * delivery queue with exponential backoff retry, and delivery log.
 *
 * Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8
 *
 * @module lib/webhooks/webhook-service
 */

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maximum webhooks per workspace (Req 6.4) */
export const MAX_WEBHOOKS_PER_WORKSPACE = 10;

/** Maximum retry attempts (Req 6.5) */
export const MAX_RETRY_ATTEMPTS = 5;

/** Base retry delay in milliseconds (Req 6.5) */
export const BASE_RETRY_DELAY_MS = 30_000;

/** Delivery timeout in milliseconds (Req 6.5) */
export const DELIVERY_TIMEOUT_MS = 30_000;

/** Default page size for delivery log queries */
export const DEFAULT_DELIVERY_PAGE_SIZE = 50;

/** Maximum page size for delivery log queries */
export const MAX_DELIVERY_PAGE_SIZE = 200;

// ─── Types ──────────────────────────────────────────────────────────────────

export type WebhookEvent =
  | 'payroll.uploaded'
  | 'audit.completed'
  | 'correction.applied'
  | 'report.generated'
  | 'rule.updated'
  | 'user.invited'
  | 'action.status_changed';

export type DeliveryStatus = 'success' | 'failed' | 'pending';

export interface WebhookRow {
  id: string;
  workspace_id: string;
  url: string;
  secret_encrypted: string;
  events: string[];
  is_active: boolean;
  created_by: string;
  created_at: string;
}

export interface WebhookDeliveryRow {
  id: string;
  webhook_id: string;
  event_type: string;
  status: DeliveryStatus;
  http_status: number | null;
  response_time_ms: number | null;
  attempts: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  payload_summary: Record<string, unknown> | null;
  created_at: string;
}

export interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  timestamp: string;
  data: Record<string, unknown>;
}

export interface DeliveryResult {
  delivery_id: string;
  status: DeliveryStatus;
  http_status: number | null;
  response_time_ms: number | null;
}

export interface DeliveryQueryOptions {
  cursor?: string;
  page_size?: number;
}

export interface DeliveryQueryResult {
  data: WebhookDeliveryRow[];
  next_cursor: string | null;
  has_more: boolean;
}

// ─── HMAC-SHA256 Signing (Req 6.3, 6.8) ────────────────────────────────────

/**
 * Sign a payload with HMAC-SHA256 using the webhook's secret.
 * Returns a hex-encoded signature string.
 */
export function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Verify a payload signature against the expected HMAC-SHA256 signature.
 * Uses timing-safe comparison to prevent timing attacks.
 */
export function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = signPayload(payload, secret);
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Generate a cryptographically secure random secret for a webhook.
 */
export function generateWebhookSecret(): string {
  return randomBytes(32).toString('hex');
}

// ─── Retry Backoff (Req 6.5) ───────────────────────────────────────────────

/**
 * Calculate the retry delay for a given attempt number.
 * Follows exponential backoff: 30s * 2^attempt (30s, 60s, 120s, 240s, ...).
 *
 * @param attempt - Zero-based attempt index (0 = first retry)
 * @returns Delay in milliseconds
 */
export function calculateRetryDelay(attempt: number): number {
  return BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
}

// ─── CRUD Operations ────────────────────────────────────────────────────────

/**
 * Create a new webhook registration for a workspace.
 *
 * Req 6.1: register endpoints for event notifications.
 * Req 6.4: max 10 webhooks per workspace.
 * Req 6.8: unique HMAC-SHA256 secret per webhook.
 */
export async function createWebhook(
  workspaceId: string,
  userId: string,
  input: WebhookInput,
): Promise<{ webhook: WebhookRow; secret: string }> {
  if (!workspaceId) throw new Error('workspace_id is required');
  if (!userId) throw new Error('user_id is required');

  const parsed = WebhookSchema.parse(input);
  const supabase = createAdminClient();

  // Check workspace webhook limit (Req 6.4)
  const { count, error: countError } = await supabase
    .from('webhooks')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', workspaceId);

  if (countError) {
    throw new Error(`Failed to check webhook count: ${countError.message}`);
  }

  if ((count ?? 0) >= MAX_WEBHOOKS_PER_WORKSPACE) {
    throw new Error(`Maximum of ${MAX_WEBHOOKS_PER_WORKSPACE} webhooks per workspace reached`);
  }

  const secret = generateWebhookSecret();

  const { data, error } = await supabase
    .from('webhooks')
    .insert({
      workspace_id: workspaceId,
      url: parsed.url,
      secret_encrypted: secret,
      events: parsed.events,
      is_active: parsed.is_active,
      created_by: userId,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to create webhook: ${error.message}`);
  }

  return { webhook: data as WebhookRow, secret };
}

/**
 * List all webhooks for a workspace.
 */
export async function listWebhooks(workspaceId: string): Promise<WebhookRow[]> {
  if (!workspaceId) throw new Error('workspace_id is required');

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to list webhooks: ${error.message}`);
  }

  return (data ?? []) as WebhookRow[];
}

/**
 * Get a single webhook by ID.
 */
export async function getWebhook(webhookId: string): Promise<WebhookRow> {
  if (!webhookId) throw new Error('webhook_id is required');

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('id', webhookId)
    .single();

  if (error) {
    throw new Error(`Failed to get webhook: ${error.message}`);
  }

  return data as WebhookRow;
}

/**
 * Update a webhook registration.
 */
export async function updateWebhook(
  webhookId: string,
  input: Partial<WebhookInput>,
): Promise<WebhookRow> {
  if (!webhookId) throw new Error('webhook_id is required');

  const supabase = createAdminClient();

  const updateData: Record<string, unknown> = {};
  if (input.url !== undefined) updateData.url = input.url;
  if (input.events !== undefined) updateData.events = input.events;
  if (input.is_active !== undefined) updateData.is_active = input.is_active;

  if (Object.keys(updateData).length === 0) {
    throw new Error('No fields to update');
  }

  const { data, error } = await supabase
    .from('webhooks')
    .update(updateData)
    .eq('id', webhookId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to update webhook: ${error.message}`);
  }

  return data as WebhookRow;
}

/**
 * Delete a webhook registration.
 */
export async function deleteWebhook(webhookId: string): Promise<void> {
  if (!webhookId) throw new Error('webhook_id is required');

  const supabase = createAdminClient();

  const { error } = await supabase
    .from('webhooks')
    .delete()
    .eq('id', webhookId);

  if (error) {
    throw new Error(`Failed to delete webhook: ${error.message}`);
  }
}

// ─── Delivery (Req 6.3, 6.5, 6.6) ─────────────────────────────────────────

/**
 * Emit an event to all active webhooks subscribed to it in a workspace.
 *
 * Req 6.2: supported events.
 * Req 6.3: POST with JSON payload + HMAC-SHA256 signature.
 * Req 6.5: retry with exponential backoff on failure.
 */
export async function emitEvent(
  workspaceId: string,
  event: WebhookEvent,
  eventData: Record<string, unknown>,
): Promise<DeliveryResult[]> {
  if (!workspaceId) throw new Error('workspace_id is required');

  const supabase = createAdminClient();

  // Find active webhooks subscribed to this event
  const { data: webhooks, error } = await supabase
    .from('webhooks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('is_active', true)
    .contains('events', [event]);

  if (error) {
    throw new Error(`Failed to query webhooks: ${error.message}`);
  }

  const results: DeliveryResult[] = [];

  for (const webhook of (webhooks ?? []) as WebhookRow[]) {
    const result = await deliverToWebhook(webhook, event, eventData);
    results.push(result);
  }

  return results;
}

/**
 * Deliver a payload to a single webhook endpoint.
 * Creates a delivery record and attempts delivery with retry logic.
 */
async function deliverToWebhook(
  webhook: WebhookRow,
  event: WebhookEvent,
  eventData: Record<string, unknown>,
): Promise<DeliveryResult> {
  const supabase = createAdminClient();

  const payload: WebhookPayload = {
    id: randomUUID(),
    event,
    timestamp: new Date().toISOString(),
    data: eventData,
  };

  const payloadString = JSON.stringify(payload);
  const signature = signPayload(payloadString, webhook.secret_encrypted);

  // Create delivery record
  const { data: delivery, error: deliveryError } = await supabase
    .from('webhook_deliveries')
    .insert({
      webhook_id: webhook.id,
      event_type: event,
      status: 'pending',
      attempts: 0,
      payload_summary: { event, data_keys: Object.keys(eventData) },
    })
    .select('*')
    .single();

  if (deliveryError) {
    throw new Error(`Failed to create delivery record: ${deliveryError.message}`);
  }

  const deliveryRow = delivery as WebhookDeliveryRow;

  // Attempt delivery
  const result = await attemptDelivery(
    deliveryRow.id,
    webhook.url,
    payloadString,
    signature,
  );

  return result;
}

/**
 * Attempt to deliver a payload to a webhook URL.
 * Updates the delivery record with the result.
 */
async function attemptDelivery(
  deliveryId: string,
  url: string,
  payloadString: string,
  signature: string,
): Promise<DeliveryResult> {
  const supabase = createAdminClient();
  const startTime = Date.now();

  let httpStatus: number | null = null;
  let status: DeliveryStatus = 'failed';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': JSON.parse(payloadString).event,
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    httpStatus = response.status;
    status = response.ok ? 'success' : 'failed';
  } catch {
    // Network error or timeout — status remains 'failed'
  }

  const responseTimeMs = Date.now() - startTime;
  const now = new Date().toISOString();

  // Update delivery record
  const updateData: Record<string, unknown> = {
    status,
    http_status: httpStatus,
    response_time_ms: responseTimeMs,
    attempts: 1,
    last_attempt_at: now,
  };

  if (status === 'failed') {
    updateData.next_retry_at = new Date(Date.now() + calculateRetryDelay(0)).toISOString();
  }

  await supabase
    .from('webhook_deliveries')
    .update(updateData)
    .eq('id', deliveryId);

  return {
    delivery_id: deliveryId,
    status,
    http_status: httpStatus,
    response_time_ms: responseTimeMs,
  };
}

/**
 * Retry a failed delivery.
 *
 * Req 6.5: exponential backoff (30s, 60s, 120s) up to MAX_RETRY_ATTEMPTS.
 */
export async function retryDelivery(deliveryId: string): Promise<DeliveryResult> {
  if (!deliveryId) throw new Error('delivery_id is required');

  const supabase = createAdminClient();

  const { data: delivery, error } = await supabase
    .from('webhook_deliveries')
    .select('*, webhooks(*)')
    .eq('id', deliveryId)
    .single();

  if (error) {
    throw new Error(`Failed to get delivery: ${error.message}`);
  }

  const row = delivery as WebhookDeliveryRow & { webhooks: WebhookRow };

  if (row.attempts >= MAX_RETRY_ATTEMPTS) {
    throw new Error(`Maximum retry attempts (${MAX_RETRY_ATTEMPTS}) reached`);
  }

  if (row.status === 'success') {
    throw new Error('Cannot retry a successful delivery');
  }

  const webhook = row.webhooks;
  const payload: WebhookPayload = {
    id: randomUUID(),
    event: row.event_type as WebhookEvent,
    timestamp: new Date().toISOString(),
    data: (row.payload_summary ?? {}) as Record<string, unknown>,
  };

  const payloadString = JSON.stringify(payload);
  const signature = signPayload(payloadString, webhook.secret_encrypted);

  const startTime = Date.now();
  let httpStatus: number | null = null;
  let status: DeliveryStatus = 'failed';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': row.event_type,
      },
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeout);
    httpStatus = response.status;
    status = response.ok ? 'success' : 'failed';
  } catch {
    // Network error or timeout
  }

  const responseTimeMs = Date.now() - startTime;
  const now = new Date().toISOString();
  const newAttempts = row.attempts + 1;

  const updateData: Record<string, unknown> = {
    status,
    http_status: httpStatus,
    response_time_ms: responseTimeMs,
    attempts: newAttempts,
    last_attempt_at: now,
    next_retry_at: null,
  };

  if (status === 'failed' && newAttempts < MAX_RETRY_ATTEMPTS) {
    updateData.next_retry_at = new Date(
      Date.now() + calculateRetryDelay(newAttempts - 1),
    ).toISOString();
  }

  await supabase
    .from('webhook_deliveries')
    .update(updateData)
    .eq('id', deliveryId);

  return {
    delivery_id: deliveryId,
    status,
    http_status: httpStatus,
    response_time_ms: responseTimeMs,
  };
}

// ─── Delivery Log (Req 6.6) ────────────────────────────────────────────────

/**
 * Query delivery log for a webhook with cursor-based pagination.
 *
 * Req 6.6: log with status, HTTP code, response time.
 */
export async function queryDeliveryLog(
  webhookId: string,
  options: DeliveryQueryOptions = {},
): Promise<DeliveryQueryResult> {
  if (!webhookId) throw new Error('webhook_id is required');

  const pageSize = Math.min(
    Math.max(options.page_size ?? DEFAULT_DELIVERY_PAGE_SIZE, 1),
    MAX_DELIVERY_PAGE_SIZE,
  );

  const supabase = createAdminClient();

  let query = supabase
    .from('webhook_deliveries')
    .select('*')
    .eq('webhook_id', webhookId)
    .order('created_at', { ascending: false })
    .limit(pageSize + 1);

  if (options.cursor) {
    query = query.lt('created_at', options.cursor);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to query delivery log: ${error.message}`);
  }

  const rows = (data ?? []) as WebhookDeliveryRow[];
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

// ─── Test Delivery (Req 6.7) ───────────────────────────────────────────────

/**
 * Send a test event to a webhook endpoint.
 *
 * Req 6.7: test webhook by sending a test event.
 */
export async function sendTestEvent(webhookId: string): Promise<DeliveryResult> {
  if (!webhookId) throw new Error('webhook_id is required');

  const webhook = await getWebhook(webhookId);

  const testData: Record<string, unknown> = {
    message: 'This is a test webhook delivery from NominaSmart',
    webhook_id: webhookId,
  };

  const result = await deliverToWebhook(
    webhook,
    'payroll.uploaded' as WebhookEvent,
    testData,
  );

  return result;
}
