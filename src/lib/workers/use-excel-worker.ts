/**
 * Hook for parsing Excel files using a Web Worker when row count exceeds 1000.
 *
 * Falls back to synchronous parsing for smaller files.
 *
 * Requirements: 24.2
 *
 * @module lib/workers/use-excel-worker
 */

import { useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';

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
}

/**
 * Returns a `parseFile` function that uses a Web Worker for files >1000 rows.
 */
export function useExcelWorker(): UseExcelWorkerResult {
  const workerRef = useRef<Worker | null>(null);

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

    // For large files, use Web Worker
    return new Promise<ParsedSheet[]>((resolve, reject) => {
      try {
        if (!workerRef.current) {
          workerRef.current = new Worker(
            new URL('./excel-parser.worker.ts', import.meta.url),
            { type: 'module' },
          );
        }

        const worker = workerRef.current;

        worker.onmessage = (event) => {
          if (event.data.type === 'result') {
            resolve(event.data.sheets);
          } else if (event.data.type === 'error') {
            reject(new Error(event.data.message));
          }
        };

        worker.onerror = (err) => {
          reject(new Error(err.message || 'Worker error'));
        };

        worker.postMessage({ type: 'parse', buffer, selectedSheets }, [buffer]);
      } catch {
        // Fallback to synchronous if Worker fails
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheets = workbook.SheetNames.map((name, index) => {
          if (selectedSheets && !selectedSheets.includes(index)) return null;
          const sheet = workbook.Sheets[name];
          const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
          const headers = (jsonData[0] as string[]) ?? [];
          const data = jsonData.slice(1);
          return { name, index, headers: headers.map(String), rowCount: data.length, data };
        }).filter(Boolean) as ParsedSheet[];
        resolve(sheets);
      }
    });
  }, []);

  return { parseFile };
}
