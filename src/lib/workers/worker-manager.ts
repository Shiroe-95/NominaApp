/**
 * WorkerManager — Unified interface for executing, canceling, and receiving
 * progress from Web Workers.
 *
 * Supports three worker types: excel-parse, anomaly-detect, forecast-calc.
 * Provides cancellation with 1s timeout + terminate(), progress callbacks,
 * and fallback to main-thread execution when Workers are not supported.
 *
 * Requirements: 3.1, 3.4, 3.5, 3.6, 3.7
 *
 * @module lib/workers/worker-manager
 */

// ── Types ───────────────────────────────────────────────────────────

export type WorkerTaskType = 'excel-parse' | 'anomaly-detect' | 'forecast-calc';

export interface WorkerTask<T = unknown> {
  type: WorkerTaskType;
  data: T;
  onProgress?: (percent: number) => void;
  signal?: AbortSignal;
}

export interface WorkerMessage {
  type: 'result' | 'error' | 'progress';
  result?: unknown;
  message?: string;
  percent?: number;
  sheets?: unknown[];
}

interface ActiveTask {
  worker: Worker;
  reject: (reason: Error) => void;
  cleanup: () => void;
}

// ── Fallback Executors ──────────────────────────────────────────────

export type FallbackExecutor<T = unknown, R = unknown> = (
  data: T,
  onProgress?: (percent: number) => void,
) => Promise<R>;

const fallbackExecutors: Partial<Record<WorkerTaskType, FallbackExecutor>> = {};

/**
 * Register a fallback executor for a given worker type.
 * Used when Web Workers are not supported by the browser.
 */
export function registerFallback<T = unknown, R = unknown>(
  type: WorkerTaskType,
  executor: FallbackExecutor<T, R>,
): void {
  fallbackExecutors[type] = executor as FallbackExecutor;
}

// ── Worker URL Factories ────────────────────────────────────────────

type WorkerFactory = () => Worker;

const workerFactories: Record<WorkerTaskType, WorkerFactory> = {
  'excel-parse': () =>
    new Worker(new URL('./excel-parser.worker.ts', import.meta.url), { type: 'module' }),
  'anomaly-detect': () =>
    new Worker(new URL('./anomaly-detect.worker.ts', import.meta.url), { type: 'module' }),
  'forecast-calc': () =>
    new Worker(new URL('./forecast-calc.worker.ts', import.meta.url), { type: 'module' }),
};

// ── Helpers ─────────────────────────────────────────────────────────

let taskCounter = 0;

function generateTaskId(): string {
  return `task-${++taskCounter}-${Date.now()}`;
}

/**
 * Check if Web Workers are supported in the current environment.
 */
export function isWorkerSupported(): boolean {
  return typeof Worker !== 'undefined';
}

// ── WorkerManager ───────────────────────────────────────────────────

const activeTasks = new Map<string, ActiveTask>();

/** Cancel timeout before calling terminate() (ms). */
const CANCEL_TIMEOUT_MS = 1000;

/**
 * Execute a task in a Web Worker. Returns a promise that resolves with the
 * worker result. If Workers are not supported, falls back to the registered
 * main-thread executor.
 */
export function execute<T = unknown, R = unknown>(task: WorkerTask<T>): Promise<R> {
  // Fallback to main thread when Workers are not available
  if (!isWorkerSupported()) {
    const fallback = fallbackExecutors[task.type];
    if (!fallback) {
      return Promise.reject(
        new Error(`No fallback executor registered for worker type "${task.type}"`),
      );
    }
    return fallback(task.data, task.onProgress) as Promise<R>;
  }

  const taskId = generateTaskId();

  return new Promise<R>((resolve, reject) => {
    // Abort early if signal already aborted
    if (task.signal?.aborted) {
      reject(new Error('Task was cancelled before starting'));
      return;
    }

    const factory = workerFactories[task.type];
    if (!factory) {
      reject(new Error(`Unknown worker type: ${task.type}`));
      return;
    }

    const worker = factory();

    const cleanup = () => {
      worker.onmessage = null;
      worker.onerror = null;
      activeTasks.delete(taskId);
    };

    activeTasks.set(taskId, { worker, reject, cleanup });

    worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
      const msg = event.data;

      if (msg.type === 'progress' && typeof msg.percent === 'number') {
        task.onProgress?.(msg.percent);
        return;
      }

      if (msg.type === 'result') {
        cleanup();
        // excel-parser returns sheets, others return result
        const payload = (msg.result !== undefined ? msg.result : msg.sheets) as R;
        resolve(payload);
        worker.terminate();
        return;
      }

      if (msg.type === 'error') {
        cleanup();
        reject(new Error(msg.message ?? 'Worker error'));
        worker.terminate();
      }
    };

    worker.onerror = (err) => {
      cleanup();
      reject(new Error(err.message || 'Worker error'));
      worker.terminate();
    };

    // Wire up AbortSignal → cancel
    if (task.signal) {
      const onAbort = () => {
        cancel(taskId);
      };
      task.signal.addEventListener('abort', onAbort, { once: true });
      // Clean up listener when task completes
      const origCleanup = activeTasks.get(taskId)?.cleanup;
      if (origCleanup) {
        activeTasks.set(taskId, {
          ...activeTasks.get(taskId)!,
          cleanup: () => {
            task.signal?.removeEventListener('abort', onAbort);
            origCleanup();
          },
        });
      }
    }

    // Send data to worker — transfer ArrayBuffers when possible
    const transferables: Transferable[] = [];
    const payload = task.data as Record<string, unknown>;
    if (payload && payload.buffer instanceof ArrayBuffer) {
      transferables.push(payload.buffer as ArrayBuffer);
    }

    worker.postMessage({ type: task.type, ...payload }, transferables);
  });
}

/**
 * Cancel a running worker task. Sends a cancel message, waits up to 1 second
 * for graceful shutdown, then calls terminate().
 */
export function cancel(taskId: string): void {
  const entry = activeTasks.get(taskId);
  if (!entry) return;

  const { worker, reject, cleanup } = entry;

  // Ask worker to stop gracefully
  try {
    worker.postMessage({ type: 'cancel' });
  } catch {
    // Worker may already be terminated
  }

  // Give the worker 1 second to finish, then force-terminate
  const timeout = setTimeout(() => {
    cleanup();
    worker.terminate();
    reject(new Error('Task cancelled'));
  }, CANCEL_TIMEOUT_MS);

  // If the worker responds before timeout, clear it
  const origOnMessage = worker.onmessage;
  worker.onmessage = (event: MessageEvent<WorkerMessage>) => {
    clearTimeout(timeout);
    cleanup();
    worker.terminate();
    // If it sent a result before terminating, we still reject as cancelled
    reject(new Error('Task cancelled'));
    // Restore in case something else needs it
    worker.onmessage = origOnMessage;
  };
}

/**
 * Cancel all active tasks.
 */
export function cancelAll(): void {
  for (const taskId of Array.from(activeTasks.keys())) {
    cancel(taskId);
  }
}

/**
 * Get the number of currently active tasks.
 */
export function activeTaskCount(): number {
  return activeTasks.size;
}

// Re-export as a namespace-like object for convenience
const WorkerManager = { execute, cancel, cancelAll, activeTaskCount, isWorkerSupported, registerFallback };
export default WorkerManager;
