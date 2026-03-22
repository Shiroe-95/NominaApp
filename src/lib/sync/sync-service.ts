import { createAdminClient } from '@/lib/supabase/admin';
import { buildRegistry } from '@/lib/ai/providers';
import { executeWithFallback } from '@/lib/ai/fallback';
import { executeResearcher } from '@/lib/ai/agents/researcher';
import { decryptApiKey } from '@/lib/ai/encryption';
import { createNotification, mapConfidenceToSeverity } from '@/lib/notifications/notification-service';
import { logAudit } from '@/lib/audit/audit-service';
import type { SyncOptions, SyncResult } from '@/lib/types/regulatory-sync';
import type { AgentContext, ProviderConfig } from '@/lib/ai/types';

// ── Constants ───────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/** Frequency intervals in milliseconds. */
const FREQUENCY_MS: Record<string, number> = {
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

// ── Internal delay (overridable for tests) ──────────────────────────

export let _delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export function _setDelay(fn: (ms: number) => Promise<void>): void {
  _delay = fn;
}

// ── Frequency check ─────────────────────────────────────────────────

/**
 * Determines whether a sync should run for a given country based on
 * the configured frequency and the timestamp of the last completed sync.
 *
 * @param frequency - 'daily' | 'weekly' | 'monthly'
 * @param lastSyncAt - ISO timestamp of the last completed sync, or null.
 * @param now - Current timestamp (defaults to Date.now()).
 * @returns true if enough time has elapsed (or no previous sync exists).
 */
export function shouldSync(
  frequency: string,
  lastSyncAt: string | null,
  now: number = Date.now(),
): boolean {
  if (!lastSyncAt) return true;

  const interval = FREQUENCY_MS[frequency];
  if (!interval) return true; // unknown frequency → always sync

  const elapsed = now - new Date(lastSyncAt).getTime();
  return elapsed >= interval;
}

// ── Provider loading ────────────────────────────────────────────────

async function loadProviderRegistry() {
  const supabase = createAdminClient();

  const { data: providers, error } = await supabase
    .from('ai_providers')
    .select('*')
    .eq('is_active', true)
    .order('priority', { ascending: true });

  if (error || !providers || providers.length === 0) {
    throw new Error('No active AI providers configured for sync');
  }

  const configs: ProviderConfig[] = providers.map((p) => ({
    id: p.id as string,
    provider_type: p.provider_type as ProviderConfig['provider_type'],
    api_key: decryptApiKey(p.api_key_encrypted as string),
    model_id: p.model_id as string,
    display_name: p.display_name as string,
    priority: p.priority as number,
    is_active: true,
  }));

  return buildRegistry(configs);
}

// ── Next-year rule draft generation ─────────────────────────────────

/**
 * Ensures that rules exist for year N+1 for a given country.
 * If no rules exist for the next year, copies the structure from the
 * current year with `status='draft'` and logs an audit entry.
 *
 * Requirements: 3.1
 *
 * @param countryCode - Código ISO del país (ej. 'CO', 'MX').
 * @param currentYear - Año fiscal actual (N). Se crearán borradores para N+1.
 * @returns `true` if a draft was created, `false` if rules already existed
 *          or no source rules were found for the current year.
 */
export async function ensureNextYearRules(
  countryCode: string,
  currentYear: number,
): Promise<boolean> {
  const supabase = createAdminClient();
  const nextYear = currentYear + 1;

  // Check if rules already exist for year N+1
  const { data: existing } = await supabase
    .from('country_year_rules')
    .select('id')
    .eq('country_code', countryCode)
    .eq('rule_year', nextYear)
    .limit(1);

  if (existing && existing.length > 0) {
    return false; // Rules already exist for next year
  }

  // Load rules from current year (year N)
  const { data: currentRules } = await supabase
    .from('country_year_rules')
    .select('*')
    .eq('country_code', countryCode)
    .eq('rule_year', currentYear);

  if (!currentRules || currentRules.length === 0) {
    return false; // No source rules to copy from
  }

  // Copy each rule with status='draft' for year N+1
  for (const rule of currentRules) {
    const { data: newRule, error: insertError } = await supabase
      .from('country_year_rules')
      .insert({
        country_code: rule.country_code,
        rule_year: nextYear,
        label: rule.label,
        required_fields: rule.required_fields,
        required_calculations: rule.required_calculations,
        checks: rule.checks,
        status: 'draft',
      })
      .select('id')
      .single();

    if (insertError || !newRule) {
      throw new Error(
        `Failed to create draft rule for ${countryCode} ${nextYear}: ${insertError?.message ?? 'unknown'}`,
      );
    }

    // Log audit entry for the creation
    await logAudit({
      ruleId: newRule.id,
      action: 'created',
      origin: 'automatic',
      previousValues: null,
      newValues: {
        countryCode,
        year: nextYear,
        copiedFromYear: currentYear,
        status: 'draft',
      },
      sourceIds: ['draft-generation'],
    });
  }

  return true;
}

// ── Apply changes to a rule ─────────────────────────────────────────

/**
 * Applies changes to an existing rule and sets its status to `pending_review`.
 *
 * Requirements: 3.2
 *
 * @param ruleId - The UUID of the rule to update.
 * @param changes - An object with the fields to update on the rule.
 */
export async function applyChangesToRule(
  ruleId: string,
  changes: Record<string, unknown>,
): Promise<void> {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from('country_year_rules')
    .update({
      ...changes,
      status: 'pending_review',
    })
    .eq('id', ruleId);

  if (error) {
    throw new Error(
      `Failed to apply changes to rule ${ruleId}: ${error.message}`,
    );
  }
}

// ── Sync for a single country ───────────────────────────────────────

async function syncCountry(
  countryCode: string,
  year: number,
  triggerType: 'automatic' | 'manual',
): Promise<SyncResult> {
  const supabase = createAdminClient();
  const startTime = Date.now();

  // 1. Create sync_history entry (in_progress)
  const { data: syncRow, error: insertError } = await supabase
    .from('sync_history')
    .insert({
      country_code: countryCode,
      rule_year: year,
      status: 'in_progress',
      trigger_type: triggerType,
    })
    .select('id')
    .single();

  if (insertError || !syncRow) {
    return {
      countryCode,
      year,
      status: 'failed',
      changesDetected: 0,
      confidence: 'low',
      duration: Date.now() - startTime,
      error: `Failed to create sync_history: ${insertError?.message ?? 'unknown'}`,
    };
  }

  const syncId = syncRow.id;

  // 1b. Ensure next-year draft rules exist (Req 3.1)
  try {
    await ensureNextYearRules(countryCode, year);
  } catch {
    // Non-fatal: log but continue with sync
  }

  // 2. Invoke researcher agent with retries (3 attempts, exponential backoff)
  let lastError: string | undefined;
  let retryCount = 0;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const registry = await loadProviderRegistry();

      const context: AgentContext = {
        countryCode,
        year,
        previousResults: {
          userMessage: `Investiga la normativa laboral vigente para ${countryCode} año ${year}. Busca las regulaciones, compara con las reglas existentes, actualiza si hay cambios y registra las fuentes.`,
        },
      };

      const fallbackResult = await executeWithFallback(
        registry,
        (model) => executeResearcher(context, model),
        { agentName: 'researcher', taskType: 'sync' },
      );

      const agentResult = fallbackResult.result;

      if (!agentResult.success) {
        throw new Error(
          (agentResult.data as Record<string, unknown>)?.['error'] as string ??
          'Researcher agent failed',
        );
      }

      // 3. Extract results from agent
      const researchData = agentResult.data as Record<string, unknown>;
      const confidence = (researchData.confidence as 'high' | 'medium' | 'low') ?? 'low';
      const rulesUpdated = researchData.rulesUpdated === true;
      const changesDetected = rulesUpdated ? 1 : 0;

      // 4. Update sync_history → completed
      await supabase
        .from('sync_history')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          changes_detected: changesDetected,
          confidence,
          retry_count: retryCount,
        })
        .eq('id', syncId);

      // 5. Fire notifications and audit if changes detected
      if (changesDetected > 0) {
        await handleChangesDetected(countryCode, year, confidence, researchData);
      } else {
        // No changes — notify that no changes were found (Req 3.6)
        await createNotification({
          type: 'sync_completed',
          severity: 'info',
          title: `Sincronización completada: ${countryCode} ${year}`,
          body: `No se detectaron cambios regulatorios para ${countryCode} año ${year}.`,
          metadata: { countryCode, year, changesDetected: 0 },
        });
      }

      return {
        countryCode,
        year,
        status: 'completed',
        changesDetected,
        confidence,
        duration: Date.now() - startTime,
      };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      retryCount = attempt + 1;

      if (attempt < MAX_RETRIES - 1) {
        const delayMs = BASE_DELAY_MS * Math.pow(2, attempt);
        await _delay(delayMs);
      }
    }
  }

  // All retries exhausted → mark as failed
  await supabase
    .from('sync_history')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: lastError,
      retry_count: retryCount,
    })
    .eq('id', syncId);

  return {
    countryCode,
    year,
    status: 'failed',
    changesDetected: 0,
    confidence: 'low',
    duration: Date.now() - startTime,
    error: lastError,
  };
}

