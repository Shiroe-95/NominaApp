/**
 * Web Worker for parsing large Excel files (>1000 rows).
 *
 * Offloads XLSX parsing to a background thread to avoid blocking the main thread.
 * Receives an ArrayBuffer of the file and returns parsed sheet data.
 *
 * Requirements: 24.2
 *
 * @module lib/workers/excel-parser.worker
 */

/// <reference lib="webworker" />

import * as XLSX from 'xlsx';

export interface WorkerMessage {
  type: 'parse';
  buffer: ArrayBuffer;
  selectedSheets?: number[];
}

export interface WorkerResult {
  type: 'result';
  sheets: Array<{
    name: string;
    index: number;
    headers: string[];
    rowCount: number;
    data: unknown[][];
  }>;
}

export interface WorkerError {
  type: 'error';
  message: string;
}

self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  try {
    const { buffer, selectedSheets } = event.data;
    const workbook = XLSX.read(buffer, { type: 'array' });

    const sheets = workbook.SheetNames.map((name, index) => {
      if (selectedSheets && !selectedSheets.includes(index)) {
        return null;
      }

      const sheet = workbook.Sheets[name];
      const jsonData = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
      const headers = (jsonData[0] as string[]) ?? [];
      const data = jsonData.slice(1);

      return {
        name,
        index,
        headers: headers.map(String),
        rowCount: data.length,
        data,
      };
    }).filter(Boolean);

    const result: WorkerResult = { type: 'result', sheets: sheets as WorkerResult['sheets'] };
    self.postMessage(result);
  } catch (err) {
    const error: WorkerError = {
      type: 'error',
      message: err instanceof Error ? err.message : 'Error parsing Excel file',
    };
    self.postMessage(error);
  }
};
