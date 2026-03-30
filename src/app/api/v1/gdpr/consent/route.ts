/**
 * GET/POST /api/v1/gdpr/consent — Consent management
 * Requirements: 25.1
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../../guard';
import { getConsents, recordConsent } from '@/lib/compliance/gdpr-service';
import { GDPRConsentSchema } from '@/lib/schemas/world-class-schemas';

export async function GET(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const consents = await getConsents(auth.userId);
    return jsonResponse({ consents }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch consents';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}

export async function POST(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parsed = GDPRConsentSchema.parse(body);
    const id = await recordConsent(auth.userId, parsed);
    return jsonResponse({ consent_id: id }, auth.requestId, 201);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return errorResponse(400, 'Validation failed', 'VALIDATION_ERROR', auth.requestId, { issues: (e as any).issues });
    }
    const msg = e instanceof Error ? e.message : 'Failed to record consent';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
