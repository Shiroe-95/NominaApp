import { z } from 'zod';

// ── Workspace (Req 2.2) ────────────────────────────────────────────

export const WorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  default_country_code: z.string().length(2),
  data_region: z.enum(['na', 'sa', 'eu', 'ap']).default('sa'),
});

export type WorkspaceInput = z.infer<typeof WorkspaceSchema>;

// ── Webhook (Req 6.1) ──────────────────────────────────────────────

export const WebhookEventEnum = z.enum([
  'payroll.uploaded',
  'audit.completed',
  'correction.applied',
  'report.generated',
  'rule.updated',
  'user.invited',
  'action.status_changed',
]);

export const WebhookSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(WebhookEventEnum).min(1),
  is_active: z.boolean().default(true),
});

export type WebhookInput = z.infer<typeof WebhookSchema>;

// ── Scheduled Report (Req 5.2) ─────────────────────────────────────

export const ScheduledReportSchema = z.object({
  name: z.string().min(1).max(200),
  report_type: z.enum([
    'executive',
    'risk_detail',
    'comparative',
    'compliance',
    'cost_analysis',
    'custom',
  ]),
  filters: z.object({
    companyIds: z.array(z.string().uuid()).optional(),
    countryCode: z.string().length(2).optional(),
    periodRange: z
      .object({
        from: z.string(),
        to: z.string(),
      })
      .optional(),
  }),
  output_format: z.enum(['excel', 'pdf']),
  recipients: z.array(z.string().email()).min(1).max(20),
  cron_expression: z.string().min(1).max(100),
});

export type ScheduledReportInput = z.infer<typeof ScheduledReportSchema>;

// ── Annotation (Req 12.2) ──────────────────────────────────────────

export const AnnotationSchema = z.object({
  target_type: z.enum(['cell', 'finding', 'action_item', 'report_section']),
  target_id: z.string().uuid(),
  target_metadata: z.record(z.unknown()).optional(),
  content: z.string().min(1).max(5000),
  mentions: z.array(z.string().uuid()).optional(),
});

export type AnnotationInput = z.infer<typeof AnnotationSchema>;

// ── API Key Create (Req 38.1) ──────────────────────────────────────

export const APIKeyCreateSchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.enum(['read', 'write', 'admin'])).min(1),
  expires_at: z.string().datetime().optional(),
});

export type APIKeyCreateInput = z.infer<typeof APIKeyCreateSchema>;

// ── NLQ Query (Req 9.1) ────────────────────────────────────────────

export const NLQQuerySchema = z.object({
  query: z.string().min(1).max(1000),
  locale: z.enum(['es', 'en', 'pt', 'fr', 'de']).default('es'),
  workspace_id: z.string().uuid(),
});

export type NLQQueryInput = z.infer<typeof NLQQuerySchema>;

// ── Forecast Parameters (Req 8.6) ──────────────────────────────────

export const ForecastParamsSchema = z.object({
  company_id: z.string().uuid(),
  months_ahead: z.union([z.literal(3), z.literal(6), z.literal(12)]).default(6),
  growth_rate: z.number().min(-0.5).max(1.0).optional(),
  salary_increase: z.number().min(0).max(0.5).optional(),
  regulatory_changes: z
    .array(
      z.object({
        description: z.string(),
        impact_percentage: z.number(),
        effective_month: z.number().int().min(1).max(12),
      })
    )
    .optional(),
});

export type ForecastParamsInput = z.infer<typeof ForecastParamsSchema>;

// ── GDPR Consent (Req 25.1) ────────────────────────────────────────

export const GDPRConsentSchema = z.object({
  consent_type: z.enum(['data_processing', 'analytics', 'marketing']),
  policy_version: z.string(),
  granted: z.boolean(),
});

export type GDPRConsentInput = z.infer<typeof GDPRConsentSchema>;

// ── Dashboard Layout (Req 18.1) ────────────────────────────────────

export const DashboardLayoutSchema = z.object({
  widget_config: z.array(
    z.object({
      widget_id: z.string(),
      position: z.object({
        x: z.number(),
        y: z.number(),
        w: z.number(),
        h: z.number(),
      }),
      settings: z.record(z.unknown()).optional(),
    })
  ),
  preset: z.enum(['executive', 'analyst', 'admin', 'custom']).default('custom'),
});

export type DashboardLayoutInput = z.infer<typeof DashboardLayoutSchema>;

// ── Benchmark Query (Req 29.1) ─────────────────────────────────────

export const BenchmarkQuerySchema = z.object({
  industry: z.string().optional(),
  country_code: z.string().length(2).optional(),
  company_size: z.enum(['small', 'medium', 'large', 'enterprise']).optional(),
  period_year: z.number().int().min(2020).max(2030).optional(),
});

export type BenchmarkQueryInput = z.infer<typeof BenchmarkQuerySchema>;

// ── API Error Response (Req 19.4) ──────────────────────────────────

export const APIErrorSchema = z.object({
  error: z.string(),
  code: z.string(),
  details: z.record(z.unknown()).optional(),
  requestId: z.string(),
});

export type APIError = z.infer<typeof APIErrorSchema>;
