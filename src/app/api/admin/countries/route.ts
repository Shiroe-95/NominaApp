import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const TABLE = 'supported_countries';

// GET /api/admin/countries — list all countries
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('country_name', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

// POST /api/admin/countries — create a country
export async function POST(req: Request) {
  const body = await req.json();
  const supabase = createAdminClient();
  const { data, error } = await supabase.from(TABLE).insert(body).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(data, { status: 201 });
}

// PUT /api/admin/countries — update a country (expects { id, ...fields })
export async function PUT(req: Request) {
  const { id, ...fields } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  const supabase = createAdminClient();
  const { data, error } = await supabase.from(TABLE).update(fields).eq('id', id).select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json(data);
}

// DELETE /api/admin/countries — delete a country (expects { id } in body)
export async function DELETE(req: Request) {
  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: 'Missing id' }, { status: 400 });
  }
  const supabase = createAdminClient();
  const { error } = await supabase.from(TABLE).delete().eq('id', id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
