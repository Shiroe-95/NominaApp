/**
 * GET /api/docs — Redirect to Scalar/Swagger UI
 * Requirements: 19.3
 */
import { NextResponse } from 'next/server';

export async function GET() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>NominaSmart API Docs</title>
  <style>body{margin:0;padding:0;font-family:system-ui,sans-serif}</style>
</head>
<body>
  <div id="api-docs" style="padding:2rem;max-width:800px;margin:0 auto">
    <h1>NominaSmart API Documentation</h1>
    <p>Interactive API documentation is available via the OpenAPI specification.</p>
    <ul>
      <li><a href="/api/v1/docs/openapi.json">OpenAPI 3.1 Specification (JSON)</a></li>
      <li><a href="/api/v1/health">Health Check Endpoint</a></li>
    </ul>
    <p>To use Scalar or Swagger UI, load the spec URL <code>/api/v1/docs/openapi.json</code> in your preferred API documentation viewer.</p>
  </div>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
