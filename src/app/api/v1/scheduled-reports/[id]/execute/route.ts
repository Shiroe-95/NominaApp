/**
 * POST /api/v1/scheduled-reports/[id]/execute — Manual execution
 * Requirements: 5.6
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../../../guard';
import { executeReport } from '@/lib/scheduler/scheduler-service';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const result = await executeReport(id);
    return jsonResponse({ result }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to execute report';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
