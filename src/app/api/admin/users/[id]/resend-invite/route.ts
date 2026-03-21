import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/email-service';

/**
 * POST /api/admin/users/[id]/resend-invite — Resend invitation to a pending user.
 *
 * - Verifies user has invitation_status='pending' before resending
 * - Rejects resend if user is already active
 *
 * Requirements: 7.4, 7.6
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'User id is required' },
        { status: 400 },
      );
    }

    const supabase = createAdminClient();

    // Fetch user profile to check invitation status
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('invitation_status, display_name, preferred_locale')
      .eq('id', id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 },
      );
    }

    if (profile.invitation_status === 'active') {
      return NextResponse.json(
        { error: 'Cannot resend invitation to an active user' },
        { status: 400 },
      );
    }

    if (profile.invitation_status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot resend invitation. Current status: ${profile.invitation_status}` },
        { status: 400 },
      );
    }

    // Get user email from auth
    const { data: authData, error: authError } =
      await supabase.auth.admin.getUserById(id);

    if (authError || !authData.user) {
      return NextResponse.json(
        { error: 'Auth user not found' },
        { status: 404 },
      );
    }

    const email = authData.user.email;
    if (!email) {
      return NextResponse.json(
        { error: 'User has no email address' },
        { status: 400 },
      );
    }

    // Re-invite via Supabase Auth
    const { error: inviteError } =
      await supabase.auth.admin.inviteUserByEmail(email, {
        data: { display_name: profile.display_name ?? '' },
      });

    if (inviteError) {
      console.error('Resend invite auth error:', inviteError);
      return NextResponse.json(
        { error: inviteError.message ?? 'Failed to resend invitation' },
        { status: 500 },
      );
    }

    // Send invitation email
    const userLocale = (['en', 'es', 'pt'].includes(profile.preferred_locale ?? '')
      ? profile.preferred_locale
      : 'es') as 'en' | 'es' | 'pt';

    await sendEmail({
      to: email,
      type: 'user_invitation',
      locale: userLocale,
      data: {
        displayName: profile.display_name ?? email,
        inviteUrl: '',
      },
    });

    return NextResponse.json({ ok: true, inviteResent: true });
  } catch (error) {
    console.error('Resend invite error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
