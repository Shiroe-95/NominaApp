/**
 * API Route: /api/settings/providers/:id
 *
 * Operaciones sobre un proveedor de IA específico.
 * Requiere rol admin. Valida UUID del parámetro dinámico.
 *
 * - PUT    — Actualiza configuración del proveedor (re-valida conectividad si cambia key/modelo)
 * - DELETE — Elimina un proveedor
 *
 * @module api/settings/providers/[id]
 */
import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptApiKey, decryptApiKey } from '@/lib/ai/encryption';
import { ProviderConfigSchema } from '@/lib/ai/schemas';
import { buildRegistry } from '@/lib/ai/providers';
import type { ProviderConfig } from '@/lib/ai/types';
import { applyRateLimit, requireAdmin, isValidUuid, RATE_LIMITS } from '@/lib/api/guard';

function maskApiKey(key: string): string {
  if (key.length <= 4) return '****';
  return '*'.repeat(key.length - 4) + key.slice(-4);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error)
    return String((error as { message: unknown }).message);
  return error instanceof Error ? error.message : fallback;
}

type RouteContext = { params: Promise<{ id: string }> };

/** PUT /api/settings/providers/:id — update a provider */
export async function PUT(req: Request, context: RouteContext) {
  const rl = await applyRateLimit(req, 'settings-providers-write', RATE_LIMITS.adminWrite);
  if (rl) return rl;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid provider id' }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    const body = await req.json();

    const parsed = ProviderConfigSchema.omit({ id: true }).partial().safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    // Fetch existing record
    const { data: existing, error: fetchErr } = await supabase
      .from('ai_providers')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (parsed.data.display_name !== undefined) updates.display_name = parsed.data.display_name;
    if (parsed.data.model_id !== undefined) updates.model_id = parsed.data.model_id;
    if (parsed.data.provider_type !== undefined) updates.provider_type = parsed.data.provider_type;
    if (parsed.data.priority !== undefined) updates.priority = parsed.data.priority;
    if (parsed.data.is_active !== undefined) updates.is_active = parsed.data.is_active;

    // If a new API key is provided, encrypt it
    if (parsed.data.api_key !== undefined) {
      updates.api_key_encrypted = encryptApiKey(parsed.data.api_key);
    }

    // Re-validate connectivity when key or model changes
    if (parsed.data.api_key !== undefined || parsed.data.model_id !== undefined) {
      const apiKey = parsed.data.api_key ?? decryptApiKey(existing.api_key_encrypted);
      const modelId = parsed.data.model_id ?? existing.model_id;
      const providerType = parsed.data.provider_type ?? existing.provider_type;

      let testSuccess = false;
      try {
        const tempConfig: ProviderConfig = {
          id: 'temp',
          provider_type: providerType,
          api_key: apiKey,
          model_id: modelId,
          display_name: 'test',
          priority: 0,
          is_active: true,
        };
        const registry = buildRegistry([tempConfig]);
        const model = registry.getModel('temp');
        await generateText({ model, prompt: 'Hello', maxTokens: 5 });
        testSuccess = true;
      } catch {
        testSuccess = false;
      }

      updates.last_test_at = new Date().toISOString();
      updates.last_test_success = testSuccess;
      if (!testSuccess) updates.is_active = false;
    }

    const { data, error } = await supabase
      .from('ai_providers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Providers PUT error:', error);
      return NextResponse.json(
        { error: getErrorMessage(error, 'Failed to update provider') },
        { status: 500 },
      );
    }

    return NextResponse.json({
      provider: { ...data, api_key_encrypted: undefined, api_key_masked: maskApiKey('updated') },
    });
  } catch (error) {
    console.error('Providers PUT error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to update provider') },
      { status: 500 },
    );
  }
}

/** DELETE /api/settings/providers/:id — remove a provider */
export async function DELETE(req: Request, context: RouteContext) {
  const rl = await applyRateLimit(req, 'settings-providers-write', RATE_LIMITS.adminWrite);
  if (rl) return rl;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid provider id' }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    // Check it exists
    const { data: existing, error: fetchErr } = await supabase
      .from('ai_providers')
      .select('id')
      .eq('id', id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    const { error } = await supabase.from('ai_providers').delete().eq('id', id);

    if (error) {
      console.error('Providers DELETE error:', error);
      return NextResponse.json(
        { error: getErrorMessage(error, 'Failed to delete provider') },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Providers DELETE error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to delete provider') },
      { status: 500 },
    );
  }
}
