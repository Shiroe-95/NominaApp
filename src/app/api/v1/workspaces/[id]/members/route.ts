/**
 * GET/POST/DELETE /api/v1/workspaces/[id]/members
 * Requirements: 2.5, 2.6
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../../../guard';
import {
  listWorkspaceMembers,
  inviteMember,
  removeMember,
} from '@/lib/workspaces/workspace-service';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  try {
    const members = await listWorkspaceMembers(id);
    return jsonResponse({ members }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to list members';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}

export async function POST(req: Request, ctx: Ctx) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  try {
    const { user_id, role } = await req.json();
    const member = await inviteMember(id, auth.userId, user_id, role);
    return jsonResponse({ member }, auth.requestId, 201);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to invite member';
    const status = msg.includes('not a member') || msg.includes('cannot') ? 403 : 500;
    return errorResponse(status, msg, status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', auth.requestId);
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;
  const { id } = await ctx.params;

  try {
    const { user_id } = await req.json();
    await removeMember(id, auth.userId, user_id);
    return jsonResponse({ ok: true }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to remove member';
    const status = msg.includes('not a member') || msg.includes('Cannot') ? 403 : 500;
    return errorResponse(status, msg, status === 403 ? 'FORBIDDEN' : 'INTERNAL_ERROR', auth.requestId);
  }
}
