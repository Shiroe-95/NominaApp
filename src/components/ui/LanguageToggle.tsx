'use client';

import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';
import { useTransition } from 'react';
import { Globe } from 'lucide-react';

export default function LanguageToggle() {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();

    const toggleLocale = () => {
        const nextLocale = locale === 'en' ? 'es' : 'en';

        startTransition(() => {
            router.replace(pathname, { locale: nextLocale });
        });
    };

    return (
        <button
            onClick={toggleLocale}
            disabled={isPending}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 glass-panel hover:bg-white/10 transition-colors shadow-md text-sm font-medium text-slate-200"
        >
            <Globe className="w-4 h-4 text-emerald-light drop-shadow-[0_0_5px_rgba(52,211,153,0.8)]" />
            <span className="uppercase">{locale}</span>
        </button>
    );
}
