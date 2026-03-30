'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';

/**
 * Hook que traduce automáticamente un array de textos en español
 * al idioma activo del usuario usando la API /api/translate (LibreTranslate).
 *
 * Si el idioma es 'es', retorna los textos originales sin llamar a la API.
 * Incluye cache en sessionStorage para evitar llamadas repetidas.
 *
 * @param texts - Array de textos en español a traducir
 * @returns Array de textos traducidos (o los originales mientras carga)
 *
 * @example
 * const [title, subtitle] = useAutoTranslate([
 *   'Cumplimiento normativo multi-país',
 *   'Valida automáticamente reglas laborales'
 * ]);
 */
export function useAutoTranslate(texts: string[]): string[] {
  const locale = useLocale();
  const [translated, setTranslated] = useState<string[]>(texts);

  useEffect(() => {
    if (locale === 'es' || texts.length === 0) {
      setTranslated(texts);
      return;
    }

    const cacheKey = `at:${locale}:${texts.join('|').slice(0, 200)}`;
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        setTranslated(JSON.parse(cached));
        return;
      } catch { /* ignore */ }
    }

    let cancelled = false;

    fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texts, source: 'es', target: locale }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.translations) {
          setTranslated(data.translations);
          sessionStorage.setItem(cacheKey, JSON.stringify(data.translations));
        }
      })
      .catch(() => { /* keep originals */ });

    return () => { cancelled = true; };
  }, [locale, texts.join('|')]);

  return translated;
}
