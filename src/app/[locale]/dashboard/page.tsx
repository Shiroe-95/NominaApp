import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { getUserProfile, type UserRole } from '@/lib/auth/user-profile';
import { DashboardClient } from '@/components/ui/DashboardClient';
import type { ProviderSummary } from '@/lib/types/pipeline';

export const dynamic = 'force-dynamic';

/**
 * Helper that wraps a Supabase query promise so it never rejects.
 * Returns `[]` if the query fails or returns null data.
 */
async function safeQuery<T>(queryPromise: PromiseLike<{ data: T | null; error: unknown }> | null): Promise<T extends (infer U)[] ? U[] : T | null> {
    if (!queryPromise) return [] as any;
    try {
        const res = await queryPromise;
        return (res.data ?? []) as any;
    } catch {
        return [] as any;
    }
}

/**
 * Página del Dashboard ejecutivo (Server Component).
 *
 * Carga datos de nóminas, empresas y proveedores de IA desde Supabase
 * en paralelo con `Promise.all`. Cada query es resiliente: si una falla,
 * retorna datos vacíos sin afectar las demás (Req 2.6, 2.7).
 *
 * Filtra datos por `company_id` cuando el rol es `client` (Req 2.3).
 */
export default async function DashboardPage() {
    let role: UserRole = 'client';
    let companyId: string | null = null;

    try {
        const supabaseAuth = await createClient();
        const { data: { user } } = await supabaseAuth.auth.getUser();

        if (user) {
            const profile = await getUserProfile(user.id);
            if (profile) {
                role = profile.role;
                companyId = profile.company_id;
            }
        }
    } catch {
        // Auth failure — continue with default client role and empty data
    }

    const supabase = createAdminClient();

    // Build payroll query — clients only see their company's data (Req 2.3)
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

    const providersQuery = supabase
        .from('ai_providers')
        .select('id, display_name, provider_type, is_active, last_test_success')
        .order('priority', { ascending: true });

    // Parallel load with resilient error handling — each query fails independently (Req 2.6, 2.7)
    const [payrollData, companiesData, providersRaw] = await Promise.all([
        safeQuery(payrollQuery),
        safeQuery(companiesQuery),
        safeQuery(providersQuery),
    ]);

    const providers: ProviderSummary[] = (providersRaw as any[]).map((row: any) => ({
        id: row.id,
        displayName: row.display_name,
        providerType: row.provider_type,
        isActive: row.is_active,
        lastTestSuccess: row.last_test_success,
    }));

    const formattedPayrolls = (payrollData as any[]).map(({ companies, ...row }: any) => {
        const co = Array.isArray(companies) ? companies[0] : companies;
        return { ...row, company_name: co?.name ?? null, company_nit: co?.nit ?? null };
    });

    return (
        <DashboardClient
            role={role}
            initialCompanies={companiesData as any[]}
            initialPayrolls={formattedPayrolls}
            providers={providers}
        />
    );
}
