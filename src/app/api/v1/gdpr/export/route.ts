/**
 * POST /api/v1/gdpr/export — Export personal data (JSON)
 * Requirements: 25.2
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../../guard';
import { exportUserData } from '@/lib/compliance/gdpr-service';

export async function POST(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const data = await exportUserData(auth.userId);
    return jsonResponse({ export: data }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to export user data';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
