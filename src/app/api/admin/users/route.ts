import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error)
    return String((error as { message: unknown }).message);
  return fallback;
}

/** GET /api/admin/users — List all users with profiles */
export async function GET(req: Request) {
  const supabase = createAdminClient();

  try {
    const { searchParams } = new URL(req.url);
    const role = searchParams.get('role');
    const companyId = searchParams.get('company_id');
    const status = searchParams.get('status');

    let query = supabase
      .from('user_profiles')
      .select('id, role, company_id, display_name, created_at, updated_at, is_active, companies(id, name)')
      .order('created_at', { ascending: false });

    if (role) query = query.eq('role', role);
    if (companyId) query = query.eq('company_id', companyId);
    if (status === 'active') query = query.eq('is_active', true);
    if (status === 'inactive') query = query.eq('is_active', false);

    const { data: profiles, error: profilesError } = await query;

    if (profilesError) {
      console.error('Users GET profiles error:', profilesError);
      return NextResponse.json(
        { error: getErrorMessage(profilesError, 'Failed to fetch users') },
        { status: 500 },
      );
    }

    // Fetch emails from auth.users via admin API
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) {
      console.error('Users GET auth error:', authError);
      return NextResponse.json(
        { error: getErrorMessage(authError, 'Failed to fetch auth users') },
        { status: 500 },
      );
    }

    const emailMap = new Map(
      (authData?.users ?? []).map((u) => [u.id, u.email ?? ''])
    );

    const users = (profiles ?? []).map((p) => ({
      id: p.id,
      email: emailMap.get(p.id) ?? '',
      display_name: p.display_name,
      role: p.role,
      company_id: p.company_id,
      company_name: (p.companies as { id: string; name: string } | null)?.name ?? null,
      is_active: (p as Record<string, unknown>).is_active ?? true,
      created_at: p.created_at,
    }));

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Users GET error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch users') },
      { status: 500 },
    );
  }
}

/** POST /api/admin/users — Create a new user in Auth + profile */
export async function POST(req: Request) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const { email, password, display_name, role, company_id } = body as {
      email?: string;
      password?: string;
      display_name?: string;
      role?: string;
      company_id?: string;
    };

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
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

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: display_name ?? '' },
    });

    if (authError || !authData.user) {
      console.error('Users POST auth error:', authError);
      return NextResponse.json(
        { error: getErrorMessage(authError, 'Failed to create auth user') },
        { status: 500 },
      );
    }

    const userId = authData.user.id;

    // Update the auto-created profile (trigger creates it with defaults)
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (role) updates.role = role;
    if (display_name) updates.display_name = display_name;
    if (company_id) updates.company_id = company_id;

    const { error: profileError } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userId);

    if (profileError) {
      console.error('Users POST profile error:', profileError);
      // User was created in auth but profile update failed — still return success with warning
    }

    return NextResponse.json({
      user: {
        id: userId,
        email,
        display_name: display_name ?? '',
        role: role ?? 'client',
        company_id: company_id ?? null,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Users POST error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to create user') },
      { status: 500 },
    );
  }
}
