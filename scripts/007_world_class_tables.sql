-- ============================================================
-- 007: World-Class Tables
-- Migration for NominaSmart World-Class capabilities.
-- Adds 23 new tables across 10 domains: Enterprise, AI,
-- Collaboration, Reporting, Compliance, Onboarding, etc.
--
-- Uso: Ejecutar contra la base de datos Supabase del proyecto.
--   Puede ejecutarse manualmente desde el SQL Editor de Supabase
--   o mediante el script: node scripts/run-managed.cjs
--
-- Nuevas tablas:
--   - workspaces, workspace_members, sso_configurations
--   - audit_trail_extended, webhooks, webhook_deliveries
--   - scheduled_reports, scheduled_report_runs
--   - annotations, annotation_replies, activity_log
--   - anomaly_detections, forecast_snapshots
--   - api_keys, benchmark_data
--   - guided_tour_progress, notification_preferences
--   - dashboard_layouts, recommendation_dismissals
--   - gdpr_consent_log, gdpr_deletion_requests
--   - custom_reports, report_builder_templates
--
-- Alteraciones:
--   - payroll_uploads: add workspace_id
--   - user_profiles: add active_workspace_id, theme_preference
--
-- RLS: workspace_member_access policy on all new tables
--
-- Requirements: 2.1, 3.5, 3.6, 6.4, 11.4, 12.1, 22.1,
--               26.1, 29.1, 38.2
-- ============================================================

-- ============================================================
-- 1. Workspaces — Multi-tenant workspace support
-- Req: 2.1, 2.2, 2.3
-- ============================================================
CREATE TABLE IF NOT EXISTS workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  description TEXT,
  default_country_code VARCHAR(2) NOT NULL DEFAULT 'CO',
  data_region VARCHAR(2) NOT NULL DEFAULT 'sa',
  organization_id UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS workspace_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  joined_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ DEFAULT now(),
  invite_status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (invite_status IN ('pending', 'accepted', 'expired')),
  UNIQUE(workspace_id, user_id)
);

-- ============================================================
-- 2. SSO Configurations — SAML/OIDC identity provider config
-- Req: 1.1, 1.2, 1.7
-- ============================================================
CREATE TABLE IF NOT EXISTS sso_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  protocol VARCHAR(4) NOT NULL CHECK (protocol IN ('saml', 'oidc')),
  metadata_url TEXT NOT NULL,
  entity_id VARCHAR(500),
  certificate_x509 TEXT,
  group_role_mapping JSONB DEFAULT '{}',
  default_role VARCHAR(10) NOT NULL DEFAULT 'client',
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(workspace_id)
);

