/**
 * GET/POST /api/v1/api-keys
 * Requirements: 38.1, 38.2, 38.4
 */
import { NextResponse } from 'next/server';
import { authenticateV1Admin, errorResponse, jsonResponse } from '../guard';
import { listAPIKeys, createAPIKey } from '@/lib/auth/api-key-service';
import { APIKeyCreateSchema } from '@/lib/schemas/world-class-schemas';

export async function GET(req: Request) {
  const auth = await authenticateV1Admin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(req.url);
    const workspace_id = url.searchParams.get('workspace_id') ?? '';
    if (!workspace_id) {
      return errorResponse(400, 'workspace_id is required', 'VALIDATION_ERROR', auth.requestId);
    }
    const keys = await listAPIKeys(workspace_id);
    return jsonResponse({ api_keys: keys }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to list API keys';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}

export async function POST(req: Request) {
  const auth = await authenticateV1Admin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { workspace_id, ...keyData } = body;
    if (!workspace_id) {
      return errorResponse(400, 'workspace_id is required', 'VALIDATION_ERROR', auth.requestId);
    }
    const parsed = APIKeyCreateSchema.parse(keyData);
    const result = await createAPIKey(workspace_id, auth.userId, parsed);
    return jsonResponse(
      { api_key: result.apiKey, full_key: result.fullKey },
      auth.requestId,
      201,
    );
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return errorResponse(400, 'Validation failed', 'VALIDATION_ERROR', auth.requestId, { issues: (e as any).issues });
    }
    const msg = e instanceof Error ? e.message : 'Failed to create API key';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
