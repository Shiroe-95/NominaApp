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
  chain.eq = vi.fn(self);
  chain.neq = vi.fn(self);
  chain.gt = vi.fn(self);
  chain.gte = vi.fn(self);
  chain.lt = vi.fn(self);
  chain.lte = vi.fn(self);
  chain.in = vi.fn(self);
  chain.ilike = vi.fn(self);
  chain.or = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(self);
  chain.single = terminal;

  // Allow limit to chain further (for queries that end with .single or just resolve)
  chain.limit.mockImplementation(() => {
    // For executeCustomReport, limit is the terminal — resolve directly
    return resolvedValue ? Promise.resolve(resolvedValue) : chain;
  });

  return { chain, terminal };
}

// ── Mock Supabase ───────────────────────────────────────────────────

let customReportsMock: ReturnType<typeof createChainMock>;
let templatesMock: ReturnType<typeof createChainMock>;
let dataSourceMock: ReturnType<typeof createChainMock>;

const mockFrom = vi.fn((table: string) => {
  if (table === 'custom_reports') return customReportsMock.chain;
  if (table === 'report_builder_templates') return templatesMock.chain;
  return dataSourceMock.chain;
});

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

import {
  executeCustomReport,
  saveCustomReport,
  getCustomReport,
  listCustomReports,
  shareCustomReport,
  getTemplates,
  getTemplate,
  PREDEFINED_TEMPLATES,
  MAX_REPORT_ROWS,
  DEFAULT_PAGE_SIZE,
  type ReportConfig,
  type SaveReportInput,
  type CustomReportRow,
  type ReportTemplate,
} from './report-builder-service';

// ── Helpers ─────────────────────────────────────────────────────────

const WS_ID = 'ws-001';
const USER_ID = 'user-001';

function makeConfig(overrides: Partial<ReportConfig> = {}): ReportConfig {
  return {
    dataSource: 'payroll_uploads',
    fields: [{ column: 'company_name', label: 'Company' }],
    metrics: [{ column: 'risk_score', label: 'Risk', aggregation: 'avg' }],
    filters: [],
    visualization: 'table',
    ...overrides,
  };
}

function makeSaveInput(overrides: Partial<SaveReportInput> = {}): SaveReportInput {
  return {
    workspace_id: WS_ID,
    created_by: USER_ID,
    name: 'My Report',
    description: 'A test report',
    report_config: makeConfig(),
    ...overrides,
  };
}

function makeReportRow(overrides: Partial<CustomReportRow> = {}): CustomReportRow {
  return {
    id: 'rpt-001',
    workspace_id: WS_ID,
    created_by: USER_ID,
    name: 'My Report',
    description: 'A test report',
    report_config: makeConfig(),
    is_shared: false,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── Setup ───────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  customReportsMock = createChainMock({ data: null, error: null });
  templatesMock = createChainMock({ data: null, error: null });
  dataSourceMock = createChainMock({ data: null, error: null });
});

// ── Tests ────────────────────────────────────────────────────────────

