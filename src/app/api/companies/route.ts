import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

function getErrorMessage(error: unknown, fallback: string) {
    if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message);
    return error instanceof Error ? error.message : fallback;
}

export async function GET() {
    const supabase = createAdminClient();
    const { data, error } = await supabase
        .from('companies')
        .select('id, name, nit, industry')
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) {
        console.error('Companies GET error:', error);
        return NextResponse.json({ error: getErrorMessage(error, 'Failed to load companies') }, { status: 500 });
    }

    return NextResponse.json({ companies: data });
}

export async function POST(req: Request) {
    const supabase = createAdminClient();
    try {
        const body = await req.json();
        const name = typeof body.name === 'string' ? body.name.trim() : '';
        const nit = typeof body.nit === 'string' ? body.nit.trim() : '';
        const industry = typeof body.industry === 'string' && body.industry.trim() ? body.industry.trim() : null;

        if (!name || !nit) {
            return NextResponse.json({ error: 'name and nit are required' }, { status: 400 });
        }

        const { data, error } = await supabase
            .from('companies')
            .insert({ name, nit, industry })
            .select('id, name, nit, industry')
            .single();

        if (error) {
            console.error('Companies POST error:', error);
            return NextResponse.json({ error: getErrorMessage(error, 'Failed to create company') }, { status: 500 });
        }

        return NextResponse.json({ company: data }, { status: 201 });
    } catch (error: unknown) {
        console.error('Companies POST error:', error);
        return NextResponse.json({ error: getErrorMessage(error, 'Failed to create company') }, { status: 500 });
    }
}
