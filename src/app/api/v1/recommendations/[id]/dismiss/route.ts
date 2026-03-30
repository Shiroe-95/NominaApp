/**
 * POST /api/v1/recommendations/[id]/dismiss — Dismiss recommendation
 * Requirements: 39.3
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../../../guard';
import { dismissRecommendation } from '@/lib/ai/agents/recommendation-engine';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const body = await req.json();
    const type = body.recommendation_type ?? 'general';

    await dismissRecommendation(auth.userId, type, id);
    return jsonResponse({ dismissed: true, recommendation_id: id }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to dismiss recommendation';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
