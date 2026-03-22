/**
 * API Route: /api/sync/bootstrap
 *
 * Endpoint manual para inicializar reglas en países sin datos.
 * Invoca el agente investigador para cada país activo que no tenga
 * reglas en `country_year_rules`. Útil en el primer despliegue.
 *
 * - POST — Ejecuta bootstrap de reglas (admin o CRON_SECRET)
 *
 * Body opcional: { countryCode?: string, year?: number }
 *
 * @module api/sync/bootstrap
 */
import { NextResponse } from 'next/server';
import { runSync } from '@/lib/sync/sync-service';
import { applyRateLimit, requireAdmin, RATE_LIMITS } from '@/lib/api/guard';

export async function POST(req: Request) {
  const rl = applyRateLimit(req, 'sync-bootstrap', RATE_LIMITS.cron);
  if (rl) return rl;

  // Allow both admin users and CRON_SECRET
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    const auth = await requireAdmin();
    if (auth instanceof NextResponse) return auth;
  }

  try {
    let countryCode: string | undefined;
    let year: number | undefined;

    try {
      const body = await req.json();
      if (body.countryCode && typeof body.countryCode === 'string') {
        countryCode = body.countryCode.toUpperCase();
      }
      if (body.year && typeof body.year === 'number') {
        year = body.year;
      }
    } catch {
      // Empty body is fine
    }

    // force: true ensures it runs regardless of frequency
    const results = await runSync({ countryCode, year, force: true });

    return NextResponse.json({
      message: 'Bootstrap completado',
      results,
    });
  } catch (error) {
    console.error('Bootstrap error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
