/**
 * NominaSmart TypeScript SDK — typed API client for all v1 endpoints.
 * Supports Bearer token and API key auth, automatic token refresh,
 * retry with exponential backoff on 401/429, and full JSDoc.
 *
 * Requirements: 19.1, 19.2, 19.3, 19.4, 19.5
 * @module lib/sdk/nominasmart-client
 */

import type {
  WorkspaceInput,
  WebhookInput,
  ScheduledReportInput,
  AnnotationInput,
  APIKeyCreateInput,
  NLQQueryInput,
  ForecastParamsInput,
  GDPRConsentInput,
  BenchmarkQueryInput,
  DashboardLayoutInput,
} from '@/lib/schemas/world-class-schemas';

// ── Configuration ───────────────────────────────────────────────────

/**
 * SDK configuration options.
 *
 * @description Configure the NominaSmart SDK client with authentication,
 * timeouts, custom headers, and optional token refresh callback.
 *
 * @example
 * ```ts
 * const client = new NominaSmartClient({
 *   baseUrl: 'https://app.nominasmart.com',
 *   apiKey: 'ns_live_abc123',
 *   timeout: 15000,
 *   headers: { 'X-Custom-Header': 'value' },
 * });
 * ```
 */
export interface NominaSmartConfig {
  /** Base URL of the NominaSmart instance (no trailing slash). */
  baseUrl: string;
  /** API key for authentication (Bearer token). */
  apiKey: string;
  /** Maximum retries on 429 rate-limit responses. @default 3 */
  maxRetries?: number;
  /** Request timeout in milliseconds. @default 30000 */
  timeout?: number;
  /** Custom headers to include in every request. */
  headers?: Record<string, string>;
  /**
   * Callback invoked when the token needs refreshing (401).
   * Return new token string or null to stop retry.
   *
   * @returns New token or null if refresh fails.
   * @example
   * ```ts
   * onTokenRefresh: async () => {
   *   const res = await fetch('/auth/refresh');
   *   const { token } = await res.json();
   *   return token;
   * }
   * ```
   */
  onTokenRefresh?: () => Promise<string | null>;
}

/**
 * Standard API response wrapper.
 *
 * @description Every SDK method returns this wrapper. Check `error` for
 * failures and `data` for successful responses.
 *
 * @typeParam T - The type of the response data.
 * @example
 * ```ts
 * const response: APIResponse<Workspace[]> = await client.listWorkspaces();
 * if (response.error) {
 *   console.error(response.error, response.status);
 * } else {
 *   console.log(response.data);
 * }
 * ```
 */
export interface APIResponse<T> {
  /** Response data on success, null on error. */
  data: T | null;
  /** Error message on failure, null on success. */
  error: string | null;
  /** HTTP status code (0 for network/timeout errors). */
  status: number;
  /** Request ID from X-Request-Id header for tracing. */
  requestId: string | null;
}

// ── Pagination ──────────────────────────────────────────────────────

/**
 * Cursor-based pagination parameters.
 *
 * @description Used by list endpoints that support cursor pagination.
 */
export interface PaginationParams {
  /** Pagination cursor from a previous response. */
  cursor?: string;
  /** Maximum number of items to return. */
  limit?: number;
}

// ── SDK Client ──────────────────────────────────────────────────────

/**
 * NominaSmart SDK client for programmatic access to the v1 API.
 *
 * @description Provides typed methods for all NominaSmart API v1 operations
 * including workspaces, webhooks, AI endpoints, reports, bulk operations,
 * annotations, API keys, GDPR compliance, and health checks.
 *
 * Features:
 * - Automatic Bearer token authentication
 * - Token refresh on 401 with configurable callback
 * - Exponential backoff retry on 429 rate-limit responses
 * - Configurable timeout, base URL, and custom headers
 * - Full TypeScript types derived from Zod schemas
 *
 * @example
 * ```ts
 * const client = new NominaSmartClient({
 *   baseUrl: 'https://app.nominasmart.com',
 *   apiKey: 'ns_live_abc123',
 * });
 *
 * const { data, error } = await client.listWorkspaces();
 * ```
 */
export class NominaSmartClient {
  private baseUrl: string;
  private apiKey: string;
  private maxRetries: number;
  private timeout: number;
  private customHeaders: Record<string, string>;
  private onTokenRefresh?: () => Promise<string | null>;

