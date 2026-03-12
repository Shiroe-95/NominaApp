import { createAdminClient } from '@/lib/supabase/admin';
import { DashboardClient } from '@/components/ui/DashboardClient';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    let payrollData: any[] = [];
    let companiesData: any[] = [];

    try {
        const supabase = createAdminClient();

        // Parallel data fetching in RSC
        const [payrollsRes, companiesRes] = await Promise.all([
            supabase
                .from('payroll_uploads')
                .select(`
                    id, company_id, country_code, period_year, period_month,
                    certification_ready, risk_report, employee_risk_summary, 
                    calculation_validation_report, created_at,
                    companies(name, nit)
                `)
                .order('created_at', { ascending: false })
                .limit(30),
            supabase
                .from('companies')
                .select('id, name, nit, industry')
                .order('created_at', { ascending: false })
                .limit(100)
        ]);

        payrollData = payrollsRes.data ?? [];
        companiesData = companiesRes.data ?? [];
    } catch {
        // Continue with empty data
    }

    const formattedPayrolls = payrollData.map(({ companies, ...row }: any) => {
        const co = Array.isArray(companies) ? companies[0] : companies;
        return { ...row, company_name: co?.name ?? null, company_nit: co?.nit ?? null };
    });

    return (
        <DashboardClient
            initialCompanies={companiesData}
            initialPayrolls={formattedPayrolls}
        />
    );
}
