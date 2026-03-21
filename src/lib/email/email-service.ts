import { createAdminClient } from '@/lib/supabase/admin';
import type {
  SendEmailOptions,
  SendEmailResult,
  EmailType,
} from '@/lib/types/regulatory-sync';
import {
  userInvitationTemplate,
  regulatoryAlertTemplate,
  weeklySummaryTemplate,
} from './templates';

/**
 * EmailService — Sends transactional emails via Resend and logs every attempt.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.6
 */

const RESEND_API_URL = 'https://api.resend.com/emails';
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

// ── Template resolver ───────────────────────────────────────────────

interface ResolvedEmail {
  subject: string;
  html: string;
}

/**
 * Resolves the correct email template based on type, locale, and data.
 */
export function resolveTemplate(
  type: EmailType,
  locale: 'en' | 'es' | 'pt',
  data: Record<string, unknown>,
): ResolvedEmail {
  switch (type) {
    case 'user_invitation':
      return userInvitationTemplate({
        displayName: (data.displayName as string) ?? '',
        inviteUrl: (data.inviteUrl as string) ?? '',
        locale,
      });
    case 'regulatory_alert':
      return regulatoryAlertTemplate({
        countryName: (data.countryName as string) ?? '',
        changesCount: (data.changesCount as number) ?? 0,
        confidence: (data.confidence as string) ?? '',
        changesDetail: (data.changesDetail as string) ?? '',
        locale,
      });
    case 'weekly_summary':
      return weeklySummaryTemplate({
        syncs:
          (data.syncs as Array<{
            country: string;
            status: string;
            changes: number;
          }>) ?? [],
        locale,
      });
    default:
      throw new Error(`Unknown email type: ${type}`);
  }
}

// ── Retry helper ────────────────────────────────────────────────────

/**
 * Sends a single HTTP request to Resend with exponential backoff retries.
 * Respects `Retry-After` header on 429 responses.
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  maxRetries: number = MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, init);

      // Success or non-retryable error
      if (response.ok || (response.status !== 429 && response.status >= 400 && response.status < 500)) {
        return response;
      }

      // Rate limited — respect Retry-After header
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delayMs = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : BASE_DELAY_MS * Math.pow(2, attempt);
        await sleep(delayMs);
        continue;
      }

      // Server error (5xx) — retry with backoff
      await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxRetries - 1) {
        await sleep(BASE_DELAY_MS * Math.pow(2, attempt));
      }
    }
  }

  throw lastError ?? new Error('Max retries exceeded');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ── Email log helper ────────────────────────────────────────────────

async function logEmail(params: {
  toEmail: string;
  emailType: EmailType;
  status: 'pending' | 'sent' | 'failed';
  resendMessageId?: string;
  errorMessage?: string;
  retryCount?: number;
}): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase.from('email_log').insert({
    to_email: params.toEmail,
    email_type: params.emailType,
    status: params.status,
    resend_message_id: params.resendMessageId ?? null,
    error_message: params.errorMessage ?? null,
    retry_count: params.retryCount ?? 0,
    sent_at: params.status === 'sent' ? new Date().toISOString() : null,
  });

  if (error) {
    console.error(`Failed to log email: ${error.message}`);
  }
}

// ── Core send function ──────────────────────────────────────────────

/**
 * Sends a single email to one recipient via Resend and logs the result.
 */
async function sendSingleEmail(
  to: string,
  type: EmailType,
  locale: 'en' | 'es' | 'pt',
  data: Record<string, unknown>,
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL ?? 'noreply@nominasmart.com';

  if (!apiKey) {
    const errorMsg = 'RESEND_API_KEY is not configured';
    await logEmail({
      toEmail: to,
      emailType: type,
      status: 'failed',
      errorMessage: errorMsg,
    });
    return { success: false, error: errorMsg };
  }

  const template = resolveTemplate(type, locale, data);

  try {
    const response = await fetchWithRetry(RESEND_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [to],
        subject: template.subject,
        html: template.html,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      const errorMsg = `Resend API error (${response.status}): ${body}`;
      await logEmail({
        toEmail: to,
        emailType: type,
        status: 'failed',
        errorMessage: errorMsg,
        retryCount: MAX_RETRIES,
      });
      return { success: false, error: errorMsg };
    }

    const result = await response.json();
    const messageId = result.id as string | undefined;

    await logEmail({
      toEmail: to,
      emailType: type,
      status: 'sent',
      resendMessageId: messageId,
    });

    return { success: true, messageId };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    await logEmail({
      toEmail: to,
      emailType: type,
      status: 'failed',
      errorMessage: errorMsg,
      retryCount: MAX_RETRIES,
    });
    return { success: false, error: errorMsg };
  }
}

// ── Recipient filtering ─────────────────────────────────────────────

/**
 * For regulatory_alert emails, returns only users whose `alert_countries`
 * array contains the specified country code.
 *
 * Requirement: 8.2, 8.6
 */
async function getAlertRecipients(
  countryCode: string,
): Promise<Array<{ email: string; locale: 'en' | 'es' | 'pt' }>> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('user_profiles')
    .select('email, preferred_locale')
    .contains('alert_countries', [countryCode]);

  if (error) {
    throw new Error(`Failed to fetch alert recipients: ${error.message}`);
  }

  return (data ?? []).map((row) => ({
    email: row.email as string,
    locale: (row.preferred_locale as 'en' | 'es' | 'pt') ?? 'es',
  }));
}

// ── Public API ──────────────────────────────────────────────────────

/**
 * Sends an email (or multiple emails) via Resend.
 *
 * For `regulatory_alert` type with a `countryCode` in data:
 *   - Filters recipients by `alert_countries` in user_profiles
 *   - Sends to each matching user in their preferred locale
 *
 * For other types:
 *   - Sends to the explicit `to` address(es) in the provided locale
 *
 * Every send attempt is logged in the `email_log` table.
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.6
 */
export async function sendEmail(
  options: SendEmailOptions,
): Promise<SendEmailResult> {
  const { to, type, locale, data } = options;

  // For regulatory alerts with a countryCode, filter recipients by alert_countries
  if (type === 'regulatory_alert' && data.countryCode) {
    const recipients = await getAlertRecipients(data.countryCode as string);

    if (recipients.length === 0) {
      return { success: true }; // No recipients configured — not an error
    }

    const results = await Promise.all(
      recipients.map((r) =>
        sendSingleEmail(r.email, type, r.locale, data),
      ),
    );

    const failed = results.filter((r) => !r.success);
    if (failed.length > 0) {
      return {
        success: false,
        error: `${failed.length}/${results.length} emails failed`,
      };
    }

    return { success: true, messageId: results[0]?.messageId };
  }

  // Standard send to explicit recipients
  const recipients = Array.isArray(to) ? to : [to];

  if (recipients.length === 1) {
    return sendSingleEmail(recipients[0], type, locale, data);
  }

  const results = await Promise.all(
    recipients.map((addr) => sendSingleEmail(addr, type, locale, data)),
  );

  const failed = results.filter((r) => !r.success);
  if (failed.length > 0) {
    return {
      success: false,
      error: `${failed.length}/${results.length} emails failed`,
    };
  }

  return { success: true, messageId: results[0]?.messageId };
}
