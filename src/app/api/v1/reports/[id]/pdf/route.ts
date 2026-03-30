/**
 * GET /api/v1/reports/[id]/pdf — Download generated PDF
 * Requirements: 28.4
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../../../guard';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const supabase = createAdminClient();

    // Look up the report run to find the file URL
    const { data, error } = await supabase
      .from('scheduled_report_runs')
      .select('file_url, status')
      .eq('id', id)
      .single();

    if (error || !data) {
      return errorResponse(404, 'Report not found', 'NOT_FOUND', auth.requestId);
    }
    if (!data.file_url) {
      return errorResponse(404, 'PDF not yet generated', 'NOT_FOUND', auth.requestId);
    }

    return jsonResponse({ pdf_url: data.file_url, status: data.status }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch PDF';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
