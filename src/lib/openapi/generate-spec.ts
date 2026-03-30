/**
 * Generate OpenAPI 3.1 spec from Zod schemas.
 * Serves at /api/v1/docs/openapi.json
 *
 * Requirements: 19.1, 19.2, 19.3, 19.6, 19.7
 * @module lib/openapi/generate-spec
 */

import {
  WorkspaceSchema,
  WebhookSchema,
  ScheduledReportSchema,
  AnnotationSchema,
  APIKeyCreateSchema,
  NLQQuerySchema,
  ForecastParamsSchema,
  GDPRConsentSchema,
  DashboardLayoutSchema,
  BenchmarkQuerySchema,
  APIErrorSchema,
} from '@/lib/schemas/world-class-schemas';
import type { z } from 'zod';

interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string; description: string };
  servers: { url: string; description: string }[];
  paths: Record<string, unknown>;
  components: { schemas: Record<string, unknown>; securitySchemes: Record<string, unknown> };
  security: Record<string, string[]>[];
}

/** Convert a Zod schema to a simplified JSON Schema representation. */
function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = schema._def;
  if (!def) return { type: 'object' };

  const typeName = def.typeName as string;

  if (typeName === 'ZodString') return { type: 'string' };
  if (typeName === 'ZodNumber') return { type: 'number' };
  if (typeName === 'ZodBoolean') return { type: 'boolean' };
  if (typeName === 'ZodEnum') return { type: 'string', enum: def.values };
  if (typeName === 'ZodArray') return { type: 'array', items: zodToJsonSchema(def.type) };
  if (typeName === 'ZodOptional') return { ...zodToJsonSchema(def.innerType), nullable: true };
  if (typeName === 'ZodDefault') return zodToJsonSchema(def.innerType);
  if (typeName === 'ZodObject') {
    const shape = def.shape?.() ?? {};
    const properties: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(shape)) {
      properties[key] = zodToJsonSchema(val as z.ZodTypeAny);
    }
    return { type: 'object', properties };
  }
  return { type: 'object' };
}

/** Schema registry mapping names to Zod schemas. */
const SCHEMA_REGISTRY: Record<string, z.ZodTypeAny> = {
  Workspace: WorkspaceSchema,
  Webhook: WebhookSchema,
  ScheduledReport: ScheduledReportSchema,
  Annotation: AnnotationSchema,
  APIKeyCreate: APIKeyCreateSchema,
  NLQQuery: NLQQuerySchema,
  ForecastParams: ForecastParamsSchema,
  GDPRConsent: GDPRConsentSchema,
  DashboardLayout: DashboardLayoutSchema,
  BenchmarkQuery: BenchmarkQuerySchema,
  APIError: APIErrorSchema,
};

/** Generate the full OpenAPI 3.1 specification. */
export function generateOpenAPISpec(): OpenAPISpec {
  const schemas: Record<string, unknown> = {};
  for (const [name, zodSchema] of Object.entries(SCHEMA_REGISTRY)) {
    schemas[name] = zodToJsonSchema(zodSchema);
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'NominaSmart API',
      version: '1.0.0',
      description: 'AI-powered payroll audit platform API',
    },
    servers: [
      { url: '/api/v1', description: 'API v1' },
    ],
    paths: {
      '/workspaces': {
        get: { summary: 'List workspaces', tags: ['Workspaces'], responses: { '200': { description: 'OK' } } },
        post: { summary: 'Create workspace', tags: ['Workspaces'], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Workspace' } } } }, responses: { '201': { description: 'Created' } } },
      },
      '/webhooks': {
        get: { summary: 'List webhooks', tags: ['Webhooks'], responses: { '200': { description: 'OK' } } },
        post: { summary: 'Create webhook', tags: ['Webhooks'], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/Webhook' } } } }, responses: { '201': { description: 'Created' } } },
      },
      '/audit-trail': {
        get: { summary: 'Query audit trail', tags: ['Audit'], parameters: [{ name: 'cursor', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'OK' } } },
      },
      '/anomalies': {
        get: { summary: 'List anomalies', tags: ['AI'], responses: { '200': { description: 'OK' } } },
      },
      '/nlq': {
        post: { summary: 'Natural language query', tags: ['AI'], requestBody: { content: { 'application/json': { schema: { $ref: '#/components/schemas/NLQQuery' } } } }, responses: { '200': { description: 'OK' } } },
      },
      '/health': {
        get: { summary: 'Health check', tags: ['System'], responses: { '200': { description: 'OK' } } },
      },
    },
    components: {
      schemas,
      securitySchemes: {
        BearerAuth: { type: 'http', scheme: 'bearer' },
        APIKeyAuth: { type: 'apiKey', in: 'header', name: 'Authorization' },
      },
    },
    security: [{ BearerAuth: [] }, { APIKeyAuth: [] }],
  };
}
