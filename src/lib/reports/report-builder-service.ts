import { createAdminClient } from '@/lib/supabase/admin';

/**
 * ReportBuilderService — Execute, save, share, and manage custom reports.
 *
 * Provides a backend for the visual Report Builder UI, handling:
 * - Execution of custom reports from user-defined config (fields, metrics, filters, visualization)
 * - Predefined templates: executive summary, employee detail, period comparison, compliance, cost analysis
 * - Save/share custom reports within a workspace
 *
 * Requirements: 27.1, 27.2, 27.3, 27.4, 27.5, 27.6, 27.7
 *
 * @module lib/reports/report-builder-service
 */

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maximum number of custom reports per workspace */
export const MAX_REPORTS_PER_WORKSPACE = 100;

/** Default page size for listing reports */
export const DEFAULT_PAGE_SIZE = 20;

/** Maximum rows returned by a single report execution */
export const MAX_REPORT_ROWS = 5000;

// ─── Types ──────────────────────────────────────────────────────────────────

export type VisualizationType = 'table' | 'bar' | 'line' | 'pie';

export type MetricAggregation = 'sum' | 'avg' | 'min' | 'max' | 'count';

export interface ReportField {
  /** Column name from the data source */
  column: string;
  /** Display label */
  label: string;
  /** Optional aggregation for metric fields */
  aggregation?: MetricAggregation;
}

export interface ReportFilter {
  column: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'like';
  value: string | number | string[];
}

export interface ReportConfig {
  /** Data source table to query */
  dataSource: 'payroll_uploads' | 'anomaly_detections' | 'audit_trail_extended' | 'activity_log';
  /** Fields to include in the report */
  fields: ReportField[];
  /** Metric fields with aggregations */
  metrics: ReportField[];
  /** Filters to apply */
  filters: ReportFilter[];
  /** Visualization type (Req 27.1) */
  visualization: VisualizationType;
  /** Optional group-by column for aggregations */
  groupBy?: string;
  /** Sort column */
  sortBy?: string;
  /** Sort direction */
  sortDirection?: 'asc' | 'desc';
  /** Maximum rows to return */
  limit?: number;
}

export interface ReportTemplate {
  id: string;
  template_key: string;
  name: string;
  description: string | null;
  default_config: ReportConfig;
  category: string | null;
}

export interface CustomReportRow {
  id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  description: string | null;
  report_config: ReportConfig;
  is_shared: boolean;
  created_at: string;
  updated_at: string;
}

export interface ReportResult {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
  visualization: VisualizationType;
  executedAt: string;
}

export interface SaveReportInput {
  workspace_id: string;
  created_by: string;
  name: string;
  description?: string;
  report_config: ReportConfig;
}

// ─── Allowed data sources for RLS-safe querying ─────────────────────────────

const ALLOWED_DATA_SOURCES = [
  'payroll_uploads',
  'anomaly_detections',
  'audit_trail_extended',
  'activity_log',
] as const;

// ─── Predefined Templates (Req 27.6) ────────────────────────────────────────

