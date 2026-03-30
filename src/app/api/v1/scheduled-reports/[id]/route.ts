/**
 * PATCH/DELETE /api/v1/scheduled-reports/[id] — Pause/resume/delete
 * Requirements: 5.6
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../../guard';
import { updateScheduledReport, deleteScheduledReport } from '@/lib/scheduler/scheduler-service';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await req.json();
    const report = await updateScheduledReport(id, body);
    return jsonResponse({ report }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update scheduled report';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    await deleteScheduledReport(id);
    return jsonResponse({ deleted: true }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to delete scheduled report';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
