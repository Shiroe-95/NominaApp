/**
 * API Route: /api/sync/history
 *
 * Historial de sincronizaciones regulatorias.
 * Requiere autenticación. Filtro opcional por código de país (ISO 3166-1 alpha-2).
 *
 * - GET — Lista historial de sincronizaciones ordenado por fecha descendente
 *
 * @module api/sync/history
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyRateLimit, requireAuth, isValidCountryCode, RATE_LIMITS } from '@/lib/api/guard';

/**
 * GET /api/sync/history — Returns sync history, optionally filtered by country_code.
 *
 * Query params:
 *   - country_code (optional): filter by country
 *
 * Requirement: 1.6
 */
export async function GET(req: Request) {
  const rl = applyRateLimit(req, 'sync-history', RATE_LIMITS.read);
  if (rl) return rl;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const rawCountryCode = searchParams.get('country_code');
    const countryCode = rawCountryCode && isValidCountryCode(rawCountryCode) ? rawCountryCode.toUpperCase() : null;

    let query = supabase
      .from('sync_history')
      .select('*')
      .order('created_at', { ascending: false });

    if (countryCode) {
      query = query.eq('country_code', countryCode);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Sync history GET error:', error);
      return NextResponse.json(
        { error: error.message ?? 'Failed to fetch sync history' },
        { status: 500 },
      );
    }

    return NextResponse.json({ history: data ?? [] });
  } catch (error) {
    console.error('Sync history GET error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
