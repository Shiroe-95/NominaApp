import { NextResponse } from 'next/server';
import { generateText } from 'ai';
import { createAdminClient } from '@/lib/supabase/admin';
import { encryptApiKey } from '@/lib/ai/encryption';
import { ProviderConfigSchema } from '@/lib/ai/schemas';
import { buildRegistry } from '@/lib/ai/providers';
import type { ProviderConfig } from '@/lib/ai/types';

function maskApiKey(key: string): string {
  if (key.length <= 4) return '****';
  return '*'.repeat(key.length - 4) + key.slice(-4);
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error)
    return String((error as { message: unknown }).message);
  return error instanceof Error ? error.message : fallback;
}

/** GET /api/settings/providers — list all providers (API keys masked) */
export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('ai_providers')
    .select('*')
    .order('priority', { ascending: true });

  if (error) {
    console.error('Providers GET error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to load providers') },
      { status: 500 },
    );
  }

  const providers = (data ?? []).map((row) => ({
    id: row.id,
    provider_type: row.provider_type,
    display_name: row.display_name,
    api_key_masked: maskApiKey('encrypted'), // never expose real key
    model_id: row.model_id,
    priority: row.priority,
    is_active: row.is_active,
    last_test_at: row.last_test_at,
    last_test_success: row.last_test_success,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));

  return NextResponse.json({ providers });
}

/** POST /api/settings/providers — create a new provider + validate connectivity */
export async function POST(req: Request) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();

    // Validate input with Zod (id is optional on create)
    const parsed = ProviderConfigSchema.omit({ id: true }).safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid payload', details: parsed.error.flatten().fieldErrors },
        { status: 400 },
      );
    }

    const { provider_type, display_name, api_key, model_id, priority, is_active } =
      parsed.data;

    // Test connectivity before saving
    let testSuccess = false;
    let testError: string | null = null;

    try {
      const tempConfig: ProviderConfig = {
        id: 'temp',
        provider_type,
        api_key,
        model_id,
        display_name,
        priority: 0,
        is_active: true,
      };
      const registry = buildRegistry([tempConfig]);
      const model = registry.getModel('temp');
      await generateText({ model, prompt: 'Hello', maxTokens: 5 });
      testSuccess = true;
    } catch (err) {
      testError = getErrorMessage(err, 'Connectivity test failed');
    }

    // Encrypt the API key before storing
    const apiKeyEncrypted = encryptApiKey(api_key);

    const { data, error } = await supabase
      .from('ai_providers')
      .insert({
        provider_type,
        display_name,
        api_key_encrypted: apiKeyEncrypted,
        model_id,
        priority,
        is_active: testSuccess ? is_active : false, // mark inactive if test failed
        last_test_at: new Date().toISOString(),
        last_test_success: testSuccess,
      })
      .select()
      .single();

    if (error) {
      console.error('Providers POST error:', error);
      return NextResponse.json(
        { error: getErrorMessage(error, 'Failed to create provider') },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        provider: {
          ...data,
          api_key_encrypted: undefined,
          api_key_masked: maskApiKey(api_key),
        },
        connectivity: { success: testSuccess, error: testError },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Providers POST error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to create provider') },
      { status: 500 },
    );
  }
}
