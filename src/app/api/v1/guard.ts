/**
 * API v1 Guard — Shared middleware for versioned API routes.
 *
 * Provides:
 * - Consistent error format: { error, code, details?, requestId }
 * - X-Request-Id and X-API-Version headers on all responses
 * - API key authentication (Bearer token) via APIKeyService
 * - Deprecation/Sunset header support
 *
 * Requirements: 19.4, 19.5, 20.1–20.5, 38.3
 *
 * @module app/api/v1/guard
 */
import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { validateAPIKey, type APIKeyRow } from '@/lib/auth/api-key-service';
import { requireAuth, requireAdmin, requireAnalystOrAdmin, type AuthContext } from '@/lib/api/guard';

export const API_VERSION = '1.0.0';

export interface V1AuthContext {
  userId: string;
  role?: string;
  apiKey?: APIKeyRow;
  requestId: string;
}

/** Standard v1 error response (Req 19.4) */
export function errorResponse(
  status: number,
  error: string,
  code: string,
  requestId: string,
  details?: Record<string, unknown>,
) {
  const body: Record<string, unknown> = { error, code, requestId };
  if (details) body.details = details;
  return NextResponse.json(body, {
    status,
    headers: v1Headers(requestId),
  });
}

/** Standard v1 success response with headers */
export function jsonResponse(data: unknown, requestId: string, status = 200) {
  return NextResponse.json(data, { status, headers: v1Headers(requestId) });
}

/** Common v1 headers (Req 19.5, 20.3) */
function v1Headers(requestId: string): Record<string, string> {
  return {
    'X-Request-Id': requestId,
    'X-API-Version': API_VERSION,
  };
}

/** Generate a request ID from the incoming header or create a new one */
export function getRequestId(req: Request): string {
  return req.headers.get('x-request-id') ?? randomUUID();
}

/**
 * Authenticate via Bearer API key OR Supabase session.
 * API key takes precedence if Authorization header is present.
 * Req 38.3: accept Bearer token, validate via APIKeyService.
 */
export async function authenticateV1(
  req: Request,
): Promise<V1AuthContext | NextResponse> {
  const requestId = getRequestId(req);
  const authHeader = req.headers.get('authorization');

  // Try API key auth first (Bearer token)
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const result = await validateAPIKey(token);
    if (!result.valid || !result.apiKey) {
      return errorResponse(401, 'Invalid or expired API key', 'INVALID_API_KEY', requestId);
    }
    return {
      userId: result.apiKey.created_by,
      apiKey: result.apiKey,
      requestId,
    };
  }

  // Fall back to Supabase session auth
  const auth = await requireAuth();
  if (auth instanceof NextResponse) {
    return errorResponse(401, 'Authentication required', 'UNAUTHORIZED', requestId);
  }
  return { userId: auth.userId, requestId };
}

/**
 * Authenticate and require admin role.
 */
export async function authenticateV1Admin(
  req: Request,
): Promise<V1AuthContext | NextResponse> {
  const requestId = getRequestId(req);
  const authHeader = req.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const result = await validateAPIKey(token);
    if (!result.valid || !result.apiKey) {
      return errorResponse(401, 'Invalid or expired API key', 'INVALID_API_KEY', requestId);
    }
    if (!result.apiKey.permissions.includes('admin')) {
      return errorResponse(403, 'Admin permission required', 'FORBIDDEN', requestId);
    }
    return { userId: result.apiKey.created_by, role: 'admin', apiKey: result.apiKey, requestId };
  }

  const ctx = await requireAdmin();
  if (ctx instanceof NextResponse) {
    return errorResponse(403, 'Admin access required', 'FORBIDDEN', requestId);
  }
  return { userId: ctx.userId, role: ctx.role, requestId };
}

/**
 * Authenticate and require analyst or admin role.
 */
export async function authenticateV1AnalystOrAdmin(
  req: Request,
): Promise<V1AuthContext | NextResponse> {
  const requestId = getRequestId(req);
  const authHeader = req.headers.get('authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const result = await validateAPIKey(token);
    if (!result.valid || !result.apiKey) {
      return errorResponse(401, 'Invalid or expired API key', 'INVALID_API_KEY', requestId);
    }
    const perms = result.apiKey.permissions;
    if (!perms.includes('admin') && !perms.includes('write')) {
      return errorResponse(403, 'Write or admin permission required', 'FORBIDDEN', requestId);
    }
    return { userId: result.apiKey.created_by, apiKey: result.apiKey, requestId };
  }

  const ctx = await requireAnalystOrAdmin();
  if (ctx instanceof NextResponse) {
    return errorResponse(403, 'Analyst or admin access required', 'FORBIDDEN', requestId);
  }
  return { userId: ctx.userId, role: ctx.role, requestId };
}
