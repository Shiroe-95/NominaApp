/**
 * GET /api/v1/activity — Activity feed with filters
 * Requirements: 13.1, 13.2
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../guard';
import { listActivities, type ActivityType } from '@/lib/collab/activity-service';

export async function GET(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(req.url);
    const workspace_id = url.searchParams.get('workspace_id') ?? '';
    if (!workspace_id) {
      return errorResponse(400, 'workspace_id is required', 'VALIDATION_ERROR', auth.requestId);
    }

    const activities = await listActivities({
      workspace_id,
      activity_type: (url.searchParams.get('type') as ActivityType) || undefined,
      user_id: url.searchParams.get('user_id') || undefined,
      date_from: url.searchParams.get('date_from') || undefined,
      date_to: url.searchParams.get('date_to') || undefined,
      cursor: url.searchParams.get('cursor') || undefined,
    });

    return jsonResponse({ activities }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch activities';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
