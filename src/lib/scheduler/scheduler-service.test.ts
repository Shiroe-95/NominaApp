import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Chainable mock builder ──────────────────────────────────────────

function createChainMock(resolvedValue?: { data: unknown; error: unknown }) {
  const terminal = resolvedValue
    ? vi.fn().mockResolvedValue(resolvedValue)
    : vi.fn();

  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;

  chain.select = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.update = vi.fn(self);
  chain.delete = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.lt = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = terminal;
  chain.single = terminal;

  return { chain, terminal };
}

// ── Mock Supabase ───────────────────────────────────────────────────

let scheduledReportsMock: ReturnType<typeof createChainMock>;
let scheduledRunsMock: ReturnType<typeof createChainMock>;
let notificationsMock: ReturnType<typeof createChainMock>;

const mockStorageUpload = vi.fn().mockResolvedValue({ error: null });
const mockStorageGetPublicUrl = vi.fn().mockReturnValue({
  data: { publicUrl: 'https://storage.example.com/reports/test.pdf' },
});

const mockFrom = vi.fn((table: string) => {
  if (table === 'scheduled_reports') return scheduledReportsMock.chain;
  if (table === 'scheduled_report_runs') return scheduledRunsMock.chain;
  if (table === 'notifications') return notificationsMock.chain;
  return {};
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: mockFrom,
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        getPublicUrl: mockStorageGetPublicUrl,
      }),
    },
  }),
}));

import {
  createScheduledReport,
  getScheduledReport,
  listScheduledReports,
  updateScheduledReport,
  deleteScheduledReport,
  pauseReport,
  resumeReport,
  executeReport,
  getExecutionHistory,
  computeNextRun,
  RETRY_DELAY_MS,
  DEFAULT_HISTORY_PAGE_SIZE,
  MAX_HISTORY_PAGE_SIZE,
  type ScheduledReportRow,
  type ScheduledReportRunRow,
} from './scheduler-service';

import type { ScheduledReportInput } from '@/lib/schemas/world-class-schemas';

// ── Helpers ─────────────────────────────────────────────────────────

function makeInput(overrides: Partial<ScheduledReportInput> = {}): ScheduledReportInput {
  return {
    name: 'Monthly Executive Report',
    report_type: 'executive',
    filters: { companyIds: ['c1'] },
    output_format: 'pdf',
    recipients: ['cfo@example.com'],
    cron_expression: '0 8 1 * *',
    ...overrides,
  };
}

function makeReportRow(overrides: Partial<ScheduledReportRow> = {}): ScheduledReportRow {
  return {
    id: 'report-001',
    workspace_id: 'ws-001',
    created_by: 'user-001',
    name: 'Monthly Executive Report',
    report_type: 'executive',
    filters: { companyIds: ['c1'] },
    output_format: 'pdf',
    recipients: ['cfo@example.com'],
    cron_expression: '0 8 1 * *',
    is_active: true,
    next_run_at: '2025-02-01T08:00:00.000Z',
    created_at: '2025-01-15T10:00:00Z',
    ...overrides,
  };
}

function makeRunRow(overrides: Partial<ScheduledReportRunRow> = {}): ScheduledReportRunRow {
  return {
    id: 'run-001',
    scheduled_report_id: 'report-001',
    status: 'success',
    file_url: 'https://storage.example.com/reports/test.pdf',
    error_message: null,
    executed_at: '2025-01-15T08:00:00Z',
    ...overrides,
  };
}

// ── Tests ───────────────────────────────────────────────────────────

