/**
 * GET/PATCH /api/v1/tours/progress — Guided tour progress
 * Requirements: 30.4
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../../guard';
import { getTourProgress, advanceStep } from '@/lib/onboarding/guided-tour-service';

export async function GET(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const progress = await getTourProgress(auth.userId);
    return jsonResponse({ tours: progress }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch tour progress';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}

export async function PATCH(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { tour_id } = body;
    if (!tour_id) {
      return errorResponse(400, 'tour_id is required', 'VALIDATION_ERROR', auth.requestId);
    }
    const progress = await advanceStep(auth.userId, tour_id);
    return jsonResponse({ progress }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to update tour progress';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
