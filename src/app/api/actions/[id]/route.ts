import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

function getErrorMessage(error: unknown, fallback: string) {
    if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
    return error instanceof Error ? error.message : fallback;
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
    const supabase = createAdminClient();
    try {
        const { id } = await context.params;
        const body = await req.json();

        if (!id) {
            return NextResponse.json({ error: 'Action id is required' }, { status: 400 });
        }

        const updates: Record<string, string> = { updated_at: new Date().toISOString() };
        if (typeof body.status === 'string') updates.status = body.status;
        if (typeof body.assignedTo === 'string') updates.assigned_to = body.assignedTo;
        if (typeof body.resolutionNote === 'string') updates.resolution_note = body.resolutionNote;

        const { data, error } = await supabase
            .from('payroll_action_items')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            const status = error.code === 'PGRST116' ? 404 : 500;
            console.error('Actions PATCH error:', error);
            return NextResponse.json({ error: status === 404 ? 'Action not found' : getErrorMessage(error, 'Failed to update action') }, { status });
        }

        return NextResponse.json({ action: data });
    } catch (error: unknown) {
        console.error('Actions PATCH error:', error);
        return NextResponse.json({ error: getErrorMessage(error, 'Failed to update action') }, { status: 500 });
    }
}
