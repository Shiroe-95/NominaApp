import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile, type UserRole } from '@/lib/auth/user-profile';
import { DashboardClient } from '@/components/ui/DashboardClient';
import type { ProviderSummary } from '@/lib/types/pipeline';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
    let payrollData: any[] = [];
    let companiesData: any[] = [];
    let providers: ProviderSummary[] = [];
    let role: UserRole = 'client';
    let companyId: string | null = null;

    try {
        // Get current user's role from session
        const supabaseAuth = await createClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();

        if (user) {
            const profile = await getUserProfile(user.id);
            if (profile) {
                role = profile.role;
                companyId = profile.company_id;
            }
        }

        const supabase = createAdminClient();

        // Build payroll query — clients only see their company's data
        let payrollQuery = supabase
            .from('payroll_uploads')
            .select(`
                id, company_id, country_code, period_year, period_month,
                certification_ready, risk_report, employee_risk_summary, 
                calculation_validation_report, created_at,
                companies(name, nit)
            `)
            .order('created_at', { ascending: false })
            .limit(30);

        if (role === 'client' && companyId) {
            payrollQuery = payrollQuery.eq('company_id', companyId);
        }

        let companiesQuery = supabase
            .from('companies')
            .select('id, name, nit, industry')
            .order('created_at', { ascending: false })
            .limit(100);

        if (role === 'client' && companyId) {
            companiesQuery = companiesQuery.eq('id', companyId);
        }

        // Query ai_providers using admin client (bypasses RLS since providers are shared)
        const providersQuery = user
            ? supabase
                .from('ai_providers')
                .select('id, display_name, provider_type, is_active, last_test_success')
                .order('priority', { ascending: true })
            : null;

        const [payrollsRes, companiesRes, providersRes] = await Promise.all([
            payrollQuery,
            companiesQuery,
            providersQuery,
        ]);

        payrollData = payrollsRes.data ?? [];
        companiesData = companiesRes.data ?? [];

        // Map snake_case DB rows to camelCase ProviderSummary
        providers = (providersRes?.data ?? []).map((row: any) => ({
            id: row.id,
            displayName: row.display_name,
            providerType: row.provider_type,
            isActive: row.is_active,
            lastTestSuccess: row.last_test_success,
        }));
    } catch {
        // Continue with empty data — providers defaults to []
    }

    const formattedPayrolls = payrollData.map(({ companies, ...row }: any) => {
        const co = Array.isArray(companies) ? companies[0] : companies;
        return { ...row, company_name: co?.name ?? null, company_nit: co?.nit ?? null };
    });

    return (
        <DashboardClient
            role={role}
            initialCompanies={companiesData}
            initialPayrolls={formattedPayrolls}
            providers={providers}
        />
    );
}
