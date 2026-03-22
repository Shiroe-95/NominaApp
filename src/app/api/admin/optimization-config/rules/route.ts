import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const VALID_COMPLEXITY_LEVELS = ['simple', 'moderate', 'complex'] as const;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error)
    return String((error as { message: unknown }).message);
  return fallback;
}

/**
 * POST /api/admin/optimization-config/rules
 *
 * Create a new model routing rule.
 * Validates uniqueness of (task_type, agent_name, complexity_level).
 * Validates: Requirements 7.4, 8.2
 */
export async function POST(req: Request) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();

    const {
      task_type,
      agent_name,
      complexity_level,
      preferred_provider_type,
      preferred_model_id,
      max_cost_per_1k_tokens,
      min_quality_score,
      is_active,
    } = body;

    // ── Validation ─────────────────────────────────────────────────

    if (!task_type || !agent_name || !complexity_level || !preferred_provider_type || !preferred_model_id) {
      return NextResponse.json(
        { error: 'Missing required fields: task_type, agent_name, complexity_level, preferred_provider_type, preferred_model_id' },
        { status: 400 },
      );
    }

    if (!VALID_COMPLEXITY_LEVELS.includes(complexity_level)) {
      return NextResponse.json(
        { error: `Invalid complexity_level. Must be one of: ${VALID_COMPLEXITY_LEVELS.join(', ')}` },
        { status: 400 },
      );
    }

    if (min_quality_score !== undefined) {
      if (typeof min_quality_score !== 'number' || min_quality_score < 0 || min_quality_score > 1) {
        return NextResponse.json(
          { error: 'min_quality_score must be a number between 0 and 1' },
          { status: 400 },
        );
      }
    }

    // Check uniqueness of (task_type, agent_name, complexity_level)
    const { data: existing, error: lookupError } = await supabase
      .from('model_routing_rules')
      .select('id')
      .eq('task_type', task_type)
      .eq('agent_name', agent_name)
      .eq('complexity_level', complexity_level)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json(
        { error: getErrorMessage(lookupError, 'Failed to check for existing rule') },
        { status: 500 },
      );
    }

    if (existing) {
      return NextResponse.json(
        { error: 'A routing rule with this combination of task_type, agent_name, and complexity_level already exists' },
        { status: 409 },
      );
    }

    // ── Insert ─────────────────────────────────────────────────────

    const insert: Record<string, unknown> = {
      task_type,
      agent_name,
      complexity_level,
      preferred_provider_type,
      preferred_model_id,
    };

    if (max_cost_per_1k_tokens !== undefined) insert.max_cost_per_1k_tokens = max_cost_per_1k_tokens;
    if (min_quality_score !== undefined) insert.min_quality_score = min_quality_score;
    if (is_active !== undefined) insert.is_active = is_active;

    const { data: rule, error: insertError } = await supabase
      .from('model_routing_rules')
      .insert(insert)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: getErrorMessage(insertError, 'Failed to create routing rule') },
        { status: 500 },
      );
    }

    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    console.error('Routing rules POST error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to create routing rule') },
      { status: 500 },
    );
  }
}