// ── Handle detected changes ─────────────────────────────────────────

async function handleChangesDetected(
  countryCode: string,
  year: number,
  confidence: 'high' | 'medium' | 'low',
  researchData: Record<string, unknown>,
) {
  const severity = mapConfidenceToSeverity(confidence);

  // Create notification for regulatory change
  await createNotification({
    type: 'regulatory_change',
    severity,
    title: `Cambios regulatorios detectados: ${countryCode} ${year}`,
    body: `Se detectaron cambios en la normativa laboral de ${countryCode} para el año ${year}. Confianza: ${confidence}.`,
    metadata: { countryCode, year, confidence },
  });

  // Log audit entry for the rule change
  const supabase = createAdminClient();
  const { data: rule } = await supabase
    .from('country_year_rules')
    .select('id')
    .eq('country_code', countryCode)
    .eq('rule_year', year)
    .single();

  if (rule) {
    // Apply changes and mark rule as pending_review (Req 3.2)
    const ruleChanges: Record<string, unknown> = {};
    if (researchData.checks) ruleChanges.checks = researchData.checks;
    if (researchData.required_fields) ruleChanges.required_fields = researchData.required_fields;
    if (researchData.required_calculations) ruleChanges.required_calculations = researchData.required_calculations;

    if (Object.keys(ruleChanges).length > 0) {
      await applyChangesToRule(rule.id, ruleChanges);
    } else {
      // No specific field changes, but still mark as pending_review
      await applyChangesToRule(rule.id, {});
    }

    // Create notification for pending review
    await createNotification({
      type: 'rule_pending_review',
      severity,
      title: `Regla pendiente de revisión: ${countryCode} ${year}`,
      body: `La regla de ${countryCode} para el año ${year} fue actualizada automáticamente y requiere revisión. Confianza: ${confidence}.`,
      metadata: { countryCode, year, confidence, ruleId: rule.id },
    });

    // Get source IDs for audit trail
    const { data: sources } = await supabase
      .from('research_sources')
      .select('id')
      .eq('country_code', countryCode)
      .eq('rule_year', year)
      .order('created_at', { ascending: false })
      .limit(10);

    const sourceIds = (sources ?? []).map((s) => s.id as string);

    await logAudit({
      ruleId: rule.id,
      action: 'updated',
      origin: 'automatic',
      previousValues: null,
      newValues: {
        countryCode,
        year,
        confidence,
        aiSummary: researchData.aiSummary ?? null,
      },
      sourceIds: sourceIds.length > 0 ? sourceIds : ['auto-sync'],
    });
  }
}

