# Implementation Plan: NominaSmart World-Class

## Overview

This plan implements 40 new capabilities across 10 domains to elevate NominaSmart to world-class level. The implementation follows an incremental approach: database schema first, then core services, then UI components, then integration/wiring. Each task builds on previous ones. The stack is TypeScript throughout: Next.js 16, React 19, Supabase, Radix UI, Upstash Redis, Tailwind CSS 4, Vitest + fast-check, Playwright.

## Tasks

- [x] 1. Database schema and migrations
  - [x] 1.1 Create migration `scripts/007_world_class_tables.sql` with all new tables
    - Create tables: workspaces, workspace_members, sso_configurations, audit_trail_extended, webhooks, webhook_deliveries, scheduled_reports, scheduled_report_runs, annotations, annotation_replies, activity_log, anomaly_detections, forecast_snapshots, api_keys, benchmark_data, guided_tour_progress, notification_preferences, dashboard_layouts, recommendation_dismissals, gdpr_consent_log, gdpr_deletion_requests, custom_reports, report_builder_templates
    - Add indexes: audit_trail (workspace+created, action_type, user), activity_log (workspace+created), api_keys (key_hash unique)
    - ALTER payroll_uploads to add workspace_id, ALTER user_profiles to add active_workspace_id and theme_preference
    - Enable RLS on all new tables with workspace_member_access policy
    - _Requirements: 2.1, 3.5, 3.6, 6.4, 11.4, 12.1, 22.1, 26.1, 29.1, 38.2_

  - [x] 1.2 Create Zod validation schemas for all new entities
    - Create `src/lib/schemas/world-class-schemas.ts` with schemas: WorkspaceSchema, WebhookSchema, ScheduledReportSchema, AnnotationSchema, APIKeyCreateSchema, NLQQuerySchema, ForecastParamsSchema, GDPRConsentSchema, DashboardLayoutSchema, BenchmarkQuerySchema, APIErrorSchema
    - Export all schemas from barrel file
    - _Requirements: 19.4, 19.6, 2.2, 6.1, 5.2, 12.2, 38.1, 9.1, 8.6, 25.1, 18.1, 29.1_

  - [ ]* 1.3 Write property tests for Zod schemas
    - **Property 1: Round-trip consistency — any valid object that passes schema validation should serialize to JSON and deserialize back to an identical object**
    - **Property 2: Invalid inputs are always rejected — randomly generated malformed inputs never pass validation**
    - **Validates: Requirements 19.4, 32.4**

- [x] 2. Checkpoint — Verify database and schemas
  - Ensure migration SQL is syntactically valid and all Zod schemas compile without errors. Ask the user if questions arise.

- [x] 3. Core infrastructure services
  - [x] 3.1 Implement CacheLayer service (`src/lib/cache/cache-layer.ts`)
    - Implement cache-aside pattern with Upstash Redis: get, set, invalidate, getOrFetch
    - Configurable TTL per data type (rules: 3600s, dashboard: 300s, providers: 900s, userProfile: 600s)
    - Graceful degradation: fallback to DB when Redis unavailable
    - Hit rate and latency metrics logging
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7_

  - [ ]* 3.2 Write property tests for CacheLayer
    - **Property 3: Cache-aside correctness — for any key, getOrFetch always returns the same value as the fetcher when cache is empty**
    - **Property 4: TTL expiration — cached values are not served after TTL expires**
    - **Property 5: Invalidation consistency — after invalidate(pattern), subsequent get returns null for matching keys**
    - **Validates: Requirements 22.2, 22.3, 22.4, 32.7**

  - [x] 3.3 Implement AuditService (`src/lib/audit/audit-service.ts`)
    - Automatic logging of all write operations on protected API routes
    - Record: workspace_id, user_id, action_type, resource_type, resource_id, data_before, data_after, ip_address, user_agent, severity
    - Cursor-based pagination for queries exceeding 10,000 entries
    - Export to CSV and PDF
    - 7-year retention policy
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 24.1_

  - [x] 3.4 Implement WebhookService (`src/lib/webhooks/webhook-service.ts`)
    - CRUD for webhook registrations (max 10 per workspace)
    - HMAC-SHA256 payload signing with unique secret per webhook
    - Delivery queue with exponential backoff retry (30s, 60s, 120s, up to 5 attempts)
    - Delivery log with status, HTTP code, response time
    - Test delivery endpoint
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8_

  - [ ]* 3.5 Write property tests for WebhookService
    - **Property 6: HMAC-SHA256 signature verification — for any payload and secret, sign(payload, secret) produces a signature that verify(payload, signature, secret) accepts**
    - **Property 7: Retry backoff correctness — retry delays follow exponential pattern (30s * 2^attempt) and never exceed max attempts**
    - **Validates: Requirements 6.3, 6.5, 6.8, 32.6**

  - [x] 3.5b Implement APIKeyService (`src/lib/auth/api-key-service.ts`)
    - Create API key: generate random key, store SHA-256 hash, return full key once
    - Validate API key: hash incoming key, lookup by hash, check expiration and revocation
    - Revoke API key: immediate invalidation
    - Permissions: read, write, admin scopes
    - _Requirements: 38.1, 38.2, 38.3, 38.4, 38.5, 38.6, 38.7_

  - [ ]* 3.6 Write property tests for APIKeyService
    - **Property 8: API key round-trip — for any generated key, hashing it and looking up by hash always finds the original record**
    - **Property 9: Revoked keys always rejected — after revocation, validate always returns false regardless of key validity**
    - **Validates: Requirements 38.2, 38.5, 32.4**

