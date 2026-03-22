/**
 * API Route: /api/audit/:ruleId
 *
 * Historial de auditoría para una regla normativa específica.
 * Requiere autenticación. Valida UUID del parámetro ruleId.
 *
 * - GET — Retorna el historial de cambios de la regla
 *
 * @module api/audit/[ruleId]
 */
import { NextResponse } from 'next/server';
import { getAuditHistory } from '@/lib/audit/audit-service';
import { applyRateLimit, requireAuth, isValidUuid, RATE_LIMITS } from '@/lib/api/guard';

/**
 * GET /api/audit/[ruleId] — Returns the audit history for a specific rule.
 *
 * Requirement: 6.4
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  const rl = await applyRateLimit(req, 'audit', RATE_LIMITS.read);
  if (rl) return rl;

  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  try {
    const { ruleId } = await params;

    if (!ruleId || !isValidUuid(ruleId)) {
      return NextResponse.json(
        { error: 'Valid ruleId is required' },
        { status: 400 },
      );
    }

    const history = await getAuditHistory(ruleId);

    return NextResponse.json({ history });
  } catch (error) {
    console.error('Audit history GET error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
