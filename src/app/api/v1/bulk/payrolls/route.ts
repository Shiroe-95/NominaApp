/**
 * POST /api/v1/bulk/payrolls — bulk operations on payrolls
 * Requirements: 4.1, 4.3, 4.4, 4.6
 */
import { NextResponse } from 'next/server';
import { authenticateV1AnalystOrAdmin, errorResponse, jsonResponse } from '../../guard';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: Request) {
  const auth = await authenticateV1AnalystOrAdmin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { ids, action } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return errorResponse(400, 'ids must be a non-empty array', 'VALIDATION_ERROR', auth.requestId);
    }
    if (!['export', 'delete', 're-audit'].includes(action)) {
      return errorResponse(400, 'action must be export, delete, or re-audit', 'VALIDATION_ERROR', auth.requestId);
    }

    const supabase = createAdminClient();
    const results = { processed: 0, failed: 0, errors: [] as string[] };

    if (action === 'delete') {
      const { error, count } = await supabase
        .from('payroll_uploads')
        .delete()
        .in('id', ids);
      if (error) {
        results.failed = ids.length;
        results.errors.push(error.message);
      } else {
        results.processed = count ?? ids.length;
      }
    } else {
      // export and re-audit: return matching payrolls
      const { data, error } = await supabase
        .from('payroll_uploads')
        .select('id, company_id, period_year, period_month')
        .in('id', ids);
      if (error) {
        results.failed = ids.length;
        results.errors.push(error.message);
      } else {
        results.processed = data?.length ?? 0;
      }
    }

    return jsonResponse({ action, results }, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Bulk operation failed';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
