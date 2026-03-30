/**
 * GET/POST /api/v1/webhooks
 * Requirements: 6.1
 */
import { NextResponse } from 'next/server';
import { authenticateV1Admin, errorResponse, jsonResponse } from '../guard';
import { listWebhooks, createWebhook } from '@/lib/webhooks/webhook-service';
import { WebhookSchema } from '@/lib/schemas/world-class-schemas';

export async function GET(req: Request) {
  const auth = await authenticateV1Admin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(req.url);
    const workspace_id = url.searchParams.get('workspace_id') ?? '';
    if (!workspace_id) {
      return errorResponse(400, 'workspace_id is required', 'VALIDATION_ERROR', auth.requestId);
    }
    const webhooks = await listWebhooks(workspace_id);
    return jsonResponse({ webhooks }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to list webhooks';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}

export async function POST(req: Request) {
  const auth = await authenticateV1Admin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { workspace_id, ...webhookData } = body;
    if (!workspace_id) {
      return errorResponse(400, 'workspace_id is required', 'VALIDATION_ERROR', auth.requestId);
    }
    const parsed = WebhookSchema.parse(webhookData);
    const result = await createWebhook(workspace_id, auth.userId, parsed);
    return jsonResponse({ webhook: result.webhook, secret: result.secret }, auth.requestId, 201);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return errorResponse(400, 'Validation failed', 'VALIDATION_ERROR', auth.requestId, { issues: (e as any).issues });
    }
    const msg = e instanceof Error ? e.message : 'Failed to create webhook';
    const status = msg.includes('Maximum') ? 409 : 500;
    return errorResponse(status, msg, status === 409 ? 'LIMIT_EXCEEDED' : 'INTERNAL_ERROR', auth.requestId);
  }
}
