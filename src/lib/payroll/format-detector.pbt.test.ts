/**
 * Property-Based Tests for Format Detector
 * Feature: platform-improvements, Property 15: Format Detector identification
 *
 * Validates: Requirements 4.6
 * For any file generated with a known format (CSV with valid delimiters,
 * XLSX with correct magic bytes), detectFormat must return the correct
 * format with confidence >= 0.8.
 *
 * Uses fast-check with minimum 100 iterations.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { detectFormat, detectDelimiter } from './format-detector';
import type { CsvDelimiter } from './format-detector';

const NUM_RUNS = 100;

// ── Generators ──────────────────────────────────────────────────────

/** Generate a valid CSV delimiter */
const delimiterArb: fc.Arbitrary<CsvDelimiter> = fc.constantFrom(
  ',' as const,
  ';' as const,
  '\t' as const,
  '|' as const,
);

/** Generate a CSV cell value (no delimiter chars, no newlines) */
function csvCellArb(delimiter: CsvDelimiter): fc.Arbitrary<string> {
  return fc.stringOf(
    fc.char().filter((c: string) =>
      c !== delimiter && c !== '\n' && c !== '\r' && c !== '"',
    ),
    { minLength: 1, maxLength: 20 },
  );
}

/** Build CSV text from generated data */
function buildCsvText(
  delimiter: CsvDelimiter,
  header: string[],
  rows: string[][],
): string {
  const lines = [header.join(delimiter), ...rows.map((r) => r.join(delimiter))];
  return lines.join('\n');
}

/** Generate a valid CSV content: [delimiter, headerRow, dataRows] */
const csvContentArb: fc.Arbitrary<[CsvDelimiter, string[], string[][]]> = delimiterArb.chain(
  (delimiter: CsvDelimiter) =>
    fc.integer({ min: 2, max: 6 }).chain((cols: number) => {
      const cellArb = csvCellArb(delimiter);
      const rowArb = fc.array(cellArb, { minLength: cols, maxLength: cols });
      return fc.tuple(
        fc.constant(delimiter),
        fc.array(cellArb, { minLength: cols, maxLength: cols }),
        fc.array(rowArb, { minLength: 2, maxLength: 8 }),
      );
    }),
);

/** XLSX magic bytes: PK\x03\x04 */
const XLSX_MAGIC = Uint8Array.from([0x50, 0x4b, 0x03, 0x04]);

/** XLS magic bytes: D0 CF 11 E0 */
const XLS_MAGIC = Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0]);

/** Generate XLSX-like binary content with correct magic bytes */
const xlsxContentArb: fc.Arbitrary<Uint8Array> = fc
  .uint8Array({ minLength: 10, maxLength: 100 })
  .map((extra: Uint8Array) => {
    const result = new Uint8Array(XLSX_MAGIC.length + extra.length);
    result.set(XLSX_MAGIC, 0);
    result.set(extra, XLSX_MAGIC.length);
    return result;
  });

/** Generate XLS-like binary content with correct magic bytes */
const xlsContentArb: fc.Arbitrary<Uint8Array> = fc
  .uint8Array({ minLength: 10, maxLength: 100 })
  .map((extra: Uint8Array) => {
    const result = new Uint8Array(XLS_MAGIC.length + extra.length);
    result.set(XLS_MAGIC, 0);
    result.set(extra, XLS_MAGIC.length);
    return result;
  });

/** Generate valid JSON content */
const jsonContentArb: fc.Arbitrary<string> = fc.oneof(
  fc
    .dictionary(
      fc.string({ minLength: 1, maxLength: 15 }).filter((s: string) => /^[a-zA-Z_]/.test(s)),
      fc.oneof(fc.string({ maxLength: 30 }), fc.integer(), fc.boolean()),
      { minKeys: 1, maxKeys: 5 },
    )
    .map((obj: Record<string, unknown>) => JSON.stringify(obj)),
  fc
    .array(fc.integer(), { minLength: 1, maxLength: 10 })
    .map((arr: number[]) => JSON.stringify(arr)),
);


// ── Property 15: Format Detector Identification ─────────────────────

describe('Feature: platform-improvements, Property 15: Format Detector identification', () => {
  it('detects CSV format with confidence >= 0.8 for valid CSV content with .csv extension', () => {
    fc.assert(
      fc.property(csvContentArb, ([delimiter, header, rows]: [CsvDelimiter, string[], string[][]]) => {
        const csvText = buildCsvText(delimiter, header, rows);
        const result = detectFormat('data.csv', csvText);

        expect(result.format).toBe('csv');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('detects XLSX format with confidence >= 0.8 for content with XLSX magic bytes', () => {
    fc.assert(
      fc.property(xlsxContentArb, (content: Uint8Array) => {
        const result = detectFormat('report.xlsx', content);

        expect(result.format).toBe('xlsx');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('detects XLS format with confidence >= 0.8 for content with XLS magic bytes', () => {
    fc.assert(
      fc.property(xlsContentArb, (content: Uint8Array) => {
        const result = detectFormat('report.xls', content);

        expect(result.format).toBe('xls');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('detects JSON format with confidence >= 0.8 for valid JSON content with .json extension', () => {
    fc.assert(
      fc.property(jsonContentArb, (jsonText: string) => {
        const result = detectFormat('config.json', jsonText);

        expect(result.format).toBe('json');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('detects CSV format with confidence >= 0.8 for valid CSV content without extension', () => {
    fc.assert(
      fc.property(csvContentArb, ([delimiter, header, rows]: [CsvDelimiter, string[], string[][]]) => {
        const csvText = buildCsvText(delimiter, header, rows);
        // No extension — relies on content analysis
        const result = detectFormat('datafile', csvText);

        expect(result.format).toBe('csv');
        expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('detectDelimiter returns a consistent delimiter for the same input', () => {
    fc.assert(
      fc.property(csvContentArb, ([delimiter, header, rows]: [CsvDelimiter, string[], string[][]]) => {
        const csvText = buildCsvText(delimiter, header, rows);
        const detected1 = detectDelimiter(csvText);
        const detected2 = detectDelimiter(csvText);
        expect(detected1).toBe(detected2);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
