/**
 * API Route: /api/translate
 *
 * Proxy de traducción usando LibreTranslate.
 * Permite traducir textos desde el cliente sin exponer la API key.
 *
 * POST { texts: string[], source: string, target: string }
 * Returns { translations: string[] }
 */
import { NextResponse } from 'next/server';
import { translateBatch } from '@/lib/i18n/translate';

export async function POST(req: Request) {
  try {
    const { texts, source, target } = await req.json();

    if (!texts || !Array.isArray(texts) || !source || !target) {
      return NextResponse.json(
        { error: 'Missing required fields: texts (array), source, target' },
        { status: 400 },
      );
    }

    if (texts.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 texts per request' },
        { status: 400 },
      );
    }

    const translations = await translateBatch(texts, source, target);
    return NextResponse.json({ translations });
  } catch {
    return NextResponse.json({ error: 'Translation failed' }, { status: 500 });
  }
}
