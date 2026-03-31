/**
 * Workspace Data Filter — Utility for filtering data by workspace_id.
 *
 * Provides pure functions for workspace-based data isolation that can be
 * tested independently of Supabase.
 *
 * Requirements: 15.3, 15.5, 15.7
 */

export interface WorkspaceScoped {
  workspace_id: string;
  [key: string]: unknown;
}

/**
 * Filter an array of records to only include those belonging to the given workspace.
 * This is the client-side complement to RLS policies on the server.
 */
export function filterByWorkspace<T extends WorkspaceScoped>(
  records: T[],
  workspaceId: string,
): T[] {
  if (!workspaceId) return [];
  return records.filter((r) => r.workspace_id === workspaceId);
}

/**
 * Check if a record belongs to a specific workspace.
 */
export function belongsToWorkspace(record: WorkspaceScoped, workspaceId: string): boolean {
  return record.workspace_id === workspaceId;
}

/**
 * Verify RLS isolation: given two workspace IDs and a set of records,
 * ensure no record from workspace A appears in workspace B's filtered set.
 */
export function verifyRLSIsolation<T extends WorkspaceScoped>(
  records: T[],
  workspaceA: string,
  workspaceB: string,
): { isolated: boolean; violations: T[] } {
  if (workspaceA === workspaceB) {
    return { isolated: true, violations: [] };
  }

  const setA = filterByWorkspace(records, workspaceA);
  const violations = setA.filter((r) => r.workspace_id === workspaceB);

  return {
    isolated: violations.length === 0,
    violations,
  };
}

/**
 * Add workspace_id to a query params object for API calls.
 */
export function withWorkspaceScope(params: Record<string, string>, workspaceId: string): Record<string, string> {
  return { ...params, workspace_id: workspaceId };
}
