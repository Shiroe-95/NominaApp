import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AuditEntry } from '@/lib/types/regulatory-sync';

// ── Mock Supabase ───────────────────────────────────────────────────

const mockSingle = vi.fn();
const mockSelect = vi.fn(() => ({ single: mockSingle }));
const mockInsert = vi.fn(() => ({ select: mockSelect }));
const mockOrder = vi.fn();
const mockEq = vi.fn(() => ({ order: mockOrder }));
const mockSelectAll = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn((table: string) => {
  if (table === 'rule_audit_log') {
    return { insert: mockInsert, select: mockSelectAll };
  }
  return {};
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import { logAudit, getAuditHistory } from './audit-service';

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

// ── Tests ───────────────────────────────────────────────────────────

describe('AuditService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── logAudit ────────────────────────────────────────────────────

  describe('logAudit', () => {
    it('inserts a manual audit entry and returns the id', async () => {
      mockSingle.mockResolvedValueOnce({
        data: { id: 'audit-123' },
        error: null,
      });

      const id = await logAudit(makeEntry());

      expect(id).toBe('audit-123');
      expect(mockFrom).toHaveBeenCalledWith('rule_audit_log');
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          rule_id: 'rule-001',
          action: 'updated',
          origin: 'manual',
          user_id: 'user-abc',
        }),
      );
    });

    it('inserts an automatic audit entry with sourceIds', async () => {
      mockSingle.mockResolvedValueOnce({
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
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          origin: 'automatic',
          source_ids: ['src-1', 'src-2'],
          user_id: null,
        }),
      );
    });

    it('throws when automatic entry has no sourceIds', async () => {
      const entry = makeEntry({
        origin: 'automatic',
        sourceIds: undefined,
      });

      await expect(logAudit(entry)).rejects.toThrow(
        'Automatic audit entries require at least one sourceId',
      );
    });

    it('throws when automatic entry has empty sourceIds', async () => {
      const entry = makeEntry({
        origin: 'automatic',
        sourceIds: [],
      });

      await expect(logAudit(entry)).rejects.toThrow(
        'Automatic audit entries require at least one sourceId',
      );
    });

    it('throws when manual entry has no userId', async () => {
      const entry = makeEntry({
        origin: 'manual',
        userId: undefined,
      });

      await expect(logAudit(entry)).rejects.toThrow(
        'Manual audit entries require a userId',
      );
    });

    it('throws on Supabase insert error', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'FK violation' },
      });

      await expect(logAudit(makeEntry())).rejects.toThrow(
        'Failed to insert audit log: FK violation',
      );
    });
  });

  // ── getAuditHistory ─────────────────────────────────────────────

  describe('getAuditHistory', () => {
    it('returns rows ordered by created_at ascending', async () => {
      const rows = [
        { id: 'a1', created_at: '2025-01-01T00:00:00Z' },
        { id: 'a2', created_at: '2025-06-01T00:00:00Z' },
      ];
      mockOrder.mockResolvedValueOnce({ data: rows, error: null });

      const result = await getAuditHistory('rule-001');

      expect(result).toEqual(rows);
      expect(mockFrom).toHaveBeenCalledWith('rule_audit_log');
      expect(mockSelectAll).toHaveBeenCalledWith('*');
      expect(mockEq).toHaveBeenCalledWith('rule_id', 'rule-001');
      expect(mockOrder).toHaveBeenCalledWith('created_at', {
        ascending: true,
      });
    });

    it('returns empty array when no history exists', async () => {
      mockOrder.mockResolvedValueOnce({ data: [], error: null });

      const result = await getAuditHistory('rule-nonexistent');

      expect(result).toEqual([]);
    });

    it('throws on Supabase query error', async () => {
      mockOrder.mockResolvedValueOnce({
        data: null,
        error: { message: 'connection refused' },
      });

      await expect(getAuditHistory('rule-001')).rejects.toThrow(
        'Failed to fetch audit history: connection refused',
      );
    });
  });
});
