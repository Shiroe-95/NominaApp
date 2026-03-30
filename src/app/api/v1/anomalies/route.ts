/**
 * GET /api/v1/anomalies — Anomalies for workspace
 * Requirements: 7.4
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

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('anomaly_detections')
      .select('*')
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw new Error(error.message);
    return jsonResponse({ anomalies: data ?? [] }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch anomalies';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
