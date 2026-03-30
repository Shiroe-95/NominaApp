/**
 * GET /api/v1/benchmarks — Benchmarking data
 * Requirements: 29.2
 */
import { NextResponse } from 'next/server';
import { authenticateV1, errorResponse, jsonResponse } from '../guard';
import { queryBenchmarks } from '@/lib/benchmark/benchmark-engine';
import { BenchmarkQuerySchema } from '@/lib/schemas/world-class-schemas';

export async function GET(req: Request) {
  const auth = await authenticateV1(req);
  if (auth instanceof NextResponse) return auth;

  try {
    const url = new URL(req.url);
    const filters = BenchmarkQuerySchema.parse({
      industry: url.searchParams.get('industry') || undefined,
      country_code: url.searchParams.get('country_code') || undefined,
      company_size: url.searchParams.get('company_size') || undefined,
      period_year: url.searchParams.get('period_year')
        ? Number(url.searchParams.get('period_year'))
        : undefined,
    });

    const result = await queryBenchmarks(filters);
    return jsonResponse(result, auth.requestId);
  } catch (e: unknown) {
    if (e instanceof Error && e.name === 'ZodError') {
      return errorResponse(400, 'Validation failed', 'VALIDATION_ERROR', auth.requestId, { issues: (e as any).issues });
    }
    const msg = e instanceof Error ? e.message : 'Failed to fetch benchmarks';
    return errorResponse(500, msg, 'INTERNAL_ERROR', auth.requestId);
  }
}
