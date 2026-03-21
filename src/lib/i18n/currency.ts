/**
 * Multi-currency formatting and parsing utilities.
 * Uses Intl.NumberFormat for locale-aware currency display.
 */

export interface CurrencyInfo {
  currencyCode: string;
  currencySymbol: string;
  localeFormat: string;
  decimalSeparator: string;
  thousandsSeparator: string;
}

/**
 * Map of country codes to their currency configuration.
 */
export const COUNTRY_CURRENCY_MAP: Record<string, CurrencyInfo> = {
  CO: {
    currencyCode: 'COP',
    currencySymbol: '$',
    localeFormat: 'es-CO',
    decimalSeparator: ',',
    thousandsSeparator: '.',
  },
  MX: {
    currencyCode: 'MXN',
    currencySymbol: '$',
    localeFormat: 'es-MX',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  PE: {
    currencyCode: 'PEN',
    currencySymbol: 'S/',
    localeFormat: 'es-PE',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
  CL: {
    currencyCode: 'CLP',
    currencySymbol: '$',
    localeFormat: 'es-CL',
    decimalSeparator: ',',
    thousandsSeparator: '.',
  },
  BR: {
    currencyCode: 'BRL',
    currencySymbol: 'R$',
    localeFormat: 'pt-BR',
    decimalSeparator: ',',
    thousandsSeparator: '.',
  },
  AR: {
    currencyCode: 'ARS',
    currencySymbol: '$',
    localeFormat: 'es-AR',
    decimalSeparator: ',',
    thousandsSeparator: '.',
  },
  US: {
    currencyCode: 'USD',
    currencySymbol: '$',
    localeFormat: 'en-US',
    decimalSeparator: '.',
    thousandsSeparator: ',',
  },
};

/**
 * Format a numeric value as a currency string using Intl.NumberFormat.
 */
export function formatCurrency(
  value: number,
  options: { countryCode: string; currencyCode: string; locale: string }
): string {
  const { currencyCode, locale } = options;

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Parse a formatted currency string back to a numeric value.
 * Handles different decimal and thousands separators per locale.
 */
export function parseCurrencyValue(
  value: string,
  decimalSeparator: string = '.',
  thousandsSeparator: string = ','
): number {
  // Remove currency symbols, whitespace, and non-breaking spaces
  let cleaned = value.replace(/[^\d\-.,]/g, '').trim();

  if (!cleaned) return 0;

  // Remove thousands separators
  if (thousandsSeparator) {
    cleaned = cleaned.split(thousandsSeparator).join('');
  }

  // Normalize decimal separator to '.'
  if (decimalSeparator && decimalSeparator !== '.') {
    cleaned = cleaned.replace(decimalSeparator, '.');
  }

  const result = parseFloat(cleaned);
  return isNaN(result) ? 0 : result;
}
