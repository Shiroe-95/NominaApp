/**
 * GET/POST /api/v1/scheduled-reports — CRUD scheduled reports
 * Requirements: 5.1
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../guard';
import { listScheduledReports, createScheduledReport } from '@/lib/scheduler/scheduler-service';
import { ScheduledReportSchema } from '@/lib/schemas/world-class-schemas';

export async function GET(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(req.url);
    const workspace_id = url.searchParams.get('workspace_id') ?? '';
    if (!workspace_id) {
      return errorResponse(400, 'workspace_id is required', 'VALIDATION_ERROR', auth.requestId);
    }
    const reports = await listScheduledReports(workspace_id);
    return jsonResponse({ reports }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to list scheduled reports';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}

export async function POST(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { workspace_id, ...reportData } = body;
    if (!workspace_id) {
      return errorResponse(400, 'workspace_id is required', 'VALIDATION_ERROR', auth.requestId);
    }
    const parsed = ScheduledReportSchema.parse(reportData);
    const report = await createScheduledReport(workspace_id, auth.userId, parsed);
    return jsonResponse({ report }, auth.requestId, 201);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return errorResponse(400, 'Validation failed', 'VALIDATION_ERROR', auth.requestId, { issues: (e as any).issues });
    }
    const msg = e instanceof Error ? e.message : 'Failed to create scheduled report';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
