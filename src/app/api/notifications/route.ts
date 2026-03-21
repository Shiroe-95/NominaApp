import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/notifications — Returns notifications for the authenticated user,
 * ordered by created_at desc.
 *
 * Requirements: 5.1, 5.4
 */
export async function GET() {
  try {
    // Get authenticated user
    const supabaseAuth = await createClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    // Fetch notifications using admin client
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
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
