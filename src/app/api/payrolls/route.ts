import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth, applyRateLimit, RATE_LIMITS, withApiHandler, apiErrorResponse } from '@/lib/api/guard';

function getErrorMessage(error: unknown, fallback: string) {
    if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
    return error instanceof Error ? error.message : fallback;
}

export const GET = withApiHandler(async (req, { requestId }) => {
    const rl = await applyRateLimit(req, 'payrolls', RATE_LIMITS.read);
    if (rl) return rl;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('payroll_uploads')
        .select(`
            id, company_id, country_code, period_year, period_month,
            rule_label, certification_ready, file_count, mapped_fields,
            created_fields, missing_required_fields, missing_required_calculations,
            mapping_relations, sheet_summary, detected_variables, concept_summary, risk_report,
            employee_risk_summary, calculation_validation_report, ai_validation_report, created_at,
            companies(name, nit)
        `)
        .order('created_at', { ascending: false })
        .limit(30);

    if (error) {
        console.error('Payrolls GET error:', error);
        return apiErrorResponse('INTERNAL_ERROR', getErrorMessage(error, 'Failed to load payrolls'), requestId);
    }

    const payrolls = (data ?? []).map(({ companies, ...row }) => {
        const co = Array.isArray(companies) ? (companies[0] as { name: string; nit: string } | undefined) : (companies as { name: string; nit: string } | null);
        return { ...row, company_name: co?.name ?? null, company_nit: co?.nit ?? null };
    });

    return NextResponse.json({ payrolls });
});

export const POST = withApiHandler(async (req, { requestId }) => {
    const rl = await applyRateLimit(req, 'payrolls-write', RATE_LIMITS.write);
    if (rl) return rl;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = createAdminClient();
    const body = await req.json();

    const companyId = typeof body.companyId === 'string' ? body.companyId : '';
    const countryCode = typeof body.countryCode === 'string' ? body.countryCode : 'CO';
    const year = Number(body.year);
    const month = Number(body.month);
    const ruleLabel = typeof body.ruleLabel === 'string' ? body.ruleLabel : null;
    const certificationReady = Boolean(body.certificationReady);
    const fileCount = Number(body.fileCount);
    const mappedFields = Array.isArray(body.mappedFields) ? body.mappedFields : [];
    const createdFields = Array.isArray(body.createdFields) ? body.createdFields : [];
    const missingRequiredFields = Array.isArray(body.missingRequiredFields) ? body.missingRequiredFields : [];
    const missingRequiredCalculations = Array.isArray(body.missingRequiredCalculations) ? body.missingRequiredCalculations : [];
    const mappingRelations = Array.isArray(body.mappingRelations) ? body.mappingRelations : [];
    const sheetSummary = Array.isArray(body.sheetSummary) ? body.sheetSummary : [];
    const detectedVariables = Array.isArray(body.detectedVariables) ? body.detectedVariables : [];
    const conceptSummary = typeof body.conceptSummary === 'object' && body.conceptSummary ? body.conceptSummary : {};
    const riskReport = typeof body.riskReport === 'object' && body.riskReport ? body.riskReport : {};
    const employeeRiskSummary = typeof body.employeeRiskSummary === 'object' && body.employeeRiskSummary ? body.employeeRiskSummary : {};
    const calculationValidationReport =
        typeof body.calculationValidationReport === 'object' && body.calculationValidationReport
            ? body.calculationValidationReport
            : {};
    const aiValidationReport =
        typeof body.aiValidationReport === 'object' && body.aiValidationReport
            ? body.aiValidationReport
            : {};
    const sourceMatrices = Array.isArray(body.sourceMatrices) ? body.sourceMatrices : null;
    const aiReportWithSource =
        sourceMatrices && sourceMatrices.length > 0
            ? { ...(aiValidationReport as Record<string, unknown>), sourceMatrices }
            : aiValidationReport;

    if (!companyId || !Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(fileCount)) {
        return apiErrorResponse('VALIDATION_ERROR', 'Invalid payload', requestId, {
            fields: [
                ...(!companyId ? [{ path: 'companyId', message: 'Required', code: 'required' }] : []),
                ...(!Number.isFinite(year) ? [{ path: 'year', message: 'Must be a valid number', code: 'invalid' }] : []),
                ...(!Number.isFinite(month) ? [{ path: 'month', message: 'Must be a valid number', code: 'invalid' }] : []),
                ...(!Number.isFinite(fileCount) ? [{ path: 'fileCount', message: 'Must be a valid number', code: 'invalid' }] : []),
            ],
        });
    }

    const { data, error } = await supabase
        .from('payroll_uploads')
        .insert({
            company_id: companyId,
            country_code: countryCode,
            period_year: year,
            period_month: month,
            rule_label: ruleLabel,
            certification_ready: certificationReady,
            file_count: fileCount,
            mapped_fields: mappedFields,
            created_fields: createdFields,
            mapping_relations: mappingRelations,
            missing_required_fields: missingRequiredFields,
            missing_required_calculations: missingRequiredCalculations,
            sheet_summary: sheetSummary,
            detected_variables: detectedVariables,
            concept_summary: conceptSummary,
            risk_report: riskReport,
            employee_risk_summary: employeeRiskSummary,
            calculation_validation_report: calculationValidationReport,
            ai_validation_report: aiReportWithSource,
        })
        .select('id, company_id, country_code, period_year, period_month, rule_label, certification_ready, created_at')
        .single();

    if (error) {
        console.error('Payrolls POST error:', error);
        return apiErrorResponse('INTERNAL_ERROR', getErrorMessage(error, 'Failed to save payroll'), requestId);
    }

    return NextResponse.json({ payroll: data }, { status: 201 });
});

export const PATCH = withApiHandler(async (req, { requestId }) => {
    const rl = await applyRateLimit(req, 'payrolls-write', RATE_LIMITS.write);
    if (rl) return rl;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = createAdminClient();
    const body = await req.json();
    const id = typeof body.id === 'string' ? body.id : null;
    const corrections = body.corrections;

    if (!id) {
        return apiErrorResponse('VALIDATION_ERROR', 'Missing id', requestId, {
            fields: [{ path: 'id', message: 'Required', code: 'required' }],
        });
    }

    const { data: current } = await supabase
        .from('payroll_uploads')
        .select('ai_validation_report')
        .eq('id', id)
        .single();

    const currentReport = (current?.ai_validation_report as Record<string, unknown>) ?? {};
    const updatedReport = { ...currentReport, corrections };

    const { error } = await supabase
        .from('payroll_uploads')
        .update({ ai_validation_report: updatedReport })
        .eq('id', id);

    if (error) {
        return apiErrorResponse('INTERNAL_ERROR', getErrorMessage(error, 'Failed to update'), requestId);
    }

    return NextResponse.json({ ok: true });
});

export const DELETE = withApiHandler(async (req, { requestId }) => {
    const rl = await applyRateLimit(req, 'payrolls-write', RATE_LIMITS.write);
    if (rl) return rl;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
        return apiErrorResponse('VALIDATION_ERROR', 'Missing id', requestId, {
            fields: [{ path: 'id', message: 'Required', code: 'required' }],
        });
    }

    const { error } = await supabase.from('payroll_uploads').delete().eq('id', id);

    if (error) {
        console.error('Payrolls DELETE error:', error);
        return apiErrorResponse('INTERNAL_ERROR', getErrorMessage(error, 'Failed to delete payroll'), requestId);
    }

    return NextResponse.json({ ok: true });
});
