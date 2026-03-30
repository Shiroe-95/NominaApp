/**
 * GET /api/v1/health — Public health check endpoint (no auth)
 * Requirements: 34.2
 */
import { NextResponse } from 'next/server';
import { runHealthChecks } from '@/lib/monitoring/health-monitor';
import { API_VERSION } from '../guard';

export async function GET() {
  const requestId = crypto.randomUUID();

  try {
    const report = await runHealthChecks();
    const status = report.overall === 'healthy' ? 200 : report.overall === 'degraded' ? 200 : 503;

    return NextResponse.json(report, {
      status,
      headers: {
        'X-Request-Id': requestId,
        'X-API-Version': API_VERSION,
        'Cache-Control': 'no-cache, no-store',
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Health check failed';
    return NextResponse.json(
      { overall: 'down', error: msg, timestamp: new Date().toISOString() },
      {
        status: 503,
        headers: {
          'X-Request-Id': requestId,
          'X-API-Version': API_VERSION,
        },
      },
    );
  }
}
