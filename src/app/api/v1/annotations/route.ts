/**
 * GET/POST /api/v1/annotations — CRUD annotations
 * Requirements: 12.1
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../guard';
import { listAnnotations, createAnnotation } from '@/lib/collab/annotation-service';
import { AnnotationSchema } from '@/lib/schemas/world-class-schemas';

export async function GET(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(req.url);
    const workspace_id = url.searchParams.get('workspace_id') ?? '';
    const target_id = url.searchParams.get('target_id') ?? undefined;
    const target_type = url.searchParams.get('target_type') ?? undefined;
    if (!workspace_id) {
      return errorResponse(400, 'workspace_id is required', 'VALIDATION_ERROR', auth.requestId);
    }

    const annotations = await listAnnotations({
      workspace_id,
      target_id,
      target_type: target_type as any,
    });
    return jsonResponse({ annotations }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to list annotations';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}

export async function POST(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { workspace_id, ...annotationData } = body;
    if (!workspace_id) {
      return errorResponse(400, 'workspace_id is required', 'VALIDATION_ERROR', auth.requestId);
    }
    const parsed = AnnotationSchema.parse(annotationData);
    const annotation = await createAnnotation({
      workspace_id,
      author_id: auth.userId,
      ...parsed,
    });
    return jsonResponse({ annotation }, auth.requestId, 201);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return errorResponse(400, 'Validation failed', 'VALIDATION_ERROR', auth.requestId, { issues: (e as any).issues });
    }
    const msg = e instanceof Error ? e.message : 'Failed to create annotation';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
