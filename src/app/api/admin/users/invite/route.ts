import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendEmail } from '@/lib/email/email-service';
import { requireAdmin, applyRateLimit, RATE_LIMITS } from '@/lib/api/guard';

/**
 * POST /api/admin/users/invite — Invite a new user by email.
 *
 * Body: { email, display_name, role, company_id, locale? }
 *
 * - Validates email uniqueness
 * - Creates user via supabase.auth.admin.inviteUserByEmail()
 * - Creates profile in user_profiles with invitation_status='pending'
 * - Sends invitation email via EmailService
 *
 * Requirements: 7.1, 7.2, 7.3
 */
export async function POST(req: Request) {
  const rl = applyRateLimit(req, 'admin-users-invite', RATE_LIMITS.adminWrite);
  if (rl) return rl;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const {
      email,
      display_name,
      role,
      company_id,
      locale,
    } = body as {
      email?: string;
      display_name?: string;
      role?: string;
      company_id?: string;
      locale?: string;
    };

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 },
      );
    }

    const validRoles = ['admin', 'analyst', 'client'];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 },
      );
    }

    // Check email uniqueness — look up existing auth users
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const emailExists = existingUsers?.users?.some(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );

    if (emailExists) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 },
      );
    }

    // Create user via invitation (magic link)
    const { data: authData, error: authError } =
      await supabase.auth.admin.inviteUserByEmail(email, {
        data: { display_name: display_name ?? '' },
      });

    if (authError || !authData.user) {
      console.error('Invite user auth error:', authError);
      return NextResponse.json(
        { error: authError?.message ?? 'Failed to invite user' },
        { status: 500 },
      );
    }

    const userId = authData.user.id;
    const userLocale = (['en', 'es', 'pt'].includes(locale ?? '') ? locale : 'es') as 'en' | 'es' | 'pt';

    // Create / update profile with invitation_status='pending'
    const { error: profileError } = await supabase
      .from('user_profiles')
      .upsert(
        {
          id: userId,
          user_id: userId,
          display_name: display_name ?? '',
          role: role ?? 'client',
          company_id: company_id ?? null,
          invitation_status: 'pending',
          preferred_locale: userLocale,
        },
        { onConflict: 'id' },
      );

    if (profileError) {
      console.error('Invite user profile error:', profileError);
      // Auth user was created — profile can be retried
    }

    // Send invitation email
    const inviteUrl = authData.user.confirmation_sent_at
      ? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/verify?type=invite&token_hash=pending`
      : '';

    await sendEmail({
      to: email,
      type: 'user_invitation',
      locale: userLocale,
      data: {
        displayName: display_name ?? email,
        inviteUrl,
      },
    });

    return NextResponse.json(
      {
        user: {
          id: userId,
          email,
          display_name: display_name ?? '',
          role: role ?? 'client',
          invitation_status: 'pending',
        },
        inviteSent: true,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Invite user error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
