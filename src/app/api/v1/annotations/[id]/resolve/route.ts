/**
 * PATCH /api/v1/annotations/[id]/resolve — Resolve annotation
 * Requirements: 12.5
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../../../guard';
import { resolveAnnotation, unresolveAnnotation } from '@/lib/collab/annotation-service';

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await req.json();
    const resolved = body.resolved !== false;

    const annotation = resolved
      ? await resolveAnnotation(id, auth.userId)
      : await unresolveAnnotation(id);

    return jsonResponse({ annotation }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to resolve annotation';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
