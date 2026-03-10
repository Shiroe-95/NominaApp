-- NóminaSmart Initialization Schema
-- Run this full script in the Supabase SQL Editor to configure tables and security policies.

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
-- Stores runs of reconciliation batches
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
-- The output of the Triple Match engine
CREATE TABLE IF NOT EXISTS public.reconciliation_records (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    audit_id UUID REFERENCES public.audits(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES public.employees(id) ON DELETE CASCADE,
    
    -- Conceptual values
    internal_base_salary DECIMAL(15, 2),
    internal_non_salary_payments DECIMAL(15, 2),
    
    calc_ibc_standard DECIMAL(15, 2),
    calc_ibc_health DECIMAL(15, 2),
    calc_ibc_pension DECIMAL(15, 2),
    calc_ibc_arl DECIMAL(15, 2),
    
    -- Submissions
    pila_reported_ibc DECIMAL(15, 2),
    
    -- Discrepancies
    has_discrepancy BOOLEAN DEFAULT false,
    discrepancy_amount DECIMAL(15, 2),
    law_1393_violation BOOLEAN DEFAULT false,
    
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table: country_year_rules
-- Rule engine configuration by country and fiscal year
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
-- Stores uploaded payroll batches associated with company + rule context
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

-- Add missing columns if upgrading from an older schema
ALTER TABLE public.payroll_uploads ADD COLUMN IF NOT EXISTS sheet_summary JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.payroll_uploads ADD COLUMN IF NOT EXISTS detected_variables JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.payroll_uploads ADD COLUMN IF NOT EXISTS mapping_relations JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.payroll_uploads ADD COLUMN IF NOT EXISTS calculation_validation_report JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.payroll_uploads ADD COLUMN IF NOT EXISTS ai_validation_report JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Table: payroll_action_items
-- Action queue for payroll findings (assign/resolve workflow)
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
-- Enables policies so users only see their own company's data.

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reconciliation_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.country_year_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_action_items ENABLE ROW LEVEL SECURITY;

-- Open policies for all operations (service role bypasses these; anon key respects them).
-- In production, replace USING (true) with auth.uid()-based checks.

DROP POLICY IF EXISTS "Allow read access to all users" ON public.companies;
DROP POLICY IF EXISTS "Allow write access to all users" ON public.companies;
DROP POLICY IF EXISTS "Allow update access to all users" ON public.companies;
DROP POLICY IF EXISTS "Allow delete access to all users" ON public.companies;
CREATE POLICY "Allow read access to all users" ON public.companies FOR SELECT USING (true);
CREATE POLICY "Allow write access to all users" ON public.companies FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update access to all users" ON public.companies FOR UPDATE USING (true);
CREATE POLICY "Allow delete access to all users" ON public.companies FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow read access to all users" ON public.employees;
DROP POLICY IF EXISTS "Allow write access to all users" ON public.employees;
DROP POLICY IF EXISTS "Allow update access to all users" ON public.employees;
CREATE POLICY "Allow read access to all users" ON public.employees FOR SELECT USING (true);
CREATE POLICY "Allow write access to all users" ON public.employees FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update access to all users" ON public.employees FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow read access to all users" ON public.audits;
DROP POLICY IF EXISTS "Allow write access to all users" ON public.audits;
DROP POLICY IF EXISTS "Allow update access to all users" ON public.audits;
CREATE POLICY "Allow read access to all users" ON public.audits FOR SELECT USING (true);
CREATE POLICY "Allow write access to all users" ON public.audits FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update access to all users" ON public.audits FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Allow read access to all users" ON public.reconciliation_records;
DROP POLICY IF EXISTS "Allow write access to all users" ON public.reconciliation_records;
CREATE POLICY "Allow read access to all users" ON public.reconciliation_records FOR SELECT USING (true);
CREATE POLICY "Allow write access to all users" ON public.reconciliation_records FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read access to all users" ON public.country_year_rules;
DROP POLICY IF EXISTS "Allow write access to all users" ON public.country_year_rules;
DROP POLICY IF EXISTS "Allow update access to all users" ON public.country_year_rules;
DROP POLICY IF EXISTS "Allow delete access to all users" ON public.country_year_rules;
CREATE POLICY "Allow read access to all users" ON public.country_year_rules FOR SELECT USING (true);
CREATE POLICY "Allow write access to all users" ON public.country_year_rules FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update access to all users" ON public.country_year_rules FOR UPDATE USING (true);
CREATE POLICY "Allow delete access to all users" ON public.country_year_rules FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow read access to all users" ON public.payroll_uploads;
DROP POLICY IF EXISTS "Allow write access to all users" ON public.payroll_uploads;
DROP POLICY IF EXISTS "Allow update access to all users" ON public.payroll_uploads;
DROP POLICY IF EXISTS "Allow delete access to all users" ON public.payroll_uploads;
CREATE POLICY "Allow read access to all users" ON public.payroll_uploads FOR SELECT USING (true);
CREATE POLICY "Allow write access to all users" ON public.payroll_uploads FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update access to all users" ON public.payroll_uploads FOR UPDATE USING (true);
CREATE POLICY "Allow delete access to all users" ON public.payroll_uploads FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow read access to all users" ON public.payroll_action_items;
DROP POLICY IF EXISTS "Allow write access to all users" ON public.payroll_action_items;
DROP POLICY IF EXISTS "Allow update access to all users" ON public.payroll_action_items;
DROP POLICY IF EXISTS "Allow delete access to all users" ON public.payroll_action_items;
CREATE POLICY "Allow read access to all users" ON public.payroll_action_items FOR SELECT USING (true);
CREATE POLICY "Allow write access to all users" ON public.payroll_action_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update access to all users" ON public.payroll_action_items FOR UPDATE USING (true);
CREATE POLICY "Allow delete access to all users" ON public.payroll_action_items FOR DELETE USING (true);

-- 3. Pre-seed Default Mock Data

-- Insert a default demo company
INSERT INTO public.companies (id, nit, name, industry)
VALUES ('00000000-0000-0000-0000-000000000001', '900123456-7', 'TechCorp Colombia S.A.S.', 'Technology')
ON CONFLICT (nit) DO NOTHING;

-- Insert a default employee
INSERT INTO public.employees (id, company_id, document_type, document_number, first_name, last_name, current_salary)
VALUES (
    '11111111-1111-1111-1111-111111111111', 
    '00000000-0000-0000-0000-000000000001', 
    'CC', '1010101010', 'Carlos', 'Ramirez', 5000000.00
) ON CONFLICT DO NOTHING;

-- Insert a mock audit
INSERT INTO public.audits (id, company_id, period_month, period_year, global_risk_score, total_deviations_value, status)
VALUES (
    '22222222-2222-2222-2222-222222222222', 
    '00000000-0000-0000-0000-000000000001', 
    5, 2024, 98.00, 450200.00, 'COMPLETED'
) ON CONFLICT DO NOTHING;

-- Insert a specific Triple Match Reconciliation anomaly regarding the "Law 1393 40% rule"
INSERT INTO public.reconciliation_records (
    audit_id, employee_id, internal_base_salary, internal_non_salary_payments, 
    calc_ibc_standard, pila_reported_ibc, has_discrepancy, discrepancy_amount, law_1393_violation
) VALUES (
    '22222222-2222-2222-2222-222222222222', 
    '11111111-1111-1111-1111-111111111111', 
    5000000.00, 4000000.00, -- 9M Total. Non-salary (4M) > 40% of Total (3.6M). Excess = 400k.
    5400000.00, -- Expected IBC: Base(5M) + Excess(400k)
    5000000.00, -- Reported in PILA (Missing the excess!)
    true, 400000.00, true
);

-- Seed country/year rules (Colombia)
-- Uses DO UPDATE so re-running this script refreshes checks and values.
INSERT INTO public.country_year_rules (country_code, rule_year, label, required_fields, required_calculations, checks)
VALUES
    (
        'CO', 2024, 'UGPP 2024',
        '["document_number","first_name","last_name","base_salary","non_salary_payments"]'::jsonb,
        '["ibc_total","ibc_salud","ibc_pension"]'::jsonb,
        '["Ley 1393 (limite 40% no salarial)","Base minima por tipo de cotizante"]'::jsonb
    ),
    (
        'CO', 2025, 'UGPP Colombia 2025',
        '["document_number","first_name","last_name","base_salary","non_salary_payments","worked_days","contributor_type"]'::jsonb,
        '["ibc_total","ibc_salud","ibc_pension","ibc_arl","tope_40_no_salarial"]'::jsonb,
        '[
            "SMMLV 2025: $1.423.500 (Presidencia, 24-dic-2024)",
            "Auxilio de transporte 2025: $200.000 — solo si salario <= 2 SMMLV ($2.847.000) (Presidencia, 24-dic-2024)",
            "Salario integral minimo 2025: $18.505.500 (13 SMMLV: 10 base + 30% factor prestacional)",
            "UVT 2025: $49.799 (DIAN Resolucion 000193 de 2024)",
            "Salud empleado: 4% del IBC",
            "Pension empleado: 4% del IBC",
            "Fondo solidaridad pensional: 1% adicional si IBC > 4 SMMLV ($5.694.000)",
            "Fondo subsistencia: 0.2% adicional por SMMLV si IBC > 16 SMMLV ($22.776.000)",
            "Salud empleador: 8.5% del IBC",
            "Pension empleador: 12% del IBC",
            "ARL: 0.522% (riesgo I) hasta 8.7% (riesgo V) segun clase de riesgo laboral",
            "SENA: 2% del IBC (empleador)",
            "ICBF: 3% del IBC (empleador)",
            "Caja de compensacion familiar: 4% del IBC (empleador)",
            "Cesantias: 8.33% del total devengado mensual (Art. 249 CST)",
            "Intereses sobre cesantias: 12% anual / 1% mensual sobre saldo acumulado (Ley 52 de 1975)",
            "Prima de servicios: 8.33% del total devengado — pagos 30 jun y 20 dic (Art. 306 CST)",
            "Vacaciones: 4.17% del salario basico / 15 dias habiles por ano (Art. 186 CST)",
            "Hora extra diurna (6am-9pm): +25% sobre valor hora ordinaria (Art. 168 CST)",
            "Hora extra nocturna (9pm-6am): +35% sobre valor hora ordinaria",
            "Recargo nocturno ordinario (9pm-6am): +35% sobre valor hora ordinaria",
            "Trabajo dominical/festivo diurno: +75% (o salario doble si se toma dia compensatorio)",
            "Trabajo dominical/festivo nocturno: +110%",
            "Ley 1393: pagos no salariales > 40% del total devengado se deben incluir en el IBC",
            "IBC minimo proporcional: 1 SMMLV x (dias trabajados / 30)",
            "IBC maximo: 25 SMMLV ($35.587.500)",
            "Auxilio de transporte NO se incluye en el IBC ni en la base de cesantias",
            "Salario integral: IBC = 70% del salario; sin cesantias, prima ni vacaciones proporcionales"
        ]'::jsonb
    ),
    (
        'CO', 2026, 'UGPP Colombia 2026',
        '["document_number","first_name","last_name","base_salary","non_salary_payments","worked_days","contributor_type"]'::jsonb,
        '["ibc_total","ibc_salud","ibc_pension","ibc_arl","tope_40_no_salarial"]'::jsonb,
        '[
            "Salario minimo (SMMLV) 2026: $1.750.905 (Decreto 1469 de 2025)",
            "Auxilio de transporte 2026: $249.095 — solo si salario <= 2 SMMLV ($3.501.810) (Decreto 1470 de 2025)",
            "Salario integral minimo 2026: $22.761.765 (10 SMMLV base + 30% factor prestacional)",
            "UVT 2026: $52.374 (DIAN Resolucion 000238 de 2025)",
            "Salud empleado: 4% del IBC",
            "Pension empleado: 4% del IBC",
            "Fondo solidaridad pensional: 1% adicional si IBC > 4 SMMLV ($7.003.620)",
            "Fondo subsistencia: 0.2% adicional por SMMLV si IBC > 16 SMMLV ($28.014.480)",
            "Salud empleador: 8.5% del IBC",
            "Pension empleador: 12% del IBC",
            "ARL: 0.522% (riesgo I) hasta 8.7% (riesgo V) segun clase de riesgo laboral",
            "SENA: 2% del IBC (empleador)",
            "ICBF: 3% del IBC (empleador)",
            "Caja de compensacion familiar: 4% del IBC (empleador)",
            "Cesantias: 8.33% del total devengado mensual (Art. 249 CST)",
            "Intereses sobre cesantias: 12% anual / 1% mensual sobre saldo acumulado (Ley 52 de 1975)",
            "Prima de servicios: 8.33% del total devengado — pagos 30 jun y 20 dic (Art. 306 CST)",
            "Vacaciones: 4.17% del salario basico / 15 dias habiles por ano (Art. 186 CST)",
            "Hora extra diurna (6am-9pm): +25% sobre valor hora ordinaria (Art. 168 CST)",
            "Hora extra nocturna (9pm-6am): +35% sobre valor hora ordinaria",
            "Recargo nocturno ordinario (9pm-6am): +35% sobre valor hora ordinaria",
            "Trabajo dominical/festivo diurno: +80% hasta jun 2026; +90% desde 1 jul 2026 (Ley 2101 de 2021)",
            "Trabajo dominical/festivo nocturno: +110%",
            "Ley 1393: pagos no salariales > 40% del total devengado se deben incluir en el IBC",
            "IBC minimo proporcional: 1 SMMLV x (dias trabajados / 30)",
            "IBC maximo: 25 SMMLV ($43.772.625)",
            "Auxilio de transporte NO se incluye en el IBC ni en la base de cesantias",
            "Salario integral: IBC = 70% del salario integral; sin cesantias, prima ni vacaciones individuales"
        ]'::jsonb
    )
ON CONFLICT (country_code, rule_year) DO UPDATE SET
    label = EXCLUDED.label,
    required_fields = EXCLUDED.required_fields,
    required_calculations = EXCLUDED.required_calculations,
    checks = EXCLUDED.checks,
    updated_at = NOW();
