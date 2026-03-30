/**
 * Web Worker helper for Excel file parsing (>500 rows).
 * Offloads heavy XLSX parsing to a background thread to avoid blocking the main thread.
 *
 * Requirements: 23.1, 23.5
 * @module lib/performance/excel-worker
 */

export interface ExcelWorkerMessage {
  type: 'parse';
  fileBuffer: ArrayBuffer;
  sheetIndex?: number;
}

export interface ExcelWorkerResult {
  type: 'result' | 'error' | 'progress';
  data?: Record<string, unknown>[][];
  sheetNames?: string[];
  totalRows?: number;
  error?: string;
  progress?: number;
}

const WORKER_THRESHOLD_ROWS = 500;

/**
 * Parse Excel file in a Web Worker if available and data exceeds threshold.
 * Falls back to main-thread parsing when Workers are unavailable.
 */
export async function parseExcelInWorker(
  fileBuffer: ArrayBuffer,
  onProgress?: (pct: number) => void,
): Promise<ExcelWorkerResult> {
  // In SSR or environments without Worker support, fall back
  if (typeof Worker === 'undefined') {
    return parseExcelMainThread(fileBuffer);
  }

  return new Promise((resolve) => {
    try {
      const blob = new Blob(
        [`importScripts('https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js');
          self.onmessage = function(e) {
            try {
              const wb = XLSX.read(e.data.fileBuffer, { type: 'array' });
              const sheets = wb.SheetNames.map(name => XLSX.utils.sheet_to_json(wb.Sheets[name]));
              self.postMessage({ type: 'result', data: sheets, sheetNames: wb.SheetNames, totalRows: sheets.reduce((s,sh) => s + sh.length, 0) });
            } catch (err) {
              self.postMessage({ type: 'error', error: String(err) });
            }
          };`],
        { type: 'application/javascript' },
      );
      const url = URL.createObjectURL(blob);
      const worker = new Worker(url);

      worker.onmessage = (e: MessageEvent<ExcelWorkerResult>) => {
        if (e.data.type === 'progress') {
          onProgress?.(e.data.progress ?? 0);
        } else {
          worker.terminate();
          URL.revokeObjectURL(url);
          resolve(e.data);
        }
      };

      worker.onerror = () => {
        worker.terminate();
        URL.revokeObjectURL(url);
        resolve(parseExcelMainThread(fileBuffer));
      };

      worker.postMessage({ type: 'parse', fileBuffer } satisfies ExcelWorkerMessage, [fileBuffer]);
    } catch {
      resolve(parseExcelMainThread(fileBuffer));
    }
  });
}

/** Fallback: parse on main thread */
async function parseExcelMainThread(fileBuffer: ArrayBuffer): Promise<ExcelWorkerResult> {
  try {
    const XLSX = await import('xlsx');
    const wb = XLSX.read(fileBuffer, { type: 'array' });
    const sheets = wb.SheetNames.map((name) => XLSX.utils.sheet_to_json(wb.Sheets[name]) as Record<string, unknown>[]);
    return { type: 'result', data: sheets, sheetNames: wb.SheetNames, totalRows: sheets.reduce((s, sh) => s + sh.length, 0) };
  } catch (err) {
    return { type: 'error', error: String(err) };
  }
}

export { WORKER_THRESHOLD_ROWS };