-- ============================================================
-- 3. Audit Trail Extended — Full audit log with before/after
-- Req: 3.1, 3.5, 3.6
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_trail_extended (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES workspaces(id),
  user_id UUID REFERENCES user_profiles(id),
  action_type VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id UUID,
  data_before JSONB,
  data_after JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  severity VARCHAR(10) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_trail_workspace_created
  ON audit_trail_extended(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_trail_action_type
  ON audit_trail_extended(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user
  ON audit_trail_extended(user_id);

-- ============================================================
-- 4. Webhooks — HTTP callback registrations + delivery log
-- Req: 6.1, 6.4, 6.6
-- ============================================================
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  url VARCHAR(500) NOT NULL,
  secret_encrypted TEXT NOT NULL,
  events VARCHAR(50)[] NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('success', 'failed', 'pending')),
  http_status INT,
  response_time_ms INT,
  attempts INT DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  payload_summary JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 5. Scheduled Reports — Automated report generation
-- Req: 5.1, 5.2, 5.4
-- ============================================================
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  name VARCHAR(200) NOT NULL,
  report_type VARCHAR(20) NOT NULL,
  filters JSONB DEFAULT '{}',
  output_format VARCHAR(5) NOT NULL DEFAULT 'pdf',
  recipients VARCHAR(255)[] NOT NULL,
  cron_expression VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS scheduled_report_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_report_id UUID NOT NULL REFERENCES scheduled_reports(id) ON DELETE CASCADE,
  status VARCHAR(10) NOT NULL CHECK (status IN ('success', 'failed')),
  file_url TEXT,
  error_message TEXT,
  executed_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 6. Annotations — Comments on cells, findings, actions
-- Req: 12.1, 12.2, 12.4
-- ============================================================
CREATE TABLE IF NOT EXISTS annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES user_profiles(id),
  target_type VARCHAR(20) NOT NULL CHECK (target_type IN ('cell', 'finding', 'action_item', 'report_section')),
  target_id UUID NOT NULL,
  target_metadata JSONB,
  content TEXT NOT NULL,
  mentions UUID[],
  is_resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS annotation_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  annotation_id UUID NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES user_profiles(id),
  content TEXT NOT NULL,
  mentions UUID[],
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 7. Activity Log — Workspace activity feed
-- Req: 13.1, 13.4
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  activity_type VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id UUID,
  metadata JSONB,
  group_key VARCHAR(200),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activity_workspace_created
  ON activity_log(workspace_id, created_at DESC);

-- ============================================================
-- 8. Anomaly Detections — AI-detected payroll anomalies
-- Req: 7.1, 7.3
-- ============================================================
CREATE TABLE IF NOT EXISTS anomaly_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id UUID NOT NULL REFERENCES payroll_uploads(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  employee_doc VARCHAR(50),
  category VARCHAR(30) NOT NULL CHECK (category IN ('potential_fraud', 'systematic_error', 'seasonal_variation', 'legitimate_change')),
  confidence VARCHAR(10) NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  description TEXT NOT NULL,
  recommendation TEXT,
  data_points JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 9. Forecast Snapshots — Predictive cost projections
-- Req: 8.1, 8.3
-- ============================================================
CREATE TABLE IF NOT EXISTS forecast_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  company_id UUID NOT NULL REFERENCES companies(id),
  country_code VARCHAR(2) NOT NULL,
  projections JSONB NOT NULL,
  parameters JSONB,
  generated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 10. API Keys — Developer API key management
-- Req: 38.1, 38.2
-- ============================================================
CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  name VARCHAR(100) NOT NULL,
  key_hash VARCHAR(64) NOT NULL,
  key_prefix VARCHAR(8) NOT NULL,
  permissions VARCHAR(10)[] NOT NULL,
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  is_revoked BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);

-- ============================================================
-- 11. Benchmark Data — Industry comparison metrics
-- Req: 29.1, 29.4
-- ============================================================
CREATE TABLE IF NOT EXISTS benchmark_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  industry VARCHAR(100) NOT NULL,
  country_code VARCHAR(2) NOT NULL,
  company_size VARCHAR(15) NOT NULL CHECK (company_size IN ('small', 'medium', 'large', 'enterprise')),
  period_year INT NOT NULL,
  period_quarter INT NOT NULL CHECK (period_quarter BETWEEN 1 AND 4),
  avg_cost_per_employee DECIMAL(12,2),
  avg_contribution_ratio DECIMAL(5,4),
  avg_risk_score DECIMAL(5,2),
  sample_count INT NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(industry, country_code, company_size, period_year, period_quarter)
);

-- ============================================================
-- 12. Guided Tour Progress — Onboarding tour tracking
-- Req: 30.1, 30.4
-- ============================================================
CREATE TABLE IF NOT EXISTS guided_tour_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  tour_id VARCHAR(50) NOT NULL,
  completed_steps INT DEFAULT 0,
  total_steps INT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  is_dismissed BOOLEAN DEFAULT false,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(user_id, tour_id)
);

-- ============================================================
-- 13. Notification Preferences — Per-event notification config
-- Req: 35.1
-- ============================================================
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  in_app BOOLEAN DEFAULT true,
  email BOOLEAN DEFAULT true,
  web_push BOOLEAN DEFAULT false,
  digest_frequency VARCHAR(10) DEFAULT 'none' CHECK (digest_frequency IN ('none', 'daily', 'weekly')),
  UNIQUE(user_id, event_type)
);

