/**
 * POST /api/v1/gdpr/delete — Request deletion
 * Requirements: 25.3
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../../guard';
import { requestDeletion } from '@/lib/compliance/gdpr-service';

export async function POST(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const result = await requestDeletion(auth.userId);
    return jsonResponse({ deletion_request: result }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to request deletion';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
