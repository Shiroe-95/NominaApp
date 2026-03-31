/**
 * Hook for parsing Excel files using the WorkerManager.
 *
 * Falls back to synchronous parsing when Workers are not supported.
 *
 * Requirements: 3.1, 3.2, 3.6
 *
 * @module lib/workers/use-excel-worker
 */

import { useCallback, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import WorkerManager, { registerFallback } from './worker-manager';

const ROW_THRESHOLD = 1000;

export interface ParsedSheet {
  name: string;
  index: number;
  headers: string[];
  rowCount: number;
  data: unknown[][];
}

export interface UseExcelWorkerResult {
  parseFile: (file: File, selectedSheets?: number[]) => Promise<ParsedSheet[]>;
  progress: number;
  cancel: () => void;
}

// Register main-thread fallback for excel parsing
registerFallback<{ buffer: ArrayBuffer; selectedSheets?: number[] }, ParsedSheet[]>(
  'excel-parse',
  async (data, onProgress) => {
    onProgress?.(5);
    const workbook = XLSX.read(data.buffer, { type: 'array' });
    onProgress?.(30);
    const sheets = workbook.SheetNames.map((name, index) => {
      if (data.selectedSheets && !data.selectedSheets.includes(index)) return null;
      const sheet = workbook.Sheets[name];
      const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
      const headers = (jsonData[0] as string[]) ?? [];
      const rows = jsonData.slice(1);
      return { name, index, headers: headers.map(String), rowCount: rows.length, data: rows };
    }).filter(Boolean) as ParsedSheet[];
    onProgress?.(100);
    return sheets;
  },
);

/**
 * Returns a `parseFile` function that uses a Web Worker for files >1000 rows,
 * with progress tracking and cancellation support.
 */
export function useExcelWorker(): UseExcelWorkerResult {
  const [progress, setProgress] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setProgress(0);
  }, []);

  const parseFile = useCallback(async (file: File, selectedSheets?: number[]): Promise<ParsedSheet[]> => {
    const buffer = await file.arrayBuffer();

    // Quick check: parse headers only to estimate row count
    const quickWb = XLSX.read(buffer, { type: 'array', sheetRows: 2 });
    const firstSheet = quickWb.Sheets[quickWb.SheetNames[0]];
    const range = XLSX.utils.decode_range(firstSheet['!ref'] ?? 'A1');
    const estimatedRows = range.e.r;

    // For small files, parse synchronously
    if (estimatedRows <= ROW_THRESHOLD) {
      const workbook = XLSX.read(buffer, { type: 'array' });
      return workbook.SheetNames.map((name, index) => {
        if (selectedSheets && !selectedSheets.includes(index)) return null;
        const sheet = workbook.Sheets[name];
        const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
        const headers = (jsonData[0] as string[]) ?? [];
        const data = jsonData.slice(1);
        return { name, index, headers: headers.map(String), rowCount: data.length, data };
      }).filter(Boolean) as ParsedSheet[];
    }

    // For large files, use WorkerManager
    const controller = new AbortController();
    abortRef.current = controller;
    setProgress(0);

    try {
      const result = await WorkerManager.execute<
        { buffer: ArrayBuffer; selectedSheets?: number[] },
        ParsedSheet[]
      >({
        type: 'excel-parse',
        data: { buffer, selectedSheets },
        onProgress: setProgress,
        signal: controller.signal,
      });
      setProgress(100);
      return result;
    } finally {
      abortRef.current = null;
    }
  }, []);

  return { parseFile, progress, cancel };
}