- [x] 4. Checkpoint — Verify core infrastructure
  - Ensure CacheLayer, AuditService, WebhookService, and APIKeyService compile and all tests pass. Ask the user if questions arise.

- [x] 5. Enterprise services (SSO, Workspaces)
  - [x] 5.1 Implement WorkspaceService (`src/lib/workspaces/workspace-service.ts`)
    - CRUD workspaces with name, description, country, data_region
    - Member management: invite, accept, remove, change role (owner/editor/viewer)
    - Switch active workspace (update user_profiles.active_workspace_id)
    - Workspace-scoped data filtering for all queries
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

  - [x] 5.2 Implement SSOService (`src/lib/auth/sso-service.ts`)
    - Configure SAML 2.0 and OIDC identity providers per workspace
    - Store metadata URL, entity ID, X.509 certificate
    - JIT provisioning: auto-create user profile on first SSO login with default role
    - Attribute mapping: email, name, group → NominaSmart role
    - Group-to-role mapping configuration
    - 10-second timeout with fallback to email/password login
    - Session revocation when user deactivated in IdP
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [ ]* 5.3 Write unit tests for WorkspaceService and SSOService
    - Test workspace CRUD, member invitation flow, role assignment
    - Test SSO attribute mapping, JIT provisioning, timeout handling
    - _Requirements: 1.1–1.7, 2.1–2.7_

- [x] 6. Collaboration services
  - [x] 6.1 Implement CollaborationEngine (`src/lib/collab/collaboration-engine.ts`)
    - Presence tracking via Supabase Realtime channels (per payroll)
    - Real-time change propagation for corrections (<500ms)
    - Last-write-wins conflict resolution with timestamp
    - Conflict notification with revert option
    - Reconnection with pending changes sync
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 6.2 Implement AnnotationService (`src/lib/collab/annotation-service.ts`)
    - CRUD annotations on cells, findings, action items, report sections
    - Thread replies with mentions (@user)
    - Resolve/unresolve annotations
    - Trigger notifications on mentions
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6_

  - [x] 6.3 Implement ActivityService (`src/lib/collab/activity-service.ts`)
    - Log activities: uploads, audits, corrections, comments, status changes, reports
    - Filter by type, user, date range
    - Group related activities (e.g., multiple corrections on same payroll)
    - Real-time updates via Supabase Realtime
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ]* 6.4 Write unit tests for collaboration services
    - Test presence tracking, conflict resolution, annotation threads, activity grouping
    - _Requirements: 11.1–11.6, 12.1–12.6, 13.1–13.5_

- [x] 7. AI agents (new)
  - [x] 7.1 Implement AnomalyDetector agent (`src/lib/ai/agents/anomaly-detector.ts`)
    - Register in AgentBus v2 as 'anomaly-detector'
    - Detect outliers, inter-period variations, suspicious rounding patterns
    - Compare current period against 6 previous periods
    - Classify anomalies: potential_fraud, systematic_error, seasonal_variation, legitimate_change
    - Confidence levels: high, medium, low
    - Natural language explanations and recommendations
    - Fallback to industry benchmarks when no historical data
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [x] 7.2 Implement PredictiveAnalytics agent (`src/lib/ai/agents/predictive-analytics.ts`)
    - Register in AgentBus v2 as 'predictive'
    - Generate 3/6/12-month cost forecasts from historical data
    - Consider: trends, regulatory changes, seasonality, headcount growth
    - Output optimistic/expected/pessimistic bands
    - Alert on >15% cost increase projections
    - Auto-recalculate on new payroll data
    - User-adjustable parameters: growth rate, salary increase, regulatory changes
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

  - [x] 7.3 Implement NLQEngine agent (`src/lib/ai/agents/nlq-engine.ts`)
    - Register in AgentBus v2 as 'nlq'
    - Translate natural language queries to data lookups on payroll data
    - Support comparative queries, aggregations, employee-level queries
    - Clarification flow for ambiguous queries
    - RBAC-scoped responses (only data user can access)
    - Show data sources used for each response
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7_

  - [x] 7.4 Implement RecommendationEngine agent (`src/lib/ai/agents/recommendation-engine.ts`)
    - Register in AgentBus v2 as 'recommender'
    - Generate up to 5 prioritized recommendations per dashboard load
    - Categories: urgent_action, optimization, informative, preventive
    - Dismiss with 30-day cooldown
    - Learn from user actions (accept/dismiss patterns)
    - Clear explanations: what, why, suggested action
    - Integration with Dianis sidebar as contextual suggestions
    - _Requirements: 39.1, 39.2, 39.3, 39.4, 39.5, 39.6_

  - [ ]* 7.5 Write unit tests for new AI agents
    - Test anomaly classification logic, forecast band generation, NLQ query parsing, recommendation prioritization
    - _Requirements: 7.1–7.6, 8.1–8.6, 9.1–9.7, 39.1–39.6_

