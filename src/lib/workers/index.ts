/**
 * Web Workers module — unified exports.
 *
 * @module lib/workers
 */

export { default as WorkerManager, execute, cancel, cancelAll, activeTaskCount, isWorkerSupported, registerFallback } from './worker-manager';
export type { WorkerTask, WorkerTaskType, FallbackExecutor } from './worker-manager';
export { useExcelWorker } from './use-excel-worker';
export type { ParsedSheet, UseExcelWorkerResult } from './use-excel-worker';
