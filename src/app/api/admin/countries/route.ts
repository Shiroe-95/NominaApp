/**
 * API Route: /api/admin/countries
 *
 * Gestión de países soportados por la plataforma.
 * Requiere rol admin para todas las operaciones.
 *
 * - GET  → Lista todos los países ordenados por nombre.
 * - POST → Crea un nuevo país con código ISO, nombre y moneda.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  requireAdmin,
  applyRateLimit,
  sanitizeString,
  isValidUuid,
  isValidCountryCode,
  RATE_LIMITS,
} from '@/lib/api/guard';

/** Tabla de Supabase que almacena los países soportados. */
const TABLE = 'supported_countries';

/**
 * GET /api/admin/countries
 *
 * Retorna la lista completa de países soportados, ordenados alfabéticamente por nombre.
 *
 * @param req - Objeto Request entrante.
 * @returns 200 con array de países | 401 si no autenticado | 403 si no es admin | 429 si excede rate limit | 500 en error de BD.
 */
export async function GET(req: Request) {
  const rl = await applyRateLimit(req, 'admin/countries', RATE_LIMITS.read);
  if (rl) return rl;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('country_name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

/**
 * POST /api/admin/countries
 *
 * Crea un nuevo país soportado en la plataforma.
 *
 * @param req - Objeto Request con body JSON.
 * @returns 201 con el país creado | 400 si faltan campos o código inválido | 401/403 si no autorizado | 429 si excede rate limit.
 *
 * Body esperado:
 * - `country_code` (string, requerido) — Código ISO 3166-1 alpha-2 (ej: "CO", "MX").
 * - `country_name` (string, requerido) — Nombre del país (máx. 100 caracteres).
 * - `currency_code` (string, opcional) — Código de moneda ISO 4217 (ej: "COP", "USD").
 */
export async function POST(req: Request) {
  const rl = await applyRateLimit(req, 'admin/countries', RATE_LIMITS.adminWrite);
  if (rl) return rl;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const countryCode = sanitizeString(body.country_code, 2).toUpperCase();
  const countryName = sanitizeString(body.country_name, 100);
  const currencyCode = sanitizeString(body.currency_code, 3).toUpperCase();

  if (!countryCode || !isValidCountryCode(countryCode) || !countryName) {
    return NextResponse.json({ error: 'country_code and country_name are required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .insert({ country_code: countryCode, country_name: countryName, currency_code: currencyCode || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}

export async function PUT(req: Request) {
  const rl = await applyRateLimit(req, 'admin/countries', RATE_LIMITS.adminWrite);
  if (rl) return rl;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const id = sanitizeString(body.id, 100);
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const fields: Record<string, unknown> = {};
  if (body.country_name) fields.country_name = sanitizeString(body.country_name, 100);
  if (body.currency_code) fields.currency_code = sanitizeString(body.currency_code, 3).toUpperCase();
  if (body.is_active !== undefined) fields.is_active = Boolean(body.is_active);
  if (body.sync_frequency) fields.sync_frequency = sanitizeString(body.sync_frequency, 10);
  if (body.currency_symbol) fields.currency_symbol = sanitizeString(body.currency_symbol, 10);
  if (body.locale_format) fields.locale_format = sanitizeString(body.locale_format, 10);
  if (body.decimal_separator) fields.decimal_separator = sanitizeString(body.decimal_separator, 1);
  if (body.thousands_separator) fields.thousands_separator = sanitizeString(body.thousands_separator, 1);

  const supabase = createAdminClient();
  const { data, error } = await supabase.from(TABLE).update(fields).eq('id', id).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data);
}

export async function DELETE(req: Request) {
  const rl = await applyRateLimit(req, 'admin/countries', RATE_LIMITS.adminWrite);
  if (rl) return rl;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json();
  const id = sanitizeString(body.id, 100);
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from(TABLE).delete().eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
