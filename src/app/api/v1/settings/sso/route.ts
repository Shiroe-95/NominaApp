/**
 * GET/POST /api/v1/settings/sso — SSO identity provider configuration
 * Requirements: 1.2, 1.7
 */
import { NextResponse } from 'next/server';
import { authenticateV1Admin, errorResponse, jsonResponse } from '../../guard';
import { getSSOConfig, configureSSOProvider, updateSSOConfig } from '@/lib/auth/sso-service';

export async function GET(req: Request) {
  const auth = await authenticateV1Admin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(req.url);
    const workspace_id = url.searchParams.get('workspace_id') ?? '';
    if (!workspace_id) {
      return errorResponse(400, 'workspace_id is required', 'VALIDATION_ERROR', auth.requestId);
    }
    const config = await getSSOConfig(workspace_id);
    return jsonResponse({ sso: config }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to get SSO config';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}

export async function POST(req: Request) {
  const auth = await authenticateV1Admin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { workspace_id, ...ssoData } = body;
    if (!workspace_id) {
      return errorResponse(400, 'workspace_id is required', 'VALIDATION_ERROR', auth.requestId);
    }

    // Try update first, create if not exists
    const existing = await getSSOConfig(workspace_id);
    const config = existing
      ? await updateSSOConfig(workspace_id, ssoData)
      : await configureSSOProvider(workspace_id, ssoData);

    return jsonResponse({ sso: config }, auth.requestId, existing ? 200 : 201);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to configure SSO';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
