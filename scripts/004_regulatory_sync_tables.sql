-- ============================================================
-- 004: Regulatory Sync Tables
-- Migración para el sistema de sincronización regulatoria automática.
--
-- Uso: Ejecutar contra la base de datos Supabase del proyecto.
--   Puede ejecutarse manualmente desde el SQL Editor de Supabase
--   o mediante el script: node scripts/run-managed.cjs
--
-- Nuevas tablas:
--   - sync_history:    Historial de ejecuciones de sincronización por país
--   - rule_audit_log:  Registro de auditoría de cambios en reglas (retención 5 años)
--   - notifications:   Notificaciones in-app para administradores
--   - email_log:       Registro de correos enviados vía Resend
--
-- Alteraciones:
--   - country_year_rules: columna `status` (draft|pending_review|approved|rejected)
--   - user_profiles: columnas `invitation_status`, `preferred_locale`, `alert_countries`
--
-- Relaciones:
--   - sync_history.country_code → supported_countries.country_code
--   - rule_audit_log.rule_id → country_year_rules.id (CASCADE)
--   - rule_audit_log.user_id → auth.users.id (SET NULL)
--   - notifications.user_id → auth.users.id (CASCADE)
--
-- Políticas RLS: Permisivas (allow all) para todas las tablas nuevas.
-- ============================================================

-- ============================================================
-- 1. New Table: sync_history
-- Tracks each automatic/manual sync execution per country.
-- Req: 1.3, 1.5
-- ============================================================
CREATE TABLE IF NOT EXISTS sync_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code VARCHAR(5) NOT NULL REFERENCES supported_countries(country_code),
    rule_year INT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress',  -- in_progress, completed, failed
    trigger_type VARCHAR(20) NOT NULL DEFAULT 'automatic', -- automatic, manual
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ,
    changes_detected INT DEFAULT 0,
    confidence VARCHAR(10),  -- high, medium, low
    error_message TEXT,
    retry_count INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sync_history_country ON sync_history(country_code, rule_year);
CREATE INDEX IF NOT EXISTS idx_sync_history_status ON sync_history(status);

-- ============================================================
-- 2. New Table: rule_audit_log
-- Audit trail for every change to country_year_rules.
-- Retention: minimum 5 years.
-- Req: 6.1
-- ============================================================
CREATE TABLE IF NOT EXISTS rule_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id UUID NOT NULL REFERENCES country_year_rules(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL,  -- created, updated, approved, rejected
    origin VARCHAR(20) NOT NULL,  -- automatic, manual
    previous_values JSONB,
    new_values JSONB NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    source_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rule_audit_log_rule ON rule_audit_log(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_audit_log_created ON rule_audit_log(created_at);

-- ============================================================
-- 3. New Table: notifications
-- In-app notifications for administrators.
-- Req: 5.1
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,  -- regulatory_change, sync_completed, rule_pending_review
    severity VARCHAR(20) NOT NULL DEFAULT 'info',  -- info, warning, critical
    title VARCHAR(255) NOT NULL,
    body TEXT,
    metadata JSONB DEFAULT '{}',
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);

-- ============================================================
-- 4. New Table: email_log
-- Record of all emails sent via Resend.
-- Req: 8.3
-- ============================================================
CREATE TABLE IF NOT EXISTS email_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resend_message_id VARCHAR(100),
    to_email VARCHAR(255) NOT NULL,
    email_type VARCHAR(50) NOT NULL,  -- user_invitation, regulatory_alert, weekly_summary
    status VARCHAR(20) NOT NULL DEFAULT 'pending',  -- pending, sent, failed, bounced
    error_message TEXT,
    retry_count INT DEFAULT 0,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_log_status ON email_log(status);
CREATE INDEX IF NOT EXISTS idx_email_log_type ON email_log(email_type);

-- ============================================================
-- 5. ALTER country_year_rules — Add status column
-- Values: draft, pending_review, approved, rejected
-- Req: 3.1, 3.2
-- ============================================================
ALTER TABLE country_year_rules
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'approved';

CREATE INDEX IF NOT EXISTS idx_country_year_rules_status ON country_year_rules(status);

-- ============================================================
-- 6. ALTER user_profiles — Add invitation and preference columns
-- Req: 7.1
-- ============================================================
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS invitation_status VARCHAR(20) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS preferred_locale VARCHAR(5) DEFAULT 'es',
ADD COLUMN IF NOT EXISTS alert_countries TEXT[] DEFAULT '{}';

-- ============================================================
-- 7. Row Level Security — Permissive policies for new tables
-- ============================================================

-- sync_history RLS
ALTER TABLE sync_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access" ON sync_history;
CREATE POLICY "Allow all access" ON sync_history
  FOR ALL USING (true) WITH CHECK (true);

-- rule_audit_log RLS
ALTER TABLE rule_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access" ON rule_audit_log;
CREATE POLICY "Allow all access" ON rule_audit_log
  FOR ALL USING (true) WITH CHECK (true);

-- notifications RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access" ON notifications;
CREATE POLICY "Allow all access" ON notifications
  FOR ALL USING (true) WITH CHECK (true);

-- email_log RLS
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access" ON email_log;
CREATE POLICY "Allow all access" ON email_log
  FOR ALL USING (true) WITH CHECK (true);