export const PREDEFINED_TEMPLATES: Omit<ReportTemplate, 'id'>[] = [
  {
    template_key: 'executive_summary',
    name: 'Executive Summary',
    description: 'High-level overview of payroll audit results with risk scores and key metrics',
    category: 'executive',
    default_config: {
      dataSource: 'payroll_uploads',
      fields: [
        { column: 'company_name', label: 'Company' },
        { column: 'period', label: 'Period' },
        { column: 'status', label: 'Status' },
      ],
      metrics: [
        { column: 'total_employees', label: 'Total Employees', aggregation: 'sum' },
        { column: 'risk_score', label: 'Avg Risk Score', aggregation: 'avg' },
      ],
      filters: [],
      visualization: 'table',
      sortBy: 'period',
      sortDirection: 'desc',
    },
  },
  {
    template_key: 'employee_detail',
    name: 'Employee Detail',
    description: 'Detailed breakdown by employee with individual findings and corrections',
    category: 'detail',
    default_config: {
      dataSource: 'payroll_uploads',
      fields: [
        { column: 'employee_doc', label: 'Document' },
        { column: 'employee_name', label: 'Name' },
        { column: 'department', label: 'Department' },
        { column: 'position', label: 'Position' },
      ],
      metrics: [
        { column: 'salary', label: 'Salary', aggregation: 'sum' },
        { column: 'findings_count', label: 'Findings', aggregation: 'count' },
      ],
      filters: [],
      visualization: 'table',
      sortBy: 'employee_name',
      sortDirection: 'asc',
    },
  },
  {
    template_key: 'period_comparison',
    name: 'Period Comparison',
    description: 'Side-by-side comparison of payroll metrics across two periods',
    category: 'comparative',
    default_config: {
      dataSource: 'payroll_uploads',
      fields: [
        { column: 'period', label: 'Period' },
        { column: 'company_name', label: 'Company' },
      ],
      metrics: [
        { column: 'total_cost', label: 'Total Cost', aggregation: 'sum' },
        { column: 'total_employees', label: 'Employees', aggregation: 'sum' },
        { column: 'risk_score', label: 'Risk Score', aggregation: 'avg' },
      ],
      filters: [],
      visualization: 'bar',
      groupBy: 'period',
      sortBy: 'period',
      sortDirection: 'asc',
    },
  },
  {
    template_key: 'compliance',
    name: 'Compliance Report',
    description: 'Audit trail and compliance status for regulatory requirements',
    category: 'compliance',
    default_config: {
      dataSource: 'audit_trail_extended',
      fields: [
        { column: 'action_type', label: 'Action' },
        { column: 'resource_type', label: 'Resource' },
        { column: 'severity', label: 'Severity' },
        { column: 'created_at', label: 'Date' },
      ],
      metrics: [
        { column: 'id', label: 'Total Actions', aggregation: 'count' },
      ],
      filters: [],
      visualization: 'table',
      groupBy: 'action_type',
      sortBy: 'created_at',
      sortDirection: 'desc',
    },
  },
  {
    template_key: 'cost_analysis',
    name: 'Cost Analysis',
    description: 'Detailed cost breakdown and trends across periods and departments',
    category: 'financial',
    default_config: {
      dataSource: 'payroll_uploads',
      fields: [
        { column: 'period', label: 'Period' },
        { column: 'department', label: 'Department' },
      ],
      metrics: [
        { column: 'total_cost', label: 'Total Cost', aggregation: 'sum' },
        { column: 'avg_salary', label: 'Avg Salary', aggregation: 'avg' },
        { column: 'total_employees', label: 'Headcount', aggregation: 'sum' },
      ],
      filters: [],
      visualization: 'line',
      groupBy: 'period',
      sortBy: 'period',
      sortDirection: 'asc',
    },
  },
];

// ─── Helper: Apply filters to a Supabase query ─────────────────────────────

function applyFilters(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: any,
  filters: ReportFilter[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  for (const f of filters) {
    switch (f.operator) {
      case 'eq':
        query = query.eq(f.column, f.value);
        break;
      case 'neq':
        query = query.neq(f.column, f.value);
        break;
      case 'gt':
        query = query.gt(f.column, f.value);
        break;
      case 'gte':
        query = query.gte(f.column, f.value);
        break;
      case 'lt':
        query = query.lt(f.column, f.value);
        break;
      case 'lte':
        query = query.lte(f.column, f.value);
        break;
      case 'in':
        query = query.in(f.column, Array.isArray(f.value) ? f.value : [f.value]);
        break;
      case 'like':
        query = query.ilike(f.column, `%${f.value}%`);
        break;
    }
  }
  return query;
}

// ─── Core Functions ─────────────────────────────────────────────────────────

/**
 * Execute a custom report from a user-defined config.
 *
 * Queries the specified data source with the given fields, filters,
 * and sorting. Returns structured result data ready for visualization.
 *
 * Req 27.1: Execute reports with fields, metrics, filters, visualization type.
 * Req 27.7: Real-time preview support (same execution path).
 */
export async function executeCustomReport(
  workspaceId: string,
  config: ReportConfig,
): Promise<ReportResult> {
  if (!workspaceId) {
    throw new Error('workspace_id is required to execute a report');
  }

  if (!ALLOWED_DATA_SOURCES.includes(config.dataSource as typeof ALLOWED_DATA_SOURCES[number])) {
    throw new Error(`Invalid data source: ${config.dataSource}`);
  }

  if (config.fields.length === 0 && config.metrics.length === 0) {
    throw new Error('At least one field or metric is required');
  }

  const supabase = createAdminClient();

  // Build select columns from fields + metrics
  const selectColumns = [
    ...config.fields.map((f) => f.column),
    ...config.metrics.map((m) => m.column),
  ];
  const uniqueColumns = [...new Set(selectColumns)];
  const selectStr = uniqueColumns.join(',');

  const limit = Math.min(config.limit ?? MAX_REPORT_ROWS, MAX_REPORT_ROWS);

  // Build query — scope to workspace
  let query = supabase
    .from(config.dataSource)
    .select(selectStr)
    .eq('workspace_id', workspaceId)
    .limit(limit);

  // Apply user-defined filters
  query = applyFilters(query, config.filters);

  // Apply sorting
  if (config.sortBy) {
    query = query.order(config.sortBy, {
      ascending: config.sortDirection !== 'desc',
    });
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to execute report: ${error.message}`);
  }

  const rows = (data ?? []) as Record<string, unknown>[];

  return {
    columns: uniqueColumns,
    rows,
    total: rows.length,
    visualization: config.visualization,
    executedAt: new Date().toISOString(),
  };
}

/**
 * Save a custom report configuration to the workspace.
 *
 * Req 27.3: Save custom reports with name and description for reuse.
 */
export async function saveCustomReport(
  input: SaveReportInput,
): Promise<CustomReportRow> {
  if (!input.workspace_id) {
    throw new Error('workspace_id is required');
  }
  if (!input.created_by) {
    throw new Error('created_by is required');
  }
  if (!input.name || input.name.trim().length === 0) {
    throw new Error('Report name is required');
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('custom_reports')
    .insert({
      workspace_id: input.workspace_id,
      created_by: input.created_by,
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      report_config: input.report_config,
      is_shared: false,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to save custom report: ${error.message}`);
  }

  return data as CustomReportRow;
}

