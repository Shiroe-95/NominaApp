/**
 * API Route: /api/notifications
 *
 * Notificaciones in-app del usuario autenticado.
 * Requiere autenticación. Filtra por user_id del usuario en sesión.
 *
 * - GET — Lista notificaciones del usuario ordenadas por fecha descendente
 *
 * @module api/notifications
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { applyRateLimit, requireAuth, RATE_LIMITS } from '@/lib/api/guard';

/**
 * GET /api/notifications — Returns notifications for the authenticated user,
 * ordered by created_at desc.
 *
 * Requirements: 5.1, 5.4
 */
export async function GET(req: Request) {
  const rl = applyRateLimit(req, 'notifications', RATE_LIMITS.read);
  if (rl) return rl;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {

    // Fetch notifications using admin client
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Notifications GET error:', error);
      return NextResponse.json(
        { error: error.message ?? 'Failed to fetch notifications' },
        { status: 500 },
      );
    }

    return NextResponse.json({ notifications: data ?? [] });
  } catch (error) {
    console.error('Notifications GET error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
