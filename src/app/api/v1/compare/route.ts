/**
 * POST /api/v1/compare — Comparative analysis between periods
 * Requirements: 10.1
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../guard';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const { workspace_id, period_a, period_b, company_id } = body;
    if (!workspace_id || !period_a || !period_b) {
      return errorResponse(400, 'workspace_id, period_a, and period_b are required', 'VALIDATION_ERROR', auth.requestId);
    }

    const supabase = createAdminClient();
    let queryA = supabase.from('payroll_uploads').select('*')
      .eq('workspace_id', workspace_id)
      .eq('period_year', period_a.year).eq('period_month', period_a.month);
    let queryB = supabase.from('payroll_uploads').select('*')
      .eq('workspace_id', workspace_id)
      .eq('period_year', period_b.year).eq('period_month', period_b.month);

    if (company_id) {
      queryA = queryA.eq('company_id', company_id);
      queryB = queryB.eq('company_id', company_id);
    }

    const [resA, resB] = await Promise.all([queryA, queryB]);
    if (resA.error) throw new Error(resA.error.message);
    if (resB.error) throw new Error(resB.error.message);

    return jsonResponse({
      period_a: { ...period_a, payrolls: resA.data?.length ?? 0 },
      period_b: { ...period_b, payrolls: resB.data?.length ?? 0 },
    }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to compare periods';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
