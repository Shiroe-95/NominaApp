/**
 * API Route: /api/integrations
 *
 * GET  — Lista conectores disponibles y configuraciones activas
 * POST — Importa datos de nómina desde un conector configurado
 */

import { NextResponse } from 'next/server';
import { applyRateLimit, requireAdmin, RATE_LIMITS } from '@/lib/api/guard';
import { listConnectors, getConnector } from '@/lib/integrations';
import type { IntegrationConfig } from '@/lib/integrations';

/** GET /api/integrations — List available connectors */
export async function GET(req: Request) {
  const rl = await applyRateLimit(req, 'integrations', RATE_LIMITS.read);
  if (rl) return rl;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const connectors = listConnectors().map((c) => ({
    providerId: c.providerId,
    displayName: c.displayName,
    type: c.type,
  }));

  return NextResponse.json({ connectors });
}

/** POST /api/integrations — Import payroll from external system */
export async function POST(req: Request) {
  const rl = await applyRateLimit(req, 'integrations-import', RATE_LIMITS.ai);
  if (rl) return rl;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await req.json()) as {
      providerId: string;
      config: IntegrationConfig;
      periodYear: number;
      periodMonth: number;
    };

    const connector = getConnector(body.providerId);
    if (!connector) {
      return NextResponse.json(
        { error: `Connector '${body.providerId}' not found` },
        { status: 404 },
      );
    }

    const result = await connector.importPayroll(
      body.config,
      body.periodYear,
      body.periodMonth,
    );

    return NextResponse.json(result, { status: result.success ? 200 : 422 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
