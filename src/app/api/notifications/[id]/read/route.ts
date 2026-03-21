import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { markAsRead } from '@/lib/notifications/notification-service';

/**
 * PATCH /api/notifications/[id]/read — Marks a notification as read.
 *
 * Requirement: 5.5
 */
export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Notification id is required' },
        { status: 400 },
      );
    }

    // Get authenticated user
    const supabaseAuth = await createClient();
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 },
      );
    }

    await markAsRead(id, user.id);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Notification mark-as-read error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
