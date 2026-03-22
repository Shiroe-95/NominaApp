/**
 * API Route: /api/settings/providers/:id/test
 *
 * Prueba de conectividad para un proveedor de IA.
 * Requiere rol admin. Envía un prompt mínimo al modelo configurado
 * y actualiza el estado de test en la BD.
 *
 * - POST — Ejecuta test de conectividad
 *
 * @module api/settings/providers/[id]/test
 */
import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createAdminClient } from '@/lib/supabase/admin';
import { decryptApiKey } from '@/lib/ai/encryption';
import { buildRegistry } from '@/lib/ai/providers';
import type { ProviderConfig } from '@/lib/ai/types';
import { applyRateLimit, requireAdmin, isValidUuid, RATE_LIMITS } from '@/lib/api/guard';

/**
 * Extrae un mensaje legible de un error desconocido.
 *
 * @param error - Error capturado (puede ser cualquier tipo).
 * @param fallback - Mensaje por defecto si no se puede extraer uno del error.
 * @returns Mensaje de error como string.
 */
function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error)
    return String((error as { message: unknown }).message);
  return error instanceof Error ? error.message : fallback;
}

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/settings/providers/:id/test — Prueba de conectividad para un proveedor de IA.
 *
 * Envía un prompt mínimo ("Hello", maxTokens: 5) al modelo configurado y actualiza
 * el estado de test en la tabla `ai_providers`. Si falla, desactiva el proveedor.
 *
 * @param req - Request HTTP entrante.
 * @param context - Contexto de ruta con `params.id` (UUID del proveedor).
 * @returns JSON `{ success: boolean, error?: string }`. Status 400 si UUID inválido, 404 si no existe, 500 en error inesperado.
 */
export async function POST(req: Request, context: RouteContext) {
  const rl = await applyRateLimit(req, 'settings-providers-test', RATE_LIMITS.ai);
  if (rl) return rl;

  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  const { id } = await context.params;
  if (!isValidUuid(id)) {
    return NextResponse.json({ error: 'Invalid provider id' }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    const { data: row, error: fetchErr } = await supabase
      .from('ai_providers')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchErr || !row) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    const apiKey = decryptApiKey(row.api_key_encrypted);

    const config: ProviderConfig = {
      id: row.id,
      provider_type: row.provider_type,
      api_key: apiKey,
      model_id: row.model_id,
      display_name: row.display_name,
      priority: 0,
      is_active: true,
    };

    let success = false;
    let errorMsg: string | null = null;

    try {
      const registry = buildRegistry([config]);
      const model = registry.getModel(row.id);
      await generateText({ model, prompt: 'Hello', maxTokens: 5 });
      success = true;
    } catch (err) {
      errorMsg = getErrorMessage(err, 'Connectivity test failed');
    }

    // Update test status in DB
    await supabase
      .from('ai_providers')
      .update({
        last_test_at: new Date().toISOString(),
        last_test_success: success,
        is_active: success ? row.is_active : false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    return NextResponse.json({ success, error: errorMsg });
  } catch (error) {
    console.error('Provider test error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to test provider') },
      { status: 500 },
    );
  }
}
