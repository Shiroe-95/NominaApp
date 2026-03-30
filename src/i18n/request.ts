import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
    // This typically corresponds to the `[locale]` segment
    let locale = await requestLocale;
    const availableLocales = routing.locales as readonly string[];

    // Ensure that a valid locale is used
    if (!locale || !availableLocales.includes(locale)) {
        locale = routing.defaultLocale;
    }

    const messages = (await import(`../../messages/${locale}.json`)).default;

    // Fallback: merge Spanish messages as base, then overlay the target locale.
    // This ensures that if a key is missing in en/pt, the Spanish value is used.
    if (locale !== 'es') {
        const fallbackMessages = (await import('../../messages/es.json')).default;
        return {
            locale,
            messages: deepMerge(fallbackMessages, messages),
        };
    }

    return {
        locale,
        messages,
    };
});

/**
 * Deep merges two objects. Values from `overlay` take precedence over `base`.
 * Missing keys in `overlay` fall back to `base`.
 */
function deepMerge(
    base: Record<string, unknown>,
    overlay: Record<string, unknown>,
): Record<string, unknown> {
    const result: Record<string, unknown> = { ...base };
    for (const key of Object.keys(overlay)) {
        if (
            overlay[key] &&
            typeof overlay[key] === 'object' &&
            !Array.isArray(overlay[key]) &&
            base[key] &&
            typeof base[key] === 'object' &&
            !Array.isArray(base[key])
        ) {
            result[key] = deepMerge(
                base[key] as Record<string, unknown>,
                overlay[key] as Record<string, unknown>,
            );
        } else {
            result[key] = overlay[key];
        }
    }
    return result;
}
