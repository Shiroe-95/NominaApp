/**
 * POST /api/v1/audit-trail/export — export to CSV/PDF
 * Requirements: 3.4
 */
import { NextResponse } from 'next/server';
import { authenticateV1Admin, errorResponse, jsonResponse } from '../../guard';
import { exportAuditCSV, exportAuditPDF } from '@/lib/audit/audit-service';

export async function POST(req: Request) {
  const auth = await authenticateV1Admin(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const { workspace_id, format, ...filters } = await req.json();
    if (!workspace_id) {
      return errorResponse(400, 'workspace_id is required', 'VALIDATION_ERROR', auth.requestId);
    }
    if (!format || !['csv', 'pdf'].includes(format)) {
      return errorResponse(400, 'format must be csv or pdf', 'VALIDATION_ERROR', auth.requestId);
    }

    const queryFilters = { workspace_id, ...filters };

    if (format === 'csv') {
      const csv = await exportAuditCSV(queryFilters);
      return new Response(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': 'attachment; filename="audit-trail.csv"',
          'X-Request-Id': auth.requestId,
          'X-API-Version': '1.0.0',
        },
      });
    }

    const pdfData = await exportAuditPDF(queryFilters);
    return jsonResponse(pdfData, auth.requestId);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to export audit trail';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
