/**
 * GET /api/v1/recommendations — Dashboard recommendations
 * Requirements: 39.1
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../guard';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(req.url);
    const workspace_id = url.searchParams.get('workspace_id') ?? '';
    if (!workspace_id) {
      return errorResponse(400, 'workspace_id is required', 'VALIDATION_ERROR', auth.requestId);
    }

    // Fetch dismissed recommendation keys for this user
    const supabase = createAdminClient();
    const { data: dismissals } = await supabase
      .from('recommendation_dismissals')
      .select('recommendation_key')
      .eq('user_id', auth.userId)
      .gt('expires_at', new Date().toISOString());

    const dismissedKeys = new Set((dismissals ?? []).map((d: { recommendation_key: string }) => d.recommendation_key));

    return jsonResponse({
      workspace_id,
      dismissed_count: dismissedKeys.size,
      message: 'Recommendations endpoint ready. Full AI generation requires model configuration.',
    }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch recommendations';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
