/**
 * GET /api/v1/docs/openapi.json — OpenAPI 3.1 spec stub
 * Requirements: 19.1, 19.2, 19.6
 */
import { NextResponse } from 'next/server';
import { API_VERSION } from '../../guard';

const OPENAPI_SPEC = {
  openapi: '3.1.0',
  info: {
    title: 'NominaSmart API',
    version: API_VERSION,
    description: 'NominaSmart World-Class Payroll Platform API',
    contact: { name: 'NominaSmart Team' },
  },
  servers: [{ url: '/api/v1', description: 'API v1' }],
  paths: {
    '/health': { get: { summary: 'Health check', tags: ['System'], responses: { '200': { description: 'OK' } } } },
    '/anomalies': { get: { summary: 'List anomalies', tags: ['AI'], security: [{ bearerAuth: [] }] } },
    '/forecast': { get: { summary: 'List forecasts', tags: ['AI'] }, post: { summary: 'Create forecast', tags: ['AI'] } },
    '/nlq': { post: { summary: 'Natural language query', tags: ['AI'] } },
    '/recommendations': { get: { summary: 'Get recommendations', tags: ['AI'] } },
    '/annotations': { get: { summary: 'List annotations', tags: ['Collaboration'] }, post: { summary: 'Create annotation', tags: ['Collaboration'] } },
    '/activity': { get: { summary: 'Activity feed', tags: ['Collaboration'] } },
    '/scheduled-reports': { get: { summary: 'List scheduled reports', tags: ['Reports'] }, post: { summary: 'Create scheduled report', tags: ['Reports'] } },
    '/benchmarks': { get: { summary: 'Benchmark data', tags: ['Reports'] } },
    '/gdpr/consent': { get: { summary: 'Get consents', tags: ['Compliance'] }, post: { summary: 'Record consent', tags: ['Compliance'] } },
    '/gdpr/export': { post: { summary: 'Export personal data', tags: ['Compliance'] } },
    '/gdpr/delete': { post: { summary: 'Request deletion', tags: ['Compliance'] } },
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', description: 'API key or session token' },
    },
  },
};

export async function GET() {
  return NextResponse.json(OPENAPI_SPEC, {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
