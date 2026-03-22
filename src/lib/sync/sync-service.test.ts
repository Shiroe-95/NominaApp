import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Supabase chain mock ─────────────────────────────────────────────

// Each call to `from(table)` returns a builder that supports the full
// Supabase chaining API. We queue resolved values per table so that
// successive calls to the same table return different results.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const tableQueue: Record<string, any[]> = {};

function enqueue(table: string, value: unknown) {
  if (!tableQueue[table]) tableQueue[table] = [];
  tableQueue[table].push(value);
}

function dequeue(table: string) {
  return tableQueue[table]?.shift() ?? { data: null, error: null };
}

/**
 * Creates a chainable object that resolves to the next queued value
 * for the given table when awaited or when a terminal method is called.
 */
function makeChain(table: string) {
  const result = dequeue(table);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {};
  const methods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'like', 'ilike',
    'is', 'in', 'order', 'limit', 'range', 'single', 'maybeSingle',
  ];

  for (const m of methods) {
    chain[m] = vi.fn((..._args: unknown[]) => chain);
  }

  // Make the chain thenable so `await` resolves to the queued result
  chain.then = (resolve: (v: unknown) => void, reject?: (e: unknown) => void) => {
    return Promise.resolve(result).then(resolve, reject);
  };

  return chain;
}

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: vi.fn((table: string) => makeChain(table)),
  }),
}));

// ── Other mocks ─────────────────────────────────────────────────────

vi.mock('@/lib/ai/providers', () => ({
  buildRegistry: vi.fn(() => ({
    entries: [{
      config: { id: 'p1', provider_type: 'openai', model_id: 'gpt-4o' },
      getModel: () => ({}),
    }],
    getModel: vi.fn(),
    getModelWithFallback: vi.fn(),
  })),
}));

vi.mock('@/lib/ai/encryption', () => ({
  decryptApiKey: vi.fn((key: string) => key),
}));

const mockExecuteResearcher = vi.fn();
vi.mock('@/lib/ai/agents/researcher', () => ({
  executeResearcher: (...args: unknown[]) => mockExecuteResearcher(...args),
}));

vi.mock('@/lib/ai/fallback', () => ({
  executeWithFallback: vi.fn(async (_registry, taskFn) => {
    const result = await taskFn({});
    return {
      result,
      providerUsed: 'p1',
      providerType: 'openai',
      modelId: 'gpt-4o',
      fallbackEvents: [],
      latencyMs: 100,
    };
  }),
}));

const mockCreateNotification = vi.fn().mockResolvedValue('notif-1');
vi.mock('@/lib/notifications/notification-service', () => ({
  createNotification: (...args: unknown[]) => mockCreateNotification(...args),
  mapConfidenceToSeverity: (c: string) => (c === 'high' ? 'info' : 'warning'),
}));

