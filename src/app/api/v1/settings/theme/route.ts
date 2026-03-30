/**
 * GET/PATCH /api/v1/settings/theme — Theme preference
 * Requirements: 17.3
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../../guard';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('user_profiles')
      .select('theme_preference')
      .eq('id', auth.userId)
      .single();

    if (error) throw new Error(error.message);
    return jsonResponse({ theme: data?.theme_preference ?? 'auto' }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch theme';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}

export async function PATCH(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const theme = body.theme;
    if (!['light', 'dark', 'auto'].includes(theme)) {
      return errorResponse(400, 'theme must be light, dark, or auto', 'VALIDATION_ERROR', auth.requestId);
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ theme_preference: theme })
      .eq('id', auth.userId)
      .select('theme_preference')
      .single();

    if (error) throw new Error(error.message);
    return jsonResponse({ theme: data?.theme_preference }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update theme';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
