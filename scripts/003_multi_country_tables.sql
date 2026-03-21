-- ============================================================
-- 003: Multi-Country Support Tables
-- Supported countries, task pricing, infrastructure costs,
-- provider token rates, applied corrections, agent communications,
-- and research sources.
-- ============================================================

-- 1. Supported Countries
CREATE TABLE IF NOT EXISTS supported_countries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code VARCHAR(5) NOT NULL UNIQUE,
    country_name VARCHAR(100) NOT NULL,
    currency_code VARCHAR(3) NOT NULL,
    currency_symbol VARCHAR(10) NOT NULL,
    locale_format VARCHAR(10) NOT NULL,
    decimal_separator VARCHAR(1) NOT NULL DEFAULT '.',
    thousands_separator VARCHAR(1) NOT NULL DEFAULT ',',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Task Pricing
CREATE TABLE IF NOT EXISTS task_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_type VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    price_per_execution DECIMAL NOT NULL DEFAULT 0,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Infrastructure Costs
CREATE TABLE IF NOT EXISTS infrastructure_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cost_type VARCHAR(100) NOT NULL,
    description TEXT,
    monthly_cost DECIMAL NOT NULL DEFAULT 0,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- 4. Provider Token Rates
CREATE TABLE IF NOT EXISTS provider_token_rates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_type VARCHAR(50) NOT NULL,
    model_id VARCHAR(100) NOT NULL,
    cost_per_1k_input_tokens DECIMAL(10,6) NOT NULL DEFAULT 0,
    cost_per_1k_output_tokens DECIMAL(10,6) NOT NULL DEFAULT 0,
    currency_code VARCHAR(3) NOT NULL DEFAULT 'USD',
    effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(provider_type, model_id, effective_date)
);

-- 5. Applied Corrections
CREATE TABLE IF NOT EXISTS applied_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_upload_id UUID REFERENCES payroll_uploads(id) ON DELETE CASCADE,
    row_index INT NOT NULL,
    field_name VARCHAR(100) NOT NULL,
    value_before TEXT,
    value_after TEXT,
    formula_applied TEXT,
    approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    revalidation_result VARCHAR(20) NOT NULL DEFAULT 'pending',
    batch_id UUID
);

-- 6. Agent Communications
CREATE TABLE IF NOT EXISTS agent_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID,
    from_agent VARCHAR(50) NOT NULL,
    to_agent VARCHAR(50) NOT NULL,
    query_type VARCHAR(50),
    payload JSONB,
    result JSONB,
    tokens_used INT DEFAULT 0,
    latency_ms INT DEFAULT 0,
    depth INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Research Sources
CREATE TABLE IF NOT EXISTS research_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code VARCHAR(5) NOT NULL,
    rule_year INT NOT NULL,
    source_url TEXT,
    source_title VARCHAR(255),
    confidence VARCHAR(10) DEFAULT 'medium',
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    country_year_rule_id UUID REFERENCES country_year_rules(id) ON DELETE CASCADE
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_supported_countries_code ON supported_countries(country_code);
CREATE INDEX IF NOT EXISTS idx_supported_countries_active ON supported_countries(is_active);
CREATE INDEX IF NOT EXISTS idx_task_pricing_type ON task_pricing(task_type);
CREATE INDEX IF NOT EXISTS idx_provider_token_rates_lookup ON provider_token_rates(provider_type, model_id, effective_date);
CREATE INDEX IF NOT EXISTS idx_applied_corrections_payroll ON applied_corrections(payroll_upload_id);
CREATE INDEX IF NOT EXISTS idx_applied_corrections_batch ON applied_corrections(batch_id);
CREATE INDEX IF NOT EXISTS idx_agent_communications_session ON agent_communications(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_communications_agents ON agent_communications(from_agent, to_agent);
CREATE INDEX IF NOT EXISTS idx_research_sources_country ON research_sources(country_code, rule_year);

-- ============================================================
-- Initial Data: Supported Countries
-- ============================================================
INSERT INTO supported_countries (country_code, country_name, currency_code, currency_symbol, locale_format, decimal_separator, thousands_separator, is_active)
VALUES
    ('CO', 'Colombia',        'COP', '$',  'es-CO', ',', '.', true),
    ('MX', 'México',          'MXN', '$',  'es-MX', '.', ',', true),
    ('PE', 'Perú',            'PEN', 'S/', 'es-PE', '.', ',', true),
    ('CL', 'Chile',           'CLP', '$',  'es-CL', ',', '.', true),
    ('BR', 'Brasil',          'BRL', 'R$', 'pt-BR', ',', '.', true),
    ('AR', 'Argentina',       'ARS', '$',  'es-AR', ',', '.', true),
    ('US', 'Estados Unidos',  'USD', '$',  'en-US', '.', ',', true)
ON CONFLICT (country_code) DO NOTHING;

-- ============================================================
-- Updated_at trigger for supported_countries
-- ============================================================
CREATE OR REPLACE FUNCTION update_supported_countries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_supported_countries_updated_at ON supported_countries;
CREATE TRIGGER trg_supported_countries_updated_at
    BEFORE UPDATE ON supported_countries
    FOR EACH ROW
    EXECUTE FUNCTION update_supported_countries_updated_at();

-- Updated_at trigger for task_pricing
CREATE OR REPLACE FUNCTION update_task_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_task_pricing_updated_at ON task_pricing;
CREATE TRIGGER trg_task_pricing_updated_at
    BEFORE UPDATE ON task_pricing
    FOR EACH ROW
    EXECUTE FUNCTION update_task_pricing_updated_at();