- [x] 8. Checkpoint — Verify services and agents
  - Ensure all services (collaboration, AI agents, enterprise) compile and tests pass. Ask the user if questions arise.

- [x] 9. Reporting and compliance services
  - [x] 9.1 Implement SchedulerService (`src/lib/scheduler/scheduler-service.ts`)
    - CRUD scheduled reports: type, filters, format (Excel/PDF), recipients, cron expression
    - Execute reports on schedule with RBAC of creator
    - Execution history with status, file URL, error message
    - Retry once after 15 minutes on failure, notify creator on second failure
    - Pause/resume/delete scheduled reports
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [x] 9.2 Implement PDFExporter (`src/lib/reports/pdf-exporter.ts`)
    - Server-side PDF generation with company logo, headers, formatted tables, rendered charts, footer with date/page number
    - Table of contents for reports >5 pages
    - Locale-aware text rendering
    - Support: executive reports, comparative analysis, custom reports, audit trail exports
    - _Requirements: 28.1, 28.2, 28.3, 28.4, 28.5, 28.6_

  - [x] 9.3 Implement ReportBuilderService (`src/lib/reports/report-builder-service.ts`)
    - Execute custom reports from user-defined config (fields, metrics, filters, visualization type)
    - Predefined templates: executive summary, employee detail, period comparison, compliance, cost analysis
    - Save/share custom reports within workspace
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7_

  - [x] 9.4 Implement BenchmarkEngine (`src/lib/benchmark/benchmark-engine.ts`)
    - Aggregated anonymized metrics by industry, country, company size
    - Percentile positioning for each metric
    - Quarterly data refresh
    - Minimum 10 companies per segment before showing data
    - _Requirements: 29.1, 29.2, 29.3, 29.4, 29.5, 29.6_

  - [x] 9.5 Implement compliance services
    - Create `src/lib/compliance/gdpr-service.ts`: consent management, data export (JSON), right to be forgotten (30-day grace), ROPA, breach notification within 72h
    - Create `src/lib/compliance/data-residency-service.ts`: region selection (na/sa/eu/ap), residency verification, transfer confirmation
    - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 26.1, 26.2, 26.3, 26.4, 26.5_

  - [ ]* 9.6 Write unit tests for reporting and compliance services
    - Test scheduled report execution, PDF generation, benchmark anonymization, GDPR data export, consent logging
    - _Requirements: 5.1–5.7, 25.1–25.6, 27.1–27.7, 28.1–28.6, 29.1–29.6_

- [x] 10. Monitoring and health services
  - [x] 10.1 Implement HealthMonitor (`src/lib/monitoring/health-monitor.ts`)
    - Health checks: Supabase connectivity, Redis availability, AI provider status, disk space
    - Alert administrators on service failures
    - _Requirements: 34.2, 34.4_

  - [x] 10.2 Implement MetricsCollector (`src/lib/monitoring/metrics-collector.ts`)
    - API latency metrics (p50, p95, p99), error rates, requests/second, rate limiting usage
    - Structured JSON logging with correlation ID (X-Request-Id)
    - Web Vitals collection (LCP, FID, CLS) from frontend
    - Cache hit rate monitoring
    - _Requirements: 34.1, 34.3, 34.5, 34.6, 19.5_

  - [ ]* 10.3 Write unit tests for monitoring services
    - Test health check logic, metrics aggregation, structured log format
    - _Requirements: 34.1–34.6_

- [x] 11. Onboarding services
  - [x] 11.1 Implement GuidedTourService (`src/lib/onboarding/guided-tour-service.ts`)
    - Tour progress tracking per user per tour
    - Role-specific tours (admin, analyst, client)
    - Tour reset capability
    - Tours: main overview, audit pipeline, AI chat, reports, admin
    - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6, 30.7_

  - [x] 11.2 Implement HelpService (`src/lib/help/help-service.ts`)
    - Contextual articles by page/route
    - Search across FAQ and articles
    - Localized content (es, en, pt)
    - Video tutorial links for main flows
    - _Requirements: 31.1, 31.2, 31.3, 31.4, 31.5_

- [x] 12. Checkpoint — Verify all backend services
  - Ensure all reporting, compliance, monitoring, and onboarding services compile and tests pass. Ask the user if questions arise.

