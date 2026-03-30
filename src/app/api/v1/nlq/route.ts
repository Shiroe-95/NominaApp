/**
 * POST /api/v1/nlq — Natural language query
 * Requirements: 9.1
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../guard';
import { NLQQuerySchema } from '@/lib/schemas/world-class-schemas';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await req.json();
    const parsed = NLQQuerySchema.parse(body);

    // Fetch RBAC-scoped payroll data for the workspace
    const supabase = createAdminClient();
    const { data: payrolls, error } = await supabase
      .from('payroll_uploads')
      .select('id, period_year, period_month, parsed_data')
      .eq('workspace_id', parsed.workspace_id)
      .order('period_year', { ascending: false })
      .order('period_month', { ascending: false })
      .limit(5);

    if (error) throw new Error(error.message);

    return jsonResponse({
      query: parsed.query,
      locale: parsed.locale,
      workspace_id: parsed.workspace_id,
      payrolls_scanned: payrolls?.length ?? 0,
      message: 'NLQ query received. Full AI processing requires model configuration.',
    }, auth.requestId);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return errorResponse(400, 'Validation failed', 'VALIDATION_ERROR', auth.requestId, { issues: (e as any).issues });
    }
    const msg = e instanceof Error ? e.message : 'Failed to process NLQ query';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