-- ============================================================
-- 14. Dashboard Layouts — Customizable widget layouts
-- Req: 18.1, 18.3
-- ============================================================
CREATE TABLE IF NOT EXISTS dashboard_layouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  widget_config JSONB NOT NULL DEFAULT '[]',
  preset VARCHAR(15) DEFAULT 'custom' CHECK (preset IN ('executive', 'analyst', 'admin', 'custom')),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, workspace_id)
);

-- ============================================================
-- 15. Recommendation Dismissals — Track dismissed suggestions
-- Req: 39.3
-- ============================================================
CREATE TABLE IF NOT EXISTS recommendation_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  recommendation_type VARCHAR(50) NOT NULL,
  recommendation_key VARCHAR(200) NOT NULL,
  dismissed_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- ============================================================
-- 16. GDPR — Consent log and deletion requests
-- Req: 25.1, 25.3, 26.1
-- ============================================================
CREATE TABLE IF NOT EXISTS gdpr_consent_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  consent_type VARCHAR(30) NOT NULL,
  policy_version VARCHAR(20) NOT NULL,
  method VARCHAR(30) NOT NULL,
  granted BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS gdpr_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id),
  status VARCHAR(15) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'cancelled')),
  requested_at TIMESTAMPTZ DEFAULT now(),
  grace_period_ends_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ
);

-- ============================================================
-- 17. Custom Reports & Templates — Report builder storage
-- Req: 27.1, 27.6
-- ============================================================
CREATE TABLE IF NOT EXISTS custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES user_profiles(id),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  report_config JSONB NOT NULL,
  is_shared BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_builder_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  default_config JSONB NOT NULL,
  category VARCHAR(50)
);

-- ============================================================
-- 18. ALTER existing tables — Add workspace and theme support
-- ============================================================
ALTER TABLE payroll_uploads
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES workspaces(id);

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS active_workspace_id UUID REFERENCES workspaces(id);

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(10) DEFAULT 'auto'
    CHECK (theme_preference IN ('light', 'dark', 'auto'));

-- ============================================================
-- 19. Row Level Security — Enable RLS on all new tables
-- ============================================================
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sso_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_trail_extended ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE annotation_replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE anomaly_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE forecast_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE benchmark_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE guided_tour_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE dashboard_layouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_dismissals ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_consent_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE gdpr_deletion_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_builder_templates ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 20. RLS Policies — Workspace-scoped access
-- Users can only access data from workspaces they belong to.
-- ============================================================

-- Helper: check if current user is a member of a workspace
CREATE OR REPLACE FUNCTION is_workspace_member(ws_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- workspaces: members can see their workspaces
DROP POLICY IF EXISTS "workspace_member_access" ON workspaces;
CREATE POLICY "workspace_member_access" ON workspaces
  FOR ALL USING (
    id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid())
  );

-- workspace_members: members can see co-members
DROP POLICY IF EXISTS "workspace_member_access" ON workspace_members;
CREATE POLICY "workspace_member_access" ON workspace_members
  FOR ALL USING (is_workspace_member(workspace_id));

-- sso_configurations
DROP POLICY IF EXISTS "workspace_member_access" ON sso_configurations;
CREATE POLICY "workspace_member_access" ON sso_configurations
  FOR ALL USING (is_workspace_member(workspace_id));

-- audit_trail_extended
DROP POLICY IF EXISTS "workspace_member_access" ON audit_trail_extended;
CREATE POLICY "workspace_member_access" ON audit_trail_extended
  FOR ALL USING (is_workspace_member(workspace_id));

-- webhooks
DROP POLICY IF EXISTS "workspace_member_access" ON webhooks;
CREATE POLICY "workspace_member_access" ON webhooks
  FOR ALL USING (is_workspace_member(workspace_id));

-- webhook_deliveries: access via parent webhook
DROP POLICY IF EXISTS "workspace_member_access" ON webhook_deliveries;
CREATE POLICY "workspace_member_access" ON webhook_deliveries
  FOR ALL USING (
    webhook_id IN (
      SELECT id FROM webhooks WHERE is_workspace_member(workspace_id)
    )
  );

-- scheduled_reports
DROP POLICY IF EXISTS "workspace_member_access" ON scheduled_reports;
CREATE POLICY "workspace_member_access" ON scheduled_reports
  FOR ALL USING (is_workspace_member(workspace_id));

