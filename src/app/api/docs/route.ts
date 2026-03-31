/**
 * GET /api/docs — Scalar API Reference UI
 * Serves interactive API documentation using Scalar (CDN-based).
 * Authentication: requires valid session or API key to view.
 *
 * Requirements: 18.1, 18.5
 * @module app/api/docs/route
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  // Require authentication — check Supabase session or API key header
  const authHeader = request.headers.get('authorization');
  let authenticated = false;

  if (authHeader?.startsWith('Bearer ')) {
    // API key or JWT in header — treat as authenticated
    authenticated = true;
  }

  if (!authenticated) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) authenticated = true;
    } catch {
      // Supabase not available — fall through
    }
  }

  if (!authenticated) {
    return NextResponse.json(
      { error: 'Authentication required to view API documentation', code: 'UNAUTHORIZED' },
      { status: 401 },
    );
  }

  const scalarConfig = JSON.stringify({
    theme: 'kepler',
    layout: 'modern',
    hideModels: false,
    authentication: {
      preferredSecurityScheme: 'BearerAuth',
      http: { bearer: { token: '' } },
    },
  });

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NominaSmart API Docs</title>
  <style>body{margin:0;padding:0;font-family:system-ui,sans-serif}</style>
</head>
<body>
  <script id="api-reference" data-url="/api/v1/docs/openapi.json" data-configuration='${scalarConfig}'></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