- [x] 13. API v1 routes — Enterprise and core
  - [x] 13.1 Create versioned API route structure under `src/app/api/v1/`
    - Set up API versioning with `/api/v1/` prefix
    - Implement consistent error format: `{ error, code, details?, requestId }`
    - Add `X-Request-Id` and `X-API-Version` headers to all responses
    - Add `Deprecation` and `Sunset` headers support for deprecated endpoints
    - Implement API key authentication in API guard (Bearer token)
    - _Requirements: 19.4, 19.5, 20.1, 20.2, 20.3, 20.4, 20.5, 38.3_

  - [x] 13.2 Implement workspace API routes
    - `GET/POST /api/v1/workspaces` — list and create workspaces
    - `GET/POST/DELETE /api/v1/workspaces/[id]/members` — member management
    - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6_

  - [x] 13.3 Implement audit trail API routes
    - `GET /api/v1/audit-trail` — cursor-paginated audit log with filters
    - `POST /api/v1/audit-trail/export` — export to CSV/PDF
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7_

  - [x] 13.4 Implement bulk operations API routes
    - `POST /api/v1/bulk/payrolls` — bulk operations on payrolls (export, delete, re-audit)
    - `PATCH /api/v1/bulk/actions` — bulk update action items (status, assignee, priority)
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [x] 13.5 Implement webhook API routes
    - `GET/POST /api/v1/webhooks` — CRUD webhooks
    - `POST /api/v1/webhooks/[id]/test` — send test event
    - `GET /api/v1/webhooks/[id]/deliveries` — delivery log
    - _Requirements: 6.1, 6.6, 6.7_

  - [x] 13.6 Implement API key management routes
    - `GET/POST /api/v1/api-keys` — list and create API keys
    - `POST /api/v1/api-keys/[id]/revoke` — revoke key
    - _Requirements: 38.1, 38.2, 38.4, 38.5_

  - [x] 13.7 Implement SSO settings route
    - `GET/POST /api/v1/settings/sso` — configure SSO identity provider
    - _Requirements: 1.2, 1.7_

- [x] 14. API v1 routes — AI, collaboration, reporting
  - [x] 14.1 Implement AI API routes
    - `GET /api/v1/anomalies` — anomalies for workspace
    - `GET/POST /api/v1/forecast` — cost projections
    - `POST /api/v1/nlq` — natural language query
    - `GET /api/v1/recommendations` — dashboard recommendations
    - `POST /api/v1/recommendations/[id]/dismiss` — dismiss recommendation
    - _Requirements: 7.4, 8.1, 9.1, 39.1, 39.3_

  - [x] 14.2 Implement collaboration API routes
    - `GET/POST /api/v1/annotations` — CRUD annotations
    - `POST /api/v1/annotations/[id]/replies` — thread replies
    - `PATCH /api/v1/annotations/[id]/resolve` — resolve annotation
    - `GET /api/v1/activity` — activity feed with filters
    - _Requirements: 12.1, 12.4, 12.5, 13.1, 13.2_

  - [x] 14.3 Implement reporting API routes
    - `GET/POST /api/v1/scheduled-reports` — CRUD scheduled reports
    - `PATCH/DELETE /api/v1/scheduled-reports/[id]` — pause/resume/delete
    - `POST /api/v1/scheduled-reports/[id]/execute` — manual execution
    - `POST /api/v1/compare` — comparative analysis between periods
    - `POST /api/v1/reports/build` — execute custom report
    - `GET /api/v1/reports/templates` — predefined templates
    - `GET /api/v1/reports/[id]/pdf` — download generated PDF
    - `GET /api/v1/benchmarks` — benchmarking data
    - _Requirements: 5.1, 5.6, 10.1, 27.1, 27.6, 28.4, 29.2_

  - [x] 14.4 Implement settings and compliance API routes
    - `GET/PATCH /api/v1/settings/theme` — theme preference
    - `GET/PATCH /api/v1/settings/notifications` — notification preferences
    - `GET/PATCH /api/v1/settings/data-residency` — data region
    - `POST /api/v1/gdpr/export` — export personal data (JSON)
    - `POST /api/v1/gdpr/delete` — request deletion
    - `GET/POST /api/v1/gdpr/consent` — consent management
    - `GET/PATCH /api/v1/tours/progress` — guided tour progress
    - _Requirements: 17.3, 25.1, 25.2, 25.3, 26.1, 30.4, 35.1_

  - [x] 14.5 Implement health and docs routes
    - `GET /api/v1/health` — public health check endpoint
    - `GET /api/v1/docs/openapi.json` — OpenAPI 3.1 spec generated from Zod schemas
    - `GET /api/docs` — Swagger UI / Scalar interactive docs
    - _Requirements: 19.1, 19.2, 19.3, 19.6, 34.2_

  - [ ]* 14.6 Write integration tests for critical API routes
    - Test workspace CRUD, webhook delivery, audit trail pagination, bulk operations, API key auth
    - _Requirements: 32.3_

