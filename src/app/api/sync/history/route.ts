import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/sync/history — Returns sync history, optionally filtered by country_code.
 *
 * Query params:
 *   - country_code (optional): filter by country
 *
 * Requirement: 1.6
 */
export async function GET(req: Request) {
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const countryCode = searchParams.get('country_code');

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
