/**
 * GET /api/v1/webhooks/[id]/deliveries — delivery log
 * Requirements: 6.6
 */
import { NextResponse } from 'next/server';
import { authenticateV1Admin, errorResponse, jsonResponse } from '../../../guard';
import { queryDeliveryLog } from '@/lib/webhooks/webhook-service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = await authenticateV1Admin(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  try {
    const url = new URL(req.url);
    const result = await queryDeliveryLog(id, {
      cursor: url.searchParams.get('cursor') ?? undefined,
      page_size: url.searchParams.get('page_size')
        ? Number(url.searchParams.get('page_size'))
        : undefined,
    });
    return jsonResponse(result, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to query deliveries';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