  /**
   * Create a new NominaSmart SDK client.
   *
   * @param config - Client configuration with baseUrl, apiKey, and optional settings.
   * @example
   * ```ts
   * const client = new NominaSmartClient({
   *   baseUrl: 'https://app.nominasmart.com',
   *   apiKey: 'ns_live_abc123',
   *   timeout: 15000,
   * });
   * ```
   */
  constructor(config: NominaSmartConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.maxRetries = config.maxRetries ?? 3;
    this.timeout = config.timeout ?? 30000;
    this.customHeaders = config.headers ?? {};
    this.onTokenRefresh = config.onTokenRefresh;
  }

  /**
   * Get the current configuration values (read-only snapshot).
   *
   * @returns Object with baseUrl, timeout, and custom headers.
   * @example
   * ```ts
   * const cfg = client.getConfig();
   * console.log(cfg.baseUrl, cfg.timeout);
   * ```
   */
  getConfig(): { baseUrl: string; timeout: number; headers: Record<string, string> } {
    return {
      baseUrl: this.baseUrl,
      timeout: this.timeout,
      headers: { ...this.customHeaders },
    };
  }

  // ── Core request method with rate-limit + 401 retry handling ──────

  /**
   * Internal HTTP request method with automatic retry logic.
   *
   * Handles:
   * - 429 rate-limit: exponential backoff using Retry-After header
   * - 401 unauthorized: calls onTokenRefresh once, retries with new token
   * - Timeout: aborts request after configured timeout
   *
   * @param method - HTTP method (GET, POST, PUT, PATCH, DELETE).
   * @param path - API path relative to /api/v1.
   * @param body - Optional request body (JSON-serializable).
   * @returns Typed API response wrapper.
   */
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<APIResponse<T>> {
    let attempts = 0;
    let currentKey = this.apiKey;

    while (attempts <= this.maxRetries) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeout);

