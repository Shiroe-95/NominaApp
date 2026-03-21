import { NextResponse } from 'next/server';
import { runSync } from '@/lib/sync/sync-service';

export async function POST(req: Request) {
  // Validate CRON_SECRET authentication
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    // Parse optional body for sync options
    let countryCode: string | undefined;
    let year: number | undefined;
    let force: boolean | undefined;

    try {
      const body = await req.json();
      if (body.countryCode && typeof body.countryCode === 'string') {
        countryCode = body.countryCode;
      }
      if (body.year && typeof body.year === 'number') {
        year = body.year;
      }
      if (typeof body.force === 'boolean') {
        force = body.force;
      }
    } catch {
      // Empty body is fine — all options are optional
    }

    const results = await runSync({ countryCode, year, force });

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Sync run error:', error);
    const message =
      error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