-- scheduled_report_runs: access via parent report
DROP POLICY IF EXISTS "workspace_member_access" ON scheduled_report_runs;
CREATE POLICY "workspace_member_access" ON scheduled_report_runs
  FOR ALL USING (
    scheduled_report_id IN (
      SELECT id FROM scheduled_reports WHERE is_workspace_member(workspace_id)
    )
  );

-- annotations
DROP POLICY IF EXISTS "workspace_member_access" ON annotations;
CREATE POLICY "workspace_member_access" ON annotations
  FOR ALL USING (is_workspace_member(workspace_id));

-- annotation_replies: access via parent annotation
DROP POLICY IF EXISTS "workspace_member_access" ON annotation_replies;
CREATE POLICY "workspace_member_access" ON annotation_replies
  FOR ALL USING (
    annotation_id IN (
      SELECT id FROM annotations WHERE is_workspace_member(workspace_id)
    )
  );

-- activity_log
DROP POLICY IF EXISTS "workspace_member_access" ON activity_log;
CREATE POLICY "workspace_member_access" ON activity_log
  FOR ALL USING (is_workspace_member(workspace_id));

-- anomaly_detections
DROP POLICY IF EXISTS "workspace_member_access" ON anomaly_detections;
CREATE POLICY "workspace_member_access" ON anomaly_detections
  FOR ALL USING (is_workspace_member(workspace_id));

-- forecast_snapshots
DROP POLICY IF EXISTS "workspace_member_access" ON forecast_snapshots;
CREATE POLICY "workspace_member_access" ON forecast_snapshots
  FOR ALL USING (is_workspace_member(workspace_id));

-- api_keys
DROP POLICY IF EXISTS "workspace_member_access" ON api_keys;
CREATE POLICY "workspace_member_access" ON api_keys
  FOR ALL USING (is_workspace_member(workspace_id));

-- benchmark_data: public read for authenticated users
DROP POLICY IF EXISTS "authenticated_read" ON benchmark_data;
CREATE POLICY "authenticated_read" ON benchmark_data
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- guided_tour_progress: user-scoped
DROP POLICY IF EXISTS "user_own_access" ON guided_tour_progress;
CREATE POLICY "user_own_access" ON guided_tour_progress
  FOR ALL USING (user_id = auth.uid());

-- notification_preferences: user-scoped
DROP POLICY IF EXISTS "user_own_access" ON notification_preferences;
CREATE POLICY "user_own_access" ON notification_preferences
  FOR ALL USING (user_id = auth.uid());

-- dashboard_layouts: user-scoped within workspace
DROP POLICY IF EXISTS "user_own_access" ON dashboard_layouts;
CREATE POLICY "user_own_access" ON dashboard_layouts
  FOR ALL USING (user_id = auth.uid() AND is_workspace_member(workspace_id));

-- recommendation_dismissals: user-scoped
DROP POLICY IF EXISTS "user_own_access" ON recommendation_dismissals;
CREATE POLICY "user_own_access" ON recommendation_dismissals
  FOR ALL USING (user_id = auth.uid());

-- gdpr_consent_log: user-scoped
DROP POLICY IF EXISTS "user_own_access" ON gdpr_consent_log;
CREATE POLICY "user_own_access" ON gdpr_consent_log
  FOR ALL USING (user_id = auth.uid());

-- gdpr_deletion_requests: user-scoped
DROP POLICY IF EXISTS "user_own_access" ON gdpr_deletion_requests;
CREATE POLICY "user_own_access" ON gdpr_deletion_requests
  FOR ALL USING (user_id = auth.uid());

-- custom_reports
DROP POLICY IF EXISTS "workspace_member_access" ON custom_reports;
CREATE POLICY "workspace_member_access" ON custom_reports
  FOR ALL USING (is_workspace_member(workspace_id));

-- report_builder_templates: public read for authenticated users
DROP POLICY IF EXISTS "authenticated_read" ON report_builder_templates;
CREATE POLICY "authenticated_read" ON report_builder_templates
  FOR SELECT USING (auth.uid() IS NOT NULL);
