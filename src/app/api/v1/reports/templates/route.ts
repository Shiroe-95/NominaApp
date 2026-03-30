/**
 * GET /api/v1/reports/templates — Predefined templates
 * Requirements: 27.6
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../../guard';
import { getTemplates } from '@/lib/reports/report-builder-service';

export async function GET(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const templates = await getTemplates();
    return jsonResponse({ templates }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch templates';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
