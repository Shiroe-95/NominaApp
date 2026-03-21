/**
 * i18n Locale Configuration Utilities
 * Dynamic message loading and validation for multi-language support.
 */

export const SUPPORTED_LOCALES = ['en', 'es', 'pt'] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

/**
 * Locale-to-message-loader map for static analysis compatibility.
 * Uses dynamic import with explicit paths for bundler compatibility.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type MessageModule = { default?: Record<string, any> } & Record<string, any>;

const MESSAGE_LOADERS: Record<
  string,
  () => Promise<Record<string, Record<string, string>>>
> = {
  en: async () => {
    const mod: MessageModule = await import('../../../messages/en.json');
    return (mod.default ?? mod) as Record<string, Record<string, string>>;
  },
  es: async () => {
    const mod: MessageModule = await import('../../../messages/es.json');
    return (mod.default ?? mod) as Record<string, Record<string, string>>;
  },
  pt: async () => {
    const mod: MessageModule = await import('../../../messages/pt.json');
    return (mod.default ?? mod) as Record<string, Record<string, string>>;
  },
};

/**
 * Dynamically load message files for a given locale.
 * Falls back to 'es' (default locale) if the requested locale is not found.
 */
export async function loadMessages(
  locale: string
): Promise<Record<string, Record<string, string>>> {
  const safeLocale = SUPPORTED_LOCALES.includes(locale as SupportedLocale)
    ? locale
    : 'es';

  try {
    const loader = MESSAGE_LOADERS[safeLocale] ?? MESSAGE_LOADERS['es'];
    return await loader();
  } catch {
    console.warn(
      `[i18n] Failed to load messages for locale "${safeLocale}", falling back to "es".`
    );
    return await MESSAGE_LOADERS['es']();
  }
}

/**
 * Recursively extract all keys from a nested object using dot notation.
 */
function extractKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...extractKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

/**
 * Validate that a locale's message file contains all keys present in the base locale.
 * Returns an object with the validation result and any missing keys.
 */
export async function validateMessageCompleteness(
  locale: string,
  baseLocale: string = 'es'
): Promise<{ isComplete: boolean; missingKeys: string[] }> {
  const [targetMessages, baseMessages] = await Promise.all([
    loadMessages(locale),
    loadMessages(baseLocale),
  ]);

  const baseKeys = extractKeys(baseMessages as Record<string, unknown>);
  const targetKeys = new Set(
    extractKeys(targetMessages as Record<string, unknown>)
  );

  const missingKeys = baseKeys.filter((key) => !targetKeys.has(key));

  return {
    isComplete: missingKeys.length === 0,
    missingKeys,
  };
}