// ── Bootstrap: create initial rules for countries with zero rules ────

/**
 * Checks if a country has ANY rules in `country_year_rules`.
 * If not, invokes the researcher agent to create initial rules
 * from web search (or REGULATION_DB fallback).
 *
 * This solves the bootstrap problem: new countries or fresh deployments
 * have no rules, so `ensureNextYearRules` can't copy from year N.
 * The researcher agent will search the web, create rules, and store sources.
 *
 * @param countryCode - ISO country code.
 * @param year - Current fiscal year.
 * @returns true if bootstrap was needed and executed, false if rules already exist.
 */
export async function bootstrapCountryRules(
  countryCode: string,
  year: number,
): Promise<boolean> {
  const supabase = createAdminClient();

  // Check if ANY rules exist for this country (any year)
  const { data: existing } = await supabase
    .from('country_year_rules')
    .select('id')
    .eq('country_code', countryCode)
    .limit(1);

  if (existing && existing.length > 0) {
    return false; // Rules already exist — no bootstrap needed
  }

  // No rules at all → invoke researcher to create initial rules
  try {
    const registry = await loadProviderRegistry();

    const context: AgentContext = {
      countryCode,
      year,
      previousResults: {
        userMessage: `BOOTSTRAP INICIAL: No existen reglas para ${countryCode} año ${year}. Investiga la normativa laboral vigente, crea las reglas completas (campos requeridos, cálculos obligatorios y verificaciones normativas) y registra las fuentes. Usa web_search primero para obtener datos actualizados, luego search_regulations como respaldo, y finalmente create_rule para guardar las reglas.`,
      },
    };

    const fallbackResult = await executeWithFallback(
      registry,
      (model) => executeResearcher(context, model),
      { agentName: 'researcher', taskType: 'bootstrap' },
    );

    const agentResult = fallbackResult.result;

    // Log the bootstrap event
    await logAudit({
      ruleId: 'bootstrap',
      action: 'created',
      origin: 'automatic',
      previousValues: null,
      newValues: {
        countryCode,
        year,
        bootstrapped: true,
        success: agentResult.success,
      },
      sourceIds: ['bootstrap-sync'],
    });

    // Notify about bootstrap
    await createNotification({
      type: 'sync_completed',
      severity: agentResult.success ? 'info' : 'warning',
      title: `Bootstrap de reglas: ${countryCode} ${year}`,
      body: agentResult.success
        ? `Se crearon las reglas iniciales para ${countryCode} año ${year} mediante investigación automática.`
        : `El bootstrap de reglas para ${countryCode} ${year} completó con advertencias. Revise las reglas manualmente.`,
      metadata: { countryCode, year, bootstrapped: true },
    });

    return true;
  } catch (err) {
    // Bootstrap failed — log but don't throw (sync will still attempt)
    console.error(`Bootstrap failed for ${countryCode}:`, err);

    await createNotification({
      type: 'sync_completed',
      severity: 'warning',
      title: `Bootstrap fallido: ${countryCode} ${year}`,
      body: `No se pudieron crear reglas iniciales para ${countryCode}. El agente investigador intentará crearlas durante la sincronización.`,
      metadata: { countryCode, year, error: err instanceof Error ? err.message : 'unknown' },
    });

    return false;
  }
}

