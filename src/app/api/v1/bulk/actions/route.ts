/**
 * PATCH /api/v1/bulk/actions — bulk update action items
 * Requirements: 4.2, 4.5
 */
import { NextResponse } from 'next/server';
import { authenticateV1AnalystOrAdmin, errorResponse, jsonResponse } from '../../guard';
import { createAdminClient } from '@/lib/supabase/admin';

export async function PATCH(req: Request) {
  const auth = await authenticateV1AnalystOrAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { ids, updates } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return errorResponse(400, 'ids must be a non-empty array', 'VALIDATION_ERROR', auth.requestId);
    }
    if (!updates || typeof updates !== 'object') {
      return errorResponse(400, 'updates object is required', 'VALIDATION_ERROR', auth.requestId);
    }

    const allowed = ['status', 'assignee', 'priority'];
    const updateData: Record<string, unknown> = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) updateData[key] = updates[key];
    }
    if (Object.keys(updateData).length === 0) {
      return errorResponse(400, 'No valid update fields provided', 'VALIDATION_ERROR', auth.requestId);
    }

    const supabase = createAdminClient();
    const { error, count } = await supabase
      .from('action_items')
      .update(updateData)
      .in('id', ids);

    if (error) {
      return errorResponse(500, error.message, 'INTERNAL_ERROR', auth.requestId);
    }

    return jsonResponse({ updated: count ?? ids.length }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Bulk update failed';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
