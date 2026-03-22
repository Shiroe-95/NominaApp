import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

const VALID_STRATEGIES = ['cost-first', 'quality-first', 'balanced'] as const;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'message' in error)
    return String((error as { message: unknown }).message);
  return fallback;
}

/**
 * GET /api/admin/optimization-config
 *
 * Returns the current optimization configuration and all model routing rules.
 * Validates: Requirements 7.1, 7.5
 */
export async function GET() {
  const supabase = createAdminClient();

  try {
    // Fetch optimization config (single row)
    const { data: config, error: configError } = await supabase
      .from('optimization_config')
      .select('*')
      .limit(1)
      .single();

    if (configError) {
      return NextResponse.json(
        { error: getErrorMessage(configError, 'Failed to fetch optimization config') },
        { status: 500 },
      );
    }

    // Fetch all routing rules
    const { data: rules, error: rulesError } = await supabase
      .from('model_routing_rules')
      .select('*')
      .order('created_at', { ascending: false });

    if (rulesError) {
      return NextResponse.json(
        { error: getErrorMessage(rulesError, 'Failed to fetch routing rules') },
        { status: 500 },
      );
    }

    return NextResponse.json({ config, rules: rules ?? [] });
  } catch (error) {
    console.error('Optimization config GET error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to fetch optimization configuration') },
      { status: 500 },
    );
  }
}


/**
 * PUT /api/admin/optimization-config
 *
 * Updates the optimization strategy, weights, min quality threshold,
 * and auto-routing toggle.
 *
 * Validations:
 *  - cost_weight + quality_weight must equal 1.0
 *  - min_quality_threshold must be between 0.0 and 1.0
 *  - strategy must be one of: 'cost-first', 'quality-first', 'balanced'
 *
 * Validates: Requirements 7.1, 7.2, 7.3, 7.5
 */
export async function PUT(req: Request) {
  const supabase = createAdminClient();

  try {
    const body = await req.json();

    const {
      strategy,
      cost_weight,
      quality_weight,
      min_quality_threshold,
      enable_auto_routing,
    } = body;

    // ── Validation ─────────────────────────────────────────────────

    // Strategy must be valid
    if (strategy !== undefined && !VALID_STRATEGIES.includes(strategy)) {
      return NextResponse.json(
        { error: `Invalid strategy. Must be one of: ${VALID_STRATEGIES.join(', ')}` },
        { status: 400 },
      );
    }

    // Weights must sum to 1.0
    if (cost_weight !== undefined || quality_weight !== undefined) {
      const cw = typeof cost_weight === 'number' ? cost_weight : undefined;
      const qw = typeof quality_weight === 'number' ? quality_weight : undefined;

      if (cw === undefined || qw === undefined) {
        return NextResponse.json(
          { error: 'Both cost_weight and quality_weight must be provided together' },
          { status: 400 },
        );
      }

      const sum = Math.round((cw + qw) * 100) / 100;
      if (sum !== 1.0) {
        return NextResponse.json(
          { error: 'cost_weight + quality_weight must equal 1.0' },
          { status: 400 },
        );
      }
    }

    // min_quality_threshold must be in [0.0, 1.0]
    if (min_quality_threshold !== undefined) {
      if (
        typeof min_quality_threshold !== 'number' ||
        min_quality_threshold < 0.0 ||
        min_quality_threshold > 1.0
      ) {
        return NextResponse.json(
          { error: 'min_quality_threshold must be a number between 0.0 and 1.0' },
          { status: 400 },
        );
      }
    }

    // enable_auto_routing must be boolean if provided
    if (enable_auto_routing !== undefined && typeof enable_auto_routing !== 'boolean') {
      return NextResponse.json(
        { error: 'enable_auto_routing must be a boolean' },
        { status: 400 },
      );
    }

    // ── Build update payload ───────────────────────────────────────

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (strategy !== undefined) update.strategy = strategy;
    if (cost_weight !== undefined) update.cost_weight = cost_weight;
    if (quality_weight !== undefined) update.quality_weight = quality_weight;
    if (min_quality_threshold !== undefined) update.min_quality_threshold = min_quality_threshold;
    if (enable_auto_routing !== undefined) update.enable_auto_routing = enable_auto_routing;

    // Fetch existing config id
    const { data: existing, error: fetchError } = await supabase
      .from('optimization_config')
      .select('id')
      .limit(1)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: getErrorMessage(fetchError, 'No optimization config found') },
        { status: 500 },
      );
    }

    // Update the config row
    const { data: updated, error: updateError } = await supabase
      .from('optimization_config')
      .update(update)
      .eq('id', existing.id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json(
        { error: getErrorMessage(updateError, 'Failed to update optimization config') },
        { status: 500 },
      );
    }

    return NextResponse.json({ config: updated });
  } catch (error) {
    console.error('Optimization config PUT error:', error);
    return NextResponse.json(
      { error: getErrorMessage(error, 'Failed to update optimization configuration') },
      { status: 500 },
    );
  }
}
