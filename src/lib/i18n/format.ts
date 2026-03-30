/**
 * Locale-aware number, currency, and date formatting helpers using Intl APIs.
 *
 * Requirements: 36.2, 36.3
 * @module lib/i18n/format
 */

export type SupportedLocale = 'es' | 'en' | 'pt' | 'fr' | 'de';
export type SupportedCurrency = 'COP' | 'MXN' | 'PEN' | 'CLP' | 'BRL' | 'ARS' | 'USD' | 'EUR';

const LOCALE_MAP: Record<SupportedLocale, string> = {
  es: 'es-CO',
  en: 'en-US',
  pt: 'pt-BR',
  fr: 'fr-FR',
  de: 'de-DE',
};

/**
 * Format a number with locale-aware grouping and decimals.
 */
export function formatNumber(
  value: number,
  locale: SupportedLocale = 'es',
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(LOCALE_MAP[locale], options).format(value);
}

/**
 * Format a currency value with the correct symbol and locale.
 */
export function formatCurrency(
  value: number,
  currency: SupportedCurrency,
  locale: SupportedLocale = 'es',
): string {
  return new Intl.NumberFormat(LOCALE_MAP[locale], {
    style: 'currency',
    currency,
    minimumFractionDigits: currency === 'COP' || currency === 'CLP' ? 0 : 2,
  }).format(value);
}

/**
 * Format a date with locale-aware formatting.
 */
export function formatDate(
  date: Date | string,
  locale: SupportedLocale = 'es',
  options?: Intl.DateTimeFormatOptions,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(LOCALE_MAP[locale], {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...options,
  }).format(d);
}

/**
 * Format a date-time with locale-aware formatting including time.
 */
export function formatDateTime(
  date: Date | string,
  locale: SupportedLocale = 'es',
  timezone?: string,
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return new Intl.DateTimeFormat(LOCALE_MAP[locale], {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  }).format(d);
}

/**
 * Format a relative time (e.g., "3 days ago").
 */
export function formatRelativeTime(
  date: Date | string,
  locale: SupportedLocale = 'es',
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  const rtf = new Intl.RelativeTimeFormat(LOCALE_MAP[locale], { numeric: 'auto' });

  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return rtf.format(-diffMinutes, 'minute');
    }
    return rtf.format(-diffHours, 'hour');
  }
  if (diffDays < 30) return rtf.format(-diffDays, 'day');
  if (diffDays < 365) return rtf.format(-Math.floor(diffDays / 30), 'month');
  return rtf.format(-Math.floor(diffDays / 365), 'year');
}

/** Get the Intl locale string for a supported locale */
export function getIntlLocale(locale: SupportedLocale): string {
  return LOCALE_MAP[locale];
}