- [x] 15. Checkpoint — Verify all API routes
  - Ensure all v1 API routes compile, return correct error format, and integration tests pass. Ask the user if questions arise.

- [x] 16. Component Library — Radix UI foundation
  - [x] 16.1 Create foundational UI components with Radix UI
    - Create `src/components/ui/` components: Button (primary/secondary/destructive/outline/ghost), Input (default/error/disabled), Select, Checkbox, Radio, Toggle, Textarea (auto-resize), Label, Badge (severity variants), Avatar (fallback initials), Tooltip, Popover
    - All components use Radix UI primitives, Slot pattern for composition, semantic theme tokens only
    - Export from barrel file `src/components/ui/index.ts`
    - _Requirements: 14.1, 14.2, 14.4, 14.5, 14.6, 17.5_

  - [x] 16.2 Create overlay and navigation UI components
    - Dialog (focus trap, escape to close), Sheet (drawer variant), DropdownMenu, CommandPalette (cmdk + Radix, Cmd+K), Toast (ephemeral notifications), Tabs, Accordion
    - _Requirements: 14.1, 14.2_

  - [x] 16.3 Create data display and feedback UI components
    - Pagination (cursor-based), Skeleton (loading placeholder), Spinner (loading indicator), Alert (info/warning/error/success), Progress Bar
    - _Requirements: 14.1_

  - [ ]* 16.4 Write unit tests for Component Library
    - Test rendering, prop handling, interactive states, keyboard navigation, ARIA attributes for each component
    - _Requirements: 14.7, 32.1_

- [x] 17. Accessibility components
  - [x] 17.1 Create accessibility components
    - `src/components/a11y/SkipToContent.tsx` — "Skip to content" link visible on Tab
    - `src/components/a11y/FocusTrap.tsx` — focus trap wrapper for modals
    - `src/components/a11y/LiveRegion.tsx` — ARIA live region for dynamic announcements
    - Implement ARIA attributes (aria-label, aria-describedby, aria-live, role) across all interactive components
    - Ensure 4.5:1 contrast ratio for normal text, 3:1 for large text in both themes
    - Visible focus indicator with high-contrast outline
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_

  - [ ]* 17.2 Write accessibility tests
    - Test keyboard navigation (Tab, Shift+Tab, Enter/Space, Escape), focus management, ARIA attributes, skip-to-content link
    - _Requirements: 15.1–15.8, 32.1_

- [x] 18. Theme engine and responsive layout
  - [x] 18.1 Implement ThemeProvider and ThemeToggle
    - `src/components/providers/ThemeProvider.tsx` — apply theme via CSS custom properties, semantic tokens (background, foreground, primary, secondary, muted, accent, destructive, border, ring)
    - `src/components/layout/ThemeToggle.tsx` — light/dark/auto selector in Header
    - Persist preference in localStorage, apply on load without flash
    - Transition all components without page reload
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [x] 18.2 Implement responsive layout components
    - `src/components/layout/MobileDrawer.tsx` — sidebar as drawer on viewport < 1024px with hamburger button
    - `src/components/ui/ResponsivePayrollEditor.tsx` — fixed columns (doc, name) + horizontal scroll on mobile
    - Dashboard: single-column layout on < 640px
    - AI Sidebar: full-screen panel on < 640px
    - Touch optimizations: 44x44px touch targets, swipe gestures, pull-to-refresh
    - 4 breakpoints: mobile (<640), tablet (640-1024), desktop (1024-1440), wide (>1440)
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.6, 16.7_

  - [x] 18.3 Implement PWA and Service Worker
    - Register Service Worker for PWA: install to home screen, static asset caching, offline page
    - Cache dashboard data, recent reports, user config for offline access
    - Offline banner with last sync date
    - Read-only mode when offline
    - Auto-sync on reconnection
    - Indicate which features work offline vs require connection
    - _Requirements: 16.5, 40.1, 40.2, 40.3, 40.4, 40.5_

- [x] 19. Checkpoint — Verify UI foundation
  - Ensure Component Library, accessibility, theme engine, responsive layout, and PWA compile and tests pass. Ask the user if questions arise.