describe('SchedulerService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    scheduledReportsMock = createChainMock();
    scheduledRunsMock = createChainMock();
    notificationsMock = createChainMock();
  });

  // ── createScheduledReport ─────────────────────────────────────

  describe('createScheduledReport', () => {
    it('inserts a report and returns the row', async () => {
      const row = makeReportRow();
      scheduledReportsMock.terminal.mockResolvedValueOnce({ data: row, error: null });

      const result = await createScheduledReport('ws-001', 'user-001', makeInput());

      expect(result).toEqual(row);
      expect(mockFrom).toHaveBeenCalledWith('scheduled_reports');
      expect(scheduledReportsMock.chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          workspace_id: 'ws-001',
          created_by: 'user-001',
          name: 'Monthly Executive Report',
          report_type: 'executive',
          output_format: 'pdf',
          is_active: true,
        }),
      );
    });

    it('throws when workspace_id is empty', async () => {
      await expect(
        createScheduledReport('', 'user-001', makeInput()),
      ).rejects.toThrow('workspace_id is required');
    });

    it('throws when created_by is empty', async () => {
      await expect(
        createScheduledReport('ws-001', '', makeInput()),
      ).rejects.toThrow('created_by is required');
    });

    it('throws on Supabase insert error', async () => {
      scheduledReportsMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { message: 'RLS violation' },
      });

      await expect(
        createScheduledReport('ws-001', 'user-001', makeInput()),
      ).rejects.toThrow('Failed to create scheduled report: RLS violation');
    });
  });

  // ── getScheduledReport ────────────────────────────────────────

  describe('getScheduledReport', () => {
    it('returns a single report by ID', async () => {
      const row = makeReportRow();
      scheduledReportsMock.terminal.mockResolvedValueOnce({ data: row, error: null });

      const result = await getScheduledReport('report-001');

      expect(result).toEqual(row);
      expect(scheduledReportsMock.chain.eq).toHaveBeenCalledWith('id', 'report-001');
    });

    it('throws when report_id is empty', async () => {
      await expect(getScheduledReport('')).rejects.toThrow('report_id is required');
    });

    it('throws on Supabase error', async () => {
      scheduledReportsMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      });

      await expect(getScheduledReport('report-999')).rejects.toThrow(
        'Failed to get scheduled report: not found',
      );
    });
  });

  // ── listScheduledReports ──────────────────────────────────────

  describe('listScheduledReports', () => {
    it('returns all reports for a workspace', async () => {
      const rows = [makeReportRow(), makeReportRow({ id: 'report-002' })];
      scheduledReportsMock.chain.order.mockResolvedValueOnce({ data: rows, error: null });

      const result = await listScheduledReports('ws-001');

      expect(result).toEqual(rows);
      expect(scheduledReportsMock.chain.eq).toHaveBeenCalledWith('workspace_id', 'ws-001');
      expect(scheduledReportsMock.chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });

    it('returns empty array when no reports exist', async () => {
      scheduledReportsMock.chain.order.mockResolvedValueOnce({ data: [], error: null });

      const result = await listScheduledReports('ws-001');
      expect(result).toEqual([]);
    });

    it('throws when workspace_id is empty', async () => {
      await expect(listScheduledReports('')).rejects.toThrow('workspace_id is required');
    });

    it('throws on Supabase error', async () => {
      scheduledReportsMock.chain.order.mockResolvedValueOnce({
        data: null,
        error: { message: 'timeout' },
      });

      await expect(listScheduledReports('ws-001')).rejects.toThrow(
        'Failed to list scheduled reports: timeout',
      );
    });
  });

  // ── updateScheduledReport ─────────────────────────────────────

  describe('updateScheduledReport', () => {
    it('updates specified fields and returns updated row', async () => {
      const updated = makeReportRow({ name: 'Updated Report' });
      scheduledReportsMock.terminal.mockResolvedValueOnce({ data: updated, error: null });

      const result = await updateScheduledReport('report-001', { name: 'Updated Report' });

      expect(result.name).toBe('Updated Report');
      expect(scheduledReportsMock.chain.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Updated Report' }),
      );
    });

    it('recomputes next_run_at when cron_expression changes', async () => {
      const updated = makeReportRow({ cron_expression: '0 9 * * 1' });
      scheduledReportsMock.terminal.mockResolvedValueOnce({ data: updated, error: null });

      await updateScheduledReport('report-001', { cron_expression: '0 9 * * 1' });

      expect(scheduledReportsMock.chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          cron_expression: '0 9 * * 1',
          next_run_at: expect.any(String),
        }),
      );
    });

    it('throws when report_id is empty', async () => {
      await expect(updateScheduledReport('', { name: 'x' })).rejects.toThrow('report_id is required');
    });

    it('throws when no fields to update', async () => {
      await expect(updateScheduledReport('report-001', {})).rejects.toThrow('No fields to update');
    });

    it('throws on Supabase error', async () => {
      scheduledReportsMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { message: 'conflict' },
      });

      await expect(
        updateScheduledReport('report-001', { name: 'x' }),
      ).rejects.toThrow('Failed to update scheduled report: conflict');
    });
  });

  // ── deleteScheduledReport ─────────────────────────────────────

  describe('deleteScheduledReport', () => {
    it('deletes a report by ID', async () => {
      scheduledReportsMock.chain.eq.mockResolvedValueOnce({ error: null });

      await deleteScheduledReport('report-001');

      expect(scheduledReportsMock.chain.delete).toHaveBeenCalled();
      expect(scheduledReportsMock.chain.eq).toHaveBeenCalledWith('id', 'report-001');
    });

    it('throws when report_id is empty', async () => {
      await expect(deleteScheduledReport('')).rejects.toThrow('report_id is required');
    });

    it('throws on Supabase error', async () => {
      scheduledReportsMock.chain.eq.mockResolvedValueOnce({
        error: { message: 'FK constraint' },
      });

      await expect(deleteScheduledReport('report-001')).rejects.toThrow(
        'Failed to delete scheduled report: FK constraint',
      );
    });
  });

  // ── pauseReport ───────────────────────────────────────────────

  describe('pauseReport', () => {
    it('sets is_active to false and clears next_run_at', async () => {
      const paused = makeReportRow({ is_active: false, next_run_at: null });
      scheduledReportsMock.terminal.mockResolvedValueOnce({ data: paused, error: null });

      const result = await pauseReport('report-001');

      expect(result.is_active).toBe(false);
      expect(result.next_run_at).toBeNull();
      expect(scheduledReportsMock.chain.update).toHaveBeenCalledWith({
        is_active: false,
        next_run_at: null,
      });
    });

    it('throws when report_id is empty', async () => {
      await expect(pauseReport('')).rejects.toThrow('report_id is required');
    });

    it('throws on Supabase error', async () => {
      scheduledReportsMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { message: 'not found' },
      });

      await expect(pauseReport('report-999')).rejects.toThrow(
        'Failed to pause scheduled report: not found',
      );
    });
  });

  // ── resumeReport ──────────────────────────────────────────────

  describe('resumeReport', () => {
    it('sets is_active to true and recomputes next_run_at', async () => {
      // First call: getScheduledReport to fetch existing cron
      const existing = makeReportRow({ is_active: false, next_run_at: null });
      scheduledReportsMock.terminal.mockResolvedValueOnce({ data: existing, error: null });

      // Second call: update
      const resumed = makeReportRow({ is_active: true });
      scheduledReportsMock.terminal.mockResolvedValueOnce({ data: resumed, error: null });

      const result = await resumeReport('report-001');

      expect(result.is_active).toBe(true);
      expect(scheduledReportsMock.chain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: true,
          next_run_at: expect.any(String),
        }),
      );
    });

    it('throws when report_id is empty', async () => {
      await expect(resumeReport('')).rejects.toThrow('report_id is required');
    });
  });


  // ── executeReport ─────────────────────────────────────────────

  describe('executeReport', () => {
    it('executes a report successfully and records the run', async () => {
      // getScheduledReport
      const report = makeReportRow();
      scheduledReportsMock.terminal.mockResolvedValueOnce({ data: report, error: null });

      // insert run
      scheduledRunsMock.terminal.mockResolvedValueOnce({ data: { id: 'run-001' }, error: null });

      // update next_run_at
      scheduledReportsMock.terminal.mockResolvedValueOnce({ data: report, error: null });

      const result = await executeReport('report-001');

      expect(result.status).toBe('success');
      expect(result.run_id).toBe('run-001');
      expect(result.file_url).toBe('https://storage.example.com/reports/test.pdf');
      expect(result.error_message).toBeNull();
    });

    it('records failure and schedules retry on first failure', async () => {
      // getScheduledReport
      const report = makeReportRow();
      scheduledReportsMock.terminal.mockResolvedValueOnce({ data: report, error: null });

      // Make storage upload fail
      mockStorageUpload.mockResolvedValueOnce({
        error: { message: 'storage full' },
      });

      // insert run (failure)
      scheduledRunsMock.terminal.mockResolvedValueOnce({ data: { id: 'run-002' }, error: null });

      // update next_run_at
      scheduledReportsMock.terminal.mockResolvedValueOnce({ data: report, error: null });

      const result = await executeReport('report-001');

      expect(result.status).toBe('failed');
      expect(result.error_message).toContain('storage full');
    });

    it('notifies creator on retry failure', async () => {
      // getScheduledReport
      const report = makeReportRow();
      scheduledReportsMock.terminal.mockResolvedValueOnce({ data: report, error: null });

      // Make storage upload fail
      mockStorageUpload.mockResolvedValueOnce({
        error: { message: 'still full' },
      });

      // insert run (failure)
      scheduledRunsMock.terminal.mockResolvedValueOnce({ data: { id: 'run-003' }, error: null });

      // notification insert — use .then() pattern
      notificationsMock.chain.insert.mockReturnValueOnce(
        Promise.resolve({ error: null }),
      );

      // update next_run_at
      scheduledReportsMock.terminal.mockResolvedValueOnce({ data: report, error: null });

      const result = await executeReport('report-001', { isRetry: true });

      expect(result.status).toBe('failed');
      expect(mockFrom).toHaveBeenCalledWith('notifications');
    });

    it('throws when report_id is empty', async () => {
      await expect(executeReport('')).rejects.toThrow('report_id is required');
    });

    it('throws when recording execution fails', async () => {
      // getScheduledReport
      const report = makeReportRow();
      scheduledReportsMock.terminal.mockResolvedValueOnce({ data: report, error: null });

      // insert run fails
      scheduledRunsMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB error' },
      });

      await expect(executeReport('report-001')).rejects.toThrow(
        'Failed to record execution: DB error',
      );
    });
  });

  // ── getExecutionHistory ───────────────────────────────────────

  describe('getExecutionHistory', () => {
    it('returns paginated execution history', async () => {
      const runs = [makeRunRow(), makeRunRow({ id: 'run-002' })];
      scheduledRunsMock.terminal.mockResolvedValueOnce({ data: runs, error: null });

      const result = await getExecutionHistory('report-001');

      expect(result.data).toEqual(runs);
      expect(result.has_more).toBe(false);
      expect(result.next_cursor).toBeNull();
    });

    it('detects has_more when extra row returned', async () => {
      const runs = Array.from({ length: 4 }, (_, i) =>
        makeRunRow({
          id: `run-${i}`,
          executed_at: `2025-01-${String(15 - i).padStart(2, '0')}T08:00:00Z`,
        }),
      );
      scheduledRunsMock.terminal.mockResolvedValueOnce({ data: runs, error: null });

      const result = await getExecutionHistory('report-001', { page_size: 3 });

      expect(result.data).toHaveLength(3);
      expect(result.has_more).toBe(true);
      expect(result.next_cursor).toBe(result.data[2].executed_at);
    });

    it('clamps page_size to MAX_HISTORY_PAGE_SIZE', async () => {
      scheduledRunsMock.terminal.mockResolvedValueOnce({ data: [], error: null });

      await getExecutionHistory('report-001', { page_size: 999 });

      expect(scheduledRunsMock.chain.limit).toHaveBeenCalledWith(MAX_HISTORY_PAGE_SIZE + 1);
    });

    it('clamps page_size minimum to 1', async () => {
      scheduledRunsMock.terminal.mockResolvedValueOnce({ data: [], error: null });

      await getExecutionHistory('report-001', { page_size: -5 });

      expect(scheduledRunsMock.chain.limit).toHaveBeenCalledWith(2); // 1 + 1
    });

    it('applies cursor filter', async () => {
      scheduledRunsMock.terminal.mockResolvedValueOnce({ data: [], error: null });

      await getExecutionHistory('report-001', { cursor: '2025-01-10T00:00:00Z' });

      expect(scheduledRunsMock.chain.lt).toHaveBeenCalledWith('executed_at', '2025-01-10T00:00:00Z');
    });

    it('throws when report_id is empty', async () => {
      await expect(getExecutionHistory('')).rejects.toThrow('report_id is required');
    });

    it('throws on Supabase error', async () => {
      scheduledRunsMock.terminal.mockResolvedValueOnce({
        data: null,
        error: { message: 'timeout' },
      });

      await expect(getExecutionHistory('report-001')).rejects.toThrow(
        'Failed to get execution history: timeout',
      );
    });
  });

  // ── computeNextRun ────────────────────────────────────────────

  describe('computeNextRun', () => {
    it('returns a valid ISO string', () => {
      const result = computeNextRun('0 8 * * *');
      expect(() => new Date(result)).not.toThrow();
      expect(new Date(result).toISOString()).toBe(result);
    });

    it('returns a future date', () => {
      const result = computeNextRun('0 8 * * *');
      expect(new Date(result).getTime()).toBeGreaterThan(Date.now());
    });

    it('handles 5-field cron with specific hour and minute', () => {
      const result = computeNextRun('30 14 * * *');
      const date = new Date(result);
      expect(date.getHours()).toBe(14);
      expect(date.getMinutes()).toBe(30);
    });

    it('falls back to 24h from now for non-standard cron', () => {
      const before = Date.now();
      const result = computeNextRun('@weekly');
      const after = Date.now();
      const resultMs = new Date(result).getTime();

      // Should be approximately 24h from now
      const expectedMin = before + 24 * 60 * 60 * 1000 - 1000;
      const expectedMax = after + 24 * 60 * 60 * 1000 + 1000;
      expect(resultMs).toBeGreaterThanOrEqual(expectedMin);
      expect(resultMs).toBeLessThanOrEqual(expectedMax);
    });
  });

  // ── Constants ─────────────────────────────────────────────────

  describe('constants', () => {
    it('RETRY_DELAY_MS is 15 minutes', () => {
      expect(RETRY_DELAY_MS).toBe(15 * 60 * 1000);
    });

    it('DEFAULT_HISTORY_PAGE_SIZE is 50', () => {
      expect(DEFAULT_HISTORY_PAGE_SIZE).toBe(50);
    });

    it('MAX_HISTORY_PAGE_SIZE is 200', () => {
      expect(MAX_HISTORY_PAGE_SIZE).toBe(200);
    });
  });
});
