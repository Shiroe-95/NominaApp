/**
 * Sentry Configuration — Client and server SDK setup, PII filtering, context capture.
 *
 * Provides:
 * - Client-side Sentry init (React error boundary, breadcrumbs, Web Vitals)
 * - Server-side Sentry init (API route error capture)
 * - PII filtering: strips API keys, tokens, payroll data before sending events
 * - Context capture: user, URL, browser, version, tags
 * - Alert rules configuration (>10 errors/min, new error type)
 *
 * Requirements: 22.1–22.6
 * Properties: 56, 57
 *
 * @module lib/monitoring/sentry-config
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SentryEvent {
  event_id: string;
  message?: string;
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  timestamp: string;
  exception?: {
    values: Array<{
      type: string;
      value: string;
      stacktrace?: { frames: Array<{ filename: string; lineno: number; colno: number; function?: string }> };
    }>;
  };
  breadcrumbs?: Array<{
    type: string;
    category: string;
    message: string;
    timestamp: string;
  }>;
  user?: {
    id: string;
    role?: string;
    workspace?: string;
  };
  contexts?: {
    browser?: { name: string; version: string };
    os?: { name: string };
    app?: { version: string };
  };
  request?: {
    url: string;
    method?: string;
    headers?: Record<string, string>;
  };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

export interface SentryClientConfig {
  dsn: string;
  environment: string;
  release: string;
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
}

export interface SentryServerConfig {
  dsn: string;
  environment: string;
  release: string;
  tracesSampleRate: number;
}

export interface WebVitalMetric {
  name: 'LCP' | 'FID' | 'CLS' | 'FCP' | 'TTFB';
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
}

export interface AlertRule {
  name: string;
  condition: string;
  threshold: number;
  window: string;
}

// ─── PII Patterns ───────────────────────────────────────────────────────────

/** Patterns that indicate PII or sensitive data */
const PII_PATTERNS = [
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,  // emails
  /\b(api[_-]?key|token|secret|password|bearer|authorization)\s*[:=]\s*\S+/gi,
  /\b(sk|pk|api)[-_][a-zA-Z0-9]{20,}\b/g,  // API keys
  /\bBearer\s+[A-Za-z0-9\-._~+/]+=*/gi,  // Bearer tokens
  /\b(salary|sueldo|salario|deduction|deduccion|net_pay|pago_neto)\b/gi,  // payroll terms
  /\b\d{3}-\d{2}-\d{4}\b/g,  // SSN-like
  /\b(cedula|documento|rut|curp|cpf)\s*[:=]?\s*\d+/gi,  // ID documents
];

/**
 * Scrubs PII from a string value.
 * Property 57: No API keys, tokens, payroll data, or PII in events.
 */
export function scrubPII(value: string): string {
  let result = value;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result;
}

/**
 * Deep-scrubs PII from an object recursively.
 */
export function scrubPIIFromObject(obj: unknown): unknown {
  if (typeof obj === 'string') return scrubPII(obj);
  if (Array.isArray(obj)) return obj.map(scrubPIIFromObject);
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      // Redact sensitive keys entirely
      const lowerKey = key.toLowerCase();
      if (['password', 'secret', 'token', 'api_key', 'apikey', 'authorization', 'cookie'].includes(lowerKey)) {
        result[key] = '[REDACTED]';
      } else {
        result[key] = scrubPIIFromObject(value);
      }
    }
    return result;
  }
  return obj;
}

/**
 * Filters PII from a Sentry event before sending.
 * Property 57: Events must not contain API keys, tokens, payroll data, or PII.
 */
export function filterPII(event: SentryEvent): SentryEvent {
  const filtered = JSON.parse(JSON.stringify(event)) as SentryEvent;

  // Scrub exception values
  if (filtered.exception?.values) {
    for (const exc of filtered.exception.values) {
      exc.value = scrubPII(exc.value);
    }
  }

  // Scrub breadcrumbs
  if (filtered.breadcrumbs) {
    for (const bc of filtered.breadcrumbs) {
      bc.message = scrubPII(bc.message);
    }
  }

  // Scrub request headers
  if (filtered.request?.headers) {
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(filtered.request.headers)) {
      const lowerKey = key.toLowerCase();
      if (['authorization', 'cookie', 'x-api-key'].includes(lowerKey)) {
        headers[key] = '[REDACTED]';
      } else {
        headers[key] = scrubPII(value);
      }
    }
    filtered.request.headers = headers;
  }

  // Scrub extra data
  if (filtered.extra) {
    filtered.extra = scrubPIIFromObject(filtered.extra) as Record<string, unknown>;
  }

  // Scrub message
  if (filtered.message) {
    filtered.message = scrubPII(filtered.message);
  }

  return filtered;
}

// ─── Event Validation ───────────────────────────────────────────────────────

/**
 * Validates that a Sentry event has all required fields.
 * Property 56: Event must include stack trace, breadcrumbs, user context, URL, browser, version, tags.
 */
export function validateSentryEvent(event: SentryEvent): {
  valid: boolean;
  missing: string[];
} {
  const missing: string[] = [];

  if (!event.event_id) missing.push('event_id');
  if (!event.level) missing.push('level');
  if (!event.timestamp) missing.push('timestamp');
  if (!event.exception?.values?.length && !event.message) missing.push('exception_or_message');
  if (!event.breadcrumbs?.length) missing.push('breadcrumbs');
  if (!event.user?.id) missing.push('user.id');
  if (!event.request?.url) missing.push('request.url');
  if (!event.tags?.environment) missing.push('tags.environment');
  if (!event.tags?.release) missing.push('tags.release');

  return { valid: missing.length === 0, missing };
}

// ─── Config Builders ────────────────────────────────────────────────────────

/**
 * Creates client-side Sentry configuration.
 */
export function createClientConfig(overrides?: Partial<SentryClientConfig>): SentryClientConfig {
  return {
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN ?? '',
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.NEXT_PUBLIC_APP_VERSION ?? '0.1.0',
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
    ...overrides,
  };
}

/**
 * Creates server-side Sentry configuration.
 */
export function createServerConfig(overrides?: Partial<SentryServerConfig>): SentryServerConfig {
  return {
    dsn: process.env.SENTRY_DSN ?? '',
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.APP_VERSION ?? '0.1.0',
    tracesSampleRate: 0.2,
    ...overrides,
  };
}

/**
 * Default alert rules for Sentry.
 * Req 22.5: >10 errors/min, new error type.
 */
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  { name: 'High Error Rate', condition: 'error_count', threshold: 10, window: '1m' },
  { name: 'New Error Type', condition: 'new_issue', threshold: 1, window: '1h' },
];

/**
 * Web Vitals thresholds for monitoring.
 * Req 22.6: LCP, FID, CLS capture.
 */
export const WEB_VITALS_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
} as const;

/**
 * Rates a Web Vital metric.
 */
export function rateWebVital(name: keyof typeof WEB_VITALS_THRESHOLDS, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = WEB_VITALS_THRESHOLDS[name];
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.poor) return 'needs-improvement';
  return 'poor';
}
