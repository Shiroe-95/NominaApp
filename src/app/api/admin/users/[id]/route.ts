import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { requireAdmin, applyRateLimit, RATE_LIMITS } from '@/lib/api/guard';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error)
    return String((error as { message: unknown }).message);
  return fallback;
}

type RouteContext = { params: Promise<{ id: string }> };

/** PUT /api/admin/users/:id — Update user role, company, or status */
export async function PUT(req: Request, context: RouteContext) {
  const rl = await applyRateLimit(req, 'admin-users-update', RATE_LIMITS.adminWrite);
  if (rl) return rl;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const supabase = createAdminClient();

  try {
    const body = await req.json();
    const { role, company_id, is_active, display_name } = body as {
      role?: string;
      company_id?: string | null;
      is_active?: boolean;
      display_name?: string;
    };

    const validRoles = ['admin', 'analyst', 'client'];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json(
        { error: `Invalid role. Must be one of: ${validRoles.join(', ')}` },
        { status: 400 },
      );
    }

    // Check user exists
    const { data: existing, error: fetchErr } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (role !== undefined) updates.role = role;
    if (company_id !== undefined) updates.company_id = company_id;
    if (is_active !== undefined) updates.is_active = is_active;
    if (display_name !== undefined) updates.display_name = display_name;

    const { data, error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Users PUT error:', error);
      return NextResponse.json(
        { error: getErrorMessage(error, 'Failed to update user') },
        { status: 500 },
      );
    }

    return NextResponse.json({ user: data });
  } catch (error) {
    console.error('Users PUT error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to update user') },
      { status: 500 },
    );
  }
}

/** DELETE /api/admin/users/:id — Soft-delete (deactivate) user */
export async function DELETE(req: Request, context: RouteContext) {
  const rl = await applyRateLimit(req, 'admin-users-delete', RATE_LIMITS.adminWrite);
  if (rl) return rl;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const supabase = createAdminClient();

  try {
    const { data: existing, error: fetchErr } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Soft delete: set is_active = false
    const { error } = await supabase
      .from('user_profiles')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      console.error('Users DELETE error:', error);
      return NextResponse.json(
        { error: getErrorMessage(error, 'Failed to deactivate user') },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Users DELETE error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to deactivate user') },
      { status: 500 },
    );
  }
}
