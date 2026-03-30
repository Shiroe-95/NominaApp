/**
 * GET/PATCH /api/v1/settings/data-residency — Data region
 * Requirements: 26.1
 */
import { NextResponse } from 'next/server';
import { authenticateV1Admin, errorResponse, jsonResponse } from '../../guard';
import { getDataRegion, setDataRegion, type DataRegion } from '@/lib/compliance/data-residency-service';

export async function GET(req: Request) {
  const auth = await authenticateV1Admin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(req.url);
    const workspace_id = url.searchParams.get('workspace_id') ?? '';
    if (!workspace_id) {
      return errorResponse(400, 'workspace_id is required', 'VALIDATION_ERROR', auth.requestId);
    }
    const residency = await getDataRegion(workspace_id);
    return jsonResponse(residency, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch data residency';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}

export async function PATCH(req: Request) {
  const auth = await authenticateV1Admin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { workspace_id, data_region } = body;
    if (!workspace_id) {
      return errorResponse(400, 'workspace_id is required', 'VALIDATION_ERROR', auth.requestId);
    }
    const residency = await setDataRegion(workspace_id, data_region as DataRegion);
    return jsonResponse(residency, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update data residency';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