// ── Main entry point ────────────────────────────────────────────────

/**
 * Runs the regulatory sync process.
 *
 * - If `options.countryCode` is provided, syncs only that country.
 * - Otherwise, syncs all active countries from `supported_countries`.
 * - Respects configured frequency unless `options.force` is true.
 * - Bootstraps countries with zero rules before syncing.
 * - Records each execution in `sync_history`.
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5
 */
export async function runSync(options: SyncOptions = {}): Promise<SyncResult[]> {
  const supabase = createAdminClient();
  const year = options.year ?? new Date().getFullYear();
  const results: SyncResult[] = [];

  // 1. Determine which countries to sync
  let countries: Array<{ country_code: string }>;

  if (options.countryCode) {
    countries = [{ country_code: options.countryCode }];
  } else {
    const { data, error } = await supabase
      .from('supported_countries')
      .select('country_code')
      .eq('is_active', true);

    if (error || !data) {
      throw new Error(`Failed to load active countries: ${error?.message ?? 'unknown'}`);
    }

    countries = data;
  }

  // 2. Iterate over each country
  for (const { country_code } of countries) {
    // 2a. Bootstrap: if country has NO rules at all, create initial ones
    await bootstrapCountryRules(country_code, year);

    // 2b. Check frequency (skip if not due, unless forced)
    if (!options.force) {
      const { data: lastSync } = await supabase
        .from('sync_history')
        .select('completed_at')
        .eq('country_code', country_code)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(1)
        .single();

      const lastSyncAt = lastSync?.completed_at ?? null;

      // Default frequency is weekly
      const frequency = 'weekly';

      if (!shouldSync(frequency, lastSyncAt)) {
        continue; // skip — not due yet
      }
    }

    // 2c. Run sync for this country
    const triggerType = options.force ? 'manual' : 'automatic';
    const result = await syncCountry(country_code, year, triggerType);
    results.push(result);
  }

  return results;
}
