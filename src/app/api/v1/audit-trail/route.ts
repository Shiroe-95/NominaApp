/**
 * GET /api/v1/audit-trail — cursor-paginated audit log
 * Requirements: 3.1, 3.2, 3.3, 3.7
 */
import { NextResponse } from 'next/server';
import { authenticateV1Admin, errorResponse, jsonResponse } from '../guard';
import { queryAuditTrail } from '@/lib/audit/audit-service';

export async function GET(req: Request) {
  const auth = await authenticateV1Admin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(req.url);
    const workspace_id = url.searchParams.get('workspace_id') ?? '';
    if (!workspace_id) {
      return errorResponse(400, 'workspace_id is required', 'VALIDATION_ERROR', auth.requestId);
    }

    const result = await queryAuditTrail(
      {
        workspace_id,
        action_type: url.searchParams.get('action_type') ?? undefined,
        resource_type: url.searchParams.get('resource_type') ?? undefined,
        user_id: url.searchParams.get('user_id') ?? undefined,
        severity: (url.searchParams.get('severity') as any) ?? undefined,
        date_from: url.searchParams.get('date_from') ?? undefined,
        date_to: url.searchParams.get('date_to') ?? undefined,
      },
      {
        cursor: url.searchParams.get('cursor') ?? undefined,
        page_size: url.searchParams.get('page_size')
          ? Number(url.searchParams.get('page_size'))
          : undefined,
      },
    );

    return jsonResponse(result, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to query audit trail';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
