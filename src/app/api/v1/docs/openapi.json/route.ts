/**
 * GET /api/v1/docs/openapi.json — OpenAPI 3.1 spec from Zod schemas
 * Requirements: 18.2, 18.3
 */
import { NextResponse } from 'next/server';
import { generateOpenAPISpec } from '@/lib/openapi/generate-spec';

export async function GET() {
  const spec = generateOpenAPISpec();
  return NextResponse.json(spec, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
