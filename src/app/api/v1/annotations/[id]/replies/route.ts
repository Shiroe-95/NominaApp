/**
 * POST /api/v1/annotations/[id]/replies — Thread replies
 * Requirements: 12.4
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../../../guard';
import { addReply } from '@/lib/collab/annotation-service';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await req.json();
    const content = body.content;
    if (!content || typeof content !== 'string') {
      return errorResponse(400, 'content is required', 'VALIDATION_ERROR', auth.requestId);
    }

    const reply = await addReply({
      annotation_id: id,
      user_id: auth.userId,
      content,
      mentions: body.mentions,
    });
    return jsonResponse({ reply }, auth.requestId, 201);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to add reply';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
