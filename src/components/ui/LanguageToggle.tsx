'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { useTransition } from 'react';
import { Globe } from 'lucide-react';

/** Ordered list of supported locales for cycling. */
const LOCALES = ['es', 'en', 'pt'] as const;

/** Display labels for each locale. */
const LOCALE_LABELS: Record<string, string> = {
    es: 'ES',
    en: 'EN',
    pt: 'PT',
};

export default function LanguageToggle() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();

    const cycleLocale = () => {
        const currentIndex = LOCALES.indexOf(locale as (typeof LOCALES)[number]);
        const nextIndex = (currentIndex + 1) % LOCALES.length;
        const nextLocale = LOCALES[nextIndex];

        startTransition(() => {
            router.replace(pathname, { locale: nextLocale });
        });
    };

    return (
        <button
            onClick={cycleLocale}
            disabled={isPending}
            aria-label={`Change language, current: ${LOCALE_LABELS[locale] ?? locale}`}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 glass-panel hover:bg-white/10 transition-colors shadow-md text-sm font-medium text-slate-200"
        >
            <Globe className="w-4 h-4 text-emerald-light drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]" />
            <span className="uppercase">{LOCALE_LABELS[locale] ?? locale}</span>
        </button>
    );
}
