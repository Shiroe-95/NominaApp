import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuditEntry } from '@/lib/types/regulatory-sync';

// ── Chainable mock builder ──────────────────────────────────────────

function createChainMock(resolvedValue?: { data: unknown; error: unknown }) {
  const terminal = resolvedValue
    ? vi.fn().mockResolvedValue(resolvedValue)
    : vi.fn();

  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;

  chain.select = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.delete = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.lt = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.lte = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = terminal;
  chain.single = terminal;

  return { chain, terminal };
}

// ── Mock Supabase ───────────────────────────────────────────────────

let ruleAuditMock: ReturnType<typeof createChainMock>;
let extAuditMock: ReturnType<typeof createChainMock>;

const mockFrom = vi.fn((table: string) => {
  if (table === 'rule_audit_log') return ruleAuditMock.chain;
  if (table === 'audit_trail_extended') return extAuditMock.chain;
  return {};
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import {
  logAudit,
  getAuditHistory,
  logAction,
  queryAuditTrail,
  exportAuditCSV,
  exportAuditPDF,
  getRetentionCutoffDate,
  purgeExpiredEntries,
  RETENTION_DAYS,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  type AuditLogActionInput,
  type AuditTrailRow,
} from './audit-service';

// ── Helpers ─────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    ruleId: 'rule-001',
    action: 'updated',
    origin: 'manual',
    previousValues: { smmlv: 1300000 },
    newValues: { smmlv: 1423500 },
    userId: 'user-abc',
    ...overrides,
  };
}

function makeActionInput(overrides: Partial<AuditLogActionInput> = {}): AuditLogActionInput {
  return {
    workspace_id: 'ws-001',
    user_id: 'user-001',
    action_type: 'create',
    resource_type: 'payroll',
    resource_id: 'payroll-001',
    data_before: null,
    data_after: { name: 'January 2025' },
    ip_address: '192.168.1.1',
    user_agent: 'Mozilla/5.0',
    severity: 'info',
    ...overrides,
  };
}

