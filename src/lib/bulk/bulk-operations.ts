/**
 * Bulk Operations — Client-side logic for executing bulk operations
 * with partial failure handling.
 *
 * Requirements: 17.1-17.6
 */

export interface BulkOperationResult<T = unknown> {
  total: number;
  successful: BulkItemResult<T>[];
  failed: BulkItemResult<T>[];
}

export interface BulkItemResult<T = unknown> {
  id: string;
  data?: T;
  error?: string;
}

export type BulkAction = 'export' | 'delete' | 're-audit' | 'change-status' | 'assign';

export interface BulkOperationProgress {
  total: number;
  processed: number;
  failed: number;
  startedAt: number;
}

/**
 * Process a bulk operation with partial failure handling.
 *
 * - Successful items are completed
 * - Failed items are reported with error details
 * - successful.length + failed.length === total
 *
 * Requirements: 17.4
 */
export function processBulkResults<T>(
  ids: string[],
  results: Map<string, { success: boolean; data?: T; error?: string }>,
): BulkOperationResult<T> {
  const successful: BulkItemResult<T>[] = [];
  const failed: BulkItemResult<T>[] = [];

  for (const id of ids) {
    const result = results.get(id);
    if (!result) {
      failed.push({ id, error: 'No result received' });
    } else if (result.success) {
      successful.push({ id, data: result.data });
    } else {
      failed.push({ id, error: result.error ?? 'Unknown error' });
    }
  }

  return {
    total: ids.length,
    successful,
    failed,
  };
}

/**
 * Extract IDs of failed items for retry.
 */
export function getRetryIds<T>(result: BulkOperationResult<T>): string[] {
  return result.failed.map((f) => f.id);
}

/**
 * Validate the invariant: successful + failed === total.
 */
export function validateBulkInvariant<T>(result: BulkOperationResult<T>): boolean {
  return result.successful.length + result.failed.length === result.total;
}

/**
 * Execute a bulk operation against the API with progress tracking.
 */
export async function executeBulkOperation(
  action: BulkAction,
  ids: string[],
  onProgress?: (progress: BulkOperationProgress) => void,
  extraData?: Record<string, unknown>,
): Promise<BulkOperationResult> {
  const progress: BulkOperationProgress = {
    total: ids.length,
    processed: 0,
    failed: 0,
    startedAt: Date.now(),
  };

  onProgress?.(progress);

  const endpoint = action === 'change-status' || action === 'assign'
    ? '/api/v1/bulk/actions'
    : '/api/v1/bulk/payrolls';

  const method = action === 'change-status' || action === 'assign' ? 'PATCH' : 'POST';

  try {
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, action, ...extraData }),
    });

    const data = await res.json();
    const results = new Map<string, { success: boolean; data?: unknown; error?: string }>();

    if (res.ok) {
      const processedCount = data.results?.processed ?? data.updated ?? ids.length;
      const failedCount = data.results?.failed ?? 0;

      // Mark items as successful or failed based on API response
      for (let i = 0; i < ids.length; i++) {
        if (i < processedCount) {
          results.set(ids[i], { success: true });
        } else {
          results.set(ids[i], { success: false, error: data.results?.errors?.[i - processedCount] ?? 'Operation failed' });
        }
      }

      progress.processed = processedCount;
      progress.failed = failedCount;
    } else {
      // All failed
      for (const id of ids) {
        results.set(id, { success: false, error: data.error ?? 'Request failed' });
      }
      progress.failed = ids.length;
    }

    onProgress?.(progress);
    return processBulkResults(ids, results);
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Network error';
    const results = new Map<string, { success: boolean; error: string }>();
    for (const id of ids) {
      results.set(id, { success: false, error });
    }
    progress.failed = ids.length;
    onProgress?.(progress);
    return processBulkResults(ids, results);
  }
}
