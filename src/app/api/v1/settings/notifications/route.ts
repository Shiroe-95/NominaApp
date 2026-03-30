/**
 * GET/PATCH /api/v1/settings/notifications — Notification preferences
 * Requirements: 35.1
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
      .from('notification_preferences')
      .select('*')
      .eq('user_id', auth.userId);

    if (error) throw new Error(error.message);
    return jsonResponse({ preferences: data ?? [] }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch notification preferences';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}

export async function PATCH(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { event_type, channels, digest_frequency } = body;
    if (!event_type) {
      return errorResponse(400, 'event_type is required', 'VALIDATION_ERROR', auth.requestId);
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert({
        user_id: auth.userId,
        event_type,
        channels: channels ?? { in_app: true, email: false, push: false },
        digest_frequency: digest_frequency ?? 'none',
      }, { onConflict: 'user_id,event_type' })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return jsonResponse({ preference: data }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update notification preferences';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
