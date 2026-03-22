import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';
import { requireAdmin, applyRateLimit, RATE_LIMITS } from '@/lib/api/guard';

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error)
    return String((error as { message: unknown }).message);
  return fallback;
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * DELETE /api/admin/optimization-config/rules/:id
 *
 * Delete a routing rule by id.
 * Returns 404 if the rule is not found.
 * Validates: Requirements 7.4, 8.2
 */
export async function DELETE(req: Request, context: RouteContext) {
  const rl = applyRateLimit(req, 'admin-routing-rules-delete', RATE_LIMITS.adminWrite);
  if (rl) return rl;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  const supabase = createAdminClient();

  try {
    // Check rule exists
    const { data: existing, error: fetchError } = await supabase
      .from('model_routing_rules')
      .select('id')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      return NextResponse.json(
        { error: getErrorMessage(fetchError, 'Failed to look up routing rule') },
        { status: 500 },
      );
    }

    if (!existing) {
      return NextResponse.json(
        { error: 'Routing rule not found' },
        { status: 404 },
      );
    }

    // Delete the rule
    const { error: deleteError } = await supabase
      .from('model_routing_rules')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json(
        { error: getErrorMessage(deleteError, 'Failed to delete routing rule') },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Routing rules DELETE error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to delete routing rule') },
      { status: 500 },
    );
  }
}