- [x] 20. Enterprise UI components
  - [x] 20.1 Implement SSO and workspace UI
    - `src/components/admin/SSOSettings.tsx` — IdP configuration: metadata URL, entity ID, X.509 cert, group-role mapping
    - `src/components/layout/WorkspaceSelector.tsx` — dropdown in Header to switch workspaces
    - `src/components/admin/WorkspaceManager.tsx` — workspace CRUD: name, description, country, members with roles
    - `src/components/admin/WorkspaceInvite.tsx` — invitation form with direct workspace link
    - _Requirements: 1.2, 1.7, 2.2, 2.4, 2.5, 2.6_

  - [x] 20.2 Implement Audit Trail UI
    - `src/app/[locale]/admin/audit-trail/page.tsx` — chronological log with filters (type, user, dates, workspace, severity), cursor pagination
    - `src/components/admin/AuditTrailDetail.tsx` — detail modal: user, timestamp, action, before/after data, IP, user-agent
    - `src/components/admin/AuditTrailExport.tsx` — export filtered log to CSV/PDF
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.7_

  - [x] 20.3 Implement Bulk Operations UI
    - `src/components/ui/BulkActionBar.tsx` — contextual bar with bulk actions: export, delete, re-audit, change status/priority
    - `src/components/ui/BulkProgressModal.tsx` — progress bar, processed/failed counts, retry failed option
    - `src/components/ui/MultiFileUpload.tsx` — multi-file upload with sequential processing and consolidated summary
    - Confirmation dialog for destructive operations showing affected count
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [x] 21. Collaboration UI components
  - [x] 21.1 Implement real-time collaboration UI
    - `src/components/collab/PresenceIndicator.tsx` — avatars and cursors of connected users
    - `src/components/collab/ConflictNotification.tsx` — conflict alert with revert option
    - "Users editing" indicator with count and avatars in PayrollEditor
    - _Requirements: 11.1, 11.3, 11.6_

  - [x] 21.2 Implement annotation UI
    - `src/components/collab/AnnotationThread.tsx` — comment thread on cells/findings/actions
    - `src/components/collab/AnnotationBadge.tsx` — visual indicator of active annotations
    - _Requirements: 12.1, 12.4, 12.6_

  - [x] 21.3 Implement activity feed UI
    - `src/components/collab/ActivityFeed.tsx` — chronological feed with filters, grouping, real-time updates
    - `src/components/dashboard/ActivityWidget.tsx` — last 10 activities widget for dashboard
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 22. AI and dashboard UI components
  - [x] 22.1 Implement AI dashboard panels
    - `src/components/dashboard/AnomalyPanel.tsx` — anomaly panel with trends, drill-down by employee/concept
    - `src/components/dashboard/ForecastChart.tsx` — Recharts graph with confidence bands (optimistic/expected/pessimistic) + historical data
    - `src/components/dashboard/ForecastSettings.tsx` — parameter adjustment: growth rate, salary increase, regulatory changes
    - `src/components/dashboard/RecommendationCards.tsx` — up to 5 prioritized recommendations with category, explanation, action, dismiss
    - _Requirements: 7.4, 8.3, 8.6, 39.1, 39.2, 39.5_

  - [x] 22.2 Implement NLQ input
    - `src/components/ai/NLQInput.tsx` — natural language input integrated in AiSidebar with data source display
    - Support comparative queries, aggregations, clarification flow for ambiguous queries
    - _Requirements: 9.1, 9.2, 9.5, 9.7_

  - [x] 22.3 Implement customizable dashboard
    - `src/components/dashboard/DashboardGrid.tsx` — drag-and-drop widget grid with layout persistence
    - `src/components/dashboard/WidgetCatalog.tsx` — catalog of available widgets (metrics, risk trend, anomalies, forecast, activity, AI providers, scheduled reports, action items)
    - `src/components/dashboard/WidgetWrapper.tsx` — error boundary per widget
    - Preset layouts by role: executive, analyst, admin
    - Restore default layout with one click
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5, 18.6_

- [x] 23. Reporting UI components
  - [x] 23.1 Implement scheduled reports UI
    - `src/components/reports/ScheduledReportForm.tsx` — config: type, filters, format, recipients, frequency (cron)
    - `src/components/reports/ScheduledReportList.tsx` — list with pause/resume/delete actions
    - _Requirements: 5.1, 5.2, 5.6_

  - [x] 23.2 Implement comparative analysis UI
    - `src/components/reports/ComparativeView.tsx` — side-by-side view of two periods with highlighted differences (>5%), direction indicators, percentage change
    - Narrative summary of main differences using Ana agent
    - Cross-company comparison within workspace
    - Export to Excel and PDF
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6_

  - [x] 23.3 Implement Report Builder UI
    - `src/components/reports/ReportBuilder.tsx` — visual builder: field selection, metrics, filters, visualization type (table, bar, line, pie)
    - `src/components/reports/ReportBuilderCanvas.tsx` — drag-and-drop design area with real-time preview
    - Save, share, and export custom reports
    - Predefined templates: executive summary, employee detail, period comparison, compliance, cost analysis
    - _Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7_

  - [x] 23.4 Implement PDF preview and benchmark widget
    - `src/components/reports/PDFPreview.tsx` — PDF preview with generation progress indicator
    - Dashboard benchmark widget: company metrics vs industry average, percentile position
    - _Requirements: 28.4, 29.2, 29.3_

