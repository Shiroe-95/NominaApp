-- Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    nit TEXT,
    industry TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create country_year_rules table
CREATE TABLE IF NOT EXISTS public.country_year_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    country_code TEXT NOT NULL,
    year INTEGER NOT NULL,
    label TEXT NOT NULL,
    required_fields TEXT[] DEFAULT '{}',
    required_calculations TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(country_code, year)
);

-- Create payroll_uploads table
CREATE TABLE IF NOT EXISTS public.payroll_uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
    country_code TEXT NOT NULL DEFAULT 'CO',
    period_year INTEGER NOT NULL,
    period_month INTEGER NOT NULL,
    file_count INTEGER DEFAULT 1,
    certification_ready BOOLEAN DEFAULT false,
    risk_report JSONB DEFAULT '{}',
    employee_risk_summary JSONB DEFAULT '{}',
    calculation_validation_report JSONB DEFAULT '{}',
    detected_variables TEXT[] DEFAULT '{}',
    mapped_fields TEXT[] DEFAULT '{}',
    missing_required_fields TEXT[] DEFAULT '{}',
    missing_required_calculations TEXT[] DEFAULT '{}',
    rule_label TEXT,
    sheet_data JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Create payroll_action_items table
CREATE TABLE IF NOT EXISTS public.payroll_action_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payroll_id UUID REFERENCES public.payroll_uploads(id) ON DELETE CASCADE,
    employee_document TEXT NOT NULL,
    employee_name TEXT,
    priority TEXT DEFAULT 'medium',
    area TEXT,
    title TEXT NOT NULL,
    description TEXT,
    recommended_fix TEXT,
    assigned_to TEXT,
    status TEXT DEFAULT 'open',
    resolution_note TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default rules for Colombia
INSERT INTO public.country_year_rules (country_code, year, label, required_fields, required_calculations)
VALUES 
    ('CO', 2024, 'Colombia 2024 - UGPP', 
     ARRAY['documento', 'nombre', 'salario_base', 'dias_trabajados', 'ibc_salud', 'ibc_pension'],
     ARRAY['aporte_salud', 'aporte_pension', 'aporte_arl', 'total_parafiscales']),
    ('CO', 2025, 'Colombia 2025 - UGPP', 
     ARRAY['documento', 'nombre', 'salario_base', 'dias_trabajados', 'ibc_salud', 'ibc_pension'],
     ARRAY['aporte_salud', 'aporte_pension', 'aporte_arl', 'total_parafiscales'])
ON CONFLICT (country_code, year) DO NOTHING;

-- Insert sample company
INSERT INTO public.companies (name, nit, industry)
VALUES ('Empresa Demo', '900123456-1', 'Tecnologia')
ON CONFLICT DO NOTHING;
