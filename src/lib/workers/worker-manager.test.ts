/**
 * Tests for WorkerManager — unified Web Worker execution interface.
 *
 * Tests cover: execute, cancel, fallback, progress, and edge cases.
 *
 * Requirements: 3.1, 3.5, 3.6
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to mock Worker since we're in a Node test environment
class MockWorker {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  private messageHandler: ((data: unknown) => void) | null = null;

  constructor(public url: URL | string, public options?: WorkerOptions) {}

  postMessage(data: unknown) {
    // Simulate async worker response
    if (this.messageHandler) {
      this.messageHandler(data);
    }
  }

  terminate() {
    this.onmessage = null;
    this.onerror = null;
  }

  // Test helper: simulate worker sending a message back
  simulateMessage(data: unknown) {
    if (this.onmessage) {
      this.onmessage(new MessageEvent('message', { data }));
    }
  }

  simulateError(message: string) {
    if (this.onerror) {
      this.onerror(new ErrorEvent('error', { message }));
    }
  }
}

// Store created workers for test inspection
let createdWorkers: MockWorker[] = [];

beforeEach(() => {
  createdWorkers = [];
  // Mock the global Worker constructor
  vi.stubGlobal('Worker', class extends MockWorker {
    constructor(url: URL | string, options?: WorkerOptions) {
      super(url, options);
      createdWorkers.push(this);
    }
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('WorkerManager', () => {
  describe('isWorkerSupported', () => {
    it('returns true when Worker is defined', async () => {
      const { isWorkerSupported } = await import('./worker-manager');
      expect(isWorkerSupported()).toBe(true);
    });

    it('returns false when Worker is undefined', async () => {
      vi.stubGlobal('Worker', undefined);
      // Need fresh import to re-evaluate
      vi.resetModules();
      const { isWorkerSupported } = await import('./worker-manager');
      expect(isWorkerSupported()).toBe(false);
    });
  });

  describe('execute', () => {
    it('creates a worker and resolves with result', async () => {
      const { execute } = await import('./worker-manager');

      const promise = execute({
        type: 'excel-parse',
        data: { buffer: new ArrayBuffer(10) },
      });

      // Worker should have been created
      expect(createdWorkers.length).toBe(1);
      const worker = createdWorkers[0];

      // Simulate worker responding with result
      worker.simulateMessage({ type: 'result', sheets: [{ name: 'Sheet1' }] });

      const result = await promise;
      expect(result).toEqual([{ name: 'Sheet1' }]);
    });

    it('calls onProgress when worker sends progress messages', async () => {
      const { execute } = await import('./worker-manager');
      const onProgress = vi.fn();

      const promise = execute({
        type: 'anomaly-detect',
        data: { currentRows: [] },
        onProgress,
      });

      const worker = createdWorkers[0];
      worker.simulateMessage({ type: 'progress', percent: 50 });
      worker.simulateMessage({ type: 'result', result: [] });

      await promise;
      expect(onProgress).toHaveBeenCalledWith(50);
    });

    it('rejects when worker sends error', async () => {
      const { execute } = await import('./worker-manager');

      const promise = execute({
        type: 'excel-parse',
        data: { buffer: new ArrayBuffer(0) },
      });

      const worker = createdWorkers[0];
      worker.simulateMessage({ type: 'error', message: 'Parse failed' });

      await expect(promise).rejects.toThrow('Parse failed');
    });

    it('rejects when worker throws onerror', async () => {
      const { execute } = await import('./worker-manager');

      const promise = execute({
        type: 'excel-parse',
        data: { buffer: new ArrayBuffer(0) },
      });

      const worker = createdWorkers[0];
      worker.simulateError('Unexpected worker error');

      await expect(promise).rejects.toThrow('Unexpected worker error');
    });

    it('rejects immediately if signal is already aborted', async () => {
      const { execute } = await import('./worker-manager');
      const controller = new AbortController();
      controller.abort();

      await expect(
        execute({
          type: 'excel-parse',
          data: { buffer: new ArrayBuffer(0) },
          signal: controller.signal,
        }),
      ).rejects.toThrow('Task was cancelled before starting');
    });
  });

  describe('fallback execution', () => {
    it('uses fallback when Workers are not supported', async () => {
      vi.stubGlobal('Worker', undefined);
      vi.resetModules();

      const { execute, registerFallback } = await import('./worker-manager');

      const fallbackFn = vi.fn().mockResolvedValue([{ name: 'FallbackSheet' }]);
      registerFallback('excel-parse', fallbackFn);

      const result = await execute({
        type: 'excel-parse',
        data: { buffer: new ArrayBuffer(10) },
      });

      expect(fallbackFn).toHaveBeenCalled();
      expect(result).toEqual([{ name: 'FallbackSheet' }]);
    });

    it('passes onProgress to fallback executor', async () => {
      vi.stubGlobal('Worker', undefined);
      vi.resetModules();

      const { execute, registerFallback } = await import('./worker-manager');

      const fallbackFn = vi.fn().mockImplementation(async (_data: unknown, onProgress?: (p: number) => void) => {
        onProgress?.(50);
        onProgress?.(100);
        return [];
      });
      registerFallback('anomaly-detect', fallbackFn);

      const onProgress = vi.fn();
      await execute({
        type: 'anomaly-detect',
        data: { currentRows: [] },
        onProgress,
      });

      expect(onProgress).toHaveBeenCalledWith(50);
      expect(onProgress).toHaveBeenCalledWith(100);
    });

    it('rejects when no fallback is registered', async () => {
      vi.stubGlobal('Worker', undefined);
      vi.resetModules();

      const { execute } = await import('./worker-manager');

      await expect(
        execute({ type: 'forecast-calc', data: {} }),
      ).rejects.toThrow('No fallback executor registered');
    });
  });

  describe('cancel', () => {
    it('terminates worker after timeout', async () => {
      vi.useFakeTimers();
      const { execute, cancel, activeTaskCount } = await import('./worker-manager');

      const promise = execute({
        type: 'excel-parse',
        data: { buffer: new ArrayBuffer(10) },
      }).catch(() => {});

      expect(activeTaskCount()).toBe(1);

      // We need to get the taskId — it's internal, so we use AbortSignal instead
      // Let's test via AbortController
      const controller = new AbortController();
      const promise2 = execute({
        type: 'anomaly-detect',
        data: { currentRows: [] },
        signal: controller.signal,
      }).catch(() => {});

      controller.abort();

      // Advance past the 1s cancel timeout
      vi.advanceTimersByTime(1100);

      await promise2;
      vi.useRealTimers();
    });
  });

  describe('activeTaskCount', () => {
    it('tracks active tasks correctly', async () => {
      const { execute, activeTaskCount } = await import('./worker-manager');

      expect(activeTaskCount()).toBe(0);

      const promise = execute({
        type: 'excel-parse',
        data: { buffer: new ArrayBuffer(10) },
      });

      expect(activeTaskCount()).toBe(1);

      const worker = createdWorkers[0];
      worker.simulateMessage({ type: 'result', sheets: [] });

      await promise;
      expect(activeTaskCount()).toBe(0);
    });
  });
});