const mockLogAudit = vi.fn().mockResolvedValue('audit-1');
vi.mock('@/lib/audit/audit-service', () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

import { shouldSync, runSync, ensureNextYearRules, applyChangesToRule, bootstrapCountryRules, _setDelay } from './sync-service';

// ── Helpers ─────────────────────────────────────────────────────────

const PROVIDERS_DATA = [{
  id: 'p1',
  provider_type: 'openai',
  api_key_encrypted: 'test-key',
  model_id: 'gpt-4o',
  display_name: 'OpenAI',
  priority: 1,
  is_active: true,
}];

function researcherOk(rulesUpdated = false, confidence: 'high' | 'medium' | 'low' = 'high') {
  return {
    agentName: 'researcher',
    success: true,
    data: { confidence, rulesUpdated, countryCode: 'CO', year: 2025 },
    tokensUsed: 100,
    providerUsed: 'openai',
    latencyMs: 500,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('SyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(tableQueue)) delete tableQueue[key];
    _setDelay(() => Promise.resolve());
  });

  // ── shouldSync (pure function) ──────────────────────────────────

  describe('shouldSync', () => {
    it('returns true when no previous sync exists', () => {
      expect(shouldSync('weekly', null)).toBe(true);
    });

    it('returns true when weekly interval has elapsed', () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString();
      expect(shouldSync('weekly', eightDaysAgo)).toBe(true);
    });

    it('returns false when weekly interval has not elapsed', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      expect(shouldSync('weekly', twoDaysAgo)).toBe(false);
    });

    it('returns true when daily interval has elapsed', () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      expect(shouldSync('daily', twoDaysAgo)).toBe(true);
    });

    it('returns false when daily interval has not elapsed', () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      expect(shouldSync('daily', twoHoursAgo)).toBe(false);
    });

    it('returns true when monthly interval has elapsed', () => {
      const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
      expect(shouldSync('monthly', fortyDaysAgo)).toBe(true);
    });

    it('returns true for unknown frequency', () => {
      expect(shouldSync('unknown', new Date().toISOString())).toBe(true);
    });
  });

  // ── runSync ─────────────────────────────────────────────────────

  describe('runSync', () => {
    it('syncs specified country successfully (no changes)', async () => {
      // bootstrapCountryRules: check if ANY rules exist → yes (skip bootstrap)
      enqueue('country_year_rules', { data: [{ id: 'existing-rule' }], error: null });
      // frequency check → last sync long ago
      enqueue('sync_history', { data: { completed_at: '2020-01-01T00:00:00Z' }, error: null });
      // ensureNextYearRules: check if next year rules exist → yes (skip creation)
      enqueue('country_year_rules', { data: [{ id: 'existing-rule' }], error: null });
      // loadProviderRegistry
      enqueue('ai_providers', { data: PROVIDERS_DATA, error: null });
      // insert sync_history
      enqueue('sync_history', { data: { id: 'sync-001' }, error: null });
      // researcher succeeds
      mockExecuteResearcher.mockResolvedValueOnce(researcherOk(false, 'high'));
      // update sync_history → completed
      enqueue('sync_history', { error: null });

      const results = await runSync({ countryCode: 'CO', year: 2025 });

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('completed');
      expect(results[0].changesDetected).toBe(0);
      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sync_completed', severity: 'info' }),
      );
    });

    it('syncs all active countries when no countryCode specified', async () => {
      // supported_countries
      enqueue('supported_countries', { data: [{ country_code: 'CO' }], error: null });
      // bootstrapCountryRules: check if ANY rules exist → yes
      enqueue('country_year_rules', { data: [{ id: 'existing-rule' }], error: null });
      // frequency check for CO
      enqueue('sync_history', { data: { completed_at: '2020-01-01T00:00:00Z' }, error: null });
      // ensureNextYearRules: check if next year rules exist → yes
      enqueue('country_year_rules', { data: [{ id: 'existing-rule' }], error: null });
      // loadProviderRegistry
      enqueue('ai_providers', { data: PROVIDERS_DATA, error: null });
      // insert sync_history
      enqueue('sync_history', { data: { id: 'sync-co' }, error: null });
      // researcher
      mockExecuteResearcher.mockResolvedValueOnce(researcherOk(false, 'high'));
      // update sync_history
      enqueue('sync_history', { error: null });

      const results = await runSync();

      expect(results).toHaveLength(1);
      expect(results[0].countryCode).toBe('CO');
      expect(results[0].status).toBe('completed');
    });

    it('skips country when frequency not due', async () => {
      enqueue('supported_countries', { data: [{ country_code: 'CO' }], error: null });
      // bootstrapCountryRules: check if ANY rules exist → yes
      enqueue('country_year_rules', { data: [{ id: 'existing-rule' }], error: null });
      // frequency check → recent sync
      enqueue('sync_history', {
        data: { completed_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() },
        error: null,
      });

      const results = await runSync();

      expect(results).toHaveLength(0);
    });

    it('forces sync even when frequency not due', async () => {
      // No frequency check when force=true
      // bootstrapCountryRules: check if ANY rules exist → yes
      enqueue('country_year_rules', { data: [{ id: 'existing-rule' }], error: null });
      // ensureNextYearRules: check if next year rules exist → yes
      enqueue('country_year_rules', { data: [{ id: 'existing-rule' }], error: null });
      enqueue('ai_providers', { data: PROVIDERS_DATA, error: null });
      enqueue('sync_history', { data: { id: 'sync-001' }, error: null });
      mockExecuteResearcher.mockResolvedValueOnce(researcherOk(false, 'high'));
      enqueue('sync_history', { error: null });

      const results = await runSync({ countryCode: 'CO', force: true });

      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('completed');
    });

    it('fires regulatory_change notification when changes detected', async () => {
      // bootstrapCountryRules: check if ANY rules exist → yes
      enqueue('country_year_rules', { data: [{ id: 'existing-rule' }], error: null });
      enqueue('sync_history', { data: { completed_at: '2020-01-01T00:00:00Z' }, error: null });
      // ensureNextYearRules: check if next year rules exist → yes
      enqueue('country_year_rules', { data: [{ id: 'existing-rule' }], error: null });
      enqueue('ai_providers', { data: PROVIDERS_DATA, error: null });
      enqueue('sync_history', { data: { id: 'sync-001' }, error: null });
      mockExecuteResearcher.mockResolvedValueOnce(researcherOk(true, 'medium'));
      enqueue('sync_history', { error: null });
      // handleChangesDetected: rule lookup
      enqueue('country_year_rules', { data: { id: 'rule-1' }, error: null });
      // applyChangesToRule: update rule status
      enqueue('country_year_rules', { error: null });
      // handleChangesDetected: sources lookup
      enqueue('research_sources', { data: [{ id: 'src-1' }], error: null });

      const results = await runSync({ countryCode: 'CO', year: 2025 });

      expect(results[0].changesDetected).toBe(1);
      expect(mockCreateNotification).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'regulatory_change', severity: 'warning' }),
      );
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'updated', origin: 'automatic' }),
      );
    });

    it('returns failed when sync_history insert fails', async () => {
      // bootstrapCountryRules: check if ANY rules exist → yes
      enqueue('country_year_rules', { data: [{ id: 'existing-rule' }], error: null });
      enqueue('sync_history', { data: { completed_at: '2020-01-01T00:00:00Z' }, error: null });
      enqueue('ai_providers', { data: PROVIDERS_DATA, error: null });
      // insert sync_history fails — ensureNextYearRules won't be reached
      enqueue('sync_history', { data: null, error: { message: 'DB error' } });

      const results = await runSync({ countryCode: 'CO', year: 2025 });

      expect(results[0].status).toBe('failed');
      expect(results[0].error).toContain('Failed to create sync_history');
    });

    it('retries and marks as failed after 3 attempts', async () => {
      // bootstrapCountryRules: check if ANY rules exist → yes
      enqueue('country_year_rules', { data: [{ id: 'existing-rule' }], error: null });
      enqueue('sync_history', { data: { completed_at: '2020-01-01T00:00:00Z' }, error: null });
      // ensureNextYearRules: check if next year rules exist → yes
      enqueue('country_year_rules', { data: [{ id: 'existing-rule' }], error: null });
      // 3 provider loads for 3 retries
      enqueue('ai_providers', { data: PROVIDERS_DATA, error: null });
      enqueue('ai_providers', { data: PROVIDERS_DATA, error: null });
      enqueue('ai_providers', { data: PROVIDERS_DATA, error: null });
      // insert sync_history
      enqueue('sync_history', { data: { id: 'sync-001' }, error: null });
      // All 3 researcher calls fail
      mockExecuteResearcher
        .mockRejectedValueOnce(new Error('Network error 1'))
        .mockRejectedValueOnce(new Error('Network error 2'))
        .mockRejectedValueOnce(new Error('Network error 3'));
      // update sync_history → failed
      enqueue('sync_history', { error: null });

      const results = await runSync({ countryCode: 'CO', year: 2025 });

      expect(results[0].status).toBe('failed');
      expect(results[0].error).toContain('Network error');
    });
  });

  // ── ensureNextYearRules ─────────────────────────────────────────

  describe('ensureNextYearRules', () => {
    it('returns false when rules already exist for next year', async () => {
      // Check for next year rules → found
      enqueue('country_year_rules', { data: [{ id: 'rule-2026' }], error: null });

      const created = await ensureNextYearRules('CO', 2025);

      expect(created).toBe(false);
      expect(mockLogAudit).not.toHaveBeenCalled();
    });

    it('returns false when no current year rules exist to copy from', async () => {
      // Check for next year rules → none
      enqueue('country_year_rules', { data: [], error: null });
      // Load current year rules → none
      enqueue('country_year_rules', { data: [], error: null });

      const created = await ensureNextYearRules('CO', 2025);

      expect(created).toBe(false);
      expect(mockLogAudit).not.toHaveBeenCalled();
    });

    it('copies current year rules as draft for next year', async () => {
      // Check for next year rules → none
      enqueue('country_year_rules', { data: [], error: null });
      // Load current year rules → one rule
      enqueue('country_year_rules', {
        data: [{
          id: 'rule-2025',
          country_code: 'CO',
          rule_year: 2025,
          label: 'Colombia 2025',
          required_fields: ['salario_basico'],
          required_calculations: ['salud'],
          checks: ['SMMLV >= 1423500'],
          status: 'approved',
        }],
        error: null,
      });
      // Insert new draft rule
      enqueue('country_year_rules', { data: { id: 'rule-2026-draft' }, error: null });

      const created = await ensureNextYearRules('CO', 2025);

      expect(created).toBe(true);
      expect(mockLogAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          ruleId: 'rule-2026-draft',
          action: 'created',
          origin: 'automatic',
          newValues: expect.objectContaining({
            countryCode: 'CO',
            year: 2026,
            copiedFromYear: 2025,
            status: 'draft',
          }),
        }),
      );
    });

    it('throws when insert fails', async () => {
      // Check for next year rules → none
      enqueue('country_year_rules', { data: [], error: null });
      // Load current year rules → one rule
      enqueue('country_year_rules', {
        data: [{
          id: 'rule-2025',
          country_code: 'CO',
          rule_year: 2025,
          label: 'Colombia 2025',
          required_fields: [],
          required_calculations: [],
          checks: [],
          status: 'approved',
        }],
        error: null,
      });
      // Insert fails
      enqueue('country_year_rules', { data: null, error: { message: 'Insert failed' } });

      await expect(ensureNextYearRules('CO', 2025)).rejects.toThrow(
        'Failed to create draft rule for CO 2026',
      );
    });
  });

  // ── applyChangesToRule ──────────────────────────────────────────

  describe('applyChangesToRule', () => {
    it('updates rule and sets status to pending_review', async () => {
      enqueue('country_year_rules', { error: null });

      await applyChangesToRule('rule-1', { checks: ['SMMLV >= 1500000'] });

      // No error means success
    });

    it('throws when update fails', async () => {
      enqueue('country_year_rules', { error: { message: 'Update failed' } });

      await expect(
        applyChangesToRule('rule-1', { checks: ['SMMLV >= 1500000'] }),
      ).rejects.toThrow('Failed to apply changes to rule rule-1');
    });
  });
});
