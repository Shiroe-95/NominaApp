import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth, applyRateLimit, RATE_LIMITS } from '@/lib/api/guard';

export type ActionStatus = 'open' | 'assigned' | 'resolved';

function getErrorMessage(error: unknown, fallback: string) {
    if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
    return error instanceof Error ? error.message : fallback;
}

export async function GET(req: Request) {
    const rl = await applyRateLimit(req, 'actions', RATE_LIMITS.read);
    if (rl) return rl;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = createAdminClient();
    const { searchParams } = new URL(req.url);
    const payrollId = searchParams.get('payrollId');
    const status = searchParams.get('status');

    let query = supabase
        .from('payroll_action_items')
        .select('*')
        .order('created_at', { ascending: false });

    if (payrollId) query = query.eq('payroll_id', payrollId);
    if (status) query = query.eq('status', status);
    if (!payrollId) query = query.limit(200);

    const { data, error } = await query;

    if (error) {
        console.error('Actions GET error:', error);
        return NextResponse.json({ error: getErrorMessage(error, 'Failed to load actions') }, { status: 500 });
    }

    return NextResponse.json({ actions: data });
}

export async function POST(req: Request) {
    const rl = await applyRateLimit(req, 'actions-write', RATE_LIMITS.write);
    if (rl) return rl;

    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    const supabase = createAdminClient();
    try {
        const body = await req.json();

        const payrollId = typeof body.payrollId === 'string' ? body.payrollId : '';
        const employeeDocument = typeof body.employeeDocument === 'string' ? body.employeeDocument : '';
        const employeeName = typeof body.employeeName === 'string' ? body.employeeName : '';
        const priority = typeof body.priority === 'string' ? body.priority : 'medium';
        const area = typeof body.area === 'string' ? body.area : 'Datos';
        const title = typeof body.title === 'string' ? body.title : '';
        const description = typeof body.description === 'string' ? body.description : '';
        const recommendedFix = typeof body.recommendedFix === 'string' ? body.recommendedFix : '';
        const assignedTo = typeof body.assignedTo === 'string' && body.assignedTo.trim() ? body.assignedTo.trim() : null;
        const actionStatus: ActionStatus = assignedTo ? 'assigned' : 'open';

        if (!payrollId || !employeeDocument || !employeeName || !title) {
            return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('payroll_action_items')
            .upsert(
                {
                    payroll_id: payrollId,
                    employee_document: employeeDocument,
                    employee_name: employeeName,
                    priority,
                    area,
                    title,
                    description,
                    recommended_fix: recommendedFix,
                    status: actionStatus,
                    assigned_to: assignedTo,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'payroll_id,employee_document,title' }
            )
            .select()
            .single();

        if (error) {
            console.error('Actions POST error:', error);
            return NextResponse.json({ error: getErrorMessage(error, 'Failed to save action') }, { status: 500 });
        }

        return NextResponse.json({ action: data }, { status: 201 });
    } catch (error: unknown) {
        console.error('Actions POST error:', error);
        return NextResponse.json({ error: getErrorMessage(error, 'Failed to save action') }, { status: 500 });
    }
}
