import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function setupDatabase() {
  console.log("[v0] Iniciando setup de base de datos...");

  try {
    // Create tables via SQL
    const sqlStatements = `
      -- Companies table
      CREATE TABLE IF NOT EXISTS public.companies (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        nit VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        industry VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );

      -- Employees table
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

      -- Audits table
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

      -- Reconciliation records table
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

      -- Country year rules table
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

      -- Payroll uploads table
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

      -- Payroll action items table
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

      -- Enable RLS on all tables
      ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.reconciliation_records ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.country_year_rules ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.payroll_uploads ENABLE ROW LEVEL SECURITY;
      ALTER TABLE public.payroll_action_items ENABLE ROW LEVEL SECURITY;

      -- Create RLS policies (permissive)
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
    `;

    console.log("[v0] Ejecutando statements SQL...");
    const { error: dbError } = await supabase.rpc("exec_sql", { sql: sqlStatements });

    if (dbError && dbError.message !== "function exec_sql(text) does not exist") {
      console.error("[v0] Error en SQL:", dbError);
    }

    // Insert demo data using the client
    console.log("[v0] Insertando datos de demostración...");

    // Insert demo company
    await supabase.from("companies").upsert(
      {
        id: "00000000-0000-0000-0000-000000000001",
        nit: "900123456-7",
        name: "TechCorp Colombia S.A.S.",
        industry: "Technology",
      },
      { onConflict: "nit" }
    );

    // Insert country rules
    await supabase.from("country_year_rules").upsert(
      [
        {
          country_code: "CO",
          rule_year: 2025,
          label: "UGPP Colombia 2025",
          required_fields: ["document_number", "first_name", "last_name", "base_salary", "non_salary_payments", "worked_days", "contributor_type"],
          required_calculations: ["ibc_total", "ibc_salud", "ibc_pension", "ibc_arl", "tope_40_no_salarial"],
          checks: ["SMMLV 2025: $1.423.500", "Auxilio de transporte 2025: $200.000", "Ley 1393: limite 40% no salarial"],
        },
        {
          country_code: "CO",
          rule_year: 2026,
          label: "UGPP Colombia 2026",
          required_fields: ["document_number", "first_name", "last_name", "base_salary", "non_salary_payments", "worked_days", "contributor_type"],
          required_calculations: ["ibc_total", "ibc_salud", "ibc_pension", "ibc_arl", "tope_40_no_salarial"],
          checks: ["SMMLV 2026: $1.750.905", "Auxilio de transporte 2026: $249.095", "Ley 1393: limite 40% no salarial"],
        },
      ],
      { onConflict: "country_code,rule_year" }
    );

    console.log("✅ Base de datos configurada exitosamente");
  } catch (err) {
    console.error("❌ Error en setup:", err);
    process.exit(1);
  }
}

setupDatabase();
