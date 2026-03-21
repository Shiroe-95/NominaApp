import { NextResponse } from 'next/server';
import { getAuditHistory } from '@/lib/audit/audit-service';

/**
 * GET /api/audit/[ruleId] — Returns the audit history for a specific rule.
 *
 * Requirement: 6.4
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ruleId: string }> },
) {
  try {
    const { ruleId } = await params;

    if (!ruleId) {
      return NextResponse.json(
        { error: 'ruleId is required' },
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
