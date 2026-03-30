/**
 * NominaSmart TypeScript SDK — typed API client for all v1 endpoints.
 * Supports API key auth, auto rate-limit handling, webhook signature verification.
 *
 * Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7
 * @module lib/sdk/nominasmart-client
 */

export interface NominaSmartConfig {
  baseUrl: string;
  apiKey: string;
  /** Max retries on 429 (default: 3) */
  maxRetries?: number;
}

export interface APIResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
  requestId: string | null;
}

export class NominaSmartClient {
  private baseUrl: string;
  private apiKey: string;
  private maxRetries: number;

  constructor(config: NominaSmartConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.apiKey = config.apiKey;
    this.maxRetries = config.maxRetries ?? 3;
  }

  // ── Core request method with rate-limit handling ──────────────────
  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<APIResponse<T>> {
    let attempts = 0;

    while (attempts <= this.maxRetries) {
      const res = await fetch(`${this.baseUrl}/api/v1${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'X-API-Version': '1',
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const requestId = res.headers.get('X-Request-Id');

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After') ?? '5', 10);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        attempts++;
        continue;
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        return { data: null, error: err.error ?? res.statusText, status: res.status, requestId };
      }

      const data = (await res.json()) as T;
      return { data, error: null, status: res.status, requestId };
    }

    return { data: null, error: 'Max retries exceeded (429)', status: 429, requestId: null };
  }

  // ── Workspaces ────────────────────────────────────────────────────
  listWorkspaces() { return this.request<unknown[]>('GET', '/workspaces'); }
  createWorkspace(data: { name: string; default_country_code: string; data_region?: string }) {
    return this.request<unknown>('POST', '/workspaces', data);
  }

  // ── Audit Trail ───────────────────────────────────────────────────
  getAuditTrail(cursor?: string) {
    const qs = cursor ? `?cursor=${cursor}` : '';
    return this.request<unknown>('GET', `/audit-trail${qs}`);
  }

  // ── Webhooks ──────────────────────────────────────────────────────
  listWebhooks() { return this.request<unknown[]>('GET', '/webhooks'); }
  createWebhook(data: { url: string; events: string[] }) {
    return this.request<unknown>('POST', '/webhooks', data);
  }

  // ── AI Endpoints ──────────────────────────────────────────────────
  getAnomalies() { return this.request<unknown[]>('GET', '/anomalies'); }
  queryNLQ(query: string, locale = 'es') {
    return this.request<unknown>('POST', '/nlq', { query, locale });
  }
  getForecast(companyId: string, monthsAhead = 6) {
    return this.request<unknown>('POST', '/forecast', { company_id: companyId, months_ahead: monthsAhead });
  }
  getRecommendations() { return this.request<unknown[]>('GET', '/recommendations'); }

  // ── Reports ───────────────────────────────────────────────────────
  listScheduledReports() { return this.request<unknown[]>('GET', '/scheduled-reports'); }
  getBenchmarks(params?: Record<string, string>) {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return this.request<unknown>('GET', `/benchmarks${qs}`);
  }

  // ── API Keys ──────────────────────────────────────────────────────
  listAPIKeys() { return this.request<unknown[]>('GET', '/api-keys'); }
  revokeAPIKey(id: string) { return this.request<unknown>('POST', `/api-keys/${id}/revoke`); }

  // ── Health ────────────────────────────────────────────────────────
  health() { return this.request<unknown>('GET', '/health'); }

  // ── Webhook Signature Verification ────────────────────────────────
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
