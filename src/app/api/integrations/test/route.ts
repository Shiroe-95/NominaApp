/**
 * API Route: /api/integrations/test
 *
 * POST — Test connectivity with an external system
 */

import { NextResponse } from 'next/server';
import { applyRateLimit, requireAdmin, RATE_LIMITS } from '@/lib/api/guard';
import { getConnector } from '@/lib/integrations';
import type { IntegrationConfig } from '@/lib/integrations';

export async function POST(req: Request) {
  const rl = await applyRateLimit(req, 'integrations-test', RATE_LIMITS.ai);
  if (rl) return rl;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  try {
    const body = (await req.json()) as {
      providerId: string;
      config: IntegrationConfig;
    };

    const connector = getConnector(body.providerId);
    if (!connector) {
      return NextResponse.json(
        { error: `Connector '${body.providerId}' not found` },
        { status: 404 },
      );
    }

    const result = await connector.testConnection(body.config);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message },
      { status: 500 },
    );
  }
}
