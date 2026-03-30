/**
 * POST /api/v1/reports/build — Execute custom report
 * Requirements: 27.1
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../../guard';
import { executeCustomReport } from '@/lib/reports/report-builder-service';

export async function POST(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { workspace_id, ...config } = body;
    if (!workspace_id) {
      return errorResponse(400, 'workspace_id is required', 'VALIDATION_ERROR', auth.requestId);
    }
    const result = await executeCustomReport(workspace_id, config);
    return jsonResponse({ report: result }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to build report';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
