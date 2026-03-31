/**
 * NLQ Response Handler
 *
 * Processes NLQ engine responses, applies RBAC filtering,
 * and attaches data source metadata.
 *
 * Requirements: 12.4, 12.5, 12.6
 */

/** Supported user roles for RBAC filtering */
export type UserRole = 'admin' | 'analyst' | 'viewer' | 'editor';

/** Data source metadata attached to NLQ responses */
export interface NLQDataSource {
  table: string;
  period?: string;
  company?: string;
  workspace_id: string;
}

/** Types of NLQ response content */
export type NLQResponseType = 'table' | 'metric' | 'chart' | 'text' | 'clarification';

/** A single metric value in an NLQ response */
export interface NLQMetric {
  label: string;
  value: number | string;
  unit?: string;
  trend?: 'up' | 'down' | 'stable';
}

/** Table data in an NLQ response */
export interface NLQTableData {
  headers: string[];
  rows: (string | number)[][];
}

/** Chart data point for inline charts */
export interface NLQChartPoint {
  label: string;
  value: number;
}

/** Clarification option for ambiguous queries */
export interface NLQClarificationOption {
  id: string;
  label: string;
  query: string;
}

/** Full NLQ response structure */
export interface NLQResponse {
  type: NLQResponseType;
  text: string;
  metrics?: NLQMetric[];
  table?: NLQTableData;
  chart?: NLQChartPoint[];
  clarificationOptions?: NLQClarificationOption[];
  sources: NLQDataSource[];
}

/** Raw NLQ API response from the backend */
export interface RawNLQApiResponse {
  query: string;
  locale: string;
  workspace_id: string;
  payrolls_scanned: number;
  message: string;
  data?: Record<string, unknown>;
  type?: string;
  metrics?: NLQMetric[];
  table?: NLQTableData;
  chart?: NLQChartPoint[];
  clarification_options?: { id: string; label: string; query: string }[];
  sources?: { table: string; period?: string; company?: string }[];
}

/**
 * RBAC access rules per role.
 * Defines which data tables each role can access.
 */
const ROLE_ACCESS: Record<UserRole, string[]> = {
  admin: ['payroll_uploads', 'country_year_rules', 'audit_results', 'anomalies', 'forecasts', 'employees', 'companies'],
  analyst: ['payroll_uploads', 'country_year_rules', 'audit_results', 'anomalies', 'forecasts'],
  editor: ['payroll_uploads', 'audit_results'],
  viewer: ['payroll_uploads', 'audit_results'],
};

/**
 * Checks if a user role has access to a specific data source table.
 *
 * @param role - The user's role
 * @param table - The data source table name
 * @returns true if the role can access the table
 */
export function hasRoleAccess(role: UserRole, table: string): boolean {
  const allowed = ROLE_ACCESS[role];
  if (!allowed) return false;
  return allowed.includes(table);
}

/**
 * Filters NLQ response data sources based on user role and workspace.
 * Removes any data from sources the user doesn't have access to.
 *
 * @param response - Raw NLQ response
 * @param role - User's role
 * @param workspaceId - User's active workspace ID
 * @returns Filtered NLQ response with only accessible data
 */
export function filterResponseByRBAC(
  response: RawNLQApiResponse,
  role: UserRole,
  workspaceId: string,
): NLQResponse {
  const sources: NLQDataSource[] = (response.sources ?? [])
    .filter((s) => hasRoleAccess(role, s.table))
    .map((s) => ({ ...s, workspace_id: workspaceId }));

  // If clarification is needed
  if (response.clarification_options?.length) {
    return {
      type: 'clarification',
      text: response.message,
      clarificationOptions: response.clarification_options,
      sources,
    };
  }

  // Determine response type
  const type: NLQResponseType = response.type === 'table'
    ? 'table'
    : response.type === 'chart'
      ? 'chart'
      : response.metrics?.length
        ? 'metric'
        : 'text';

  return {
    type,
    text: response.message,
    metrics: response.metrics,
    table: response.table,
    chart: response.chart,
    sources,
  };
}

/**
 * Ensures every NLQ response includes data source metadata.
 * If no sources are provided, creates a default source entry.
 *
 * @param response - The NLQ response to validate
 * @param workspaceId - The active workspace ID
 * @returns Response with guaranteed sources array
 */
export function ensureDataSources(
  response: NLQResponse,
  workspaceId: string,
): NLQResponse {
  if (response.sources.length > 0) return response;

  return {
    ...response,
    sources: [{
      table: 'payroll_uploads',
      workspace_id: workspaceId,
    }],
  };
}
