/**
 * POST /api/v1/webhooks/[id]/test — send test event
 * Requirements: 6.7
 */
import { NextResponse } from 'next/server';
import { authenticateV1Admin, errorResponse, jsonResponse } from '../../../guard';
import { sendTestEvent } from '@/lib/webhooks/webhook-service';

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const auth = await authenticateV1Admin(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  try {
    const result = await sendTestEvent(id);
    return jsonResponse({ delivery: result }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to send test event';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