- [x] 24. Settings, webhooks, and compliance UI
  - [x] 24.1 Implement webhook settings UI
    - `src/components/settings/WebhookSettings.tsx` — CRUD webhooks: endpoint, events, HMAC secret, test delivery
    - `src/components/settings/WebhookDeliveryLog.tsx` — delivery log: status, HTTP code, response time
    - _Requirements: 6.1, 6.6, 6.7_

  - [x] 24.2 Implement notification preferences UI
    - Notification preferences page: per-event-type toggles for in-app, email, web push
    - Digest frequency: none, daily, weekly
    - Web Push API integration for browser notifications
    - Notification grouping and digest support
    - NotificationBell animation on new notification, count update without reload
    - Notification center panel: grouped by date, mark all read, filter by type
    - _Requirements: 35.1, 35.2, 35.3, 35.4, 35.5, 35.6_

  - [x] 24.3 Implement compliance and security UI
    - GDPR settings: consent management, data export button, deletion request with 30-day grace
    - Data residency: region selector with geographic indicator, transfer confirmation
    - SOC 2 readiness: security compliance panel showing control status (active/partial/pending)
    - Compliance badges (GDPR, SOC 2) on security page and footer
    - Password policy settings: min 12 chars, complexity, expiration
    - Account lockout after 5 failed attempts, auto-unlock after 30 min
    - _Requirements: 24.3, 24.4, 24.6, 25.1, 25.2, 25.3, 25.6, 26.1, 26.3, 26.5_

- [x] 25. Onboarding UI components
  - [x] 25.1 Implement guided tours
    - `src/components/onboarding/GuidedTour.tsx` — interactive tour with overlay, tooltip, advance/back/skip/cancel
    - `src/components/onboarding/TourStep.tsx` — individual step with element highlight and explanatory text
    - Auto-trigger on first access, role-specific steps
    - Tours: main overview, audit pipeline, AI chat, reports, admin
    - Reset tours option in Settings
    - _Requirements: 30.1, 30.2, 30.3, 30.4, 30.5, 30.6, 30.7_

  - [x] 25.2 Implement contextual help
    - `src/components/onboarding/ContextualTooltip.tsx` — ? icon with explanatory tooltip next to complex fields
    - `src/components/help/HelpCenter.tsx` — lateral help panel with search, FAQ, contextual articles, video links
    - `src/components/help/FeedbackWidget.tsx` — feedback widget with automatic context capture (URL, browser, role)
    - Localized content (es, en, pt)
    - _Requirements: 31.1, 31.2, 31.3, 31.4, 31.5, 31.6_

- [x] 26. Checkpoint — Verify all UI components
  - Ensure all UI components (enterprise, collaboration, AI, reporting, settings, onboarding) compile and render correctly. Ask the user if questions arise.

- [x] 27. Performance optimizations
  - [x] 27.1 Implement virtual scrolling and Web Workers
    - Virtual scrolling in PayrollEditor for planillas >100 rows (maintain 30fps)
    - Web Worker for Excel file parsing (planillas >500 rows) to avoid blocking main thread
    - _Requirements: 23.1, 23.5_

  - [x] 27.2 Implement code splitting and lazy loading
    - Code splitting by route (dynamic imports)
    - Lazy load heavy components: Recharts, PayrollEditor, Storybook, mapping editor
    - Next.js Image optimization (WebP/AVIF, lazy loading)
    - Prefetch adjacent routes with next/link
    - Progressive dashboard loading: skeletons → main metrics → charts
    - _Requirements: 23.2, 23.3, 23.4, 23.6, 23.7_

  - [ ]* 27.3 Write performance tests
    - Test virtual scrolling frame rate, lazy loading behavior, cache integration
    - _Requirements: 23.1–23.7_

- [x] 28. Internationalization extension
  - [x] 28.1 Extend i18n to 5 languages
    - Add French (fr) and German (de) message files alongside existing es, en, pt
    - Locale-aware number, currency, and date formatting (Intl.NumberFormat, Intl.DateTimeFormat)
    - Currency support: COP, MXN, PEN, CLP, BRL, ARS, USD, EUR
    - Workspace timezone support for all timestamps
    - Fallback cascade: user language → workspace language → Spanish
    - Localized transactional emails
    - _Requirements: 36.1, 36.2, 36.3, 36.4, 36.5, 36.6_