describe('ReportBuilderService', () => {
  // ── executeCustomReport ─────────────────────────────────────────

  describe('executeCustomReport', () => {
    it('throws when workspace_id is empty', async () => {
      await expect(executeCustomReport('', makeConfig())).rejects.toThrow(
        'workspace_id is required',
      );
    });

    it('throws for invalid data source', async () => {
      const config = makeConfig({ dataSource: 'invalid_table' as ReportConfig['dataSource'] });
      await expect(executeCustomReport(WS_ID, config)).rejects.toThrow(
        'Invalid data source',
      );
    });

    it('throws when no fields or metrics provided', async () => {
      const config = makeConfig({ fields: [], metrics: [] });
      await expect(executeCustomReport(WS_ID, config)).rejects.toThrow(
        'At least one field or metric is required',
      );
    });

    it('executes a report and returns structured result', async () => {
      const rows = [
        { company_name: 'Acme', risk_score: 75 },
        { company_name: 'Beta', risk_score: 42 },
      ];
      dataSourceMock = createChainMock({ data: rows, error: null });
      // Override limit to resolve with data
      dataSourceMock.chain.limit.mockResolvedValue({ data: rows, error: null });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'custom_reports') return customReportsMock.chain;
        if (table === 'report_builder_templates') return templatesMock.chain;
        return dataSourceMock.chain;
      });

      const result = await executeCustomReport(WS_ID, makeConfig());

      expect(result.columns).toContain('company_name');
      expect(result.columns).toContain('risk_score');
      expect(result.rows).toHaveLength(2);
      expect(result.visualization).toBe('table');
      expect(result.executedAt).toBeDefined();
      expect(mockFrom).toHaveBeenCalledWith('payroll_uploads');
    });

    it('applies filters to the query', async () => {
      dataSourceMock = createChainMock({ data: [], error: null });
      dataSourceMock.chain.limit.mockResolvedValue({ data: [], error: null });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'custom_reports') return customReportsMock.chain;
        if (table === 'report_builder_templates') return templatesMock.chain;
        return dataSourceMock.chain;
      });

      const config = makeConfig({
        filters: [
          { column: 'status', operator: 'eq', value: 'completed' },
          { column: 'risk_score', operator: 'gt', value: 50 },
        ],
      });

      await executeCustomReport(WS_ID, config);

      expect(dataSourceMock.chain.eq).toHaveBeenCalledWith('status', 'completed');
      expect(dataSourceMock.chain.gt).toHaveBeenCalledWith('risk_score', 50);
    });

    it('applies sorting when sortBy is specified', async () => {
      dataSourceMock = createChainMock({ data: [], error: null });
      dataSourceMock.chain.limit.mockResolvedValue({ data: [], error: null });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'custom_reports') return customReportsMock.chain;
        if (table === 'report_builder_templates') return templatesMock.chain;
        return dataSourceMock.chain;
      });

      const config = makeConfig({ sortBy: 'risk_score', sortDirection: 'desc' });
      await executeCustomReport(WS_ID, config);

      expect(dataSourceMock.chain.order).toHaveBeenCalledWith('risk_score', {
        ascending: false,
      });
    });

    it('caps limit to MAX_REPORT_ROWS', async () => {
      dataSourceMock = createChainMock({ data: [], error: null });
      dataSourceMock.chain.limit.mockResolvedValue({ data: [], error: null });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'custom_reports') return customReportsMock.chain;
        if (table === 'report_builder_templates') return templatesMock.chain;
        return dataSourceMock.chain;
      });

      const config = makeConfig({ limit: 999999 });
      await executeCustomReport(WS_ID, config);

      expect(dataSourceMock.chain.limit).toHaveBeenCalledWith(MAX_REPORT_ROWS);
    });

    it('throws on Supabase error', async () => {
      dataSourceMock = createChainMock({
        data: null,
        error: { message: 'DB error' },
      });
      dataSourceMock.chain.limit.mockResolvedValue({
        data: null,
        error: { message: 'DB error' },
      });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'custom_reports') return customReportsMock.chain;
        if (table === 'report_builder_templates') return templatesMock.chain;
        return dataSourceMock.chain;
      });

      await expect(executeCustomReport(WS_ID, makeConfig())).rejects.toThrow(
        'Failed to execute report',
      );
    });
  });

  // ── saveCustomReport ────────────────────────────────────────────

  describe('saveCustomReport', () => {
    it('throws when workspace_id is empty', async () => {
      await expect(
        saveCustomReport(makeSaveInput({ workspace_id: '' })),
      ).rejects.toThrow('workspace_id is required');
    });

    it('throws when created_by is empty', async () => {
      await expect(
        saveCustomReport(makeSaveInput({ created_by: '' })),
      ).rejects.toThrow('created_by is required');
    });

    it('throws when name is empty', async () => {
      await expect(
        saveCustomReport(makeSaveInput({ name: '  ' })),
      ).rejects.toThrow('Report name is required');
    });

    it('saves a report and returns the row', async () => {
      const row = makeReportRow();
      customReportsMock = createChainMock({ data: row, error: null });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'custom_reports') return customReportsMock.chain;
        if (table === 'report_builder_templates') return templatesMock.chain;
        return dataSourceMock.chain;
      });

      const result = await saveCustomReport(makeSaveInput());

      expect(result.id).toBe('rpt-001');
      expect(result.name).toBe('My Report');
      expect(mockFrom).toHaveBeenCalledWith('custom_reports');
    });

    it('throws on Supabase error', async () => {
      customReportsMock = createChainMock({
        data: null,
        error: { message: 'insert failed' },
      });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'custom_reports') return customReportsMock.chain;
        return dataSourceMock.chain;
      });

      await expect(saveCustomReport(makeSaveInput())).rejects.toThrow(
        'Failed to save custom report',
      );
    });
  });

  // ── getCustomReport ─────────────────────────────────────────────

  describe('getCustomReport', () => {
    it('throws when reportId is empty', async () => {
      await expect(getCustomReport('', WS_ID)).rejects.toThrow(
        'reportId is required',
      );
    });

    it('throws when workspace_id is empty', async () => {
      await expect(getCustomReport('rpt-001', '')).rejects.toThrow(
        'workspace_id is required',
      );
    });

    it('returns the report row', async () => {
      const row = makeReportRow();
      customReportsMock = createChainMock({ data: row, error: null });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'custom_reports') return customReportsMock.chain;
        return dataSourceMock.chain;
      });

      const result = await getCustomReport('rpt-001', WS_ID);
      expect(result.id).toBe('rpt-001');
    });

    it('throws on Supabase error', async () => {
      customReportsMock = createChainMock({
        data: null,
        error: { message: 'not found' },
      });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'custom_reports') return customReportsMock.chain;
        return dataSourceMock.chain;
      });

      await expect(getCustomReport('rpt-001', WS_ID)).rejects.toThrow(
        'Failed to fetch custom report',
      );
    });
  });

  // ── listCustomReports ───────────────────────────────────────────

  describe('listCustomReports', () => {
    it('throws when workspace_id is empty', async () => {
      await expect(listCustomReports('', USER_ID)).rejects.toThrow(
        'workspace_id is required',
      );
    });

    it('throws when userId is empty', async () => {
      await expect(listCustomReports(WS_ID, '')).rejects.toThrow(
        'userId is required',
      );
    });

    it('returns reports for the workspace', async () => {
      const rows = [makeReportRow(), makeReportRow({ id: 'rpt-002', name: 'Second' })];
      customReportsMock = createChainMock();
      customReportsMock.chain.limit.mockResolvedValue({ data: rows, error: null });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'custom_reports') return customReportsMock.chain;
        return dataSourceMock.chain;
      });

      const result = await listCustomReports(WS_ID, USER_ID);
      expect(result).toHaveLength(2);
      expect(customReportsMock.chain.or).toHaveBeenCalledWith(
        `created_by.eq.${USER_ID},is_shared.eq.true`,
      );
    });
  });

  // ── shareCustomReport ───────────────────────────────────────────

  describe('shareCustomReport', () => {
    it('throws when reportId is empty', async () => {
      await expect(shareCustomReport('', WS_ID, USER_ID)).rejects.toThrow(
        'reportId is required',
      );
    });

    it('throws when workspace_id is empty', async () => {
      await expect(shareCustomReport('rpt-001', '', USER_ID)).rejects.toThrow(
        'workspace_id is required',
      );
    });

    it('throws when userId is empty', async () => {
      await expect(shareCustomReport('rpt-001', WS_ID, '')).rejects.toThrow(
        'userId is required',
      );
    });

    it('throws when report not found or not owned', async () => {
      customReportsMock = createChainMock({
        data: null,
        error: { message: 'not found' },
      });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'custom_reports') return customReportsMock.chain;
        return dataSourceMock.chain;
      });

      await expect(
        shareCustomReport('rpt-001', WS_ID, USER_ID),
      ).rejects.toThrow('Report not found or you do not have permission');
    });

    it('shares a report successfully', async () => {
      const existing = makeReportRow();
      const shared = makeReportRow({ is_shared: true });

      // First call: fetch existing (single resolves to existing)
      // Second call: update (single resolves to shared)
      let callCount = 0;
      customReportsMock = createChainMock();
      customReportsMock.chain.single.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve({ data: existing, error: null });
        return Promise.resolve({ data: shared, error: null });
      });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'custom_reports') return customReportsMock.chain;
        return dataSourceMock.chain;
      });

      const result = await shareCustomReport('rpt-001', WS_ID, USER_ID);
      expect(result.is_shared).toBe(true);
    });
  });

  // ── getTemplates ────────────────────────────────────────────────

  describe('getTemplates', () => {
    it('returns templates from the database', async () => {
      const templates: ReportTemplate[] = [
        {
          id: 't-001',
          template_key: 'executive_summary',
          name: 'Executive Summary',
          description: 'Overview',
          default_config: makeConfig(),
          category: 'executive',
        },
      ];
      templatesMock = createChainMock();
      templatesMock.chain.order.mockResolvedValue({ data: templates, error: null });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'report_builder_templates') return templatesMock.chain;
        if (table === 'custom_reports') return customReportsMock.chain;
        return dataSourceMock.chain;
      });

      const result = await getTemplates();
      expect(result).toHaveLength(1);
      expect(result[0].template_key).toBe('executive_summary');
    });

    it('throws on Supabase error', async () => {
      templatesMock = createChainMock();
      templatesMock.chain.order.mockResolvedValue({
        data: null,
        error: { message: 'fetch failed' },
      });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'report_builder_templates') return templatesMock.chain;
        return dataSourceMock.chain;
      });

      await expect(getTemplates()).rejects.toThrow('Failed to fetch templates');
    });
  });

  // ── getTemplate ─────────────────────────────────────────────────

  describe('getTemplate', () => {
    it('throws when templateKey is empty', async () => {
      await expect(getTemplate('')).rejects.toThrow('templateKey is required');
    });

    it('returns a single template', async () => {
      const template: ReportTemplate = {
        id: 't-001',
        template_key: 'compliance',
        name: 'Compliance Report',
        description: null,
        default_config: makeConfig({ dataSource: 'audit_trail_extended' }),
        category: 'compliance',
      };
      templatesMock = createChainMock({ data: template, error: null });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'report_builder_templates') return templatesMock.chain;
        return dataSourceMock.chain;
      });

      const result = await getTemplate('compliance');
      expect(result.template_key).toBe('compliance');
    });

    it('throws on Supabase error', async () => {
      templatesMock = createChainMock({
        data: null,
        error: { message: 'not found' },
      });
      mockFrom.mockImplementation((table: string) => {
        if (table === 'report_builder_templates') return templatesMock.chain;
        return dataSourceMock.chain;
      });

      await expect(getTemplate('nonexistent')).rejects.toThrow(
        'Failed to fetch template',
      );
    });
  });

  // ── PREDEFINED_TEMPLATES ────────────────────────────────────────

  describe('PREDEFINED_TEMPLATES', () => {
    it('contains 5 templates', () => {
      expect(PREDEFINED_TEMPLATES).toHaveLength(5);
    });

    it('has unique template keys', () => {
      const keys = PREDEFINED_TEMPLATES.map((t) => t.template_key);
      expect(new Set(keys).size).toBe(keys.length);
    });

    it('includes all required template types', () => {
      const keys = PREDEFINED_TEMPLATES.map((t) => t.template_key);
      expect(keys).toContain('executive_summary');
      expect(keys).toContain('employee_detail');
      expect(keys).toContain('period_comparison');
      expect(keys).toContain('compliance');
      expect(keys).toContain('cost_analysis');
    });

    it('each template has a valid config with at least one field or metric', () => {
      for (const t of PREDEFINED_TEMPLATES) {
        const totalFields = t.default_config.fields.length + t.default_config.metrics.length;
        expect(totalFields).toBeGreaterThan(0);
      }
    });
  });
});
