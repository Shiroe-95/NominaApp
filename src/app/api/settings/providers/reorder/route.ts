import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

const ReorderSchema = z.object({
  order: z.array(
    z.object({
      id: z.string().uuid(),
      priority: z.number().int().min(0),
    }),
  ).min(1),
});

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error)
    return String((error as { message: unknown }).message);
  return error instanceof Error ? error.message : fallback;
}

/** PUT /api/settings/providers/reorder — reorder provider priorities */
export async function PUT(req: Request) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();

    const parsed = ReorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Update each provider's priority
    const updates = parsed.data.order.map(({ id, priority }) =>
      supabase
        .from('ai_providers')
        .update({ priority, updated_at: new Date().toISOString() })
        .eq('id', id),
    );

    const results = await Promise.all(updates);

    const failed = results.find((r) => r.error);
    if (failed?.error) {
      console.error('Providers reorder error:', failed.error);
      return NextResponse.json(
        { error: getErrorMessage(failed.error, 'Failed to reorder providers') },
        { status: 500 },
      );
    }

    // Return updated list
    const { data, error } = await supabase
      .from('ai_providers')
      .select('id, display_name, provider_type, model_id, priority, is_active')
      .order('priority', { ascending: true });

    if (error) {
      return NextResponse.json(
        { error: getErrorMessage(error, 'Failed to fetch updated providers') },
        { status: 500 },
      );
    }

    return NextResponse.json({ providers: data });
  } catch (error) {
    console.error('Providers reorder error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to reorder providers') },
      { status: 500 },
    );
  }
}
