import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logAudit } from '@/lib/audit/audit-service';
import { applyRateLimit, RATE_LIMITS } from '@/lib/api/guard';

/**
 * PATCH /api/admin/rules/[id]/approve — Approves a pending rule.
 *
 * Changes rule status to 'approved' and logs an audit entry with action='approved'.
 *
 * Requirements: 3.4, 6.1
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = await applyRateLimit(req, 'admin-rules-approve', RATE_LIMITS.adminWrite);
  if (rl) return rl;

  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: 'Rule id is required' },
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

    const supabase = createAdminClient();

    // Fetch current rule
    const { data: rule, error: fetchError } = await supabase
      .from('country_year_rules')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !rule) {
      return NextResponse.json(
        { error: 'Rule not found' },
        { status: 404 },
      );
    }

    const previousStatus = rule.status;

    // Update status to approved
    const { error: updateError } = await supabase
      .from('country_year_rules')
      .update({ status: 'approved' })
      .eq('id', id);

    if (updateError) {
      console.error('Rule approve error:', updateError);
      return NextResponse.json(
        { error: updateError.message ?? 'Failed to approve rule' },
        { status: 500 },
      );
    }

    // Log audit entry
    await logAudit({
      ruleId: id,
      action: 'approved',
      origin: 'manual',
      previousValues: { status: previousStatus },
      newValues: { status: 'approved' },
      userId: user.id,
    });

    return NextResponse.json({ ok: true, status: 'approved' });
  } catch (error) {
    console.error('Rule approve error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
