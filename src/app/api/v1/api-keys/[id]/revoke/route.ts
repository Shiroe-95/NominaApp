/**
 * POST /api/v1/api-keys/[id]/revoke
 * Requirements: 38.5
 */
import { NextResponse } from 'next/server';
import { authenticateV1Admin, errorResponse, jsonResponse } from '../../../guard';
import { revokeAPIKey } from '@/lib/auth/api-key-service';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await authenticateV1Admin(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  try {
    const apiKey = await revokeAPIKey(id);
    return jsonResponse({ api_key: apiKey }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to revoke API key';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
