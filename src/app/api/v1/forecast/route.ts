/**
 * GET/POST /api/v1/forecast — Cost projections
 * Requirements: 8.1
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../guard';
import { createAdminClient } from '@/lib/supabase/admin';
import { ForecastParamsSchema } from '@/lib/schemas/world-class-schemas';

export async function GET(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(req.url);
    const workspace_id = url.searchParams.get('workspace_id') ?? '';
    if (!workspace_id) {
      return errorResponse(400, 'workspace_id is required', 'VALIDATION_ERROR', auth.requestId);
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('forecast_snapshots')
      .select('*')
      .eq('workspace_id', workspace_id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);
    return jsonResponse({ forecasts: data ?? [] }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch forecasts';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}

export async function POST(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parsed = ForecastParamsSchema.parse(body);

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('forecast_snapshots')
      .insert({ ...parsed, created_by: auth.userId })
      .select('*')
      .single();

    if (error) throw new Error(error.message);
    return jsonResponse({ forecast: data }, auth.requestId, 201);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return errorResponse(400, 'Validation failed', 'VALIDATION_ERROR', auth.requestId, { issues: (e as any).issues });
    }
    const msg = e instanceof Error ? e.message : 'Failed to create forecast';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