/**
 * Retrieve a single custom report by ID.
 */
export async function getCustomReport(
  reportId: string,
  workspaceId: string,
): Promise<CustomReportRow> {
  if (!reportId) {
    throw new Error('reportId is required');
  }
  if (!workspaceId) {
    throw new Error('workspace_id is required');
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('custom_reports')
    .select('*')
    .eq('id', reportId)
    .eq('workspace_id', workspaceId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch custom report: ${error.message}`);
  }

  return data as CustomReportRow;
}

/**
 * List custom reports for a workspace.
 *
 * Returns reports created by the user OR shared reports in the workspace.
 */
export async function listCustomReports(
  workspaceId: string,
  userId: string,
): Promise<CustomReportRow[]> {
  if (!workspaceId) {
    throw new Error('workspace_id is required');
  }
  if (!userId) {
    throw new Error('userId is required');
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('custom_reports')
    .select('*')
    .eq('workspace_id', workspaceId)
    .or(`created_by.eq.${userId},is_shared.eq.true`)
    .order('updated_at', { ascending: false })
    .limit(DEFAULT_PAGE_SIZE);

  if (error) {
    throw new Error(`Failed to list custom reports: ${error.message}`);
  }

  return (data ?? []) as CustomReportRow[];
}

/**
 * Share a custom report with all members of the workspace.
 *
 * Req 27.4: Share custom reports within workspace.
 */
export async function shareCustomReport(
  reportId: string,
  workspaceId: string,
  userId: string,
): Promise<CustomReportRow> {
  if (!reportId) {
    throw new Error('reportId is required');
  }
  if (!workspaceId) {
    throw new Error('workspace_id is required');
  }
  if (!userId) {
    throw new Error('userId is required');
  }

  const supabase = createAdminClient();

  // Verify ownership before sharing
  const { data: existing, error: fetchError } = await supabase
    .from('custom_reports')
    .select('*')
    .eq('id', reportId)
    .eq('workspace_id', workspaceId)
    .eq('created_by', userId)
    .single();

  if (fetchError || !existing) {
    throw new Error('Report not found or you do not have permission to share it');
  }

  const { data, error } = await supabase
    .from('custom_reports')
    .update({ is_shared: true, updated_at: new Date().toISOString() })
    .eq('id', reportId)
    .select('*')
    .single();

  if (error) {
    throw new Error(`Failed to share custom report: ${error.message}`);
  }

  return data as CustomReportRow;
}

/**
 * Get all predefined report builder templates.
 *
 * Req 27.6: Predefined templates (executive summary, employee detail,
 * period comparison, compliance, cost analysis).
 */
export async function getTemplates(): Promise<ReportTemplate[]> {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('report_builder_templates')
    .select('*')
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch templates: ${error.message}`);
  }

  return (data ?? []) as ReportTemplate[];
}

/**
 * Get a single predefined template by its key.
 */
export async function getTemplate(
  templateKey: string,
): Promise<ReportTemplate> {
  if (!templateKey) {
    throw new Error('templateKey is required');
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('report_builder_templates')
    .select('*')
    .eq('template_key', templateKey)
    .single();

  if (error) {
    throw new Error(`Failed to fetch template: ${error.message}`);
  }

  return data as ReportTemplate;
}
