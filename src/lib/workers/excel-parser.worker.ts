/**
 * Web Worker for parsing large Excel files.
 *
 * Offloads XLSX parsing to a background thread to avoid blocking the main thread.
 * Reports progress every 500ms during sheet processing.
 * Supports cancellation via 'cancel' message.
 *
 * Requirements: 3.1, 3.2, 3.6
 *
 * @module lib/workers/excel-parser.worker
 */

/// <reference lib="webworker" />

import * as XLSX from 'xlsx';

export interface WorkerParseMessage {
  type: 'parse' | 'excel-parse' | 'cancel';
  buffer?: ArrayBuffer;
  selectedSheets?: number[];
}

export interface ParsedSheet {
  name: string;
  index: number;
  headers: string[];
  rowCount: number;
  data: unknown[][];
}

export interface WorkerResult {
  type: 'result';
  sheets: ParsedSheet[];
}

export interface WorkerProgress {
  type: 'progress';
  percent: number;
}

export interface WorkerError {
  type: 'error';
  message: string;
}

let cancelled = false;

/**
 * Report progress to the main thread. Capped at 0–100.
 */
function reportProgress(percent: number): void {
  const clamped = Math.min(100, Math.max(0, Math.round(percent)));
  self.postMessage({ type: 'progress', percent: clamped } satisfies WorkerProgress);
}

self.onmessage = (event: MessageEvent<WorkerParseMessage>) => {
  const { type } = event.data;

  if (type === 'cancel') {
    cancelled = true;
    return;
  }

  if (type !== 'parse' && type !== 'excel-parse') return;

  cancelled = false;

  try {
    const { buffer, selectedSheets } = event.data;
    if (!buffer) {
      self.postMessage({ type: 'error', message: 'No buffer provided' } satisfies WorkerError);
      return;
    }

    reportProgress(5);

    const workbook = XLSX.read(buffer, { type: 'array' });

    reportProgress(20);

    if (cancelled) {
      self.postMessage({ type: 'error', message: 'Cancelled' } satisfies WorkerError);
      return;
    }

    const sheetNames = workbook.SheetNames;
    const sheetsToProcess = selectedSheets
      ? sheetNames.filter((_, i) => selectedSheets.includes(i))
      : sheetNames;

    const totalSheets = sheetsToProcess.length;
    const sheets: ParsedSheet[] = [];
    let lastProgressTime = Date.now();

    for (let si = 0; si < sheetNames.length; si++) {
      if (cancelled) {
        self.postMessage({ type: 'error', message: 'Cancelled' } satisfies WorkerError);
        return;
      }

      const name = sheetNames[si];
      if (selectedSheets && !selectedSheets.includes(si)) continue;

      const sheet = workbook.Sheets[name];
      const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
      const headers = (jsonData[0] as string[]) ?? [];
      const data = jsonData.slice(1);

      sheets.push({
        name,
        index: si,
        headers: headers.map(String),
        rowCount: data.length,
        data,
      });

      // Report progress every 500ms or on each sheet completion
      const now = Date.now();
      if (now - lastProgressTime >= 500 || si === sheetNames.length - 1) {
        const sheetProgress = sheets.length / totalSheets;
        // 20% for reading workbook, 20-90% for processing sheets, 90-100% for finalization
        const percent = 20 + sheetProgress * 70;
        reportProgress(percent);
        lastProgressTime = now;
      }
    }

    reportProgress(95);

    const result: WorkerResult = { type: 'result', sheets };
    self.postMessage(result);

    reportProgress(100);
  } catch (err) {
    const error: WorkerError = {
      type: 'error',
      message: err instanceof Error ? err.message : 'Error parsing Excel file',
    };
    self.postMessage(error);
  }
};
