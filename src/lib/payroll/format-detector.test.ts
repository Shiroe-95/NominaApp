import { describe, it, expect } from 'vitest';
import { detectFormat, detectDelimiter } from './format-detector';

// ── Unit tests: detectFormat — extension-based ──────────────────────

describe('detectFormat — extension-based (no content)', () => {
  it('detects CSV by .csv extension', () => {
    const result = detectFormat('nomina.csv');
    expect(result.format).toBe('csv');
    expect(result.confidence).toBe(0.8);
    expect(result.metadata.delimiter).toBe(',');
    expect(result.metadata.extension).toBe('csv');
  });

  it('detects TSV by .tsv extension with tab delimiter', () => {
    const result = detectFormat('data.tsv');
    expect(result.format).toBe('csv');
    expect(result.metadata.delimiter).toBe('\t');
  });

  it('detects XLSX by .xlsx extension', () => {
    const result = detectFormat('report.xlsx');
    expect(result.format).toBe('xlsx');
    expect(result.confidence).toBe(0.8);
  });

  it('detects XLS by .xls extension', () => {
    const result = detectFormat('legacy.xls');
    expect(result.format).toBe('xls');
    expect(result.confidence).toBe(0.8);
  });

  it('detects JSON by .json extension', () => {
    const result = detectFormat('payroll.json');
    expect(result.format).toBe('json');
    expect(result.confidence).toBe(0.8);
  });

  it('returns unknown for unrecognized extension', () => {
    const result = detectFormat('readme.txt');
    expect(result.format).toBe('unknown');
    expect(result.confidence).toBe(0);
  });

  it('returns unknown for file without extension', () => {
    const result = detectFormat('Makefile');
    expect(result.format).toBe('unknown');
    expect(result.confidence).toBe(0);
  });

  it('handles path-like filenames', () => {
    const result = detectFormat('/uploads/2024/nomina.csv');
    expect(result.format).toBe('csv');
  });
});

// ── Unit tests: detectFormat — content-based ────────────────────────

describe('detectFormat — content-based', () => {
  it('detects JSON from valid JSON content', () => {
    const content = JSON.stringify([{ name: 'Juan', salary: 5000 }]);
    const result = detectFormat('data.json', content);
    expect(result.format).toBe('json');
    expect(result.confidence).toBe(1.0);
  });

  it('detects JSON object content even with wrong extension', () => {
    const content = '{"employees": []}';
    const result = detectFormat('data.txt', content);
    expect(result.format).toBe('json');
    expect(result.confidence).toBe(1.0);
  });

  it('detects CSV with comma delimiter from content', () => {
    const content = 'nombre,salario,cargo\nJuan,5000,Dev\nAna,6000,PM';
    const result = detectFormat('nomina.csv', content);
    expect(result.format).toBe('csv');
    expect(result.confidence).toBe(1.0);
    expect(result.metadata.delimiter).toBe(',');
  });

  it('detects CSV with semicolon delimiter', () => {
    const content = 'nombre;salario;cargo\nJuan;5000;Dev\nAna;6000;PM';
    const result = detectFormat('nomina.csv', content);
    expect(result.format).toBe('csv');
    expect(result.metadata.delimiter).toBe(';');
  });

  it('detects CSV with tab delimiter', () => {
    const content = 'nombre\tsalario\tcargo\nJuan\t5000\tDev\nAna\t6000\tPM';
    const result = detectFormat('data.tsv', content);
    expect(result.format).toBe('csv');
    expect(result.metadata.delimiter).toBe('\t');
  });

  it('detects CSV with pipe delimiter', () => {
    const content = 'nombre|salario|cargo\nJuan|5000|Dev\nAna|6000|PM';
    const result = detectFormat('data.csv', content);
    expect(result.format).toBe('csv');
    expect(result.metadata.delimiter).toBe('|');
  });

  it('detects XLSX from binary magic bytes', () => {
    const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]);
    const result = detectFormat('file.xlsx', bytes);
    expect(result.format).toBe('xlsx');
    expect(result.confidence).toBe(1.0);
    expect(result.metadata.encoding).toBe('binary');
  });

  it('detects XLS from binary magic bytes', () => {
    const bytes = Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0x00, 0x00]);
    const result = detectFormat('file.xls', bytes);
    expect(result.format).toBe('xls');
    expect(result.confidence).toBe(1.0);
  });

  it('detects XLSX magic bytes even with wrong extension', () => {
    const bytes = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);
    const result = detectFormat('data.bin', bytes);
    expect(result.format).toBe('xlsx');
    expect(result.confidence).toBe(1.0);
  });

  it('detects CSV content without matching extension', () => {
    const content = 'a,b,c\n1,2,3\n4,5,6';
    const result = detectFormat('data.txt', content);
    expect(result.format).toBe('csv');
    expect(result.confidence).toBe(0.9);
    expect(result.metadata.delimiter).toBe(',');
  });

  it('returns unknown for unrecognizable content', () => {
    const result = detectFormat('mystery', 'just some random text');
    expect(result.format).toBe('unknown');
    expect(result.confidence).toBe(0);
  });

  it('handles Uint8Array content for XLSX', () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]);
    const result = detectFormat('file.xlsx', bytes);
    expect(result.format).toBe('xlsx');
    expect(result.confidence).toBe(1.0);
  });
});

// ── Unit tests: detectDelimiter ─────────────────────────────────────

describe('detectDelimiter', () => {
  it('detects comma as delimiter', () => {
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
  });

  it('detects semicolon as delimiter', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
  });

  it('detects tab as delimiter', () => {
    expect(detectDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
  });

  it('detects pipe as delimiter', () => {
    expect(detectDelimiter('a|b|c\n1|2|3')).toBe('|');
  });

  it('defaults to comma for empty input', () => {
    expect(detectDelimiter('')).toBe(',');
  });

  it('handles quoted fields with commas inside', () => {
    const text = '"last, first",age,city\n"Doe, John",30,NYC';
    expect(detectDelimiter(text)).toBe(',');
  });
});