function makeAuditRow(overrides: Partial<AuditTrailRow> = {}): AuditTrailRow {
  return {
    id: 'audit-001',
    workspace_id: 'ws-001',
    user_id: 'user-001',
    action_type: 'create',
    resource_type: 'payroll',
    resource_id: 'payroll-001',
    data_before: null,
    data_after: { name: 'January 2025' },
    ip_address: '192.168.1.1',
    user_agent: 'Mozilla/5.0',
    severity: 'info',
    created_at: '2025-01-15T10:00:00Z',
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('AuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ruleAuditMock = createChainMock();
    extAuditMock = createChainMock();
  });

  // ── Legacy logAudit ─────────────────────────────────────────────

  describe('logAudit', () => {
    it('inserts a manual audit entry and returns the id', async () => {
      ruleAuditMock.terminal.mockResolvedValueOnce({
        data: { id: 'audit-123' },
        error: null,
      });

      const id = await logAudit(makeEntry());

      expect(id).toBe('audit-123');
      expect(mockFrom).toHaveBeenCalledWith('rule_audit_log');
      expect(ruleAuditMock.chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          rule_id: 'rule-001',
          action: 'updated',
          origin: 'manual',
          user_id: 'user-abc',
        }),
      );
    });

    it('inserts an automatic audit entry with sourceIds', async () => {
      ruleAuditMock.terminal.mockResolvedValueOnce({
        data: { id: 'audit-456' },
        error: null,
      });

      const entry = makeEntry({
        origin: 'automatic',
        userId: undefined,
        sourceIds: ['src-1', 'src-2'],
      });

      const id = await logAudit(entry);

      expect(id).toBe('audit-456');
      expect(ruleAuditMock.chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: 'automatic',
          source_ids: ['src-1', 'src-2'],
          user_id: null,
        }),
      );
    });

    it('throws when automatic entry has no sourceIds', async () => {
      await expect(
        logAudit(makeEntry({ origin: 'automatic', sourceIds: undefined })),
      ).rejects.toThrow('Automatic audit entries require at least one sourceId');
    });

    it('throws when automatic entry has empty sourceIds', async () => {
      await expect(
        logAudit(makeEntry({ origin: 'automatic', sourceIds: [] })),
      ).rejects.toThrow('Automatic audit entries require at least one sourceId');
    });

    it('throws when manual entry has no userId', async () => {
      await expect(
        logAudit(makeEntry({ origin: 'manual', userId: undefined })),
      ).rejects.toThrow('Manual audit entries require a userId');
    });

    it('throws on Supabase insert error', async () => {
      ruleAuditMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { message: 'FK violation' },
      });

      await expect(logAudit(makeEntry())).rejects.toThrow(
        'Failed to insert audit log: FK violation',
      );
    });
  });

  // ── Legacy getAuditHistory ──────────────────────────────────────

  describe('getAuditHistory', () => {
    it('returns rows ordered by created_at ascending', async () => {
      const rows = [
        { id: 'a1', created_at: '2025-01-01T00:00:00Z' },
        { id: 'a2', created_at: '2025-06-01T00:00:00Z' },
      ];
      // getAuditHistory calls .select('*').eq(...).order(...) — order is the terminal
      // In our chain mock, order returns the chain itself, but we need it to resolve
      ruleAuditMock.chain.order.mockResolvedValueOnce({ data: rows, error: null });

      const result = await getAuditHistory('rule-001');

      expect(result).toEqual(rows);
      expect(mockFrom).toHaveBeenCalledWith('rule_audit_log');
      expect(ruleAuditMock.chain.select).toHaveBeenCalledWith('*');
      expect(ruleAuditMock.chain.eq).toHaveBeenCalledWith('rule_id', 'rule-001');
      expect(ruleAuditMock.chain.order).toHaveBeenCalledWith('created_at', { ascending: true });
    });

    it('returns empty array when no history exists', async () => {
      ruleAuditMock.chain.order.mockResolvedValueOnce({ data: [], error: null });

      const result = await getAuditHistory('rule-nonexistent');
      expect(result).toEqual([]);
    });

    it('throws on Supabase query error', async () => {
      ruleAuditMock.chain.order.mockResolvedValueOnce({
        data: null,
        error: { message: 'connection refused' },
      });

      await expect(getAuditHistory('rule-001')).rejects.toThrow(
        'Failed to fetch audit history: connection refused',
      );
    });
  });

  // ── Extended: logAction ─────────────────────────────────────────

  describe('logAction', () => {
    it('inserts an extended audit entry and returns the id', async () => {
      extAuditMock.terminal.mockResolvedValueOnce({
        data: { id: 'ext-001' },
        error: null,
      });

      const id = await logAction(makeActionInput());

      expect(id).toBe('ext-001');
      expect(mockFrom).toHaveBeenCalledWith('audit_trail_extended');
      expect(extAuditMock.chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: 'ws-001',
          user_id: 'user-001',
          action_type: 'create',
          resource_type: 'payroll',
          resource_id: 'payroll-001',
          severity: 'info',
        }),
      );
    });

    it('defaults severity to info when not provided', async () => {
      extAuditMock.terminal.mockResolvedValueOnce({
        data: { id: 'ext-002' },
        error: null,
      });

      await logAction(makeActionInput({ severity: undefined }));

      expect(extAuditMock.chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'info' }),
      );
    });

    it('handles null data_before and data_after', async () => {
      extAuditMock.terminal.mockResolvedValueOnce({
        data: { id: 'ext-003' },
        error: null,
      });

      await logAction(makeActionInput({ data_before: undefined, data_after: undefined }));

      expect(extAuditMock.chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          data_before: null,
          data_after: null,
        }),
      );
    });

    it('throws when workspace_id is missing', async () => {
      await expect(
        logAction(makeActionInput({ workspace_id: '' })),
      ).rejects.toThrow('workspace_id is required');
    });

    it('throws when user_id is missing', async () => {
      await expect(
        logAction(makeActionInput({ user_id: '' })),
      ).rejects.toThrow('user_id is required');
    });

    it('throws when action_type is missing', async () => {
      await expect(
        logAction(makeActionInput({ action_type: '' })),
      ).rejects.toThrow('action_type is required');
    });

    it('throws when resource_type is missing', async () => {
      await expect(
        logAction(makeActionInput({ resource_type: '' })),
      ).rejects.toThrow('resource_type is required');
    });

    it('throws on Supabase insert error', async () => {
      extAuditMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { message: 'RLS violation' },
      });

      await expect(logAction(makeActionInput())).rejects.toThrow(
        'Failed to insert audit trail entry: RLS violation',
      );
    });
  });

  // ── Extended: queryAuditTrail ───────────────────────────────────

  describe('queryAuditTrail', () => {
    it('returns paginated results with cursor', async () => {
      const rows = [makeAuditRow({ id: 'a1' }), makeAuditRow({ id: 'a2' })];
      extAuditMock.terminal.mockResolvedValueOnce({ data: rows, error: null });

      const result = await queryAuditTrail({ workspace_id: 'ws-001' });

      expect(result.data).toEqual(rows);
      expect(result.has_more).toBe(false);
      expect(result.next_cursor).toBeNull();
    });

    it('detects has_more when extra row returned', async () => {
      // Default page size is 50, so return 51 rows to trigger has_more
      const rows = Array.from({ length: 4 }, (_, i) =>
        makeAuditRow({ id: `a${i}`, created_at: `2025-01-${String(15 - i).padStart(2, '0')}T10:00:00Z` }),
      );
      extAuditMock.terminal.mockResolvedValueOnce({ data: rows, error: null });

      const result = await queryAuditTrail(
        { workspace_id: 'ws-001' },
        { page_size: 3 },
      );

      expect(result.data).toHaveLength(3);
      expect(result.has_more).toBe(true);
      expect(result.next_cursor).toBe(result.data[2].created_at);
    });

    it('clamps page_size to MAX_PAGE_SIZE', async () => {
      extAuditMock.terminal.mockResolvedValueOnce({ data: [], error: null });

      await queryAuditTrail(
        { workspace_id: 'ws-001' },
        { page_size: 999 },
      );

      expect(extAuditMock.chain.limit).toHaveBeenCalledWith(MAX_PAGE_SIZE + 1);
    });

    it('clamps page_size minimum to 1', async () => {
      extAuditMock.terminal.mockResolvedValueOnce({ data: [], error: null });

      await queryAuditTrail(
        { workspace_id: 'ws-001' },
        { page_size: -5 },
      );

      expect(extAuditMock.chain.limit).toHaveBeenCalledWith(2); // 1 + 1
    });

    it('applies cursor filter', async () => {
      extAuditMock.terminal.mockResolvedValueOnce({ data: [], error: null });

      await queryAuditTrail(
        { workspace_id: 'ws-001' },
        { cursor: '2025-01-10T00:00:00Z' },
      );

      expect(extAuditMock.chain.lt).toHaveBeenCalledWith('created_at', '2025-01-10T00:00:00Z');
    });

    it('applies all optional filters', async () => {
      extAuditMock.terminal.mockResolvedValueOnce({ data: [], error: null });

      await queryAuditTrail({
        workspace_id: 'ws-001',
        action_type: 'create',
        resource_type: 'payroll',
        user_id: 'user-001',
        severity: 'critical',
        date_from: '2025-01-01T00:00:00Z',
        date_to: '2025-12-31T23:59:59Z',
      });

      // workspace_id eq is always called, plus the optional filters
      expect(extAuditMock.chain.eq).toHaveBeenCalledWith('workspace_id', 'ws-001');
      expect(extAuditMock.chain.eq).toHaveBeenCalledWith('action_type', 'create');
      expect(extAuditMock.chain.eq).toHaveBeenCalledWith('resource_type', 'payroll');
      expect(extAuditMock.chain.eq).toHaveBeenCalledWith('user_id', 'user-001');
      expect(extAuditMock.chain.eq).toHaveBeenCalledWith('severity', 'critical');
      expect(extAuditMock.chain.gte).toHaveBeenCalledWith('created_at', '2025-01-01T00:00:00Z');
      expect(extAuditMock.chain.lte).toHaveBeenCalledWith('created_at', '2025-12-31T23:59:59Z');
    });

    it('throws when workspace_id is missing', async () => {
      await expect(
        queryAuditTrail({ workspace_id: '' }),
      ).rejects.toThrow('workspace_id is required');
    });

    it('throws on Supabase query error', async () => {
      extAuditMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { message: 'timeout' },
      });

      await expect(
        queryAuditTrail({ workspace_id: 'ws-001' }),
      ).rejects.toThrow('Failed to query audit trail: timeout');
    });
  });

  // ── Extended: exportAuditCSV ────────────────────────────────────

  describe('exportAuditCSV', () => {
    it('generates CSV with BOM and headers', async () => {
      const rows = [makeAuditRow()];
      // exportAuditCSV calls fetchAllFilteredRows which calls queryAuditTrail
      // First call returns data, second call returns empty (no more pages)
      extAuditMock.terminal
        .mockResolvedValueOnce({ data: rows, error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const csv = await exportAuditCSV({ workspace_id: 'ws-001' });

      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('id,workspace_id,user_id,action_type');
      expect(csv).toContain('audit-001');
      expect(csv).toContain('payroll');
    });

    it('escapes commas and quotes in CSV values', async () => {
      const row = makeAuditRow({
        user_agent: 'Mozilla/5.0, Chrome',
        data_after: { note: 'value with "quotes"' },
      });
      extAuditMock.terminal
        .mockResolvedValueOnce({ data: [row], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const csv = await exportAuditCSV({ workspace_id: 'ws-001' });

      // Commas in user_agent should be quoted
      expect(csv).toContain('"Mozilla/5.0, Chrome"');
    });

    it('throws when workspace_id is missing', async () => {
      await expect(
        exportAuditCSV({ workspace_id: '' }),
      ).rejects.toThrow('workspace_id is required');
    });
  });

  // ── Extended: exportAuditPDF ────────────────────────────────────

  describe('exportAuditPDF', () => {
    it('returns structured PDF data', async () => {
      const rows = [makeAuditRow()];
      extAuditMock.terminal
        .mockResolvedValueOnce({ data: rows, error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const pdfData = await exportAuditPDF({ workspace_id: 'ws-001' });

      expect(pdfData.title).toBe('Audit Trail Report');
      expect(pdfData.total_entries).toBe(1);
      expect(pdfData.entries[0].action_type).toBe('create');
      expect(pdfData.generated_at).toBeDefined();
      expect(pdfData.filters.workspace_id).toBe('ws-001');
    });

    it('marks entries with data changes', async () => {
      const rowWithChanges = makeAuditRow({ data_before: { old: 1 }, data_after: { new: 2 } });
      const rowWithoutChanges = makeAuditRow({ id: 'audit-002', data_before: null, data_after: null });
      extAuditMock.terminal
        .mockResolvedValueOnce({ data: [rowWithChanges, rowWithoutChanges], error: null })
        .mockResolvedValueOnce({ data: [], error: null });

      const pdfData = await exportAuditPDF({ workspace_id: 'ws-001' });

      expect(pdfData.entries[0].has_data_changes).toBe(true);
      expect(pdfData.entries[1].has_data_changes).toBe(false);
    });
  });

  // ── Retention policy ────────────────────────────────────────────

  describe('retention policy', () => {
    it('RETENTION_DAYS equals 7 years in days', () => {
      expect(RETENTION_DAYS).toBe(7 * 365);
    });

    it('getRetentionCutoffDate returns a date ~7 years ago', () => {
      const cutoff = getRetentionCutoffDate();
      const now = new Date();
      const diffDays = Math.round((now.getTime() - cutoff.getTime()) / (1000 * 60 * 60 * 24));
      // Allow 1 day tolerance for edge cases
      expect(diffDays).toBeGreaterThanOrEqual(RETENTION_DAYS - 1);
      expect(diffDays).toBeLessThanOrEqual(RETENTION_DAYS + 1);
    });

    it('purgeExpiredEntries deletes old entries', async () => {
      extAuditMock.chain.delete.mockReturnValue({
        lt: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValueOnce({
            data: [{ id: 'old-1' }, { id: 'old-2' }],
            error: null,
          }),
        }),
      });

      const count = await purgeExpiredEntries();

      expect(count).toBe(2);
      expect(mockFrom).toHaveBeenCalledWith('audit_trail_extended');
    });

    it('purgeExpiredEntries throws on error', async () => {
      extAuditMock.chain.delete.mockReturnValue({
        lt: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValueOnce({
            data: null,
            error: { message: 'permission denied' },
          }),
        }),
      });

      await expect(purgeExpiredEntries()).rejects.toThrow(
        'Failed to purge expired audit entries: permission denied',
      );
    });
  });

  // ── Constants ───────────────────────────────────────────────────

  describe('constants', () => {
    it('DEFAULT_PAGE_SIZE is 50', () => {
      expect(DEFAULT_PAGE_SIZE).toBe(50);
    });

    it('MAX_PAGE_SIZE is 200', () => {
      expect(MAX_PAGE_SIZE).toBe(200);
    });
  });
});
