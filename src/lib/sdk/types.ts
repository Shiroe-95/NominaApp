/**
 * NominaSmart SDK Types — re-exported from Zod schemas for SDK consumers.
 * All types are derived from Zod schemas via z.infer<>.
 *
 * Requirements: 19.2
 * @module lib/sdk/types
 */

export type {
  WorkspaceInput,
  WebhookInput,
  ScheduledReportInput,
  AnnotationInput,
  APIKeyCreateInput,
  NLQQueryInput,
  ForecastParamsInput,
  GDPRConsentInput,
  BenchmarkQueryInput,
  APIError,
  DashboardLayoutInput,
} from '@/lib/schemas/world-class-schemas';

export type { NominaSmartConfig, APIResponse, PaginationParams } from './nominasmart-client';
