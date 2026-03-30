/**
 * GET/POST /api/v1/workspaces
 * Requirements: 2.1, 2.2, 2.3
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../guard';
import { listUserWorkspaces, createWorkspace } from '@/lib/workspaces/workspace-service';
import { WorkspaceSchema } from '@/lib/schemas/world-class-schemas';

export async function GET(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const workspaces = await listUserWorkspaces(auth.userId);
    return jsonResponse({ workspaces }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to list workspaces';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}

export async function POST(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parsed = WorkspaceSchema.parse(body);
    const workspace = await createWorkspace(auth.userId, parsed);
    return jsonResponse({ workspace }, auth.requestId, 201);
  } catch (e: unknown) {
    const rid = (auth as { requestId: string }).requestId;
    if (e instanceof Error && e.name === 'ZodError') {
      return errorResponse(400, 'Validation failed', 'VALIDATION_ERROR', rid, { issues: (e as any).issues });
    }
    const msg = e instanceof Error ? e.message : 'Failed to create workspace';
    return errorResponse(500, msg, 'INTERNAL_ERROR', rid);
  }
}