- [x] 29. Integration and wiring
  - [x] 29.1 Wire enterprise features into existing app
    - Add WorkspaceSelector to Header layout
    - Add ThemeToggle to Header
    - Integrate SSO login flow into auth callback
    - Add API key auth to existing API guard middleware
    - Wire audit trail auto-logging into all protected API routes
    - Add workspace_id filtering to all existing data queries
    - _Requirements: 1.1, 2.4, 3.6, 17.1, 38.3_

  - [x] 29.2 Wire collaboration into PayrollEditor
    - Integrate PresenceIndicator and ConflictNotification into existing PayrollEditor
    - Connect AnnotationBadge to cells and findings
    - Wire ActivityFeed into dashboard and sidebar
    - _Requirements: 11.1, 11.6, 12.6, 13.5_

  - [x] 29.3 Wire AI agents into existing AgentBus
    - Register anomaly-detector, predictive, nlq, recommender in agent registry
    - Update Dianis orchestrator to route to new agents
    - Wire AnomalyPanel, ForecastChart, RecommendationCards into dashboard
    - Wire NLQInput into AiSidebar
    - _Requirements: 7.1, 8.1, 9.1, 39.6_

  - [x] 29.4 Wire reporting features
    - Add ComparativeView to Reports page
    - Add ScheduledReportList to Reports page
    - Wire ReportBuilder as new route
    - Connect PDFExporter to all export buttons
    - Wire BenchmarkWidget into dashboard
    - _Requirements: 5.1, 10.1, 27.1, 28.1, 29.2_

  - [x] 29.5 Wire onboarding and help
    - Trigger GuidedTour on first user access
    - Add ContextualTooltip to complex fields across all pages
    - Add HelpCenter panel accessible from all pages
    - Add FeedbackWidget to all pages
    - _Requirements: 30.1, 31.1, 31.2, 31.6_

- [x] 30. Checkpoint — Verify integration
  - Ensure all features are wired together, no orphaned code, all imports resolve. Ask the user if questions arise.

- [x] 31. SDK and OpenAPI generation
  - [x] 31.1 Generate OpenAPI spec from Zod schemas
    - Auto-generate OpenAPI 3.1 spec from all Zod validation schemas
    - Serve at `/api/v1/docs/openapi.json`
    - Set up Swagger UI / Scalar at `/api/docs` (auth-protected)
    - Document all endpoints: description, params, request/response schemas, examples
    - _Requirements: 19.1, 19.2, 19.3, 19.6, 19.7_

  - [x] 31.2 Create TypeScript SDK
    - Generate typed client from OpenAPI spec covering all v1 endpoints
    - Support API key and OAuth 2.0 bearer token auth
    - Auto rate-limit handling (HTTP 429 + Retry-After)
    - Webhook signature verification helper
    - Full request/response typing from Zod schemas
    - Package as npm module with docs, examples, changelog
    - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.6, 21.7_

- [x] 32. ERP integrations extension
  - [x] 32.1 Extend integration framework
    - Add connectors: SAP SuccessFactors, Oracle HCM, Workday, ADP, Generic REST API (extend existing Siigo)
    - Step-by-step setup wizard: connector selection, credentials, field mapping, connection test
    - Scheduled sync (import) from ERP
    - Sync log: date, records imported, errors, duration
    - Partial import preservation on failure with retry from failure point
    - Export audit results back to ERP when supported
    - Documentation for custom connector creation via IntegrationConnector interface
    - _Requirements: 37.1, 37.2, 37.3, 37.4, 37.5, 37.6, 37.7_

- [ ] 33. Comprehensive test suite
  - [ ]* 33.1 Write unit tests for utility functions
    - Test: math calculations, mapping functions, file parsing, encryption/decryption, data formatting
    - _Requirements: 32.2_

  - [ ]* 33.2 Write property-based tests with fast-check
    - **Property 10: Risk score calculation — score is always between 0 and 100 for any valid input combination**
    - **Property 11: Model selection by composite score — selected model always has the highest composite score among available providers**
    - **Property 12: RBAC route filtering — filtered routes for a role are always a subset of all routes, and admin always sees all routes**
    - **Validates: Requirements 32.4**

  - [ ]* 33.3 Write tests for AI provider fallback chain
    - Test providers attempted in priority order, graceful handling of individual failures, eventual success or complete failure
    - _Requirements: 32.5_

  - [ ]* 33.4 Write tests for cache layer degradation
    - Test cache hit, cache miss, invalidation, graceful degradation when Redis unavailable
    - _Requirements: 32.7_

- [ ] 34. E2E tests with Playwright
  - [ ]* 34.1 Set up Playwright and write critical flow E2E tests
    - Login flow, full 4-step payroll upload, report viewing, action item management, AI chat
    - RBAC verification: client restricted to Dashboard/Reports, analyst blocked from admin routes
    - Collaboration: two users editing same payroll see each other's changes
    - axe-core accessibility checks on each page
    - Screenshot and video capture on failure
    - CI/CD integration: block merge on failure
    - _Requirements: 33.1, 33.2, 33.3, 33.4, 33.5, 33.6_

- [x] 35. Observability dashboard
  - [x] 35.1 Implement admin observability panel
    - Real-time API metrics display (latency, error rates, requests/sec)
    - External service status (Supabase, Redis, AI providers)
    - Cache hit rate display
    - Webhook queue status
    - _Requirements: 34.3_

- [x] 36. Final checkpoint — Ensure all tests pass
  - Run full test suite (unit, property, integration). Ensure all features are wired, no orphaned code, all requirements covered. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout implementation
- Property tests validate universal correctness properties from the design
- The implementation language is TypeScript throughout (Next.js 16 + React 19)
- All UI components use Radix UI primitives with Tailwind CSS 4 styling and semantic theme tokens
