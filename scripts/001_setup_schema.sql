-- NominaSmart Database Schema Setup
-- This script initializes all required tables for the payroll application

-- 1. Create Data Tables

-- Table: companies
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    nit VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    industry VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: employees
CREATE TABLE IF NOT EXISTS public.employees (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    document_type VARCHAR(10) NOT NULL,
    document_number VARCHAR(50) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    current_salary DECIMAL(15, 2) NOT NULL,
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(company_id, document_type, document_number)
);

-- Table: audits
CREATE TABLE IF NOT EXISTS public.audits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    period_month INT NOT NULL,
    period_year INT NOT NULL,
    global_risk_score DECIMAL(5, 2),
    total_deviations_value DECIMAL(15, 2),
    status VARCHAR(50) DEFAULT 'IN_PROGRESS',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: reconciliation_records
CREATE TABLE IF NOT EXISTS public.reconciliation_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    audit_id UUID REFERENCES public.audits(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    internal_base_salary DECIMAL(15, 2),
    internal_non_salary_payments DECIMAL(15, 2),
    calc_ibc_standard DECIMAL(15, 2),
    calc_ibc_health DECIMAL(15, 2),
    calc_ibc_pension DECIMAL(15, 2),
    calc_ibc_arl DECIMAL(15, 2),
    pila_reported_ibc DECIMAL(15, 2),
    has_discrepancy BOOLEAN DEFAULT false,
    discrepancy_amount DECIMAL(15, 2),
    law_1393_violation BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: country_year_rules
CREATE TABLE IF NOT EXISTS public.country_year_rules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    country_code VARCHAR(10) NOT NULL,
    rule_year INT NOT NULL,
    label VARCHAR(120) NOT NULL,
    required_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    required_calculations JSONB NOT NULL DEFAULT '[]'::jsonb,
    checks JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(country_code, rule_year)
);

-- Table: payroll_uploads
CREATE TABLE IF NOT EXISTS public.payroll_uploads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    country_code VARCHAR(10) NOT NULL DEFAULT 'CO',
    period_year INT NOT NULL,
    period_month INT NOT NULL,
    rule_label VARCHAR(100),
    certification_ready BOOLEAN NOT NULL DEFAULT false,
    file_count INT NOT NULL,
    mapped_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    mapping_relations JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_required_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
    missing_required_calculations JSONB NOT NULL DEFAULT '[]'::jsonb,
    sheet_summary JSONB NOT NULL DEFAULT '[]'::jsonb,
    detected_variables JSONB NOT NULL DEFAULT '[]'::jsonb,
    concept_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    risk_report JSONB NOT NULL DEFAULT '{}'::jsonb,
    employee_risk_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
    calculation_validation_report JSONB NOT NULL DEFAULT '{}'::jsonb,
    ai_validation_report JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: payroll_action_items
CREATE TABLE IF NOT EXISTS public.payroll_action_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payroll_id UUID REFERENCES public.payroll_uploads(id) ON DELETE CASCADE,
    employee_document VARCHAR(80) NOT NULL,
    employee_name VARCHAR(255) NOT NULL,
    priority VARCHAR(20) NOT NULL,
    area VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    recommended_fix TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open',
    assigned_to VARCHAR(120),
    resolution_note TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(payroll_id, employee_document, title)
);

-- 2. Setup Row Level Security (RLS)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_year_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_action_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies (permissive for now - in production, restrict by auth.uid())
DROP POLICY IF EXISTS "Allow all access" ON public.companies;
CREATE POLICY "Allow all access" ON public.companies FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access" ON public.employees;
CREATE POLICY "Allow all access" ON public.employees FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access" ON public.audits;
CREATE POLICY "Allow all access" ON public.audits FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access" ON public.reconciliation_records;
CREATE POLICY "Allow all access" ON public.reconciliation_records FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access" ON public.country_year_rules;
CREATE POLICY "Allow all access" ON public.country_year_rules FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access" ON public.payroll_uploads;
CREATE POLICY "Allow all access" ON public.payroll_uploads FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access" ON public.payroll_action_items;
CREATE POLICY "Allow all access" ON public.payroll_action_items FOR ALL USING (true) WITH CHECK (true);

-- 3. Seed default data

-- Demo company
INSERT INTO public.companies (id, nit, name, industry)
VALUES ('00000000-0000-0000-0000-000000000001', '900123456-7', 'TechCorp Colombia S.A.S.', 'Technology')
ON CONFLICT (nit) DO NOTHING;

-- Country rules for Colombia 2025 and 2026
INSERT INTO public.country_year_rules (country_code, rule_year, label, required_fields, required_calculations, checks)
VALUES
    (
        'CO', 2025, 'UGPP Colombia 2025',
        '["document_number","first_name","last_name","base_salary","non_salary_payments","worked_days","contributor_type"]'::jsonb,
        '["ibc_total","ibc_salud","ibc_pension","ibc_arl","tope_40_no_salarial"]'::jsonb,
        '["SMMLV 2025: $1.423.500","Auxilio de transporte 2025: $200.000","Ley 1393: limite 40% no salarial"]'::jsonb
    ),
    (
        'CO', 2026, 'UGPP Colombia 2026',
        '["document_number","first_name","last_name","base_salary","non_salary_payments","worked_days","contributor_type"]'::jsonb,
        '["ibc_total","ibc_salud","ibc_pension","ibc_arl","tope_40_no_salarial"]'::jsonb,
        '["SMMLV 2026: $1.750.905","Auxilio de transporte 2026: $249.095","Ley 1393: limite 40% no salarial"]'::jsonb
    )
ON CONFLICT (country_code, rule_year) DO UPDATE SET
    label = EXCLUDED.label,
    required_fields = EXCLUDED.required_fields,
    required_calculations = EXCLUDED.required_calculations,
    checks = EXCLUDED.checks,
    updated_at = NOW();