      try {
        const res = await fetch(`${this.baseUrl}/api/v1${path}`, {
          method,
          headers: {
            Authorization: `Bearer ${currentKey}`,
            'Content-Type': 'application/json',
            'X-API-Version': '1',
            ...this.customHeaders,
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: controller.signal,
        });
        clearTimeout(timer);

        const requestId = res.headers.get('X-Request-Id');

        // Rate limited — wait and retry
        if (res.status === 429) {
          const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10);
          const backoff = retryAfter * 1000 * Math.pow(2, attempts);
          await new Promise((r) => setTimeout(r, backoff));
          attempts++;
          continue;
        }

        // Unauthorized — try token refresh once
        if (res.status === 401 && this.onTokenRefresh && attempts === 0) {
          const newToken = await this.onTokenRefresh();
          if (newToken) {
            currentKey = newToken;
            this.apiKey = newToken;
            attempts++;
            continue;
          }
        }

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: res.statusText }));
          return { data: null, error: err.error ?? res.statusText, status: res.status, requestId };
        }

        const data = (await res.json()) as T;
        return { data, error: null, status: res.status, requestId };
      } catch (e) {
        clearTimeout(timer);
        if ((e as Error).name === 'AbortError') {
          return { data: null, error: 'Request timeout', status: 0, requestId: null };
        }
        return { data: null, error: (e as Error).message, status: 0, requestId: null };
      }
    }

    return { data: null, error: 'Max retries exceeded (429)', status: 429, requestId: null };
  }

  /** Build query string from optional params. */
  private qs(params?: Record<string, unknown>): string {
    if (!params) return '';
    const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
    if (entries.length === 0) return '';
    return '?' + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
  }

  // ── Workspaces ────────────────────────────────────────────────────

  /**
   * List all workspaces accessible to the authenticated user.
   *
   * @returns Array of workspace objects.
   * @example
   * ```ts
   * const { data } = await client.listWorkspaces();
   * ```
   */
  listWorkspaces() { return this.request<unknown[]>('GET', '/workspaces'); }

  /**
   * Create a new workspace.
   *
   * @param data - Workspace creation parameters (name, country code, etc.).
   * @returns The created workspace object.
   * @example
   * ```ts
   * const { data } = await client.createWorkspace({
   *   name: 'LATAM',
   *   default_country_code: 'CO',
   * });
   * ```
   */
  createWorkspace(data: WorkspaceInput) {
    return this.request<unknown>('POST', '/workspaces', data);
  }

  /**
   * Get a workspace by ID.
   *
   * @param id - Workspace UUID.
   * @returns The workspace object.
   * @example
   * ```ts
   * const { data } = await client.getWorkspace('uuid-here');
   * ```
   */
  getWorkspace(id: string) {
    return this.request<unknown>('GET', `/workspaces/${id}`);
  }

  /**
   * Update a workspace.
   *
   * @param id - Workspace UUID.
   * @param data - Partial workspace fields to update.
   * @returns The updated workspace object.
   * @example
   * ```ts
   * const { data } = await client.updateWorkspace('uuid', { name: 'New Name' });
   * ```
   */
  updateWorkspace(id: string, data: Partial<WorkspaceInput>) {
    return this.request<unknown>('PATCH', `/workspaces/${id}`, data);
  }

  /**
   * Delete a workspace.
   *
   * @param id - Workspace UUID.
   * @returns Confirmation of deletion.
   * @example
   * ```ts
   * await client.deleteWorkspace('uuid-here');
   * ```
   */
  deleteWorkspace(id: string) {
    return this.request<unknown>('DELETE', `/workspaces/${id}`);
  }

  // ── Audit Trail ───────────────────────────────────────────────────

  /**
   * Query the audit trail with optional cursor-based pagination.
   *
   * @param params - Optional pagination parameters (cursor, limit).
   * @returns Paginated audit trail entries.
   * @example
   * ```ts
   * const { data } = await client.getAuditTrail();
   * const { data: next } = await client.getAuditTrail({ cursor: 'abc' });
   * ```
   */
  getAuditTrail(params?: PaginationParams) {
    return this.request<unknown>('GET', `/audit-trail${this.qs(params)}`);
  }

  // ── Webhooks ──────────────────────────────────────────────────────

  /**
   * List all webhooks for the current workspace.
   *
   * @returns Array of webhook configurations.
   * @example
   * ```ts
   * const { data } = await client.listWebhooks();
   * ```
   */
  listWebhooks() { return this.request<unknown[]>('GET', '/webhooks'); }

  /**
   * Register a new webhook endpoint.
   *
   * @param data - Webhook URL and subscribed events.
   * @returns The created webhook with generated HMAC secret.
   * @example
   * ```ts
   * const { data } = await client.createWebhook({
   *   url: 'https://example.com/hook',
   *   events: ['payroll.uploaded', 'audit.completed'],
   * });
   * ```
   */
  createWebhook(data: WebhookInput) {
    return this.request<unknown>('POST', '/webhooks', data);
  }

  /**
   * Get a webhook by ID.
   *
   * @param id - Webhook UUID.
   * @returns The webhook configuration.
   * @example
   * ```ts
   * const { data } = await client.getWebhook('uuid-here');
   * ```
   */
  getWebhook(id: string) {
    return this.request<unknown>('GET', `/webhooks/${id}`);
  }

  /**
   * Update a webhook configuration.
   *
   * @param id - Webhook UUID.
   * @param data - Partial webhook fields to update.
   * @returns The updated webhook.
   * @example
   * ```ts
   * await client.updateWebhook('uuid', { is_active: false });
   * ```
   */
  updateWebhook(id: string, data: Partial<WebhookInput>) {
    return this.request<unknown>('PATCH', `/webhooks/${id}`, data);
  }

  /**
   * Delete a webhook.
   *
   * @param id - Webhook UUID.
   * @returns Confirmation of deletion.
   * @example
   * ```ts
   * await client.deleteWebhook('uuid-here');
   * ```
   */
  deleteWebhook(id: string) {
    return this.request<unknown>('DELETE', `/webhooks/${id}`);
  }

  // ── AI Endpoints ──────────────────────────────────────────────────

  /**
   * List detected payroll anomalies.
   *
   * @returns Array of anomaly objects with confidence levels and categories.
   * @example
   * ```ts
   * const { data } = await client.getAnomalies();
   * ```
   */
  getAnomalies() { return this.request<unknown[]>('GET', '/anomalies'); }

  /**
   * Execute a natural language query against payroll data.
   *
   * @param params - Query text, locale, and workspace ID.
   * @returns Structured NLQ response with data, sources, and optional charts.
   * @example
   * ```ts
   * const { data } = await client.queryNLQ({
   *   query: '¿Cuál es el total de nómina de enero?',
   *   locale: 'es',
   *   workspace_id: 'uuid-here',
   * });
   * ```
   */
  queryNLQ(params: NLQQueryInput) {
    return this.request<unknown>('POST', '/nlq', params);
  }

  /**
   * Generate a payroll cost forecast.
   *
   * @param params - Forecast parameters including company, horizon, and adjustments.
   * @returns Forecast projections with confidence bands (optimistic, expected, pessimistic).
   * @example
   * ```ts
   * const { data } = await client.getForecast({
   *   company_id: 'uuid-here',
   *   months_ahead: 6,
   *   growth_rate: 0.05,
   * });
   * ```
   */
  getForecast(params: ForecastParamsInput) {
    return this.request<unknown>('POST', '/forecast', params);
  }

  /**
   * Get AI-generated payroll optimization recommendations.
   *
   * @returns Array of recommendation objects with priority and impact.
   * @example
   * ```ts
   * const { data } = await client.getRecommendations();
   * ```
   */
  getRecommendations() { return this.request<unknown[]>('GET', '/recommendations'); }

  // ── Reports ───────────────────────────────────────────────────────

  /**
   * List available reports with optional pagination.
   *
   * @param params - Optional pagination parameters.
   * @returns Paginated list of reports.
   * @example
   * ```ts
   * const { data } = await client.listReports();
   * ```
   */
  listReports(params?: PaginationParams) {
    return this.request<unknown[]>('GET', `/reports${this.qs(params)}`);
  }

  /**
   * List all scheduled reports.
   *
   * @returns Array of scheduled report configurations.
   * @example
   * ```ts
   * const { data } = await client.listScheduledReports();
   * ```
   */
  listScheduledReports() { return this.request<unknown[]>('GET', '/scheduled-reports'); }

  /**
   * Create a new scheduled report.
   *
   * @param data - Report configuration with schedule, recipients, and filters.
   * @returns The created scheduled report.
   * @example
   * ```ts
   * const { data } = await client.createScheduledReport({
   *   name: 'Monthly Executive',
   *   report_type: 'executive',
   *   output_format: 'pdf',
   *   recipients: ['cfo@company.com'],
   *   cron_expression: '0 8 1 * *',
   *   filters: {},
   * });
   * ```
   */
  createScheduledReport(data: ScheduledReportInput) {
    return this.request<unknown>('POST', '/scheduled-reports', data);
  }

  /**
   * Get industry benchmark data for comparison.
   *
   * @param params - Optional filters: industry, country_code, company_size, period_year.
   * @returns Benchmark data matching the filters.
   * @example
   * ```ts
   * const { data } = await client.getBenchmarks({ country_code: 'CO', period_year: 2024 });
   * ```
   */
  getBenchmarks(params?: BenchmarkQueryInput) {
    return this.request<unknown>('GET', `/benchmarks${this.qs(params)}`);
  }

  // ── Annotations ───────────────────────────────────────────────────

  /**
   * List annotations for a target entity.
   *
   * @param targetType - Entity type: 'cell', 'finding', 'action_item', 'report_section'.
   * @param targetId - UUID of the target entity.
   * @returns Array of annotations for the target.
   * @example
   * ```ts
   * const { data } = await client.listAnnotations('finding', 'uuid-here');
   * ```
   */
  listAnnotations(targetType: string, targetId: string) {
    return this.request<unknown[]>('GET', `/annotations${this.qs({ target_type: targetType, target_id: targetId })}`);
  }

  /**
   * Create a new annotation or comment on a target entity.
   *
   * @param data - Annotation content, target type/ID, and optional mentions.
   * @returns The created annotation.
   * @example
   * ```ts
   * const { data } = await client.createAnnotation({
   *   target_type: 'cell',
   *   target_id: 'uuid-here',
   *   content: 'This value looks incorrect',
   *   mentions: ['user-uuid'],
   * });
   * ```
   */
  createAnnotation(data: AnnotationInput) {
    return this.request<unknown>('POST', '/annotations', data);
  }

  /**
   * Resolve or update an annotation.
   *
   * @param id - Annotation UUID.
   * @param data - Fields to update (e.g., resolved status).
   * @returns The updated annotation.
   * @example
   * ```ts
   * await client.updateAnnotation('uuid', { resolved: true });
   * ```
   */
  updateAnnotation(id: string, data: Record<string, unknown>) {
    return this.request<unknown>('PATCH', `/annotations/${id}`, data);
  }

  // ── API Keys ──────────────────────────────────────────────────────

  /**
   * List all API keys for the authenticated user.
   *
   * @returns Array of API key metadata (keys are masked).
   * @example
   * ```ts
   * const { data } = await client.listAPIKeys();
   * ```
   */
  listAPIKeys() { return this.request<unknown[]>('GET', '/api-keys'); }

  /**
   * Create a new API key.
   *
   * @param data - Key name, permissions, and optional expiration.
   * @returns The created API key (full key shown only once).
   * @example
   * ```ts
   * const { data } = await client.createAPIKey({
   *   name: 'CI/CD Pipeline',
   *   permissions: ['read'],
   * });
   * ```
   */
  createAPIKey(data: APIKeyCreateInput) {
    return this.request<unknown>('POST', '/api-keys', data);
  }

  /**
   * Revoke an existing API key.
   *
   * @param id - The API key ID to revoke.
   * @returns Confirmation of revocation.
   * @example
   * ```ts
   * await client.revokeAPIKey('key-uuid');
   * ```
   */
  revokeAPIKey(id: string) { return this.request<unknown>('POST', `/api-keys/${id}/revoke`); }

  // ── Bulk Operations ───────────────────────────────────────────────

  /**
   * Execute a bulk operation on multiple records.
   *
   * @param operation - Operation type: 'export', 'delete', 're-audit', 'change-status', 'assign'.
   * @param recordIds - Array of record UUIDs to process.
   * @param params - Optional operation-specific parameters.
   * @returns Bulk operation result with success/failure counts.
   * @example
   * ```ts
   * const { data } = await client.executeBulk('export', ['uuid1', 'uuid2']);
   * ```
   */
  executeBulk(operation: string, recordIds: string[], params?: Record<string, unknown>) {
    return this.request<unknown>('POST', '/bulk', { operation, record_ids: recordIds, ...params });
  }

  // ── Activity ──────────────────────────────────────────────────────

  /**
   * Get recent activity feed for the current workspace.
   *
   * @param params - Optional pagination parameters.
   * @returns Paginated activity entries.
   * @example
   * ```ts
   * const { data } = await client.getActivity();
   * ```
   */
  getActivity(params?: PaginationParams) {
    return this.request<unknown[]>('GET', `/activity${this.qs(params)}`);
  }

  // ── Compare ───────────────────────────────────────────────────────

  /**
   * Compare payroll data between two periods.
   *
   * @param periodA - First period identifier.
   * @param periodB - Second period identifier.
   * @returns Comparison results with differences highlighted.
   * @example
   * ```ts
   * const { data } = await client.comparePeriods('2024-01', '2024-02');
   * ```
   */
  comparePeriods(periodA: string, periodB: string) {
    return this.request<unknown>('GET', `/compare${this.qs({ period_a: periodA, period_b: periodB })}`);
  }

  // ── Dashboard ─────────────────────────────────────────────────────

  /**
   * Save the user's dashboard layout configuration.
   *
   * @param layout - Dashboard layout with widget positions and preset.
   * @returns The saved layout.
   * @example
   * ```ts
   * await client.saveDashboardLayout({
   *   widget_config: [{ widget_id: 'metrics', position: { x: 0, y: 0, w: 2, h: 1 } }],
   *   preset: 'executive',
   * });
   * ```
   */
  saveDashboardLayout(layout: DashboardLayoutInput) {
    return this.request<unknown>('PUT', '/settings/dashboard-layout', layout);
  }

  // ── GDPR / Compliance ─────────────────────────────────────────────

  /**
   * Record a GDPR consent decision.
   *
   * @param data - Consent type, policy version, and granted status.
   * @returns The recorded consent.
   * @example
   * ```ts
   * await client.recordConsent({
   *   consent_type: 'data_processing',
   *   policy_version: '2.0',
   *   granted: true,
   * });
   * ```
   */
  recordConsent(data: GDPRConsentInput) {
    return this.request<unknown>('POST', '/gdpr/consent', data);
  }

  // ── Health ────────────────────────────────────────────────────────

  /**
   * Check the health status of all NominaSmart services.
   *
   * @returns Health status object with per-service details (status, latency, last check).
   * @example
   * ```ts
   * const { data } = await client.health();
   * ```
   */
  health() { return this.request<unknown>('GET', '/health'); }

  // ── Webhook Signature Verification ────────────────────────────────

  /**
   * Verify a webhook payload signature using HMAC-SHA256.
   *
   * @param payload - The raw request body string.
   * @param signature - The signature from the X-Webhook-Signature header.
   * @param secret - The webhook secret (from webhook creation response).
   * @returns True if the signature is valid, false otherwise.
   * @example
   * ```ts
   * const isValid = await NominaSmartClient.verifyWebhookSignature(
   *   rawBody,
   *   req.headers['x-webhook-signature'],
   *   process.env.WEBHOOK_SECRET,
   * );
   * if (!isValid) throw new Error('Invalid signature');
   * ```
   */
  static async verifyWebhookSignature(
    payload: string,
    signature: string,
    secret: string,
  ): Promise<boolean> {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const computed = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return computed === signature;
  }
}
